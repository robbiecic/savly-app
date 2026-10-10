export const CONNECTION_ERROR = "Can't connect right now";
export const EXPO_GO_ERROR = 'Sign-in requires the Savly development app. Open Savly instead of Expo Go.';

export function validateAuthRuntime(platform: string, expoGo: boolean): void {
  if (platform !== 'web' && expoGo) throw new Error(EXPO_GO_ERROR);
}

// Public app identifiers, not secrets. Production must supply its own configuration.
export const developmentCognitoConfig = {
  authority: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_MncSdF1r0',
  client_id: '35vicii2qq71r09bcd0val80lm',
  redirect_uri: 'savly://auth/callback',
  domain: 'https://savly.auth.us-east-1.amazoncognito.com',
  response_type: 'code',
  scope: 'aws.cognito.signin.user.admin email openid phone profile',
} as const;

export type CognitoConfig = {
  authority: string; clientId: string; redirectUri: string; scopes: string[]; domain?: string;
};
export type Endpoints = { authorizationEndpoint: string; tokenEndpoint: string; userInfoEndpoint: string };
export type Session = { authMethod?: 'native'; accessToken: string; refreshToken?: string; expiresAt: number; user: { sub: string; email?: string } };
type Json = Record<string, unknown>;

function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(CONNECTION_ERROR);
  return value as Json;
}

function https(value: unknown): string {
  if (typeof value !== 'string') throw new Error(CONNECTION_ERROR);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error(CONNECTION_ERROR);
  return value;
}

export function resolveCognitoConfig(options: {
  development: boolean; authority?: string; clientId?: string; redirectUri?: string; domain?: string;
}): CognitoConfig {
  const authority = options.authority || (options.development ? developmentCognitoConfig.authority : '');
  const clientId = options.clientId || (options.development ? developmentCognitoConfig.client_id : '');
  if (!clientId || !authority) throw new Error(CONNECTION_ERROR);
  const issuer = new URL(https(authority));
  if (issuer.search) throw new Error(CONNECTION_ERROR);
  return {
    authority: authority.replace(/\/$/, ''), clientId,
    redirectUri: options.redirectUri || developmentCognitoConfig.redirect_uri,
    scopes: developmentCognitoConfig.scope.split(' '),
    domain: options.domain || (options.development ? developmentCognitoConfig.domain : undefined),
  };
}

// Never send an authorization code to the example.com placeholder or a different web origin.
export function validateRedirect(redirectUri: string, platform: string, webOrigin?: string): void {
  const url = new URL(redirectUri);
  if (url.username || url.password || url.search || url.hash) throw new Error(CONNECTION_ERROR);
  if (platform === 'web') {
    if (!webOrigin || url.origin !== webOrigin ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) {
      throw new Error(CONNECTION_ERROR);
    }
  } else if (redirectUri !== 'savly://auth/callback') {
    throw new Error(CONNECTION_ERROR);
  }
}

async function connectionRequest<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error(CONNECTION_ERROR)); }, timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error;
    // Do not expose tokens, callback codes, provider responses, or network details in the UI/logs.
    throw new Error(CONNECTION_ERROR);
  } finally { clearTimeout(timer); }
}

export async function requestJson(url: string, init: RequestInit = {}, fetcher: typeof fetch = fetch, timeoutMs = 10000): Promise<Json> {
  return connectionRequest(async signal => {
    const response = await fetcher(url, { ...init, signal });
    if (!response.ok) throw new Error(CONNECTION_ERROR);
    return object(await response.json());
  }, timeoutMs);
}

// Native fetch can check the managed login page before handing control to the browser.
// Web cannot do this because Cognito's authorization endpoint does not allow CORS.
export async function checkLoginPage(url: string, fetcher: typeof fetch = fetch): Promise<void> {
  await connectionRequest(async signal => {
    const response = await fetcher(url, { signal, credentials: 'omit' });
    if (!response.ok) throw new Error(CONNECTION_ERROR);
  }, 10000);
}

