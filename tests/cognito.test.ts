import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkLoginPage, completeSignIn, CONNECTION_ERROR, EXPO_GO_ERROR, developmentCognitoConfig, discover, requestJson, validateAuthRuntime,
  resolveCognitoConfig, validateRedirect, type Endpoints } from '../src/auth/cognito';

const config = { ...resolveCognitoConfig({ development: true }), domain: undefined };
const domain = 'https://savly-test.auth.us-east-1.amazoncognito.com';
const endpoints: Endpoints = {
  authorizationEndpoint: `${domain}/oauth2/authorize`, tokenEndpoint: `${domain}/oauth2/token`,
  userInfoEndpoint: `${domain}/oauth2/userInfo`,
};
const discovery = { issuer: config.authority, authorization_endpoint: endpoints.authorizationEndpoint,
  token_endpoint: endpoints.tokenEndpoint, userinfo_endpoint: endpoints.userInfoEndpoint };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const options = { config, endpoints, expectedState: 'request-state', codeVerifier: 'pkce-verifier',
  result: { type: 'success', params: { state: 'request-state', code: 'authorization-code' } }, now: () => 1000 };

test('Expo Go gets a setup explanation instead of a misleading connection failure', () => {
  for (const platform of ['ios', 'android']) {
    assert.throws(() => validateAuthRuntime(platform, true), (error: Error) => error.message === EXPO_GO_ERROR);
    assert.doesNotThrow(() => validateAuthRuntime(platform, false));
  }
  assert.doesNotThrow(() => validateAuthRuntime('web', true));
});

test('Cognito dev client is explicit; release configuration never silently uses it', () => {
  assert.equal(config.authority, developmentCognitoConfig.authority);
  assert.equal(config.clientId, '35vicii2qq71r09bcd0val80lm');
  assert.equal(resolveCognitoConfig({ development: true }).domain, 'https://savly.auth.us-east-1.amazoncognito.com');
  assert.equal(resolveCognitoConfig({ development: true }).redirectUri, 'savly://auth/callback');
  assert.equal(config.scopes.join(' '), developmentCognitoConfig.scope);
  assert.throws(() => resolveCognitoConfig({ development: false }), /Can't connect right now/);
  assert.throws(() => resolveCognitoConfig({ development: false, authority: config.authority }), /Can't connect right now/);
  assert.equal(resolveCognitoConfig({ development: false, authority: config.authority, clientId: 'release-client' }).clientId, 'release-client');
});

test('callbacks must return to Savly, not example.com or another web origin', () => {
  validateRedirect('savly://auth/callback', 'ios');
  validateRedirect('savly://auth/callback', 'android');
  validateRedirect('http://localhost:8081', 'web', 'http://localhost:8081');
  validateRedirect('https://savly.test/auth/callback', 'web', 'https://savly.test');
  for (const [redirect, platform, origin] of [
    ['https://example.com', 'ios'], ['https://example.com', 'web', 'http://localhost:8081'],
    ['exp://localhost', 'android'], ['savly://auth/callback?code=old', 'ios'],
    ['http://remote.test', 'web', 'http://remote.test'],
  ]) assert.throws(() => validateRedirect(redirect, platform, origin), /Can't connect right now/);
});

test('discovery validates the issuer and secure managed-login endpoints', async () => {
  assert.deepEqual(await discover(config, (async () => json(discovery)) as typeof fetch), endpoints);
  assert.deepEqual(await discover({ ...config, domain }, (async () => json({ issuer: config.authority })) as typeof fetch), endpoints);
  for (const bad of [
    { ...discovery, issuer: 'https://wrong-issuer.test' },
    { ...discovery, authorization_endpoint: `${config.authority}/authorize` },
    { ...discovery, token_endpoint: 'http://insecure.test/token' },
    { ...discovery, userinfo_endpoint: 'https://unrelated.test/userInfo' },
    {},
  ]) await assert.rejects(discover(config, (async () => json(bad)) as typeof fetch), /Can't connect right now/);
});

test('code exchange sends PKCE and identical callback, then validates identity through Cognito', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return calls.length === 1
      ? json({ access_token: 'access-token', refresh_token: 'never-persisted', token_type: 'Bearer', expires_in: 3600 })
      : json({ sub: 'user-id', email: 'traveler@example.test' });
  }) as typeof fetch;
  const session = await completeSignIn({ ...options, fetcher });
  assert.deepEqual(session, { accessToken: 'access-token', expiresAt: 3601000,
    user: { sub: 'user-id', email: 'traveler@example.test' } });
  assert.equal(calls[0].url, endpoints.tokenEndpoint);
  assert.equal(calls[0].init?.method, 'POST');
  const body = new URLSearchParams(calls[0].init?.body as string);
  assert.equal(body.get('code_verifier'), 'pkce-verifier');
  assert.equal(body.get('redirect_uri'), 'savly://auth/callback');
  assert.equal(body.get('grant_type'), 'authorization_code');
  assert.equal(body.get('client_id'), config.clientId);
  assert.equal(body.has('client_secret'), false);
  assert.equal(calls[1].url, endpoints.userInfoEndpoint);
  assert.deepEqual(calls[1].init?.headers, { Authorization: 'Bearer access-token' });
});

test('cancel, state mismatch, missing code/verifier, and provider errors never create a session', async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; throw Error('Must not fetch'); }) as typeof fetch;
  for (const type of ['cancel', 'dismiss']) {
    assert.equal(await completeSignIn({ ...options, fetcher, result: { type } }), null);
  }
  for (const result of [
    { type: 'success', params: { code: 'code', state: 'wrong' } },
    { type: 'success', params: { code: '', state: 'request-state' } },
    { type: 'error' }, { type: 'locked' },
  ]) await assert.rejects(completeSignIn({ ...options, fetcher, result }), /Can't connect right now/);
  await assert.rejects(completeSignIn({ ...options, fetcher, codeVerifier: '' }), /Can't connect right now/);
  assert.equal(calls, 0);
});

