import { createHash } from 'node:crypto';
import { expect, test, type BrowserContext } from '@playwright/test';
import { SAMPLE_RESPONSES, type ReferencePath } from '../../src/data/transport';

const authority = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_MncSdF1r0';
const domain = 'https://savly-test.auth.us-east-1.amazoncognito.com';
const callback = 'http://localhost:4174';

async function provider(context: BrowserContext, options: { offline?: boolean; badState?: boolean; rejectedToken?: boolean; holdBrowser?: boolean } = {}) {
  let challenge = '';
  let exchanges = 0;
  await context.route('https://savly-api.example.test/v1/*', async route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization' };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ headers }); return;
    }
    expect(route.request().headers().authorization).toBe('Bearer test-access-token');
    const path = new URL(route.request().url()).pathname as ReferencePath;
    await route.fulfill({ headers, json: SAMPLE_RESPONSES[path] });
  });
  await context.route(`${authority}/.well-known/openid-configuration`, route => options.offline ? route.abort() : route.fulfill({
    json: { issuer: authority }, headers: { 'Access-Control-Allow-Origin': '*' },
  }));
  await context.route(`${domain}/oauth2/authorize?*`, async route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('client_id')).toBe('35vicii2qq71r09bcd0val80lm');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(callback);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('prompt')).toBe('login');
    challenge = url.searchParams.get('code_challenge')!;
    if (options.holdBrowser) { await route.fulfill({ contentType: 'text/html', body: 'Simulated Cognito login' }); return; }
    const destination = new URL(callback);
    destination.searchParams.set('code', 'test-code');
    destination.searchParams.set('state', options.badState ? 'wrong-state' : url.searchParams.get('state')!);
    await route.fulfill({ status: 302, headers: { Location: destination.toString() } });
  });
  await context.route(`${domain}/oauth2/token`, async route => {
    exchanges++;
    const body = new URLSearchParams(route.request().postData()!);
    expect(body.get('redirect_uri')).toBe(callback);
    expect(body.get('code')).toBe('test-code');
    expect(body.has('client_secret')).toBe(false);
    expect(createHash('sha256').update(body.get('code_verifier')!).digest('base64url')).toBe(challenge);
    await route.fulfill({ status: options.rejectedToken ? 400 : 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: options.rejectedToken ? { error: 'invalid_grant' } : { access_token: 'test-access-token', expires_in: 3600, token_type: 'Bearer' },
    });
  });
  await context.route(`${domain}/oauth2/userInfo`, async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization' } }); return;
    }
    expect(route.request().headers().authorization).toBe('Bearer test-access-token');
    await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { sub: 'test-user', email: 'traveler@example.test' } });
  });
  return { exchanges: () => exchanges };
}

test('failed connection allows retry and guest Settings offers only sign-in', async ({ page, context }) => {
  const options = { offline: true };
  await provider(context, options);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText("Can't connect right now");
  options.offline = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Continue to sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Savly' }).click();
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compare a price' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Not signed in', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('PKCE browser return signs in, stays out of storage, and signs out in Settings', async ({ page, context }) => {
  const mock = await provider(context);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Compare a price' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Signed in as traveler@example.test', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  expect(mock.exchanges()).toBe(1);
  const disk = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(disk).not.toContain('test-access-token');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compare a price' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Not signed in', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('Settings sign-in returns to the same form and restart drops the session', async ({ page, context }) => {
  await provider(context);
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await expect(page.getByText('Signed in as traveler@example.test', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to calculator' }).click();
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toHaveValue('120');
  await page.reload();
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Not signed in', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

for (const failure of ['badState', 'rejectedToken'] as const) {
  test(`${failure} shows an error without signing in`, async ({ page, context }) => {
    const mock = await provider(context, { [failure]: true });
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText("Can't connect right now");
    expect(mock.exchanges()).toBe(failure === 'badState' ? 0 : 1);
  });
}

test('closing Cognito cancels without an error or token request', async ({ page, context }) => {
  const mock = await provider(context, { holdBrowser: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await (await popup).close();
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(mock.exchanges()).toBe(0);
});
