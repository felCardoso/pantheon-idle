import { useState, type FormEvent } from 'react';
import { Icon } from '../common/Icon';
import type { UpdateUsernameResult } from '../../hooks/useProfile';

const NICKNAME_CHANGE_COST = 250;

interface ChangeNicknameModalProps {
  currentUsername: string | null;
  tokens: number;
  onUpdateUsername: (name: string) => Promise<UpdateUsernameResult>;
  onSpendTokens: (amount: number) => Promise<boolean>;
  onClose: () => void;
}

export function ChangeNicknameModal({ currentUsername, tokens, onUpdateUsername, onSpendTokens, onClose }: ChangeNicknameModalProps) {
  const [name, setName] = useState(currentUsername ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const canAfford = tokens >= NICKNAME_CHANGE_COST;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canAfford) {
      setError(`Você precisa de ${NICKNAME_CHANGE_COST} tokens.`);
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await onUpdateUsername(name);
    if (!result.ok) {
      setSubmitting(false);
      setError(result.error ?? 'Não foi possível alterar o nome de usuário.');
      return;
    }
    await onSpendTokens(NICKNAME_CHANGE_COST);
    setSubmitting(false);
    setSuccess(true);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative w-full max-w-sm rounded-2xl border border-code-500/25 bg-void-900 p-4 shadow-[0_0_60px_-10px_rgba(57,255,156,0.25)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xs font-bold uppercase tracking-wide text-white text-glow-code">Alterar nickname</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-white/50 transition hover:bg-void-700 hover:text-white">
            <Icon name="x" size={16} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-code-500/25 bg-code-900/20 px-4 py-6 text-center">
            <Icon name="check-circle" size={24} className="text-code-400" />
            <p className="text-sm text-white/80">Nome de usuário atualizado!</p>
            <button
              onClick={onClose}
              className="mt-1 font-display text-xs font-bold uppercase tracking-wide text-code-400 hover:text-code-300"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex items-center gap-2 rounded-lg border border-void-600 bg-void-800/60 px-3 py-2.5 focus-within:border-code-500/60">
              <Icon name="user" size={15} className="shrink-0 text-white/40" />
              <input
                type="text"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                title="3–20 caracteres: letras, números e underscore"
                autoComplete="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent font-mono text-sm text-white/90 placeholder:text-white/30 focus:outline-none"
              />
            </label>

            <div className={`flex items-center gap-1.5 text-xs ${canAfford ? 'text-white/50' : 'text-signal-red'}`}>
              <Icon name="gem" size={13} />
              Custa {NICKNAME_CHANGE_COST} tokens (você tem {tokens})
            </div>

            {error && <p className="rounded-lg border border-signal-red/30 bg-signal-red/10 px-3 py-2 text-xs text-signal-red">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !canAfford}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-code-500 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400 disabled:opacity-60"
            >
              {submitting && <Icon name="loader" size={14} className="animate-spin" />}
              Confirmar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