test('malformed, expired, and rejected tokens do not sign the user in', async () => {
  const valid = { access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 };
  for (const token of [{}, { ...valid, expires_in: 0 }, { ...valid, expires_in: -1 },
    { ...valid, token_type: 'unknown' }, { ...valid, access_token: '' }]) {
    await assert.rejects(completeSignIn({ ...options, fetcher: (async () => json(token)) as typeof fetch }), /Can't connect right now/);
  }
  for (const userResponse of [json({}), json({ sub: 123 }), json({ error: 'invalid token' }, 401)]) {
    let calls = 0;
    await assert.rejects(completeSignIn({ ...options,
      fetcher: (async () => ++calls === 1 ? json(valid) : userResponse) as typeof fetch }), /Can't connect right now/);
  }
  let ticks = 0;
  await assert.rejects(completeSignIn({ ...options, now: () => ++ticks === 1 ? 1000 : 4000000,
    fetcher: (async (url: string) => json(url === endpoints.tokenEndpoint ? valid : { sub: 'user' })) as typeof fetch }), /Can't connect right now/);
});

test('offline, HTTP, JSON, and timeout failures use the exact error without leaking details', async () => {
  for (const fetcher of [
    async () => { throw Error('sensitive provider detail'); },
    async () => json({ secret: 'not for the UI' }, 503),
    async () => new Response('not json'), async () => json([]),
    async () => new Promise<Response>(() => {}),
  ]) await assert.rejects(requestJson(endpoints.tokenEndpoint, {}, fetcher as typeof fetch, 5),
    (error: Error) => error.message === CONNECTION_ERROR);
});

test('native availability check rejects disabled login pages and omits existing cookies', async () => {
  await checkLoginPage(endpoints.authorizationEndpoint, (async (_url, init) => {
    assert.equal(init?.credentials, 'omit');
    return new Response('<html>Sign in</html>');
  }) as typeof fetch);
  await assert.rejects(checkLoginPage(endpoints.authorizationEndpoint, (async () =>
    new Response('Login pages unavailable', { status: 403 })) as typeof fetch), /Can't connect right now/);
  await assert.rejects(checkLoginPage(endpoints.authorizationEndpoint, (async () => {
    throw Error('offline');
  }) as typeof fetch), /Can't connect right now/);
});
