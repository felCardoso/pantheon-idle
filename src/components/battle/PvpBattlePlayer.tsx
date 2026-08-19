import { usePvpBattle } from '../../hooks/usePvpBattle';
import { PvpBattleStage } from './PvpBattleStage';
import type { PvpAttackResult } from '../../hooks/usePvp';

interface PvpBattlePlayerProps {
  opponentName: string;
  result: PvpAttackResult;
  onContinue: () => void;
}

/**
 * Plays one already-resolved PvP attack.
 *
 * Split out so `usePvpBattle` is only ever mounted while a fight is actually on screen, and so
 * both entry points can share it: the opponent list's Atacar button, and the random encounters
 * that interrupt a PvE run (lib/battle-resolve.ts's rollPvpEncounter).
 */
export function PvpBattlePlayer({ opponentName, result, onContinue }: PvpBattlePlayerProps) {
  const battle = usePvpBattle({
    log: result.log,
    attackers: result.attackers,
    defenders: result.defenders,
    battleKey: opponentName,
    playing: true,
  });

  return (
    <PvpBattleStage
      attackerName="Você"
      defenderName={opponentName}
      allies={battle.allies}
      enemies={battle.enemies}
      floaters={battle.floaters}
      activeAbilities={battle.activeAbilities}
      attackAnims={battle.attackAnims}
      finished={battle.finished}
      winner={battle.winner}
      onContinue={onContinue}
    />
  );
}
