import type { CustomerInfo, PurchasesEntitlementInfo, PurchasesStoreProduct } from 'react-native-purchases';
import { PREMIUM_ENTITLEMENT } from './access';

type Entitlement = Pick<PurchasesEntitlementInfo, 'productIdentifier' | 'productPlanIdentifier' | 'expirationDate' | 'isActive' | 'willRenew' | 'store' | 'isSandbox' | 'originalPurchaseDate' | 'billingIssueDetectedAt' | 'ownershipType' | 'periodType'>;
type Product = Pick<PurchasesStoreProduct, 'identifier' | 'title' | 'subscriptionPeriod' | 'productCategory' | 'productType'>;
type Customer = { entitlements: { all: Record<string, Entitlement> }; managementURL: string | null; activeSubscriptions?: readonly string[] };

export function purchasedProductId(entitlement: Pick<Entitlement, 'productIdentifier' | 'productPlanIdentifier'>): string {
  return entitlement.productPlanIdentifier ? `${entitlement.productIdentifier}:${entitlement.productPlanIdentifier}` : entitlement.productIdentifier;
}

export function safeManagementUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? url : null;
  } catch { return null; }
}

export function premiumPlan(info: Customer | null, products: readonly Product[], now = Date.now()) {
  const entitlement = info?.entitlements.all[PREMIUM_ENTITLEMENT];
  if (!entitlement) return null;
  const productId = purchasedProductId(entitlement);
  const product = products.find(item => item.identifier === productId);
  const period = product?.subscriptionPeriod;
  const lifetime = entitlement.expirationDate === null && !!product && (product.productType === 'NON_CONSUMABLE' || product.productCategory === 'NON_SUBSCRIPTION');
  const name = period === 'P1M' ? 'Monthly' : period === 'P1Y' || period === 'P12M' ? 'Annual' : lifetime ? 'Lifetime' : product?.title || 'Plan details unavailable';
  const active = entitlement.isActive && (entitlement.expirationDate === null || Date.parse(entitlement.expirationDate) > now);
  const expired = entitlement.expirationDate !== null && Date.parse(entitlement.expirationDate) <= now;
  const status = !active ? (expired ? 'Expired' : 'Inactive') : lifetime ? 'Active · One-time purchase' : entitlement.billingIssueDetectedAt ? 'Billing issue — review your payment method' : entitlement.willRenew ? 'Active · Auto-renewal on' : entitlement.expirationDate ? 'Active · Auto-renewal off' : 'Active';
  const dateLabel = !active ? (expired ? 'Expired on' : 'Recorded access end') : entitlement.billingIssueDetectedAt ? 'Current period ends on' : entitlement.willRenew ? (entitlement.periodType === 'TRIAL' ? 'Trial ends on' : 'Renews on') : 'Access until';
  const testStore = entitlement.store === 'TEST_STORE';
  const storeName = ({ APP_STORE: 'Apple App Store', PLAY_STORE: 'Google Play', TEST_STORE: 'Test Store', PROMOTIONAL: 'Promotional access', AMAZON: 'Amazon Appstore' } as Record<string, string>)[entitlement.store] || entitlement.store;
  const shared = entitlement.ownershipType === 'FAMILY_SHARED';
  // CustomerInfo URLs route to the purchase's store, which may differ from this device's platform.
  const otherSubscriptions = lifetime && !!info?.activeSubscriptions?.length;
  const url = !shared && (!lifetime || otherSubscriptions) ? safeManagementUrl(info?.managementURL) : null;
  return { name, productId, active, status, dateLabel, expirationDate: entitlement.expirationDate,
    purchasedAt: entitlement.originalPurchaseDate, lifetime, testStore, sandbox: entitlement.isSandbox,
    storeName, shared, otherSubscriptions, managementUrl: url, detailsUnavailable: !product };
}

export function subscriptionManagementUrl(info: CustomerInfo | null): string | null {
  const entitlement = info?.entitlements.all[PREMIUM_ENTITLEMENT];
  if (!info || !entitlement) return null;
  const subscriptions = Object.values(info.subscriptionsByProductIdentifier ?? {});
  const subscription = subscriptions.find(item => item.productIdentifier === entitlement.productIdentifier && item.productPlanIdentifier === entitlement.productPlanIdentifier);
  return safeManagementUrl(subscription?.managementURL) ?? safeManagementUrl(info.managementURL) ?? (entitlement.expirationDate === null ? safeManagementUrl(subscriptions.find(item => item.isActive)?.managementURL) : null);
}
