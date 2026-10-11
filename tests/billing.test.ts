import test from 'node:test';
import assert from 'node:assert/strict';
import { getOfferingPackages, hasPremium, purchaseMessage } from '../src/billing/access';

const now = Date.parse('2026-10-10T12:00:00Z');
const customer = (expirationDate: string | null, isActive = true, id = 'savly_premium') => ({
  entitlements: { active: { [id]: { expirationDate, isActive } } },
});
test('premium requires the exact active entitlement; a different purchase does not unlock', () => {
  assert.equal(hasPremium(null, now), false);
  assert.equal(hasPremium(customer(null, true, 'premium'), now), false);
  assert.equal(hasPremium(customer(null, false), now), false);
  assert.equal(hasPremium(customer(null), now), true);
});
test('monthly access ends at expiry, including cached offline access; lifetime has no expiry', () => {
  assert.equal(hasPremium(customer('2026-10-10T12:00:01Z'), now), true);
  assert.equal(hasPremium(customer('2026-10-10T12:00:00Z'), now), false);
  assert.equal(hasPremium(customer('2026-10-10T11:59:59Z'), now), false);
  assert.equal(hasPremium(customer('invalid'), now), false);
  assert.equal(hasPremium(customer(null), now + 365 * 86400000), true);
});
test('RevenueCat plans are exposed in the configured order: monthly, annual, lifetime', () => {
  const plans = getOfferingPackages({
    monthly: { identifier: 'monthly', product: { priceString: '$5' } },
    annual: { identifier: 'annual', product: { priceString: '$45' } },
    lifetime: { identifier: 'lifetime', product: { priceString: '$120' } },
  } as any);
  assert.deepEqual(plans.map((item) => item.identifier), ['monthly', 'annual', 'lifetime']);
});
test('canceled, pending and failed checkout messages never promise an unlock or expose raw errors', () => {
  assert.match(purchaseMessage({ userCancelled: true }), /canceled/);
  assert.match(purchaseMessage({ code: '1' }), /canceled/);
  assert.match(purchaseMessage({ code: '20' }), /pending/);
  assert.match(purchaseMessage(new Error('private provider details')), /try again/);
  assert.equal(purchaseMessage(null).includes('private'), false);
});
