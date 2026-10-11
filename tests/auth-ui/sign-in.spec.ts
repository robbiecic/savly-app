import { expect, test, type BrowserContext, type Page } from '@playwright/test';
const endpoint = 'https://cognito-idp.us-east-1.amazonaws.com/';
const jwt = (claims: object) => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
async function provider(context: BrowserContext, options: { error?: string; challenge?: string; offline?: boolean } = {}) {
  const calls: { operation: string; body: any }[] = [];
  await context.route(endpoint, async route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ headers }); return; }
    if (options.offline) { await route.abort(); return; }
    const operation = route.request().headers()['x-amz-target'].split('.').pop()!;
    const body = route.request().postDataJSON(); calls.push({ operation, body });
    if (options.error && operation !== 'GetUser') {
      await route.fulfill({ status: 400, headers, json: { __type: options.error } }); return;
    }
    const now = Math.floor(Date.now() / 1000);
    const result = { AuthenticationResult: { AccessToken: jwt({ sub: 'user', exp: now + 3600, iat: now }), IdToken: jwt({ sub: 'user', exp: now + 3600, iat: now }), RefreshToken: 'refresh-secret', TokenType: 'Bearer', ExpiresIn: 3600 } };
    let json: object = {};
    if (operation === 'InitiateAuth') {
      expect(body.AuthFlow).toBe('USER_SRP_AUTH');
      expect(body.AuthParameters.SRP_A).toBeTruthy();
      expect(body.AuthParameters.PASSWORD).toBeUndefined();
      json = { ChallengeName: 'PASSWORD_VERIFIER', Session: 'srp-session', ChallengeParameters: { USER_ID_FOR_SRP: 'user', SRP_B: 'abcd1234', SALT: '1234abcd', SECRET_BLOCK: 'c2VjcmV0' } };
    } else if (operation === 'RespondToAuthChallenge') {
      if (body.ChallengeName === 'PASSWORD_VERIFIER') {
        expect(body.ChallengeResponses.PASSWORD_CLAIM_SIGNATURE).toBeTruthy();
        json = options.challenge ? { ChallengeName: options.challenge, Session: 'challenge-session', ChallengeParameters: { userAttributes: '{}', requiredAttributes: '[]' } } : result;
      } else json = result;
    }
    else if (operation === 'GetUser') json = { UserAttributes: [{ Name: 'sub', Value: 'user' }, { Name: 'email', Value: 'traveler@example.test' }] };
    else if (operation === 'SignUp') json = { UserConfirmed: false };
    await route.fulfill({ headers, json });
  });
  await context.route('https://savly-api.example.test/v1/*', route => route.fulfill({ status: 503, json: {} }));
  return calls;
}
async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function credentials(page: Page) {
  await page.getByLabel('Email address', { exact: true }).fill('traveler@example.test');
  await page.getByLabel('Password', { exact: true }).fill('MyPassword123!');
}
async function newPassword(page: Page) {
  await page.getByLabel('New password', { exact: true }).fill('MyNewPassword123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('MyNewPassword123!');
}
test('in-app SRP sign-in, memory-only web session, and sign-out', async ({ page, context }) => {
  const calls = await provider(context);
  await open(page); await credentials(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Compare a price' })).toBeVisible();
  expect(context.pages()).toHaveLength(1);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Signed in as traveler@example.test', { exact: true })).toBeVisible();
  expect(calls.map(c => c.operation)).toEqual(['InitiateAuth', 'RespondToAuthChallenge', 'GetUser']);
  const disk = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(disk).not.toMatch(/refresh-secret|MyPassword|signature/);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try it out', exact: true })).toBeVisible();
});
test('sign-up validates passwords, resends and confirms email without signing in early', async ({ page, context }) => {
  const calls = await provider(context); await open(page);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email address').fill('traveler@example.test'); await newPassword(page);
  await page.getByLabel('Confirm password').fill('different');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.'); expect(calls).toHaveLength(0);
  await page.getByLabel('Confirm password').fill('MyNewPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await page.getByRole('button', { name: 'Resend code' }).click();
  await expect(page.getByText('A new code has been requested. Check your email.')).toBeVisible();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByText('Email verified. You can now sign in.')).toBeVisible();
  expect(calls.map(c => c.operation)).toEqual(['SignUp', 'ResendConfirmationCode', 'ConfirmSignUp']);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});
test('password recovery handles an incorrect code then succeeds', async ({ page, context }) => {
  const options: { error?: string } = {}; const calls = await provider(context, options); await open(page);
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email address').fill('traveler@example.test');
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await page.getByLabel('Verification code').fill('123456'); await newPassword(page);
  options.error = 'CodeMismatchException';
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('alert')).toHaveText('That code is incorrect. Please try again.');
  options.error = undefined;
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByText('Password updated. Sign in with your new password.')).toBeVisible();
  expect(calls.map(c => c.operation)).toEqual(['ForgotPassword', 'ConfirmForgotPassword', 'ConfirmForgotPassword']);
});
for (const challenge of ['SMS_MFA', 'SOFTWARE_TOKEN_MFA', 'NEW_PASSWORD_REQUIRED']) {
  test(`completes ${challenge} inside app`, async ({ page, context }) => {
    const calls = await provider(context, { challenge }); await open(page); await credentials(page);
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Complete sign-in' })).toBeVisible();
    if (challenge === 'NEW_PASSWORD_REQUIRED') await newPassword(page);
    else await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Compare a price' })).toBeVisible();
    expect(calls.filter(c => c.operation === 'RespondToAuthChallenge').at(-1)?.body.ChallengeName).toBe(challenge);
  });
}
test('unconfirmed account leads to verification and connection failure is retryable', async ({ page, context }) => {
  const options = { error: 'UserNotConfirmedException', offline: false }; await provider(context, options);
  await open(page); await credentials(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  options.error = ''; options.offline = true; await credentials(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('alert')).toHaveText("Can't connect right now");
  options.offline = false;
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Compare a price' })).toBeVisible();
});
test('dismissed forms clear passwords and preserve guest access', async ({ page, context }) => {
  await provider(context); await open(page); await credentials(page);
  await page.getByRole('button', { name: 'Back to Savly' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Back to Savly' }).click();
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compare a price' })).toBeVisible();
});

test('Try it out opens restricted mode; Settings signup continues to Premium after verified sign-in', async ({ page, context }) => {
  const calls = await provider(context);
  await page.goto('/');
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compare a price' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calculate savings', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Savly Premium', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Get Savly Premium', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByLabel('Email address').fill('traveler@example.test'); await newPassword(page);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Savly' })).toBeVisible();
  await credentials(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Savly Premium', exact: true })).toBeVisible();
  await expect(page.getByText(/purchases are unavailable here/)).toBeVisible();
  expect(calls.map(c => c.operation)).toEqual(['SignUp', 'ConfirmSignUp', 'InitiateAuth', 'RespondToAuthChallenge', 'GetUser']);
  await page.getByRole('button', { name: 'Back to Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Back to calculator', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Calculate savings', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Get Savly Premium', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Savly Premium', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toHaveCount(0);
});

test('canceling Premium signup clears purchase continuation; restore remains reachable without signup', async ({ page, context }) => {
  await provider(context); await page.goto('/');
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Get Savly Premium', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Savly', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Get Savly Premium', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore purchases', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Savly Premium', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await credentials(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByText('Signed in as traveler@example.test', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Savly Premium', exact: true })).toHaveCount(0);
});

test('default calculations stay unlimited across reload and ignore an exhausted legacy allowance', async ({ page, context }) => {
  await provider(context);
  await page.addInitScript(() => localStorage.setItem('savly:free-calculations:1', JSON.stringify({ version: 1, used: 999 })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await expect(page.getByText(/Unlimited calculations with limited, stale built-in rates/)).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /^Home country:/ }).click();
  await page.getByRole('textbox', { name: 'Search home country', exact: true }).fill('United States');
  await page.getByRole('button', { name: 'United States', exact: true }).click();
  await page.getByRole('button', { name: 'Back to calculator', exact: true }).click();
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('150');
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Calculate savings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your savings', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to calculator', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Calculate savings', exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await page.getByRole('button', { name: 'Calculate savings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your savings', exact: true })).toBeVisible();
});

test('signed-in free users only use bundled reference data and never request the API', async ({ page, context }) => {
  await provider(context);
  const requests: string[] = [];
  page.on('request', request => { if (request.url().startsWith('https://savly-api.example.test/')) requests.push(request.url()); });
  await open(page); await credentials(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByText('Using built-in default countries, VAT and FX rates.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /^Home country:/ }).click();
  await page.getByRole('textbox', { name: 'Search home country', exact: true }).fill('United States');
  await page.getByRole('button', { name: 'United States', exact: true }).click();
  await page.getByRole('button', { name: 'Back to calculator', exact: true }).click();
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('150');
  await page.getByRole('button', { name: 'Calculate savings', exact: true }).click();
  await expect(page.getByText('You could save $33.84', { exact: true })).toBeVisible();
  expect(requests).toEqual([]);
});
