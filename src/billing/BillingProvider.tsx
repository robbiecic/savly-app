import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import type Purchases from 'react-native-purchases';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { getOfferingPackages, hasPremium, PREMIUM_ENTITLEMENT, purchaseMessage, TEST_API_KEY } from './access';

type Billing = {
  active: boolean; preview: boolean; busy: boolean; message: string;
  packages: PurchasesPackage[]; refresh: () => void;
  purchase: (item: PurchasesPackage) => void; restore: () => void;
};
const Context = createContext<Billing | null>(null);
let sdkPromise: Promise<typeof Purchases> | undefined;
function getSdk(): Promise<typeof Purchases> {
  if (!__DEV__) return Promise.reject(new Error('release'));
  if (!NativeModules.RNPurchases) return Promise.reject(new Error('native'));
  return sdkPromise ??= import('react-native-purchases').then(async ({ default: sdk, LOG_LEVEL }) => {
    sdk.setLogLevel(LOG_LEVEL.WARN);
    if (!await sdk.isConfigured()) sdk.configure({ apiKey: TEST_API_KEY });
    return sdk;
  }).catch(error => { sdkPromise = undefined; throw error; });
}

export function BillingProvider({ children }: { children: ReactNode }) {
  const preview = Platform.OS === 'web';
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState(!preview);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const running = useRef(false);
  const mounted = useRef(true);
  const run = async (action: 'refresh' | 'restore' | 'purchase', item?: PurchasesPackage) => {
    if (preview || running.current) return;
    running.current = true; setBusy(true); setMessage('');
    try {
      const sdk = await getSdk();
      const customer = action === 'purchase' && item ? (await sdk.purchasePackage(item)).customerInfo
        : action === 'restore' ? await sdk.restorePurchases() : await sdk.getCustomerInfo();
      if (!mounted.current) return;
      setInfo(customer); setNow(Date.now());
      if (action === 'restore') setMessage(hasPremium(customer) ? 'Test purchase restored. Saved comparisons remain on this device.' : 'No active Savly Premium purchase was found.');
      if (action === 'purchase' && !hasPremium(customer)) setMessage('No active Savly Premium access was returned. Check that the product is attached to savly_premium in RevenueCat.');
      if (action === 'refresh') {
        const offering = (await sdk.getOfferings()).current;
        if (!mounted.current) return;
        const choices = getOfferingPackages(offering);
        setPackages(choices);
        if (choices.length < 3) setMessage('The default offering needs Monthly, Annual and Lifetime packages. Check the package types in RevenueCat, then retry.');
      }
    } catch (error) {
      if (!mounted.current) return;
      setMessage(error instanceof Error && error.message === 'release' ? 'Store billing is not configured for this release. Test purchases require a development build.'
        : error instanceof Error && error.message === 'native' ? 'Install a rebuilt Savly development app to test purchases. This build does not include RevenueCat.' : purchaseMessage(error));
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    let sdk: typeof Purchases | undefined;
    const listener = (customer: CustomerInfo) => { if (mounted.current) { setInfo(customer); setNow(Date.now()); } };
    if (!preview) {
      void getSdk().then(value => { if (mounted.current) { sdk = value; sdk.addCustomerInfoUpdateListener(listener); } }).catch(() => {});
      void run('refresh');
    }
    const lifecycle = AppState.addEventListener('change', state => { if (state === 'active') { setNow(Date.now()); void run('refresh'); } });
    return () => { mounted.current = false; lifecycle.remove(); sdk?.removeCustomerInfoUpdateListener(listener); };
  }, []);
  useEffect(() => {
    const expiry = info?.entitlements.active[PREMIUM_ENTITLEMENT]?.expirationDate;
    if (!expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Date.parse(expiry) - now, 86400000));
    return () => clearTimeout(timer);
  }, [info, now]);
  return <Context.Provider value={{ active: hasPremium(info, now), preview, busy, message, packages,
    refresh: () => { void run('refresh'); }, restore: () => { void run('restore'); }, purchase: item => { void run('purchase', item); } }}>{children}</Context.Provider>;
}
export function useBilling() {
  const value = useContext(Context);
  if (!value) throw new Error('BillingProvider is required');
  return value;
}
