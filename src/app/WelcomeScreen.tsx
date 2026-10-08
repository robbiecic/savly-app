import { useAuth } from '../auth/AuthProvider';
import { WelcomeContent } from './WelcomeContent';

export function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const { openSignIn } = useAuth();
  return <WelcomeContent onGetStarted={onGetStarted} onSignIn={openSignIn} />;
}
