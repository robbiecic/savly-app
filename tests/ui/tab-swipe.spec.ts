import { expect, test, type Page } from '@playwright/test';
import { countryCurrencyCodes } from '../../src/data/country-catalog';

async function drag(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();
}

async function touchDrag(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  const device = await page.context().newCDPSession(page);
  await device.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y: fromY, id: 1 }] });
  for (let step = 1; step <= 12; step++) {
    await device.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
      x: fromX + (toX - fromX) * step / 12, y: fromY + (toY - fromY) * step / 12, id: 1,
    }] });
  }
  await device.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await device.detach();
}

test('Swipes switch Calculate and Saved without losing the draft', async ({ page }) => {
  await page.route('https://api.frankfurter.dev/v2/rates?*', async route => {
    const base = new URL(route.request().url()).searchParams.get('base')!;
    await route.fulfill({ json: countryCurrencyCodes.filter(quote => quote !== base).map(quote => ({
      date: '2026-11-15', base, quote, rate: 1,
    })) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try it out', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Calculate' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('textbox', { name: 'Shopping price (EUR)' }).fill('120');
  await drag(page, 335, 182, 95, 180);
  await expect(page.getByRole('tab', { name: 'Saved' })).toHaveAttribute('aria-selected', 'true');
  await touchDrag(page, 70, 180, 330, 182);
  await expect(page.getByRole('tab', { name: 'Calculate' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: 'Shopping price (EUR)' })).toHaveValue('120');
  await drag(page, 250, 600, 240, 780);
  await expect(page.getByRole('tab', { name: 'Calculate' })).toHaveAttribute('aria-selected', 'true');
});
