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
import { checkLoginPage, completeSignIn, CONNECTION_ERROR, EXPO_GO_ERROR, discover, resolveCognitoConfig, validateAuthRuntime, validateRedirect,
  type CognitoConfig, type Endpoints, type Session } from './cognito';

WebBrowser.maybeCompleteAuthSession();

type Prepared = { config: CognitoConfig; endpoints: Endpoints; request: AuthRequest };
type Auth = { user: Session['user'] | null; openSignIn: () => void; signOut: () => void };
const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required');
  return auth;
}

async function prepare(): Promise<Prepared> {
  validateAuthRuntime(Platform.OS, Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
  const config = resolveCognitoConfig({
    development: __DEV__ || ['local', 'development'].includes(process.env.EXPO_PUBLIC_APP_ENV ?? ''),
    authority: process.env.EXPO_PUBLIC_COGNITO_AUTHORITY,
    clientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID,
    domain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN,
    redirectUri: process.env.EXPO_PUBLIC_COGNITO_REDIRECT_URI,
  });
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
  // Session-only by design: never put Cognito tokens in AsyncStorage or browser localStorage.
  const [session, setSession] = useState<Session | null>(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'browser' | 'error'>('loading');
  const [failureMessage, setFailureMessage] = useState(CONNECTION_ERROR);
  const prepared = useRef<Prepared | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!session) return;
    const expire = () => { if (session.expiresAt <= Date.now()) setSession(null); };
    const timer = setTimeout(expire, Math.min(Math.max(0, session.expiresAt - Date.now()), 2147483647));
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') expire(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [session]);
  useEffect(() => () => { generation.current++; }, []);

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
        setFailureMessage(error instanceof Error && error.message === EXPO_GO_ERROR ? EXPO_GO_ERROR : CONNECTION_ERROR);
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
      if (next) setSession(next);
      close(); // Closing the browser voluntarily leaves the user signed out without an error.
    } catch { if (generation.current === current) setPhase('error'); }
    finally { if (generation.current === current) inFlight.current = false; }
  };

  return <AuthContext.Provider value={{
    user: session?.user ?? null,
    openSignIn: () => { setVisible(true); void load(); },
    signOut: () => { generation.current++; setSession(null); },
  }}>
    {children}
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
              {failureMessage !== EXPO_GO_ERROR && <Action label="Try again" onPress={() => { void load(); }} />}
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
