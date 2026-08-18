import { useMemo } from 'react';
import { buildNameToId, type BattleLogEntry, type Combatant } from '../engine';
import { toBattleUnits } from '../data/battleUnits';
import { useBattleReplay, type AbilityCastEvent, type AttackAnimEvent, type FloatingText } from './useBattleReplay';
import type { BattleUnit, ChatMessage } from '../types';

/**
 * Plays a single already-resolved PvP fight (supabase/functions/pvp-attack's response) through
 * the same replay/animation machinery PvE uses — just without any of PvE's world-progression or
 * reward-accrual concerns, since a PvP attack is a one-shot result the server already committed.
 */
export interface UsePvpBattleOptions {
  log: BattleLogEntry[];
  attackers: Combatant[];
  defenders: Combatant[];
  /** Bump this (e.g. a fresh object per attack) whenever a new fight should start playing from t=0. */
  battleKey: string;
  playing: boolean;
}

export interface PvpBattle {
  allies: BattleUnit[];
  enemies: BattleUnit[];
  logFeed: ChatMessage[];
  floaters: FloatingText[];
  activeAbilities: AbilityCastEvent[];
  attackAnims: AttackAnimEvent[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
}

export function usePvpBattle(options: UsePvpBattleOptions): PvpBattle {
  const { log, attackers, defenders, battleKey, playing } = options;
  const nameToId = useMemo(() => buildNameToId(attackers, defenders), [attackers, defenders]);
  const replay = useBattleReplay({ log, allies: attackers, enemies: defenders, nameToId, resetKey: battleKey, playing });

  return {
    allies: toBattleUnits(attackers, replay.replay, replay.replay.allyOrder, true),
    enemies: toBattleUnits(defenders, replay.replay, replay.replay.enemyOrder, false),
    logFeed: replay.abilityLogFeed,
    floaters: replay.floaters,
    activeAbilities: replay.activeAbilities,
    attackAnims: replay.attackAnims,
    finished: replay.finished,
    winner: replay.winner,
  };
}
