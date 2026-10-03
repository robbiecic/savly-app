import { test, expect, type Page } from '@playwright/test';

async function openCompare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
}

async function calculate(page: Page) {
  await page.getByRole('button', { name: 'Calculate savings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your savings', exact: true })).toBeVisible();
}
async function back(page: Page) {
  await page.getByRole('button', { name: /^Back to (calculator|saved comparisons)$/ }).click();
}
async function comparison(page: Page) {
  await openCompare(page);
  await page.getByRole('button', { name: 'Country of residence: Choose country', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search country of residence', exact: true }).fill('United States');
  await page.getByRole('button', { name: 'United States', exact: true }).click();
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await page.getByRole('textbox', { name: 'Home price (USD, optional)', exact: true }).fill('150');
  await expect(page.getByRole('heading', { name: 'Your savings', exact: true })).toHaveCount(0);
  await calculate(page);
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toHaveCount(0);
  await expect(page.getByText('You could save USD 34.50', { exact: true })).toBeVisible();
}

test('AC12–15: submitted result, fee changes, overrides, validation and restart settings', async ({ page }) => {
  await comparison(page);
  await expect(page.getByText('USD 115.50', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rate details & assumptions', exact: true }).click();
  await expect(page.getByText('1 EUR = 1.1 USD · Sample rate', { exact: true })).toBeVisible();
  await back(page);
  await page.getByRole('button', { name: 'Edit assumptions', exact: true }).click();
  await page.getByRole('textbox', { name: 'Additional bank fee (%)', exact: true }).fill('3');
  await calculate(page);
  await expect(page.getByText('You could save USD 30.54', { exact: true })).toBeVisible();
  await back(page);
  await page.getByRole('textbox', { name: 'Manual refund (EUR)', exact: true }).fill('21');
  await expect(page.getByRole('button', { name: 'Share savings', exact: true })).toHaveCount(0);
  await expect(page.getByText('Refund cannot exceed included VAT (EUR 20.00).').first()).toBeVisible();
  await page.getByRole('button', { name: 'Reset FX and refund to automatic', exact: true }).click();
  await calculate(page);
  await expect(page.getByText('USD 119.46', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await calculate(page);
  await expect(page.getByText('USD 119.46', { exact: true })).toBeVisible();
  await back(page);
  await page.getByRole('button', { name: 'Edit assumptions', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Additional bank fee (%)', exact: true })).toHaveValue('3');
});

test('Share payload matches the display; cancellation leaves it intact', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (content: { text: string }) => {
      (window as unknown as { sharedText: string }).sharedText = content.text;
      throw new DOMException('Cancelled', 'AbortError');
    } });
  });
  await comparison(page);
  await page.getByRole('button', { name: 'Share savings', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { sharedText: string }).sharedText)).toContain('USD 34.50 (23.0%)');
  await expect(page.getByText('USD 115.50', { exact: true })).toBeVisible();
  await expect(page.getByText('Sharing couldn’t open. Please try again.', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/delivered/i)).toHaveCount(0);
});

test('Missing, equal, unfavorable comparisons and context override reset', async ({ page }) => {
  await comparison(page);
  await back(page);
  await page.getByRole('textbox', { name: 'Home price (USD, optional)', exact: true }).fill('100');
  await calculate(page);
  await expect(page.getByText('Costs USD 15.50 more', { exact: true })).toBeVisible();
  await back(page);
  await page.getByRole('textbox', { name: 'Home price (USD, optional)', exact: true }).fill('115.50');
  await calculate(page);
  await expect(page.getByText('Same estimated cost', { exact: true })).toBeVisible();
  await back(page);
  await page.getByRole('textbox', { name: 'Home price (USD, optional)', exact: true }).fill('');
  await calculate(page);
  await expect(page.getByText('Add a home price to compare potential savings.', { exact: true })).toBeVisible();
  await back(page);
  await page.getByRole('button', { name: 'Edit assumptions', exact: true }).click();
  await page.getByRole('textbox', { name: 'Manual FX (USD per EUR)', exact: true }).fill('2');
  await calculate(page);
  await expect(page.getByText('USD 210.00', { exact: true })).toBeVisible();
  await back(page);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('100');
  await expect(page.getByRole('textbox', { name: 'Manual FX (USD per EUR)', exact: true })).toHaveValue('');
  await calculate(page);
  await expect(page.getByText('USD 96.25', { exact: true })).toBeVisible();
});

test('Small screen layout and demo landing page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await comparison(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await back(page);
  await page.getByRole('button', { name: 'Shopping country: France · EUR', exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/savly-compare-320.png' });
  await calculate(page);
  await page.getByText('Your savings', { exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/savly-result-320.png' });
  await page.getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/savly-result-actions-320.png' });
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Coming to Android and iOS', exact: true })).toBeVisible();
  await expect(page.getByText('Store downloads are not available yet.', { exact: true })).toBeVisible();
});

test('Stale cached data stays labeled and Retry recovers after storage becomes available', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('savly:preferences:1', JSON.stringify({ version: 1, country: 'FR', homeCurrency: 'USD', residence: 'US', feePercent: '0' }));
    localStorage.setItem('savly:reference:1:prototype:sample', JSON.stringify({
      adapterVersion: 1, environment: 'prototype', mode: 'sample', id: 'old', fetchedAt: Date.now() - 14_400_001,
      rates: [{ pair: 'EURUSD', rate: 1.1, pipSize: 0.0001, source: 'CityIndex', asOf: '2026-09-26T12:00:00Z' }],
      countries: [{ country: 'FR', currency: 'EUR', vatRate: 0.2 }, { country: 'US', currency: 'USD', vatRate: null }],
    }));
    const original = Storage.prototype.setItem;
    (window as unknown as { storageBlocked: boolean }).storageBlocked = true;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('savly:reference') && (window as unknown as { storageBlocked: boolean }).storageBlocked) throw new Error('Storage unavailable');
      return original.call(this, key, value);
    };
  });
  await openCompare(page);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await calculate(page);
  await expect(page.getByText('Sample estimate · Rates out of date', { exact: true })).toBeVisible();
  await expect(page.getByText('USD 115.50', { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { storageBlocked: boolean }).storageBlocked = false; });
  await back(page);
  await page.getByRole('button', { name: 'Retry rates', exact: true }).click();
  await calculate(page);
  await expect(page.getByText('Sample estimate', { exact: true })).toBeVisible();
  await expect(page.getByText('Sample estimate · Rates out of date', { exact: true })).toHaveCount(0);
});

