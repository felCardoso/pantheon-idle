import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface AuthResult {
  error: string | null;
  /** True when signUp succeeded but the account needs email confirmation before it can sign in. */
  needsEmailConfirmation?: boolean;
}

export interface UseAuthResult {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('User already registered')) return 'Já existe uma conta com esse e-mail.';
  if (message.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (message.includes('Unable to validate email address')) return 'E-mail inválido.';
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
  }
  return message;
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    // Without this, the confirmation email links back to whatever "Site URL" is set in the
    // Supabase dashboard (defaults to localhost:3000) instead of wherever this is actually running.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null, needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, user: session?.user ?? null, loading, signIn, signUp, signOut };
}
