import { useState, type FormEvent } from 'react';
import { Icon } from '../common/Icon';
import type { UseAuthResult } from '../../hooks/useAuth';

interface AuthScreenProps {
  auth: Pick<UseAuthResult, 'signIn' | 'signUp'>;
}

type Mode = 'signIn' | 'signUp';

export function AuthScreen({ auth }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = mode === 'signIn' ? await auth.signIn(email, password) : await auth.signUp(email, password);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (mode === 'signUp' && result.needsEmailConfirmation) {
      setConfirmationPending(true);
    }
  }

  return (
    <div className="circuit-grid relative flex h-dvh items-center justify-center overflow-y-auto bg-void-950 p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(50% 40% at 50% 0%, rgba(57,255,156,0.12), transparent 70%), radial-gradient(45% 35% at 100% 100%, rgba(195,74,255,0.12), transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-code-500/25 bg-void-900/90 p-6 shadow-[0_0_60px_-10px_rgba(57,255,156,0.2)] backdrop-blur-md">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-code-500/70 to-transparent" />

        <h1 className="text-center font-display text-xl font-black uppercase tracking-widest text-white text-glow-code">
          Pantheon Idle
        </h1>
        <p className="mt-1 text-center text-xs text-white/40">Jurupari.iso — Folclore Brasileiro</p>

        {confirmationPending ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-code-500/25 bg-code-900/20 px-4 py-6 text-center">
            <Icon name="check-circle" size={28} className="text-code-400" />
            <p className="text-sm text-white/80">
              Conta criada! Confirme seu e-mail (<span className="text-code-300">{email}</span>) pra poder entrar.
            </p>
            <button
              onClick={() => {
                setConfirmationPending(false);
                setMode('signIn');
              }}
              className="mt-1 font-display text-xs font-bold uppercase tracking-wide text-code-400 hover:text-code-300"
            >
              Voltar pro login
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 flex rounded-lg border border-void-600 bg-void-800/60 p-1">
              <button
                type="button"
                onClick={() => setMode('signIn')}
                className={`flex-1 rounded-md py-1.5 font-display text-xs font-bold uppercase tracking-wide transition ${
                  mode === 'signIn' ? 'bg-code-500 text-void-950' : 'text-white/50'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('signUp')}
                className={`flex-1 rounded-md py-1.5 font-display text-xs font-bold uppercase tracking-wide transition ${
                  mode === 'signUp' ? 'bg-code-500 text-void-950' : 'text-white/50'
                }`}
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <label className="flex items-center gap-2 rounded-lg border border-void-600 bg-void-800/60 px-3 py-2.5 focus-within:border-code-500/60">
                <Icon name="mail" size={15} className="shrink-0 text-white/40" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent font-mono text-sm text-white/90 placeholder:text-white/30 focus:outline-none"
                />
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-void-600 bg-void-800/60 px-3 py-2.5 focus-within:border-code-500/60">
                <Icon name="lock" size={15} className="shrink-0 text-white/40" />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  placeholder="senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent font-mono text-sm text-white/90 placeholder:text-white/30 focus:outline-none"
                />
              </label>

              {error && <p className="rounded-lg border border-signal-red/30 bg-signal-red/10 px-3 py-2 text-xs text-signal-red">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-code-500 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400 disabled:opacity-60"
              >
                {submitting && <Icon name="loader" size={14} className="animate-spin" />}
                {mode === 'signIn' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
