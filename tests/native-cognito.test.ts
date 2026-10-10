import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountRequest, AccountError, refreshNativeSession, verifiedSession } from '../src/auth/native-cognito';
import { resolveCognitoConfig, SessionExpiredError, type Session } from '../src/auth/cognito';
const config = resolveCognitoConfig({ development: true });
const previous: Session = { authMethod: 'native', accessToken: 'old', refreshToken: 'refresh', expiresAt: 1, user: { sub: 'user' } };
const tokens = { AccessToken: 'access', RefreshToken: 'rotated', ExpiresIn: 3600, TokenType: 'Bearer' };
function transport(replies: { status?: number; body: object }[]) {
  const calls: { url: string; operation: string; body: any }[] = [];
  const fetcher = (async (url, init) => {
    calls.push({ url: String(url), operation: (init!.headers as Record<string, string>)['X-Amz-Target'], body: JSON.parse(init!.body as string) });
    const next = replies.shift(); assert.ok(next);
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  }) as typeof fetch;
  return { calls, fetcher };
}
const user = { UserAttributes: [{ Name: 'sub', Value: 'user' }, { Name: 'email', Value: 'person@example.com' }] };
test('native session validates identity with GetUser and keeps rotated refresh credentials', async () => {
  const t = transport([{ body: { AuthenticationResult: tokens } }, { body: user }]);
  const result = await refreshNativeSession(config, previous, t.fetcher);
  assert.equal(result.refreshToken, 'rotated'); assert.equal(result.authMethod, 'native');
  assert.deepEqual(result.user, { sub: 'user', email: 'person@example.com' });
  assert.equal(t.calls[0].url, 'https://cognito-idp.us-east-1.amazonaws.com');
  assert.equal(t.calls[0].operation, 'AWSCognitoIdentityProviderService.GetTokensFromRefreshToken');
  assert.deepEqual(t.calls[0].body, { ClientId: config.clientId, RefreshToken: 'refresh' });
  assert.deepEqual(t.calls[1].body, { AccessToken: 'access' });
});
test('refresh retains original token when rotation is disabled', async () => {
  const t = transport([{ body: { AuthenticationResult: { ...tokens, RefreshToken: undefined } } }, { body: user }]);
  assert.equal((await refreshNativeSession(config, previous, t.fetcher)).refreshToken, 'refresh');
});
test('revoked refresh expires session, temporary failures preserve it', async () => {
  for (const code of ['NotAuthorizedException', 'UserNotFoundException', 'RefreshTokenReuseException']) {
    const t = transport([{ status: 400, body: { __type: code } }]);
    await assert.rejects(refreshNativeSession(config, previous, t.fetcher), SessionExpiredError);
  }
  const t = transport([{ status: 500, body: { __type: 'InternalErrorException', message: 'secret provider detail' } }]);
  await assert.rejects(refreshNativeSession(config, previous, t.fetcher), error => error instanceof AccountError && error.message === "Can't connect right now");
  assert.equal(previous.refreshToken, 'refresh');
});
test('refresh rejects a different account and malformed tokens', async () => {
  const t = transport([{ body: { AuthenticationResult: tokens } }, { body: { UserAttributes: [{ Name: 'sub', Value: 'other' }] } }]);
  await assert.rejects(refreshNativeSession(config, previous, t.fetcher), SessionExpiredError);
  for (const invalid of [{}, { ...tokens, ExpiresIn: -1 }, { ...tokens, TokenType: 'unknown' }]) {
    await assert.rejects(verifiedSession(config, invalid, transport([]).fetcher));
  }
  await assert.rejects(verifiedSession(config, tokens, transport([{ body: {} }]).fetcher));
});
test('provider errors are mapped without exposing raw responses', async () => {
  const t = transport([{ status: 400, body: { __type: 'namespace#CodeMismatchException', message: 'secret' } }]);
  await assert.rejects(accountRequest(config, 'ConfirmSignUp', {}, t.fetcher), error => error instanceof AccountError && error.message === 'That code is incorrect. Please try again.');
});
