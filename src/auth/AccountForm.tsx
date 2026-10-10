import { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { Action, Card, ui } from '../components/controls';
import { KeyboardFormScrollView, RevealInputContext } from '../components/KeyboardFormScrollView';
import { CONNECTION_ERROR, type CognitoConfig, type Session } from './cognito';
import { AccountError, NativeAccount, type Challenge, type LoginResult } from './native-cognito';

type Step = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset' | 'challenge';
function Input({ label, value, onChange, secret = false, code = false, email = false, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; secret?: boolean; code?: boolean; email?: boolean; disabled?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  const reveal = useContext(RevealInputContext);
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text>
    <TextInput ref={ref} accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
      onFocus={() => reveal?.(ref.current)} onBlur={() => reveal?.(null)} style={ui.input}
      secureTextEntry={secret} autoCapitalize="none" autoCorrect={false}
      keyboardType={email ? 'email-address' : code ? 'number-pad' : 'default'}
      autoComplete={email ? 'email' : code ? 'one-time-code' : secret ? (label === 'Password' ? 'current-password' : 'new-password') : 'off'} />
  </View>;
}
const titles: Record<Step, string> = { signin: 'Sign in to Savly', signup: 'Create your account', confirm: 'Verify your email', forgot: 'Reset your password', reset: 'Choose a new password', challenge: 'Complete sign-in' };
const actions: Record<Step, string> = { signin: 'Sign in', signup: 'Create account', confirm: 'Verify email', forgot: 'Send reset code', reset: 'Save new password', challenge: 'Continue' };

export function AccountForm({ configuration, onSession, onClose }: { configuration: () => CognitoConfig; onSession: (session: Session) => Promise<void>; onClose: () => void }) {
  const [step, setStep] = useState<Step>('signin');
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
  useEffect(() => () => { generation.current++; account.current = null; }, []);
  const changeStep = (next: Step, message = '') => {
    setStep(next); setPassword(''); setRepeat(''); setCode(''); setError(''); setNotice(message); setAttributes({});
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
    if ('session' in result) await onSession(result.session);
    else { setChallenge(result.challenge); setAttributes({}); setStep('challenge'); }
  };
  const newPassword = step === 'signup' || step === 'reset' || (step === 'challenge' && challenge?.kind === 'NEW_PASSWORD_REQUIRED');
  const needsPassword = step === 'signin' || newPassword;
  const needsCode = step === 'confirm' || step === 'reset' || (step === 'challenge' && !newPassword);
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
        if (active()) changeStep(response.UserConfirmed ? 'signin' : 'confirm', response.UserConfirmed ? 'Account created. You can now sign in.' : 'Check your email for your verification code.');
      } else if (step === 'confirm') {
        await api.request('ConfirmSignUp', { Username: username, ConfirmationCode: code.trim() });
        if (active()) changeStep('signin', 'Email verified. You can now sign in.');
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
    <KeyboardFormScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
      <Card>
        <Text accessibilityRole="header" style={ui.title}>{titles[step]}</Text>
        <Text style={ui.text}>{step === 'signin' ? 'Welcome back. Sign in with your email and password.' : step === 'signup' ? 'Create a Savly account with your email address.' : step === 'challenge' ? (newPassword ? 'Choose a new password to finish signing in.' : challenge?.kind === 'SOFTWARE_TOKEN_MFA' ? 'Enter the code from your authenticator app.' : 'Enter the verification code sent to your phone.') : email.trim()}</Text>
        {!!notice && <Text accessibilityLiveRegion="polite" style={ui.text}>{notice}</Text>}
        {['signin', 'signup', 'forgot'].includes(step) && <Input label="Email address" email value={email} onChange={setEmail} disabled={busy} />}
        {needsCode && <Input label="Verification code" code value={code} onChange={setCode} disabled={busy} />}
        {needsPassword && <Input label={newPassword ? 'New password' : 'Password'} secret value={password} onChange={setPassword} disabled={busy} />}
        {newPassword && <><Text style={ui.muted}>Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.</Text>
          <Input label="Confirm password" secret value={repeat} onChange={setRepeat} disabled={busy} /></>}
        {step === 'challenge' && challenge?.attributes.map(name => <Input key={name} label={name.replace(/_/g, ' ')} value={attributes[name] ?? ''} onChange={value => setAttributes(previous => ({ ...previous, [name]: value }))} disabled={busy} />)}
        {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
        {busy && <ActivityIndicator accessibilityLabel="Connecting" />}
        <Action label={actions[step]} disabled={busy} onPress={submit} />
        {(step === 'confirm' || step === 'reset') && <Action label="Resend code" secondary disabled={busy} onPress={() => { void run(async active => {
          await client().request(step === 'confirm' ? 'ResendConfirmationCode' : 'ForgotPassword', { Username: email.trim() });
          if (active()) setNotice('A new code has been requested. Check your email.');
        }); }} />}
        {step === 'signin' && <><Action label="Create an account" secondary disabled={busy} onPress={() => changeStep('signup')} />
          <Action label="Forgot password?" secondary disabled={busy} onPress={() => changeStep('forgot')} /></>}
        {step !== 'signin' && <Action label="Back to sign in" secondary disabled={busy} onPress={() => changeStep('signin')} />}
        <Text style={ui.muted}>Saved comparisons stay on this device. Cloud history sync is not available yet.</Text>
        <Action label="Back to Savly" secondary disabled={busy} onPress={onClose} />
      </Card>
    </KeyboardFormScrollView>
  </KeyboardAvoidingView>;
}
