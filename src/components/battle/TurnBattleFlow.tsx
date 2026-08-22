import { useEffect, useRef } from 'react';
import { TurnBattleStage } from './TurnBattleStage';
import { Icon } from '../common/Icon';
import { usePvpTurnBattle, type TurnBattleOutcome } from '../../hooks/usePvpTurnBattle';
import type { PvpOpponent } from '../../hooks/usePvp';

interface TurnBattleFlowProps {
  attackerName: string;
  opponent: PvpOpponent;
  onFinished: (outcome: TurnBattleOutcome) => void;
  /** The battle couldn't even start (no defense team, function not deployed, etc.) — nothing to show, drop it. */
  onFailed: (message: string) => void;
}

/**
 * Owns one turn-based PvP battle end to end: starts it against `opponent` on mount, plays it
 * through TurnBattleStage's action picker, and reports back once it's over. Replaces the old
 * PvpBattlePlayer, which only ever replayed an already-finished fight — this one is live.
 */
export function TurnBattleFlow({ attackerName, opponent, onFinished, onFailed }: TurnBattleFlowProps) {
  const turnBattle = usePvpTurnBattle();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const ok = await turnBattle.startBattle(opponent);
      if (!ok) onFailed(turnBattle.error ?? 'Não foi possível iniciar a batalha.');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (turnBattle.round === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void-950/90">
        <div className="flex items-center gap-2 text-white/60">
          <Icon name="loader" size={16} className="animate-spin" />
          <span className="text-xs">Conectando à batalha...</span>
        </div>
      </div>
    );
  }

  return (
    <TurnBattleStage
      attackerName={attackerName}
      defenderName={opponent.username}
      allies={turnBattle.allies}
      enemies={turnBattle.enemies}
      round={turnBattle.round}
      pendingAllyUnitId={turnBattle.pendingAllyUnitId}
      log={turnBattle.log}
      finished={turnBattle.finished}
      winner={turnBattle.winner}
      loading={turnBattle.loading}
      error={turnBattle.error}
      onAct={turnBattle.act}
      onContinue={() => {
        if (turnBattle.outcome) onFinished(turnBattle.outcome);
        else onFailed('A batalha terminou sem um resultado válido.');
      }}
    />
  );
}
