import { test, expect, type Page } from '@playwright/test';

async function openCompare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
}

async function calculate(page: Page) {
  await page.getByRole('button', { name: 'Calculate savings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your savings', exact: true })).toBeVisible();
}
async function back(page: Page) {
  await page.getByRole('button', { name: /^Back to (calculator|saved comparisons)$/ }).click();
}
async function setHomeCountry(page: Page, country: string) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /^Home country:/ }).click();
  await page.getByRole('textbox', { name: 'Search home country', exact: true }).fill(country);
  await page.getByRole('button', { name: country, exact: true }).click();
  await page.getByRole('button', { name: 'Back to calculator', exact: true }).click();
}

async function comparison(page: Page) {
  await openCompare(page);
  await setHomeCountry(page, 'United States');
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('150');
  await expect(page.getByRole('heading', { name: 'Your savings', exact: true })).toHaveCount(0);
  await calculate(page);
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toHaveCount(0);
  await expect(page.getByText('You could save $33.84', { exact: true })).toBeVisible();
}

test('AC12–15: submitted result, automatic assumptions, no card fee and restart settings', async ({ page }) => {
  await comparison(page);
  await page.getByRole('button', { name: 'Expand details', exact: true }).click();
  await expect(page.getByText('USD 116.16', { exact: true })).toBeVisible();
  await expect(page.getByText('1 EUR = 1.1 USD · Default FX rate', { exact: true })).toBeVisible();
  await back(page);
  await expect(page.getByRole('button', { name: 'Edit assumptions', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Additional bank fee (%)', exact: true })).toHaveCount(0);
  await calculate(page);
  await expect(page.getByText('You could save $33.84', { exact: true })).toBeVisible();
  await back(page);
  await expect(page.getByRole('textbox', { name: /Manual FX|Manual refund/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset FX and refund to automatic', exact: true })).toHaveCount(0);
  await calculate(page);
  await page.getByRole('button', { name: 'Expand details', exact: true }).click();
  await expect(page.getByText('USD 116.16', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await calculate(page);
  await expect(page.getByRole('heading', { name: 'Your savings', exact: true })).toBeVisible();
  await back(page);
  await expect(page.getByRole('button', { name: 'Edit assumptions', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Additional bank fee (%)', exact: true })).toHaveCount(0);
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
  await expect.poll(() => page.evaluate(() => (window as unknown as { sharedText: string }).sharedText)).toContain('USD 33.84 (22.6%)');
  await page.getByRole('button', { name: 'Expand details', exact: true }).click();
  await expect(page.getByText('USD 116.16', { exact: true })).toBeVisible();
  await expect(page.getByText('Sharing couldn’t open. Please try again.', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/delivered/i)).toHaveCount(0);
});

test('Equal and unfavorable comparisons', async ({ page }) => {
  await comparison(page);
  await back(page);
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('100');
  await calculate(page);
  await expect(page.getByText('Costs $16.16 more', { exact: true })).toBeVisible();
  await back(page);
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('116.16');
  await calculate(page);
  await expect(page.getByText('Same estimated cost', { exact: true })).toBeVisible();
  await back(page);
});

test('Missing home price and automatic price updates', async ({ page }) => {
  await comparison(page);
  await back(page);
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('');
  await calculate(page);
  await page.getByRole('button', { name: 'Expand details', exact: true }).click();
  await expect(page.getByText('Add a home price to compare potential savings.', { exact: true })).toBeVisible();
  await back(page);
  await expect(page.getByRole('button', { name: 'Edit assumptions', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('100');
  await calculate(page);
  await page.getByRole('button', { name: 'Expand details', exact: true }).click();
  await expect(page.getByText('USD 110.00', { exact: true }).first()).toBeVisible();
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

test('Refreshing the cache does not make dated default FX fresh', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('savly:preferences:1', JSON.stringify({ version: 1, country: 'FR', homeCurrency: 'USD', residence: 'US', feePercent: '0' }));
    localStorage.setItem('savly:reference:1:prototype:sample:guest-2', JSON.stringify({
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
  await expect(page.getByText('FX rates are stale. Premium and sign-in enable API rates.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'FX rate is stale' })).toHaveCount(0);
  await expect(page.getByText('USD 116.16', { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { storageBlocked: boolean }).storageBlocked = false; });
  await back(page);
  await page.getByRole('button', { name: 'Retry rates', exact: true }).click();
  await calculate(page);
  await expect(page.getByText('FX rates are stale. Premium and sign-in enable API rates.', { exact: true })).toBeVisible();
});

test('Unknown refund and missing FX never invent a total; invalid input hides sharing', async ({ page }) => {
  await openCompare(page);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await setHomeCountry(page, 'France');
  await calculate(page);
  await expect(page.getByText('EUR 105.60', { exact: true })).toBeVisible();
  await back(page);
  await setHomeCountry(page, 'Japan');
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
  await expect(page.getByText('USD 116.16', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Corrupt saved settings recover with defaults without an unhandled error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('savly:preferences:1', '{broken');
  });
  await openCompare(page);
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toBeVisible();
  await expect(page.getByLabel('Home country: Not set', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Welcome screen offers sign-in and guest entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Shop the world. Discover what you could save.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/savly-welcome-390.png' });
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try it out', exact: true })).toHaveCount(0);
});

test('Home country selects currency automatically and migrates saved currency choices', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('savly:preferences:1')) localStorage.setItem('savly:preferences:1', JSON.stringify({
      version: 1, country: 'FR', residence: 'US', homeCurrency: 'GBP', feePercent: '0'
    }));
  });
  await openCompare(page);
  await expect(page.getByRole('textbox', { name: 'Home price (USD)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Home currency:/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('150');
  await setHomeCountry(page, 'France');
  await expect(page.getByRole('textbox', { name: 'Home price (EUR)', exact: true })).toHaveValue('');
  await page.reload();
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Home price (EUR)', exact: true })).toBeVisible();
});

test('Save persists the displayed snapshot and supports reopening and deletion', async ({ page }) => {
  await comparison(page);
  await page.getByRole('textbox', { name: 'Name for saved comparison', exact: true }).fill('Travel bag');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved on this device', exact: true })).toBeDisabled();
  await back(page);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('999');
  await page.reload();
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  await page.getByRole('button', { name: 'Open Travel bag', exact: true }).click();
  await expect(page.getByText('USD 116.16', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('tab', { name: 'Scan', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  await expect(page.getByText('No saved comparisons yet.')).toBeVisible();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true })).toHaveValue('123');
});

test('AC19 Spain worked example shows stale FX, gross refund, fee, net refund and savings', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('savly:preferences:1', JSON.stringify({ version: 1, country: 'ES', homeCurrency: 'USD', residence: 'US', feePercent: '0' }));
    localStorage.setItem('savly:reference:1:prototype:sample:guest-2', JSON.stringify({
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
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('500');
  await calculate(page);
  for (const label of ['You could save USD 56.92', 'login to get accurate rates', 'USD -6.36',
    'Net VAT refund (estimate)', 'USD 87.88', 'Refund fee (28% assumed)', '−USD 24.61', 'USD 63.27', 'USD 443.08']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Rate details & assumptions', exact: true }).click();
  await expect(page.getByText('Calculated from USDEUR at 0.8887.', { exact: true })).toBeVisible();
});

test('Item photo can be added, removed, saved and reopened after reload', async ({ page }) => {
  await comparison(page);
  await page.getByRole('textbox', { name: 'Name for saved comparison', exact: true }).fill('Photo bag');
  await expect(page.getByRole('button', { name: 'Take photo', exact: true })).toBeVisible();
  const addPhoto = async () => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add photo', exact: true }).click();
    await (await chooser).setFiles('assets/favicon.png');
    await expect(page.getByRole('img', { name: 'Photo of Photo bag', exact: true })).toBeVisible();
  };
  await addPhoto();
  await page.getByRole('button', { name: 'View photo of Photo bag', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Full-screen photo of Photo bag', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'Close photo', exact: true })).toBeInViewport();
  await expect(page.getByRole('img', { name: 'Full-screen photo of Photo bag', exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Close photo', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Full-screen photo of Photo bag', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Photo of Photo bag', exact: true })).toHaveCount(0);
  await addPhoto();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved on this device', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Photo of Photo bag', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Photo bag', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Photo of Photo bag', exact: true })).toBeVisible();
  await expect(page.getByText('You could save USD 33.84', { exact: true })).toBeVisible();
});

test('Rotation reflows welcome, calculator and savings while retaining the draft', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  const welcomeBrand = await page.getByLabel('Savly', { exact: true }).boundingBox();
  const welcomeHeading = await page.getByRole('heading').boundingBox();
  expect(welcomeHeading!.x).toBeGreaterThan(welcomeBrand!.x + welcomeBrand!.width);
  await expect(page.getByRole('button', { name: 'Try it out', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/savly-welcome-landscape.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await comparison(page);
  await back(page);
  await expect(page.getByRole('textbox', { name: 'Item name (optional)', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 844, height: 390 });
  const shopping = page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true });
  const home = page.getByRole('textbox', { name: 'Home price (USD)', exact: true });
  await expect(shopping).toHaveValue('120');
  await expect(home).toHaveValue('150');
  const left = await shopping.boundingBox(); const right = await home.boundingBox();
  expect(right!.x).toBeGreaterThan(left!.x + left!.width);
  await shopping.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/savly-calculator-landscape.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await calculate(page);
  await expect(page.getByText('You could save USD 33.84', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Name for saved comparison', exact: true }).fill('Landscape bag');
  await page.getByRole('textbox', { name: 'Name for saved comparison', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/savly-result-landscape.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('textbox', { name: 'Name for saved comparison', exact: true })).toHaveValue('Landscape bag');
  await back(page);
  await expect(home).toHaveValue('150');
  await expect(page.getByRole('textbox', { name: 'Item name (optional)', exact: true })).toHaveCount(0);
});

test('Startup identifies defaults without prototype branding or a premature stale-rate warning', async ({ page }) => {
  await openCompare(page);
  await expect(page.getByText('SAMPLE PROTOTYPE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Using built-in default countries, VAT and FX rates.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: /FX rate.*stale/ })).toHaveCount(0);
});

test('Settings owns home country; fixed flag follows calculations and persists after reload', async ({ page }) => {
  await openCompare(page);
  await expect(page.getByRole('button', { name: /^Home country:/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Country of residence:/ })).toHaveCount(0);
  await setHomeCountry(page, 'United States');
  const badge = page.getByLabel('Home country: United States', { exact: true });
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('🇺🇸');
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('150');
  await page.getByRole('button', { name: 'Calculate savings', exact: true }).scrollIntoViewIfNeeded();
  await expect(badge).toBeInViewport();
  await calculate(page);
  await expect(badge).toBeInViewport();
  await expect(page.getByText('You could save USD 33.84', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await expect(badge).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Home price (USD)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.screenshot({ path: 'test-results/savly-settings.png' });
});

test('Savings lead the result; VAT is assumed refundable regardless of home country', async ({ page }) => {
  await comparison(page);
  const savings = page.getByText('You could save USD 33.84', { exact: true });
  await expect(savings).toBeInViewport();
  const summaryBounds = await savings.boundingBox();
  const warningBounds = await page.getByText('login to get accurate rates', { exact: true }).boundingBox();
  expect(summaryBounds!.y).toBeLessThan(warningBounds!.y);
  await back(page);
  await setHomeCountry(page, 'France');
  await page.getByRole('textbox', { name: 'Home price (EUR)', exact: true }).fill('150');
  await calculate(page);
  await expect(page.getByText('You could save EUR 44.40', { exact: true })).toBeInViewport();
  await expect(page.getByText('Assumes all included VAT is refundable', { exact: false })).toBeVisible();
});

test('Null VAT still shows cheaper and more expensive overseas comparisons', async ({ page }) => {
  await openCompare(page);
  await setHomeCountry(page, 'France');
  await page.getByRole('button', { name: 'Shopping country: France · EUR', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search shopping country', exact: true }).fill('United States');
  await page.getByRole('button', { name: 'United States · USD', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search shopping country', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Shopping price (USD)', exact: true }).fill('110');
  await page.getByRole('textbox', { name: 'Home price (EUR)', exact: true }).fill('120');
  await expect(page.getByRole('textbox', { name: 'Shopping price (USD)', exact: true })).toHaveValue('110');
  await expect(page.getByRole('textbox', { name: 'Home price (EUR)', exact: true })).toHaveValue('120');
  await calculate(page);
  await expect(page.getByText('You could save EUR 20.00', { exact: true })).toBeVisible();
  await expect(page.getByText('Compared without a VAT refund.', { exact: true })).toBeVisible();
  await expect(page.getByText('VAT refund unavailable: no VAT rate supplied.', { exact: false })).toBeVisible();
  await back(page);
  await page.getByRole('textbox', { name: 'Home price (EUR)', exact: true }).fill('80');
  await calculate(page);
  await expect(page.getByText('Costs EUR 20.00 more', { exact: true })).toBeVisible();
});

test('numeric fields group thousands during typing and retain decimals', async ({ page }) => {
  await openCompare(page);
  await setHomeCountry(page, 'United States');
  const shopping = page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true });
  const home = page.getByRole('textbox', { name: 'Home price (USD)', exact: true });
  await shopping.fill('');
  await shopping.pressSequentially('12345.67', { delay: 50 });
  await expect(shopping).toHaveValue('12,345.67');
  await shopping.press('Backspace');
  await expect(shopping).toHaveValue('12,345.6');
  await home.pressSequentially('20000', { delay: 50 });
  await expect(home).toHaveValue('20,000');
  await expect(page.getByRole('button', { name: 'Edit assumptions', exact: true })).toHaveCount(0);
  await calculate(page);
  await back(page);
  await expect(shopping).toHaveValue('12,345.6');
  await expect(home).toHaveValue('20,000');
});