export async function discover(config: CognitoConfig, fetcher: typeof fetch = fetch): Promise<Endpoints> {
  const document = await requestJson(`${config.authority}/.well-known/openid-configuration`, {}, fetcher);
  if (document.issuer !== config.authority) throw new Error(CONNECTION_ERROR);
  if (config.domain) {
    const domain = new URL(https(config.domain));
    if (domain.pathname !== '/' || domain.search) throw new Error(CONNECTION_ERROR);
    return {
      authorizationEndpoint: `${domain.origin}/oauth2/authorize`,
      tokenEndpoint: `${domain.origin}/oauth2/token`,
      userInfoEndpoint: `${domain.origin}/oauth2/userInfo`,
    };
  }
  const endpoints = {
    authorizationEndpoint: https(document.authorization_endpoint),
    tokenEndpoint: https(document.token_endpoint),
    userInfoEndpoint: https(document.userinfo_endpoint),
  };
  // Some Cognito discovery documents expose issuer-host URLs instead of usable login URLs.
  // Fail in Savly instead of opening an AWS JSON error page.
  if (new URL(endpoints.authorizationEndpoint).host === new URL(config.authority).host ||
    new Set(Object.values(endpoints).map(value => new URL(value).origin)).size !== 1) {
    throw new Error(CONNECTION_ERROR);
  }
  return endpoints;
}

export async function completeSignIn(options: {
  config: CognitoConfig; endpoints: Endpoints; expectedState: string; codeVerifier: string;
  result: { type: string; params?: Record<string, string> }; fetcher?: typeof fetch; now?: () => number;
}): Promise<Session | null> {
  const { result, config, endpoints, expectedState, codeVerifier, fetcher = fetch, now = Date.now } = options;
  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success' || !expectedState || !codeVerifier || !result.params?.code ||
    result.params.state !== expectedState || result.params.error) throw new Error(CONNECTION_ERROR);
  const issuedAt = now();
  const tokens = await requestJson(endpoints.tokenEndpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId,
      redirect_uri: config.redirectUri, code: result.params.code, code_verifier: codeVerifier }).toString(),
  }, fetcher);
  return sessionFromTokens(tokens, endpoints, fetcher, issuedAt, now);
}

async function sessionFromTokens(tokens: Json, endpoints: Endpoints, fetcher: typeof fetch, issuedAt: number, now: () => number): Promise<Session> {
  if (typeof tokens.access_token !== 'string' || !tokens.access_token || tokens.token_type !== 'Bearer' ||
    typeof tokens.expires_in !== 'number' || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) {
    throw new Error(CONNECTION_ERROR);
  }
  // Ask Cognito to validate the access token. Do not trust decoded, unverified ID-token claims.
  const user = await requestJson(endpoints.userInfoEndpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }, fetcher);
  const expiresAt = issuedAt + tokens.expires_in * 1000;
  if (typeof user.sub !== 'string' || !user.sub || expiresAt <= now()) throw new Error(CONNECTION_ERROR);
  return { accessToken: tokens.access_token, expiresAt,
    ...(typeof tokens.refresh_token === 'string' && tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}), user: {
    sub: user.sub, ...(typeof user.email === 'string' ? { email: user.email } : {}),
  } };
}

export class SessionExpiredError extends Error {
  constructor() { super('Please sign in again'); }
}

export async function refreshSession(config: CognitoConfig, previous: Session, fetcher: typeof fetch = fetch, now = Date.now): Promise<Session> {
  if (!previous.refreshToken) throw new SessionExpiredError();
  const endpoints = await discover(config, fetcher);
  const issuedAt = now();
  const tokens = await connectionRequest(async signal => {
    const response = await fetcher(endpoints.tokenEndpoint, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: config.clientId,
        refresh_token: previous.refreshToken! }).toString(),
    });
    const body = object(await response.json());
    if (!response.ok) {
      if (body.error === 'invalid_grant') throw new SessionExpiredError();
      throw new Error(CONNECTION_ERROR);
    }
    return body;
  }, 10000);
  const next = await sessionFromTokens(tokens, endpoints, fetcher, issuedAt, now);
  if (next.user.sub !== previous.user.sub) throw new SessionExpiredError();
  return { ...next, refreshToken: next.refreshToken ?? previous.refreshToken };
}
