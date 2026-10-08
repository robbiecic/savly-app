import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionStore, type SessionStorage } from '../src/auth/session-store';
import { SessionExpiredError, refreshSession, resolveCognitoConfig, type Session } from '../src/auth/cognito';

const original: Session = { accessToken: 'access', refreshToken: 'refresh', expiresAt: 2000, user: { sub: 'traveler' } };
function disk() {
  let value: string | null = null;
  const storage: SessionStorage = { read: async () => value, write: async next => { value = next; }, clear: async () => { value = null; } };
  return storage;
}

test('secure session survives restart and explicit sign-out removes it', async () => {
  const storage = disk();
  const first = new SessionStore(storage, 'client', async s => s, () => {}, () => 1000);
  await first.accept(original);
  let restored: Session | null = null;
  const second = new SessionStore(storage, 'client', async () => { throw Error('must not refresh'); }, s => { restored = s; }, () => 1000);
  await second.restore();
  assert.deepEqual(restored, original);
  await second.signOut();
  assert.equal(restored, null);
  assert.equal(await storage.read(), null);
});

test('expired sessions refresh once across concurrent requests and persist rotated credentials', async () => {
  const storage = disk();
  const next = { ...original, refreshToken: 'rotated', expiresAt: 10000 };
  let calls = 0;
  const store = new SessionStore(storage, 'client', async () => { calls++; return next; }, () => {}, () => 3000);
  await store.accept(original);
  await Promise.all([store.refresh(), store.refresh()]);
  assert.equal(calls, 1);
  const reopened = new SessionStore(storage, 'client', async s => s, () => {}, () => 3000);
  await reopened.restore();
  assert.deepEqual(reopened.session, next);
});

test('offline restoration retains credentials and retries; revoked credentials are removed', async () => {
  const storage = disk();
  const first = new SessionStore(storage, 'client', async s => s, () => {});
  await first.accept(original);
  let unavailable = true;
  const store = new SessionStore(storage, 'client', async () => {
    if (unavailable) throw Error('offline');
    throw new SessionExpiredError();
  }, () => {}, () => 3000);
  await assert.rejects(store.restore());
  assert.ok(await storage.read());
  unavailable = false;
  await store.refresh();
  assert.equal(await storage.read(), null);
  assert.equal(store.session, null);
});

test('sign-out during refresh prevents a late result from restoring the account', async () => {
  const storage = disk();
  let finish!: (s: Session) => void;
  const store = new SessionStore(storage, 'client', () => new Promise(resolve => { finish = resolve; }), () => {});
  await store.accept(original);
  const refresh = store.refresh();
  await store.signOut();
  finish({ ...original, accessToken: 'late' });
  await refresh;
  assert.equal(store.session, null);
  assert.equal(await storage.read(), null);
});

test('wrong client and corrupt records cannot restore an identity', async () => {
  for (const raw of ['broken', JSON.stringify({ scope: 'other', session: original }), JSON.stringify({ scope: 'client', session: { user: {} } })]) {
    const storage = disk();
    await storage.write(raw);
    const store = new SessionStore(storage, 'client', async s => s, () => {});
    await store.restore();
    assert.equal(store.session, null);
    assert.equal(await storage.read(), null);
  }
});

test('storage failures never report successful persistence or sign-out', async () => {
  const storage = disk();
  const store = new SessionStore(storage, 'client', async s => s, () => {});
  storage.write = async () => { throw Error('locked'); };
  await assert.rejects(store.accept(original));
  assert.equal(store.session, null);
  const working = disk();
  const signedIn = new SessionStore(working, 'client', async s => s, () => {});
  await signedIn.accept(original);
  working.clear = async () => { throw Error('locked'); };
  await assert.rejects(signedIn.signOut());
  assert.deepEqual(signedIn.session, original);
});

const config = resolveCognitoConfig({ development: true });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
test('Cognito refresh sends the saved token, verifies identity and retains or rotates the refresh token', async () => {
  for (const rotated of [undefined, 'rotated']) {
    const fetcher = (async (url: string, init?: RequestInit) => {
      if (url.includes('openid-configuration')) return json({ issuer: config.authority });
      if (url.endsWith('/token')) {
        const body = new URLSearchParams(init?.body as string);
        assert.equal(body.get('grant_type'), 'refresh_token');
        assert.equal(body.get('refresh_token'), 'refresh');
        assert.equal(body.get('client_id'), config.clientId);
        assert.equal(body.has('client_secret'), false);
        return json({ access_token: 'new-access', refresh_token: rotated, token_type: 'Bearer', expires_in: 3600 });
      }
      assert.deepEqual(init?.headers, { Authorization: 'Bearer new-access' });
      return json({ sub: 'traveler' });
    }) as typeof fetch;
    const next = await refreshSession(config, original, fetcher, () => 3000);
    assert.equal(next.refreshToken, rotated ?? 'refresh');
    assert.equal(next.expiresAt, 3603000);
  }
});

test('Cognito distinguishes revoked refresh tokens from temporary network/server failures', async () => {
  for (const [error, status, revoked] of [['invalid_grant', 400, true], ['server_error', 503, false]] as const) {
    const fetcher = (async (url: string) => url.includes('openid-configuration')
      ? json({ issuer: config.authority }) : json({ error }, status)) as typeof fetch;
    await assert.rejects(refreshSession(config, original, fetcher), e => (e instanceof SessionExpiredError) === revoked);
  }
});

test('cold start renews an expired saved session before exposing the identity', async () => {
  const storage = disk();
  await storage.write(JSON.stringify({ scope: 'client', session: original }));
  const published: Session[] = [];
  const next = { ...original, accessToken: 'renewed', expiresAt: 10000 };
  const store = new SessionStore(storage, 'client', async () => next, s => { if (s) published.push(s); }, () => 3000);
  await store.restore();
  assert.deepEqual(published, [next]);
  assert.equal(JSON.parse((await storage.read())!).session.accessToken, 'renewed');
});

test('sign-out waits for an in-progress secure write, then removes the session', async () => {
  const storage = disk();
  const write = storage.write;
  let release!: () => void;
  storage.write = async value => { await new Promise<void>(resolve => { release = resolve; }); await write(value); };
  const published: (Session | null)[] = [];
  const store = new SessionStore(storage, 'client', async s => s, s => published.push(s));
  const saving = store.accept(original);
  await Promise.resolve();
  const leaving = store.signOut();
  release();
  await Promise.all([saving, leaving]);
  assert.deepEqual(published, [null]);
  assert.equal(await storage.read(), null);
});

test('renewal rejects a different identity', async () => {
  const fetcher = (async (url: string) => {
    if (url.includes('openid-configuration')) return json({ issuer: config.authority });
    if (url.endsWith('/token')) return json({ access_token: 'new', token_type: 'Bearer', expires_in: 3600 });
    return json({ sub: 'other-account' });
  }) as typeof fetch;
  await assert.rejects(refreshSession(config, original, fetcher), SessionExpiredError);
});

test('foreground renewal cannot start while secure sign-out is deleting credentials', async () => {
  const storage = disk();
  let release!: () => void;
  const clear = storage.clear;
  storage.clear = async () => { await new Promise<void>(resolve => { release = resolve; }); await clear(); };
  let renewals = 0;
  const store = new SessionStore(storage, 'client', async s => { renewals++; return s; }, () => {});
  await store.accept(original);
  const leaving = store.signOut();
  await Promise.resolve();
  await store.refresh();
  assert.equal(renewals, 0);
  release();
  await leaving;
  assert.equal(await storage.read(), null);
});