test('Unknown refund and missing FX never invent a total; invalid input hides sharing', async ({ page }) => {
  await openCompare(page);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await page.getByRole('button', { name: 'Country of residence: Choose country', exact: true }).click();
  await page.getByRole('button', { name: 'France', exact: true }).click();
  await calculate(page);
  await expect(page.getByText('Refund estimate unavailable.', { exact: false })).toBeVisible();
  await back(page);
  await page.getByRole('button', { name: /Edit settings/ }).click();
  await page.getByRole('button', { name: 'Country of residence: France', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search country of residence', exact: true }).fill('Japan');
  await page.getByRole('button', { name: 'Japan', exact: true }).click();
  await expect(page.getByText('Conversion unavailable.', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share comparison', exact: true })).toHaveCount(0);
});

test('Calculator starts and computes when optional Intl constructors are unavailable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(Intl, 'DisplayNames', { configurable: true, value: undefined });
    Object.defineProperty(Intl, 'Locale', { configurable: true, value: undefined });
    Object.defineProperty(Intl, 'supportedValuesOf', { configurable: true, value: undefined });
    Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', { configurable: true, value: undefined });
  });
  await comparison(page);
  await expect(page.getByText('USD 115.50', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Unexpected async settings errors are handled and can be retried', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = Intl.NumberFormat.prototype.formatToParts;
    Intl.NumberFormat.prototype.formatToParts = function (...args) {
      // Exercise a failure in the asynchronous initialization callback, once.
      Intl.NumberFormat.prototype.formatToParts = original;
      throw new Error('Simulated settings initialization failure');
    };
  });
  await openCompare(page);
  await expect(page.getByText('Your settings couldn’t load. Please try again.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry loading settings', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Welcome screen matches the entry flow and Sign in remains inactive', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Shop the world. Discover what you could save.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/savly-welcome-390.png' });
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toHaveCount(0);
});

test('Home country selects currency automatically and migrates saved currency choices', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('savly:preferences:1')) localStorage.setItem('savly:preferences:1', JSON.stringify({
      version: 1, country: 'FR', residence: 'US', homeCurrency: 'GBP', feePercent: '0'
    }));
  });
  await openCompare(page);
  await expect(page.getByRole('textbox', { name: 'Home price (USD, optional)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Home currency:/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Home price (USD, optional)', exact: true }).fill('150');
  await page.getByRole('button', { name: /Edit settings/ }).click();
  await page.getByRole('button', { name: 'Country of residence: United States', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search country of residence', exact: true }).fill('France');
  await page.getByRole('button', { name: 'France', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Home price (EUR, optional)', exact: true })).toHaveValue('');
  await page.reload();
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Home price (EUR, optional)', exact: true })).toBeVisible();
});

test('Save persists the displayed snapshot and supports reopening and deletion', async ({ page }) => {
  await comparison(page);
  await page.getByRole('textbox', { name: 'Name for saved comparison', exact: true }).fill('Travel bag');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved on this device', exact: true })).toBeDisabled();
  await back(page);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('999');
  await page.reload();
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  await page.getByRole('button', { name: 'Open Travel bag', exact: true }).click();
  await expect(page.getByText('USD 115.50', { exact: true })).toBeVisible();
  await back(page);
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Travel bag', exact: true }).click();
  await expect(page.getByText('No saved comparisons yet.', { exact: true })).toBeVisible();
});
test('Failed saves remain retryable and do not claim success', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'savly:saved:1') throw new Error('Disk full');
      return original.call(this, key, value);
    };
  });
  await comparison(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Enter an item name to save this comparison.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Name for saved comparison', exact: true }).fill('Bag');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Couldn’t save on this device. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
});

