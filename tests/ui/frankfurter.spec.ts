import { expect, test } from '@playwright/test';
import { countryCurrencyCodes } from '../../src/data/country-catalog';

test('Frankfurter fetches by home currency and reuses the four-hour local cache', async ({ page }) => {
  const calls: string[] = [];
  await page.route('https://api.frankfurter.dev/v2/rates?*', async route => {
    const base = new URL(route.request().url()).searchParams.get('base')!;
    calls.push(base);
    const rows = countryCurrencyCodes.filter(quote => quote !== base).map(quote => ({
      date: '2026-11-15', base, quote, rate: base === 'USD' && quote === 'EUR' ? 0.8 : 1,
    }));
    await route.fulfill({ json: rows });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await expect(page.getByText('Start calculating your savings with FX rates and VAT refunds taken care for you.')).toBeVisible();
  await expect.poll(() => calls).toEqual(['EUR']);

  async function home(country: string) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /^Home country:/ }).click();
    await page.getByRole('textbox', { name: 'Search home country', exact: true }).fill(country);
    await page.getByRole('button', { name: country, exact: true }).click();
    await page.getByRole('button', { name: 'Back to calculator', exact: true }).click();
  }
  await home('United States');
  await expect.poll(() => calls).toEqual(['EUR', 'USD']);
  await page.getByRole('textbox', { name: 'Shopping price (EUR)', exact: true }).fill('120');
  await page.getByRole('textbox', { name: 'Home price (USD)', exact: true }).fill('200');
  await page.getByRole('button', { name: 'Calculate savings', exact: true }).click();
  await expect(page.getByText('Estimated cost', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand details', exact: true }).click();
  await expect(page.getByText('1 EUR = 1.25 USD · FX rate', { exact: true })).toBeVisible();
  await expect(page.getByText('FX rate date: 2026-11-15', { exact: true })).toBeVisible();
  await expect(page.getByText('Frankfurter', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to calculator', exact: true }).click();

  await home('France');
  await expect.poll(() => calls).toEqual(['EUR', 'USD']);
  await home('United States');
  await expect.poll(() => calls).toEqual(['EUR', 'USD']);
  await page.reload();
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await expect(page.getByText('Start calculating your savings with FX rates and VAT refunds taken care for you.')).toBeVisible();
  expect(calls).toEqual(['EUR', 'USD']);

  await home('United Arab Emirates');
  await expect.poll(() => calls).toEqual(['EUR', 'USD', 'AED']);
  await expect(page.getByRole('textbox', { name: 'Home price (AED)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Shopping country:/ }).click();
  await page.getByRole('textbox', { name: 'Search shopping country', exact: true }).fill('United Arab Emirates');
  await page.getByRole('button', { name: 'United Arab Emirates · AED', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Shopping price (AED)', exact: true })).toBeVisible();
});
