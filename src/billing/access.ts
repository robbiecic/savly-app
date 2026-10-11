export const PREMIUM_ENTITLEMENT = 'savly_premium';
export const TEST_API_KEY = 'test_ZYyEueOjVnddgvjQrrWNKcROoiq';

type Entitlement = { isActive: boolean; expirationDate: string | null };
export function getOfferingPackages<T extends { identifier: string }>(
  offering: Partial<Record<'monthly' | 'annual' | 'lifetime', T | null | undefined>> | null | undefined,
): T[] {
  return ['monthly', 'annual', 'lifetime']
    .map((key) => offering?.[key as 'monthly' | 'annual' | 'lifetime'])
    .filter((entry): entry is T => !!entry);
}

export function hasPremium(info: { entitlements: { active: Record<string, Entitlement> } } | null, now = Date.now()): boolean {
  const entitlement = info?.entitlements.active[PREMIUM_ENTITLEMENT];
  if (!entitlement?.isActive) return false;
  return entitlement.expirationDate === null || Date.parse(entitlement.expirationDate) > now;
}

export function purchaseMessage(error: unknown): string {
  const value = error as { userCancelled?: boolean; code?: string } | null;
  if (value?.userCancelled || value?.code === '1') return 'Purchase canceled. Your access has not changed.';
  if (value?.code === '20') return 'Payment is pending. Premium unlocks after the purchase is approved.';
  return 'Couldn’t complete the billing request. Check your connection and try again.';
}
