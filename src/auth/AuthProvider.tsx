import { SplashScreen } from '../app/WelcomeContent';
import { SessionStore } from './session-store';
import { checkSessionStorage, SECURE_STORAGE_BUILD_ERROR, SecureStorageBuildError, sessionStorage } from './session-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthRequest, CodeChallengeMethod, Prompt, ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Action, Card, ui } from '../components/controls';
import { SavlyLogo } from '../components/SavlyLogo';
import { colors } from '../theme/colors';
import { refreshSession, checkLoginPage, completeSignIn, CONNECTION_ERROR, EXPO_GO_ERROR, discover, resolveCognitoConfig, validateAuthRuntime, validateRedirect,
  type CognitoConfig, type Endpoints, type Session } from './cognito';

WebBrowser.maybeCompleteAuthSession();

type Prepared = { config: CognitoConfig; endpoints: Endpoints; request: AuthRequest };
type Auth = { session: Session | null; user: Session['user'] | null; openSignIn: () => void; signOut: () => Promise<boolean> };
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

async function prepare(): Promise<Prepared> {
  validateAuthRuntime(Platform.OS, Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
  checkSessionStorage();
  const config = configuration();
  const endpoints = await discover(config);
  validateRedirect(config.redirectUri, Platform.OS, Platform.OS === 'web' ? window.location.origin : undefined);
  const request = new AuthRequest({
    clientId: config.clientId, redirectUri: config.redirectUri, scopes: config.scopes,
    responseType: ResponseType.Code, usePKCE: true, codeChallengeMethod: CodeChallengeMethod.S256,
    prompt: Prompt.Login,
  });
  const url = await request.makeAuthUrlAsync(endpoints);
  if (Platform.OS !== 'web') await checkLoginPage(url);
  return { config, endpoints, request };
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
  const [phase, setPhase] = useState<'loading' | 'ready' | 'browser' | 'error'>('loading');
  const [failureMessage, setFailureMessage] = useState(CONNECTION_ERROR);
  const prepared = useRef<Prepared | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);

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
          previous => refreshSession(config, previous), setSession);
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
  useEffect(() => () => { generation.current++; }, []);

  const signOut = async () => {
    generation.current++;
    try {
      await store.current?.signOut();
      setSessionError(false);
      return true;
    } catch { setSessionError(true); return false; }
  };

  const load = async () => {
    const current = ++generation.current;
    prepared.current = null;
    setFailureMessage(CONNECTION_ERROR);
    setPhase('loading');
    try {
      const next = await prepare();
      if (generation.current !== current) return;
      prepared.current = next;
      setPhase('ready');
    } catch (error) {
      if (generation.current === current) {
        setFailureMessage(error instanceof SecureStorageBuildError ? SECURE_STORAGE_BUILD_ERROR : error instanceof Error && error.message === EXPO_GO_ERROR ? EXPO_GO_ERROR : CONNECTION_ERROR);
        setPhase('error');
      }
    }
  };
  const close = () => {
    generation.current++;
    prepared.current = null;
    if (inFlight.current) {
      try { WebBrowser.dismissAuthSession(); } catch { /* Already closed or unavailable. */ }
    }
    inFlight.current = false;
    setVisible(false);
  };
  const signIn = async () => {
    const pending = prepared.current;
    if (!pending || inFlight.current) return;
    inFlight.current = true;
    prepared.current = null; // Each attempt consumes its own state and PKCE verifier.
    const current = generation.current;
    setPhase('browser');
    try {
      // The URL is prepared before this user gesture, so web popups are not blocked by discovery.
      const result = await pending.request.promptAsync(pending.endpoints, { preferEphemeralSession: true });
      if (generation.current !== current) return;
      const next = await completeSignIn({ ...pending, expectedState: pending.request.state,
        codeVerifier: pending.request.codeVerifier ?? '', result });
      if (generation.current !== current) return;
      if (next) {
        if (!store.current || (Platform.OS !== 'web' && !next.refreshToken)) throw new Error(CONNECTION_ERROR);
        await store.current.accept(next);
        setSessionError(false);
      }
      close(); // Closing the browser voluntarily leaves the user signed out without an error.
    } catch { if (generation.current === current) setPhase('error'); }
    finally { if (generation.current === current) inFlight.current = false; }
  };

  return <AuthContext.Provider value={{
    session, user: session?.user ?? null,
    openSignIn: () => { setVisible(true); void load(); },
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
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
          <Card>
            <Text accessibilityRole="header" style={ui.title}>Sign in to Savly</Text>
            <Text style={ui.text}>Sign in securely in your browser.</Text>
            {(phase === 'loading' || phase === 'browser') && <>
              <ActivityIndicator accessibilityLabel={phase === 'loading' ? 'Connecting' : 'Signing in'} color={colors.ink} />
              <Text style={ui.muted}>{phase === 'loading' ? 'Connecting…' : 'Complete sign-in in your browser.'}</Text>
            </>}
            {phase === 'error' && <>
              <Text accessibilityRole="alert" style={ui.error}>{failureMessage}</Text>
              {failureMessage !== EXPO_GO_ERROR && failureMessage !== SECURE_STORAGE_BUILD_ERROR && <Action label="Try again" onPress={() => { void load(); }} />}
            </>}
            {phase === 'ready' && <Action label="Continue to sign in" onPress={() => { void signIn(); }} />}
            <Text style={ui.muted}>Saved comparisons stay on this device. Cloud history sync is not available yet.</Text>
            <Action label="Back to Savly" secondary onPress={close} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </AuthContext.Provider>;
}
