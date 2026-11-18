import { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ui } from '../components/controls';
import { CompareIcon } from '../components/CompareIcon';
import { useWideLayout } from '../components/responsive';
import { KeyboardFormScrollView, RevealInputContext } from '../components/KeyboardFormScrollView';
import { CONNECTION_ERROR, type CognitoConfig, type Session } from './cognito';
import { AccountError, NativeAccount, type Challenge, type LoginResult } from './native-cognito';

type Step = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset' | 'challenge';
function Input({ label, value, onChange, secret = false, code = false, email = false, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; secret?: boolean; code?: boolean; email?: boolean; disabled?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  const reveal = useContext(RevealInputContext);
  return <View style={styles.inputTile}>
    <View style={styles.inputIcon}><CompareIcon name={email ? 'mail' : secret ? 'lock' : code ? 'key' : 'tag'} /></View>
    <View style={styles.inputContent}><Text style={styles.inputLabel}>{label}</Text>
    <TextInput ref={ref} accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
      onFocus={() => reveal?.(ref.current)} onBlur={() => reveal?.(null)} style={styles.input}
      secureTextEntry={secret} autoCapitalize="none" autoCorrect={false}
      keyboardType={email ? 'email-address' : code ? 'number-pad' : 'default'}
      autoComplete={email ? 'email' : code ? 'one-time-code' : secret ? (label === 'Password' ? 'current-password' : 'new-password') : 'off'} />
    </View>
  </View>;
}

function AccountAction({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [secondary ? styles.secondaryAction : styles.primaryAction, (pressed || disabled) && styles.dimmed]}>
    <Text style={secondary ? styles.secondaryText : styles.primaryText}>{label}</Text>
    <CompareIcon name="arrow" size={secondary ? 22 : 28} color={secondary ? '#09184A' : '#FFFFFF'} />
  </Pressable>;
}
const titles: Record<Step, string> = { signin: 'Welcome back', signup: 'Create your account', confirm: 'Verify your email', forgot: 'Reset your password', reset: 'Choose a new password', challenge: 'Complete sign-in' };
const actions: Record<Step, string> = { signin: 'Sign in', signup: 'Create account', confirm: 'Verify email', forgot: 'Send reset code', reset: 'Save new password', challenge: 'Continue' };

export function AccountForm({ configuration, onSession, onClose, initialStep = 'signin' }: { initialStep?: 'signin' | 'signup'; configuration: () => CognitoConfig; onSession: (session: Session) => Promise<void>; onClose: () => void }) {
  const wide = useWideLayout();
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<Challenge>();
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const account = useRef<NativeAccount | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const pendingPassword = useRef('');
  const confirmed = useRef(false);
  useEffect(() => () => { generation.current++; account.current = null; pendingPassword.current = ''; }, []);
  const changeStep = (next: Step, message = '') => {
    setStep(next); setPassword(''); setRepeat(''); setCode(''); setError(''); setNotice(message); setAttributes({});
    pendingPassword.current = ''; confirmed.current = false;
    if (next !== 'challenge') { setChallenge(undefined); account.current = null; }
  };
  const client = () => account.current ?? (account.current = new NativeAccount(configuration()));
  const run = async (work: (active: () => boolean) => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    const current = generation.current;
    const active = () => generation.current === current;
    try { await work(active); }
    catch (failure) {
      if (!active()) return;
      if (failure instanceof AccountError && failure.code === 'UserNotConfirmedException') changeStep('confirm', 'Enter your email verification code, or request a new one.');
      else if (failure instanceof AccountError && failure.code === 'PasswordResetRequiredException') changeStep('forgot', 'Reset your password to continue.');
      else setError(failure instanceof Error ? failure.message : CONNECTION_ERROR);
    } finally { if (active()) { locked.current = false; setBusy(false); } }
  };
  const loginResult = async (result: LoginResult, active: () => boolean) => {
    if (!active()) return;
    setPassword(''); setRepeat(''); setCode('');
    if ('session' in result) {
      await onSession(result.session);
      pendingPassword.current = ''; confirmed.current = false;
    }
    else { setChallenge(result.challenge); setAttributes({}); setStep('challenge'); }
  };
  const newPassword = step === 'signup' || step === 'reset' || (step === 'challenge' && challenge?.kind === 'NEW_PASSWORD_REQUIRED');
  const needsPassword = step === 'signin' || newPassword;
  const needsCode = (step === 'confirm' && !confirmed.current) || step === 'reset' || (step === 'challenge' && !newPassword);
  const submit = () => {
    const username = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) { setError('Enter a valid email address.'); return; }
    if (needsPassword && !password) { setError('Enter your password.'); return; }
    if (newPassword && (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))) {
      setError('Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.'); return;
    }
    if (newPassword && password !== repeat) { setError('Passwords do not match.'); return; }
    if (needsCode && !code.trim()) { setError('Enter your verification code.'); return; }
    if (challenge?.attributes.some(name => !attributes[name]?.trim())) { setError('Complete the required account details.'); return; }
    void run(async active => {
      const api = client();
      if (step === 'signin') { await loginResult(await api.signIn(username, password), active); return; }
      if (step === 'challenge' && challenge) { await loginResult(await api.answer(challenge, newPassword ? password : code.trim(), attributes), active); return; }
      if (step === 'signup') {
        const response = await api.request('SignUp', { Username: username, Password: password, UserAttributes: [{ Name: 'email', Value: username }] });
        if (!active()) return;
        const signupPassword = password;
        changeStep('confirm', response.UserConfirmed ? 'Account created. Finishing sign-in…' : 'Check your email for your verification code.');
        pendingPassword.current = signupPassword;
        confirmed.current = !!response.UserConfirmed;
        if (response.UserConfirmed) await loginResult(await api.signIn(username, signupPassword), active);
      } else if (step === 'confirm') {
        if (!confirmed.current) {
          await api.request('ConfirmSignUp', { Username: username, ConfirmationCode: code.trim() });
          if (!active()) return;
          confirmed.current = true;
          setCode('');
        }
        if (pendingPassword.current) await loginResult(await api.signIn(username, pendingPassword.current), active);
        else if (active()) changeStep('signin', 'Email verified. Sign in to continue.');
      } else if (step === 'forgot') {
        await api.request('ForgotPassword', { Username: username });
        if (active()) changeStep('reset', 'If this account can be recovered, a reset code will arrive by email.');
      } else if (step === 'reset') {
        await api.request('ConfirmForgotPassword', { Username: username, ConfirmationCode: code.trim(), Password: password });
        if (active()) changeStep('signin', 'Password updated. Sign in with your new password.');
      }
    });
  };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
    <KeyboardFormScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, wide && styles.wideContent]}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.pageTitle}>{titles[step]}</Text>
          <Text style={styles.subtitle}>{step === 'signin' ? 'Sign in with your email and password.' : step === 'signup' ? 'Create a Savly account with your email address.' : step === 'challenge' ? (newPassword ? 'Choose a new password to finish signing in.' : challenge?.kind === 'SOFTWARE_TOKEN_MFA' ? 'Enter the code from your authenticator app.' : 'Enter the verification code sent to your phone.') : email.trim()}</Text>
        </View>
        {!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
        {['signin', 'signup', 'forgot'].includes(step) && <Input label="Email address" email value={email} onChange={setEmail} disabled={busy} />}
        {needsCode && <Input label="Verification code" code value={code} onChange={setCode} disabled={busy} />}
        {needsPassword && <Input label={newPassword ? 'New password' : 'Password'} secret value={password} onChange={setPassword} disabled={busy} />}
        {newPassword && <><Text style={styles.hint}>Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.</Text>
          <Input label="Confirm password" secret value={repeat} onChange={setRepeat} disabled={busy} /></>}
        {step === 'challenge' && challenge?.attributes.map(name => <Input key={name} label={name.replace(/_/g, ' ')} value={attributes[name] ?? ''} onChange={value => setAttributes(previous => ({ ...previous, [name]: value }))} disabled={busy} />)}
        {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
        {busy && <ActivityIndicator accessibilityLabel="Connecting" color="#0B2156" />}
        <AccountAction label={step === 'confirm' && confirmed.current ? 'Continue' : actions[step]} disabled={busy} onPress={submit} />
        {((step === 'confirm' && !confirmed.current) || step === 'reset') && <AccountAction label="Resend code" secondary disabled={busy} onPress={() => { void run(async active => {
          await client().request(step === 'confirm' ? 'ResendConfirmationCode' : 'ForgotPassword', { Username: email.trim() });
          if (active()) setNotice('A new code has been requested. Check your email.');
        }); }} />}
        {step === 'signin' && <><AccountAction label="Create an account" secondary disabled={busy} onPress={() => changeStep('signup')} />
          <AccountAction label="Forgot password?" secondary disabled={busy} onPress={() => changeStep('forgot')} /></>}
        {step !== 'signin' && <AccountAction label="Back to sign in" secondary disabled={busy} onPress={() => changeStep('signin')} />}
        <AccountAction label="Back" secondary disabled={busy} onPress={onClose} />
    </KeyboardFormScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { marginTop: 54, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', backgroundColor: '#FFFFFF', borderTopLeftRadius: 36, borderTopRightRadius: 36, minHeight: '100%' },
  wideContent: { marginTop: 24 },
  intro: { gap: 8, marginTop: 12, marginBottom: 6 },
  pageTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2, color: '#09184A' },
  subtitle: { fontSize: 17, lineHeight: 24, color: '#09184A' },
  inputTile: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, backgroundColor: '#F2F3FA', minHeight: 96, paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  inputIcon: { width: 42 },
  inputContent: { flex: 1, minWidth: 0 },
  inputLabel: { color: '#09184A', fontSize: 14, fontWeight: '500' },
  input: { minHeight: 42, paddingHorizontal: 0, paddingVertical: 0, color: '#09184A', fontSize: 20, backgroundColor: 'transparent' },
  hint: { color: '#596277', fontSize: 14, lineHeight: 21 },
  notice: { borderRadius: 18, backgroundColor: '#F0F1FA', paddingHorizontal: 18, paddingVertical: 14, color: '#09184A', fontSize: 14, lineHeight: 21 },
  primaryAction: { minHeight: 62, borderRadius: 22, backgroundColor: '#0B2156', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', flexShrink: 1 },
  secondaryAction: { minHeight: 60, borderRadius: 20, backgroundColor: '#F0F1FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 22 },
  secondaryText: { color: '#09184A', fontSize: 17, fontWeight: '700', flexShrink: 1 },
  dimmed: { opacity: 0.65 },
});
