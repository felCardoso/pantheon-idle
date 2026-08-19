import { useEffect, useState } from 'react';
import { Icon } from '../common/Icon';
import { pvpRankTierFor } from '../../data/pvpRank';
import { PvpBattlePlayer } from '../battle/PvpBattlePlayer';
import type { PvpAttackResult, PvpOpponent, UsePvpResult } from '../../hooks/usePvp';

interface PvpAttackModalProps {
  pvp: UsePvpResult;
  onRewardCredits: (amount: number) => void;
  onToast: (message: string) => void;
  onClose: () => void;
}

/**
 * Opponent-list + attack flow, carried over from the now-removed Arena page.
 * Defense-team selection lives in the Team page itself now (whichever `.cfg`
 * is marked PvP there) — this modal is only the "find and attack someone"
 * surface, since Team no longer has a dedicated page to launch it from.
 */
export function PvpAttackModal({ pvp, onRewardCredits, onToast, onClose }: PvpAttackModalProps) {
  const [opponents, setOpponents] = useState<PvpOpponent[]>([]);
  const [loadingOpponents, setLoadingOpponents] = useState(false);
  const [attacking, setAttacking] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ opponent: PvpOpponent; result: PvpAttackResult } | null>(null);
  /** Non-null while the fight itself is playing (PvpBattleStage) — the rating/reward summary only reveals once the player continues past it. */
  const [playingBattle, setPlayingBattle] = useState<{ opponent: PvpOpponent; result: PvpAttackResult } | null>(null);

  async function refreshOpponents() {
    setLoadingOpponents(true);
    setOpponents(await pvp.findOpponents());
    setLoadingOpponents(false);
  }

  useEffect(() => {
    refreshOpponents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAttack(opponent: PvpOpponent) {
    if (attacking) return;
    setAttacking(opponent.userId);
    const outcome = await pvp.attack(opponent);
    setAttacking(null);
    if (!outcome.ok) {
      onToast(outcome.message);
      return;
    }
    setPlayingBattle({ opponent, result: outcome.result });
  }

  function handleBattleContinue() {
    if (!playingBattle) return;
    const { opponent, result } = playingBattle;
    setPlayingBattle(null);
    setLastResult({ opponent, result });
    onRewardCredits(result.rewardCredits);
    onToast(
      result.won
        ? `Vitória! +${result.rewardCredits} créditos, ${result.ratingDelta >= 0 ? '+' : ''}${result.ratingDelta} rating.`
        : `Derrota. ${result.ratingDelta >= 0 ? '+' : ''}${result.ratingDelta} rating.`,
    );
    refreshOpponents();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-void-600 bg-void-900 p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white">Oponentes PvP</h2>
            <p className="text-xs text-white/50">Ataca o time PvP salvo por outros jogadores.</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={refreshOpponents} className="rounded-lg p-1.5 text-white/40 transition hover:text-white/70">
              <Icon name="repeat" size={14} />
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 transition hover:text-white/70">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-center gap-4 rounded-lg border border-arcane-400/25 bg-void-800/50 px-3 py-2">
          <div className="text-center">
            <p className="font-mono text-sm font-bold text-arcane-300">{pvp.rating}</p>
            <p className="text-[9px] uppercase tracking-wide text-white/40">{pvpRankTierFor(pvp.rating).name}</p>
          </div>
          <div className="h-6 w-px bg-void-600" />
          <div className="text-center">
            <p className="font-mono text-sm font-bold text-code-400">{pvp.wins}</p>
            <p className="text-[9px] uppercase tracking-wide text-white/40">Vitórias</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-sm font-bold text-signal-red">{pvp.losses}</p>
            <p className="text-[9px] uppercase tracking-wide text-white/40">Derrotas</p>
          </div>
        </div>

        {lastResult && (
          <div
            className={`mb-3 flex items-center justify-between gap-3 rounded-xl border p-3 ${
              lastResult.result.won ? 'border-code-500/30 bg-code-900/20' : 'border-signal-red/30 bg-signal-red/10'
            }`}
          >
            <div>
              <p className={`font-display text-xs font-bold ${lastResult.result.won ? 'text-code-400' : 'text-signal-red'}`}>
                {lastResult.result.won ? 'Vitória!' : 'Derrota'} vs {lastResult.opponent.username}
              </p>
              <p className="text-[11px] text-white/60">
                +{lastResult.result.rewardCredits} créditos · {lastResult.result.ratingDelta >= 0 ? '+' : ''}
                {lastResult.result.ratingDelta} rating (agora {lastResult.result.newRating})
              </p>
            </div>
            <button onClick={() => setLastResult(null)} className="rounded-lg p-1 text-white/40 transition hover:text-white/70">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingOpponents ? (
            <p className="p-4 text-xs text-white/40">Carregando...</p>
          ) : opponents.length === 0 ? (
            <p className="rounded-xl border border-void-600 bg-void-800/30 p-4 text-xs text-white/40">Nenhum oponente com time PvP salvo ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {opponents.map((o) => (
                <div key={o.userId} className="flex items-center justify-between gap-3 rounded-lg border border-void-600 bg-void-800/50 p-3">
                  <div className="flex items-center gap-2">
                    <Icon name="crosshair" size={16} className="text-signal-red" />
                    <div>
                      <p className="text-sm text-white">{o.username}</p>
                      <p className="font-mono text-xs text-white/50">
                        {o.rating} · {pvpRankTierFor(o.rating).name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAttack(o)}
                    disabled={attacking !== null}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-signal-red/80 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-signal-red disabled:opacity-50"
                  >
                    {attacking === o.userId && <Icon name="loader" size={12} className="animate-spin" />}
                    Atacar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {playingBattle && (
        <PvpBattlePlayer
          key={playingBattle.opponent.userId + playingBattle.result.newRating}
          opponentName={playingBattle.opponent.username}
          result={playingBattle.result}
          onContinue={handleBattleContinue}
        />
      )}
    </div>
  );
}
