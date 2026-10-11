import { premiumPlan, purchasedProductId, subscriptionManagementUrl } from './management';
import { useAuth } from '../auth/AuthProvider';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import type Purchases from 'react-native-purchases';
import type { CustomerInfo, PurchasesPackage, PurchasesStoreProduct } from 'react-native-purchases';
import { getOfferingPackages, hasPremium, PREMIUM_ENTITLEMENT, purchaseMessage, TEST_API_KEY } from './access';

type Billing = {
  prompt: 'checking' | 'plans' | 'error' | 'unavailable' | null; dismissPrompt: () => void; checkEntitlement: () => void;
  active: boolean; preview: boolean; busy: boolean; message: string;
  packages: PurchasesPackage[]; refresh: () => void; refreshDetails: () => void;
  plan: ReturnType<typeof premiumPlan>; detailsLoading: boolean;
  purchase: (item: PurchasesPackage) => void;
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
  const { user } = useAuth();
  const subject = user?.sub ?? null;
  const currentSubject = useRef(subject);
  currentSubject.current = subject;
  const queuedCheck = useRef(false);
  const checkDismissed = useRef(false);
  const [prompt, setPrompt] = useState<'checking' | 'plans' | 'error' | 'unavailable' | null>(null);
  const preview = Platform.OS === 'web';
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [products, setProducts] = useState<PurchasesStoreProduct[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState(!preview);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const running = useRef(false);
  const mounted = useRef(true);
  const run = async (action: 'refresh' | 'purchase' | 'check' | 'details', item?: PurchasesPackage) => {
    if (preview) { if (action === 'check') setPrompt('unavailable'); return; }
    if (running.current) { if (action === 'check') queuedCheck.current = true; return; }
    const checkingSubject = currentSubject.current;
    if (action === 'check' && !checkDismissed.current) setPrompt('checking');
    running.current = true; setBusy(true); setMessage('');
    let loadingOffers = false;
    try {
      const sdk = await getSdk();
      if (action !== 'purchase') await sdk.invalidateCustomerInfoCache();
      const customer = action === 'purchase' && item ? (await sdk.purchasePackage(item)).customerInfo
        : await sdk.getCustomerInfo();
      if (!mounted.current) return;
      setInfo({ ...customer }); setNow(Date.now());
      if (hasPremium(customer)) setPrompt(null);
      else if (action === 'check' && !checkDismissed.current && checkingSubject && currentSubject.current === checkingSubject) setPrompt('plans');
      if (action === 'purchase' && !hasPremium(customer)) setMessage('No active Savly Premium access was returned. Check that the product is attached to savly_premium in RevenueCat.');
      if (hasPremium(customer) || action === 'details') return;
      if (action === 'refresh' || action === 'check') {
        loadingOffers = true;
        setPackages([]);
        const offering = (await sdk.getOfferings()).current;
        if (!mounted.current) return;
        const choices = getOfferingPackages(offering);
        setPackages(choices);
        if (choices.length === 0) setMessage('No plans are available. Add your plans to the default offering in RevenueCat, then retry.');
      }
    } catch (error) {
      if (!mounted.current) return;
      const unavailable = error instanceof Error && ['release', 'native'].includes(error.message);
      if (action === 'check' && !loadingOffers && !checkDismissed.current && checkingSubject && currentSubject.current === checkingSubject) setPrompt(unavailable ? 'unavailable' : 'error');
      setMessage(error instanceof Error && error.message === 'release' ? 'Store billing is not configured for this release. Test purchases require a development build.'
        : error instanceof Error && error.message === 'native' ? 'Install a rebuilt Savly development app to test purchases. This build does not include RevenueCat.' : loadingOffers ? 'Premium access was checked, but the offers couldn’t load. Retry loading offers.' : purchaseMessage(error));
    } finally {
      running.current = false;
      if (mounted.current) {
        setBusy(false);
        if (queuedCheck.current) { queuedCheck.current = false; if (currentSubject.current) void run('check'); }
      }
    }
  };
  useEffect(() => {
    mounted.current = true;
    let sdk: typeof Purchases | undefined;
    const listener = (customer: CustomerInfo) => { if (mounted.current) { setInfo({ ...customer }); setNow(Date.now()); if (hasPremium(customer)) setPrompt(null); } };
    if (!preview) {
      void getSdk().then(value => { if (mounted.current) { sdk = value; sdk.addCustomerInfoUpdateListener(listener); } }).catch(() => {});
      void run('refresh');
    }
    const lifecycle = AppState.addEventListener('change', state => { if (state === 'active') { setNow(Date.now()); void run('refresh'); } });
    return () => { mounted.current = false; lifecycle.remove(); sdk?.removeCustomerInfoUpdateListener(listener); };
  }, []);
  useEffect(() => {
    if (subject) { checkDismissed.current = false; setPrompt('checking'); void run('check'); }
    else { queuedCheck.current = false; setPrompt(null); }
  }, [subject]);
  useEffect(() => {
    const entitlement = info?.entitlements.all[PREMIUM_ENTITLEMENT];
    if (!entitlement || preview) { setProducts([]); setDetailsLoading(false); return; }
    let canceled = false;
    setDetailsLoading(true); setProducts([]);
    void (async () => {
      try {
        const sdk = await getSdk();
        const category = entitlement.expirationDate === null ? sdk.PRODUCT_CATEGORY.NON_SUBSCRIPTION : sdk.PRODUCT_CATEGORY.SUBSCRIPTION;
        const loaded = await sdk.getProducts([purchasedProductId(entitlement)], category);
        if (!canceled) setProducts(loaded);
      } catch { if (!canceled) setProducts([]); }
      finally { if (!canceled) setDetailsLoading(false); }
    })();
    return () => { canceled = true; };
  }, [info, preview]);
  useEffect(() => {
    const expiry = info?.entitlements.active[PREMIUM_ENTITLEMENT]?.expirationDate;
    if (!expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Date.parse(expiry) - now, 86400000));
    return () => clearTimeout(timer);
  }, [info, now]);
  return <Context.Provider value={{ prompt, dismissPrompt: () => { checkDismissed.current = true; setPrompt(null); }, checkEntitlement: () => { checkDismissed.current = false; void run('check'); }, active: hasPremium(info, now), preview, busy, message, packages, detailsLoading,
    plan: premiumPlan(info ? { ...info, managementURL: subscriptionManagementUrl(info) } : null, [...products, ...packages.map(item => item.product)], now),
    refreshDetails: () => { void run('details'); },
    refresh: () => { void run('refresh'); }, purchase: item => { void run('purchase', item); } }}>{children}</Context.Provider>;
}
export function useBilling() {
  const value = useContext(Context);
  if (!value) throw new Error('BillingProvider is required');
  return value;
}
