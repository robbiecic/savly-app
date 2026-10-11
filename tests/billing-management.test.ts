import test from 'node:test';
import assert from 'node:assert/strict';
import type { CustomerInfo, PurchasesEntitlementInfo, PurchasesStoreProduct } from 'react-native-purchases';
import { premiumPlan, purchasedProductId, safeManagementUrl, subscriptionManagementUrl } from '../src/billing/management';

const now = Date.parse('2026-10-10T12:00:00Z');
const entitlement = (changes: Partial<PurchasesEntitlementInfo> = {}) => ({
  productIdentifier: 'premium', productPlanIdentifier: null, expirationDate: '2026-11-10T12:00:00Z',
  isActive: true, willRenew: true, store: 'APP_STORE', isSandbox: false,
  originalPurchaseDate: '2026-10-10T12:00:00Z', billingIssueDetectedAt: null, ownershipType: 'PURCHASED', periodType: 'NORMAL', ...changes,
} as PurchasesEntitlementInfo);
const customer = (changes: Partial<PurchasesEntitlementInfo> = {}) => ({
  entitlements: { all: { savly_premium: entitlement(changes) } }, managementURL: 'https://apps.apple.com/account/subscriptions',
});
const product = (changes: Partial<Omit<PurchasesStoreProduct, 'productCategory' | 'productType'>> & { productCategory?: string; productType?: string } = {}) => ({ identifier: 'premium', title: 'Savly', subscriptionPeriod: 'P1M', productCategory: 'SUBSCRIPTION', productType: 'AUTO_RENEWABLE_SUBSCRIPTION', ...changes } as PurchasesStoreProduct);

test('owned product determines Monthly or Annual, regardless of available plan order', () => {
  assert.equal(premiumPlan(customer(), [product({ identifier: 'other', subscriptionPeriod: 'P1Y' }), product()], now)?.name, 'Monthly');
  assert.equal(premiumPlan(customer(), [product({ subscriptionPeriod: 'P1Y' })], now)?.name, 'Annual');
  assert.equal(premiumPlan(customer(), [product({ subscriptionPeriod: 'P12M' })], now)?.name, 'Annual');
});

test('Google base plan matching distinguishes annual from monthly on the same product', () => {
  const info = customer({ store: 'PLAY_STORE', productPlanIdentifier: 'yearly' });
  assert.equal(purchasedProductId(info.entitlements.all.savly_premium), 'premium:yearly');
  const plan = premiumPlan(info, [product({ identifier: 'premium:monthly' }), product({ identifier: 'premium:yearly', subscriptionPeriod: 'P1Y' })], now);
  assert.equal(plan?.name, 'Annual');
});

test('lifetime needs matching non-subscription metadata; missing expiry alone never proves lifetime', () => {
  const info = customer({ expirationDate: null, willRenew: false });
  const plan = premiumPlan(info, [product({ subscriptionPeriod: null, productCategory: 'NON_SUBSCRIPTION', productType: 'NON_CONSUMABLE' })], now);
  assert.equal(plan?.name, 'Lifetime');
  assert.equal(plan?.managementUrl, null);
  assert.equal(plan?.expirationDate, null);
  assert.equal(plan?.showCancellation, false);
  assert.equal(premiumPlan(info, [], now)?.lifetime, false);
  assert.equal(premiumPlan(info, [], now)?.name, 'Plan details unavailable');
});

test('canceled renewal retains access until expiry and never shows a renewal promise', () => {
  const info = customer({ willRenew: false });
  const plan = premiumPlan(info, [product()], now);
  assert.equal(plan?.active, true);
  assert.equal(plan?.status, 'Active · Auto-renewal off');
  assert.equal(plan?.dateLabel, 'Access until');
  assert.equal(plan?.showCancellation, false);
  const expired = premiumPlan(info, [product()], Date.parse(info.entitlements.all.savly_premium.expirationDate!));
  assert.equal(expired?.active, false);
  assert.equal(expired?.status, 'Expired');
});

test('trial and billing issue details use entitlement data', () => {
  assert.equal(premiumPlan(customer({ periodType: 'TRIAL' }), [product()], now)?.dateLabel, 'Trial ends on');
  assert.match(premiumPlan(customer({ billingIssueDetectedAt: '2026-10-10' }), [product()], now)!.status, /Billing issue/);
});

test('family-shared access hides cancellation and Test Store stays identifiable', () => {
  assert.equal(premiumPlan(customer({ ownershipType: 'FAMILY_SHARED' }), [product()], now)?.managementUrl, null);
  assert.equal(premiumPlan(customer({ ownershipType: 'FAMILY_SHARED' }), [product()], now)?.showCancellation, false);
  const plan = premiumPlan({ ...customer({ store: 'TEST_STORE', isSandbox: true }), managementURL: null }, [product()], now);
  assert.equal(plan?.testStore, true);
  assert.equal(plan?.managementUrl, null);
  assert.equal(plan?.showCancellation, true);
});

test('Lifetime retains management for a separately active recurring subscription', () => {
  const plan = premiumPlan({ ...customer({ expirationDate: null, willRenew: false }), activeSubscriptions: ['old-monthly'] },
    [product({ subscriptionPeriod: null, productCategory: 'NON_SUBSCRIPTION', productType: 'NON_CONSUMABLE' })], now);
  assert.equal(plan?.lifetime, true);
  assert.equal(plan?.otherSubscriptions, true);
  assert.ok(plan?.managementUrl);
  assert.equal(plan?.showCancellation, true);
});

test('cancellation is offered for renewing subscriptions even when product metadata or store links are missing', () => {
  for (const store of ['APP_STORE', 'PLAY_STORE', 'TEST_STORE'] as const) {
    assert.equal(premiumPlan(customer({ store }), [product()], now)?.showCancellation, true);
    assert.equal(premiumPlan({ ...customer({ store }), managementURL: null }, [], now)?.showCancellation, true);
  }
  assert.equal(premiumPlan(customer({ isActive: false }), [product()], now)?.showCancellation, false);
  assert.equal(premiumPlan(customer(), [product()], Date.parse('2026-12-01T00:00:00Z'))?.showCancellation, false);
});

test('management routes to the purchased subscription URL and rejects unsafe links', () => {
  const info = { ...customer(), subscriptionsByProductIdentifier: { premium: {
    productIdentifier: 'premium', productPlanIdentifier: null, managementURL: 'https://play.google.com/store/account/subscriptions',
  } } } as unknown as CustomerInfo;
  assert.equal(subscriptionManagementUrl(info), 'https://play.google.com/store/account/subscriptions');
  for (const value of ['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com', 'invalid', null]) assert.equal(safeManagementUrl(value), null);
  assert.equal(premiumPlan(null, [], now), null);
});


test('revocation does not describe a future end date as an already expired plan', () => {
  const plan = premiumPlan(customer({ isActive: false }), [product()], now);
  assert.equal(plan?.active, false);
  assert.equal(plan?.status, 'Inactive');
  assert.equal(plan?.dateLabel, 'Recorded access end');
});


test('Android one-time Premium is Lifetime even without Apple non-consumable product typing', () => {
  const plan = premiumPlan(customer({ store: 'PLAY_STORE', expirationDate: null, willRenew: false }),
    [product({ subscriptionPeriod: null, productCategory: 'NON_SUBSCRIPTION', productType: 'UNKNOWN' })], now);
  assert.equal(plan?.name, 'Lifetime');
  assert.equal(plan?.managementUrl, null);
});
