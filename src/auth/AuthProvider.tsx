import { SplashScreen } from '../app/WelcomeContent';
import { SessionStore } from './session-store';
import { checkSessionStorage, SECURE_STORAGE_BUILD_ERROR, SecureStorageBuildError, sessionStorage } from './session-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Modal, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Action, ui } from '../components/controls';
import { SavlyLogo } from '../components/SavlyLogo';
import { colors } from '../theme/colors';
import { refreshSession, resolveCognitoConfig, type CognitoConfig, type Session } from './cognito';
import { refreshNativeSession } from './native-cognito';
import { AccountForm } from './AccountForm';

type Auth = { session: Session | null; user: Session['user'] | null; openSignIn: () => void; openSignUp: (onComplete: () => void) => void; signOut: () => Promise<boolean> };
const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required');
  return auth;
}

function configuration(): CognitoConfig {
  return resolveCognitoConfig({
    development: __DEV__ || ['local', 'development'].includes(process.env.EXPO_PUBLIC_APP_ENV ?? ''),
    authority: process.env.EXPO_PUBLIC_COGNITO_AUTHORITY,
    clientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID,
    domain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN,
    redirectUri: process.env.EXPO_PUBLIC_COGNITO_REDIRECT_URI,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [restoring, setRestoring] = useState(true);
  const [returningUser, setReturningUser] = useState(false);
  const [splashElapsed, setSplashElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  const [sessionError, setSessionError] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const store = useRef<SessionStore | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [visible, setVisible] = useState(false);
  const [initialStep, setInitialStep] = useState<'signin' | 'signup'>('signin');
  const afterSignIn = useRef<(() => void) | null>(null);

  const restore = async () => {
    setRestoring(true);
    setSessionError(false);
    setNeedsUpdate(false);
    try {
      if (!store.current) {
        let config: CognitoConfig;
        try { config = configuration(); } catch { return; } // Unconfigured releases still allow guest use.
        store.current = new SessionStore(sessionStorage,
          JSON.stringify([config.authority, config.clientId, config.domain ?? '']),
          previous => previous.authMethod === 'native' ? refreshNativeSession(config, previous) : refreshSession(config, previous), setSession);
      }
      await store.current.restore();
      setReturningUser(!!store.current.session);
    } catch (error) {
      setNeedsUpdate(error instanceof SecureStorageBuildError);
      setSessionError(true);
    }
    finally { setRestoring(false); }
  };
  useEffect(() => { void restore(); }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const renew = async () => {
      try { await store.current?.refresh(); if (active) setSessionError(false); }
      catch {
        if (active) {
          setSessionError(true);
          timer = setTimeout(() => { void renew(); }, 60000);
        }
      }
    };
    timer = setTimeout(() => { void renew(); }, Math.min(Math.max(0, session.expiresAt - Date.now() - 60000), 2147483647));
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && session.expiresAt <= Date.now() + 60000) {
        clearTimeout(timer); void renew();
      }
    });
    return () => { active = false; clearTimeout(timer); subscription.remove(); };
  }, [session]);

  const signOut = async () => {
    try {
      await store.current?.signOut();
      setSessionError(false);
      return true;
    } catch { setSessionError(true); return false; }
  };

  const close = () => { afterSignIn.current = null; setVisible(false); };
  const accept = async (next: Session) => {
    if (!store.current || (Platform.OS !== 'web' && !next.refreshToken)) throw new Error("Can't connect right now");
    await store.current.accept(next);
    setSessionError(false);
    const completed = afterSignIn.current;
    close();
    completed?.();
  };

  return <AuthContext.Provider value={{
    session, user: session?.user ?? null,
    openSignIn: () => { afterSignIn.current = null; setInitialStep('signin'); setVisible(true); },
    openSignUp: onComplete => { afterSignIn.current = onComplete; setInitialStep('signup'); setVisible(true); },
    signOut,
  }}>
    {restoring || (returningUser && !splashElapsed) ? <>
      <StatusBar style="light" />
      <SplashScreen />
    </> : sessionError && !session ? <SafeAreaView style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text accessibilityRole="alert" style={ui.text}>{needsUpdate ? SECURE_STORAGE_BUILD_ERROR : "Can't restore sign-in right now. Your saved sign-in has been kept."}</Text>
      {needsUpdate ? <Action label="Continue as guest" onPress={() => setSessionError(false)} /> : <>
        <Action label="Try again" onPress={() => { void restore(); }} />
        <Action label="Sign out on this device" secondary onPress={() => { void signOut(); }} />
      </>}
    </SafeAreaView> : <>
      {sessionError && <SafeAreaView edges={['top']}><Text accessibilityRole="alert" style={ui.error}>Can't update sign-in right now. Check your connection and try again.</Text>
        <Action label="Retry sign-in connection" onPress={() => { void store.current?.refresh().then(() => setSessionError(false)).catch(() => setSessionError(true)); }} />
      </SafeAreaView>}
      {children}
    </>}
    <Modal visible={visible} animationType="slide" supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={close}>
      {visible && <StatusBar style="dark" />}
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}><SavlyLogo /></View>
        {visible && <AccountForm initialStep={initialStep} configuration={() => { checkSessionStorage(); return configuration(); }} onSession={accept} onClose={close} />}
      </SafeAreaView>
    </Modal>
  </AuthContext.Provider>;
}
