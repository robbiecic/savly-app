import { AuthenticationDetails, CognitoUser, CognitoUserPool, type IAuthenticationCallback, type ICognitoStorage } from 'amazon-cognito-identity-js';
import { CONNECTION_ERROR, SessionExpiredError, type CognitoConfig, type Session } from './cognito';

type Json = Record<string, any>;
export class AccountError extends Error {
  constructor(public code: string) { super(accountMessage(code)); }
}
export function accountMessage(code: string): string {
  return ({
    NotAuthorizedException: 'Email or password is incorrect. Please try again.',
    UserNotFoundException: 'Email or password is incorrect. Please try again.',
    UsernameExistsException: 'An account with this email already exists. Sign in or reset your password.',
    InvalidPasswordException: 'Choose a stronger password with uppercase and lowercase letters, a number, and a symbol.',
    CodeMismatchException: 'That code is incorrect. Please try again.',
    ExpiredCodeException: 'That code has expired. Request a new code.',
    TooManyRequestsException: 'Too many attempts. Please wait a little before trying again.',
    LimitExceededException: 'Please wait before requesting another code.',
    InvalidParameterException: 'Check your details and try again.',
    UnsupportedChallenge: 'This account requires an authentication method that is not supported in Savly yet.',
  } as Record<string, string>)[code] ?? CONNECTION_ERROR;
}
export async function accountRequest(config: CognitoConfig, operation: string, body: Json, fetcher: typeof fetch = fetch): Promise<Json> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(new URL(config.authority).origin, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${operation}` },
      body: JSON.stringify(body),
    });
    const value = await response.json();
    if (!response.ok) throw new AccountError(String(value.__type ?? '').split('#').pop()!);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(CONNECTION_ERROR);
    return value;
  } catch (error) { throw error instanceof AccountError ? error : new Error(CONNECTION_ERROR); }
  finally { clearTimeout(timer); }
}
export async function verifiedSession(config: CognitoConfig, tokens: Json, fetcher: typeof fetch = fetch, issuedAt = Date.now()): Promise<Session> {
  if (typeof tokens.AccessToken !== 'string' || !tokens.AccessToken || tokens.TokenType !== 'Bearer' ||
    !Number.isFinite(tokens.ExpiresIn) || tokens.ExpiresIn <= 0) throw new Error(CONNECTION_ERROR);
  const result = await accountRequest(config, 'GetUser', { AccessToken: tokens.AccessToken }, fetcher);
  const attributes = Array.isArray(result.UserAttributes) ? result.UserAttributes : [];
  const sub = attributes.find(a => a.Name === 'sub')?.Value;
  const email = attributes.find(a => a.Name === 'email')?.Value;
  const expiresAt = issuedAt + tokens.ExpiresIn * 1000;
  if (typeof sub !== 'string' || !sub || expiresAt <= Date.now()) throw new Error(CONNECTION_ERROR);
  return { accessToken: tokens.AccessToken, expiresAt, user: { sub, ...(typeof email === 'string' ? { email } : {}) },
    ...(typeof tokens.RefreshToken === 'string' && tokens.RefreshToken ? { refreshToken: tokens.RefreshToken } : {}), authMethod: 'native' };
}
export async function refreshNativeSession(config: CognitoConfig, previous: Session, fetcher: typeof fetch = fetch): Promise<Session> {
  if (!previous.refreshToken) throw new SessionExpiredError();
  try {
    const issuedAt = Date.now();
    const response = await accountRequest(config, 'GetTokensFromRefreshToken', { ClientId: config.clientId, RefreshToken: previous.refreshToken }, fetcher);
    const next = await verifiedSession(config, response.AuthenticationResult ?? {}, fetcher, issuedAt);
    if (next.user.sub !== previous.user.sub) throw new SessionExpiredError();
    return { ...next, refreshToken: next.refreshToken ?? previous.refreshToken };
  } catch (error) {
    if (error instanceof AccountError && ['NotAuthorizedException', 'UserNotFoundException', 'RefreshTokenReuseException'].includes(error.code)) throw new SessionExpiredError();
    throw error;
  }
}
export type Challenge = { kind: 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA' | 'NEW_PASSWORD_REQUIRED'; attributes: string[] };
export type LoginResult = { session: Session } | { challenge: Challenge };

// The SDK performs SRP only. Its token cache is deliberately ephemeral and is
// discarded after each attempt. SessionStore alone owns secure persistence.
export class NativeAccount {
  private user?: CognitoUser;
  private storage: ICognitoStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
  constructor(private config: CognitoConfig) {}
  request(operation: string, body: Json) { return accountRequest(this.config, operation, { ClientId: this.config.clientId, ...body }); }
  signIn(email: string, password: string): Promise<LoginResult> {
    const pool = new CognitoUserPool({ UserPoolId: new URL(this.config.authority).pathname.slice(1), ClientId: this.config.clientId, Storage: this.storage });
    this.user = new CognitoUser({ Username: email, Pool: pool, Storage: this.storage });
    return this.authenticate(callbacks => this.user!.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), callbacks));
  }
  answer(challenge: Challenge, value: string, attributes: Record<string, string>): Promise<LoginResult> {
    if (!this.user) return Promise.reject(new Error(CONNECTION_ERROR));
    return this.authenticate(callbacks => challenge.kind === 'NEW_PASSWORD_REQUIRED'
      ? this.user!.completeNewPasswordChallenge(value, attributes, callbacks)
      : this.user!.sendMFACode(value, callbacks, challenge.kind));
  }
  private authenticate(start: (callbacks: IAuthenticationCallback) => void): Promise<LoginResult> {
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (work: () => void) => { if (!finished) { finished = true; clearTimeout(timer); work(); } };
      const timer = setTimeout(() => finish(() => reject(new Error(CONNECTION_ERROR))), 20000);
      const unsupported = () => finish(() => reject(new AccountError('UnsupportedChallenge')));
      try { start({
        onSuccess: session => {
          if (finished) return;
          void verifiedSession(this.config, { AccessToken: session.getAccessToken().getJwtToken(),
            RefreshToken: session.getRefreshToken().getToken(), TokenType: 'Bearer',
            ExpiresIn: session.getAccessToken().getExpiration() - Math.floor(Date.now() / 1000) })
            .then(value => finish(() => resolve({ session: value })), error => finish(() => reject(error)));
        },
        onFailure: error => finish(() => reject(new AccountError(error.code ?? error.name))),
        newPasswordRequired: (_attributes, required) => finish(() => resolve({ challenge: { kind: 'NEW_PASSWORD_REQUIRED', attributes: Array.isArray(required) ? required : [] } })),
        mfaRequired: () => finish(() => resolve({ challenge: { kind: 'SMS_MFA', attributes: [] } })),
        totpRequired: () => finish(() => resolve({ challenge: { kind: 'SOFTWARE_TOKEN_MFA', attributes: [] } })),
        customChallenge: unsupported, mfaSetup: unsupported, selectMFAType: unsupported,
      }); } catch { finish(() => reject(new Error(CONNECTION_ERROR))); }
    });
  }
}
