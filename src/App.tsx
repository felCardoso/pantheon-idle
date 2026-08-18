import { useEffect } from 'react';
import { AuthScreen } from './components/auth/AuthScreen';
import { GameShell } from './components/GameShell';
import { Splash } from './components/common/Splash';
import { useAuth } from './hooks/useAuth';
import { killLegacyServiceWorker } from './lib/killLegacyServiceWorker';

export default function App() {
  const auth = useAuth();

  useEffect(() => {
    killLegacyServiceWorker();
  }, []);

  if (auth.loading) return <Splash />;
  if (!auth.user) return <AuthScreen auth={auth} />;

  return <GameShell userId={auth.user.id} onSignOut={auth.signOut} />;
}