test('Country dropdown precedes tabs; tab switching preserves the calculator draft', async ({ page }) => {
  await openCompare(page);
  const country = page.getByRole('button', { name: 'Shopping country: France · EUR', exact: true });
  const tab = page.getByRole('tab', { name: 'Calculate', exact: true });
  await expect(country).toBeVisible();
  const countryBox = await country.boundingBox();
  const tabBox = await tab.boundingBox();
  expect(countryBox!.y + countryBox!.height).toBeLessThanOrEqual(tabBox!.y);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('123');
  await page.getByRole('tab', { name: 'Scan', exact: true }).click();
  await expect(page.getByText('Scanning is coming soon.')).toBeVisible();
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  await expect(page.getByText('No saved comparisons yet.')).toBeVisible();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toHaveValue('123');
});

test('AC19 Spain worked example shows stale FX, gross refund, fee, net refund and savings', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('savly:preferences:1', JSON.stringify({ version: 1, country: 'ES', homeCurrency: 'USD', residence: 'US', feePercent: '0' }));
    localStorage.setItem('savly:reference:1:prototype:sample', JSON.stringify({
      adapterVersion: 1, environment: 'prototype', mode: 'sample', id: 'spain-example', fetchedAt: Date.now() - 14_400_001,
      rates: [{ pair: 'USDEUR', rate: 0.8887, pipSize: 0.0001, source: 'CityIndex', asOf: '2026-09-26T12:00:00Z' }],
      countries: [{ country: 'ES', currency: 'EUR', vatRate: 0.21 }, { country: 'US', currency: 'USD', vatRate: null }],
    }));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('savly:reference')) throw new Error('Simulated failed refresh');
      return original.call(this, key, value);
    };
  });
  await openCompare(page);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('450');
  await page.getByRole('textbox', { name: 'Home price (USD, optional)', exact: true }).fill('500');
  await calculate(page);
  for (const label of ['You could save USD 56.92', 'Sample estimate · Rates out of date', 'USD -6.36',
    'VAT refund before fee (estimate)', 'USD 87.88', 'Refund fee (28% assumed)', '−USD 24.61',
    'Net VAT refund (estimate)', 'USD 63.27', 'USD 443.08']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Rate details & assumptions', exact: true }).click();
  await expect(page.getByText('Calculated from USDEUR at 0.8887.', { exact: true })).toBeVisible();
});
