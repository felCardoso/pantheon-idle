import type { StatusEffectInstance, StatusType, TurnCombatant, UnitSnapshot } from '../engine';
import { DISPLAY_PORTRAIT_BY_TEMPLATE_ID, DISPLAY_RARITY_BY_TEMPLATE_ID, ENEMY_LEVEL_BY_TEMPLATE_ID, FALLBACK_FACTION, FALLBACK_RARITY } from './engineDisplay';
import type { ActiveStatus, BattleUnit } from '../types';

function toActiveStatuses(statuses: StatusEffectInstance[]): ActiveStatus[] {
  const counts = new Map<ActiveStatus['type'], number>();
  for (const s of statuses) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

function toActiveStatusesFromSnapshot(statuses: Partial<Record<StatusType, number>>): ActiveStatus[] {
  return Object.entries(statuses)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([type, count]) => ({ type: type as ActiveStatus['type'], count: count ?? 0 }));
}

/**
 * Turn-mode's counterpart to battleUnits.ts's toBattleUnits — no replay/snapshot layer needed
 * here: a TurnCombatant's hp/shield/statuses are already the live current values (the engine
 * mutates them in place — src/engine/turn/roundLoop.ts — and the server hands back the current
 * roster with every pvp-turn-start/pvp-turn-act response), so there's nothing to replay.
 *
 * `isAllySide` is the screen side (which array this unit came from), the same distinction
 * battleUnits.ts's toBattleUnits documents — not the same as TurnCombatant.isAlly, which is an
 * engine build-rule flag that stays true for the defender's roster too.
 */
export function toTurnBattleUnit(unit: TurnCombatant, isAllySide: boolean): BattleUnit {
  return {
    id: unit.id,
    name: unit.name,
    faction: unit.faction ?? FALLBACK_FACTION,
    rarity: DISPLAY_RARITY_BY_TEMPLATE_ID[unit.templateId] ?? FALLBACK_RARITY,
    level: unit.isAlly ? unit.level : (ENEMY_LEVEL_BY_TEMPLATE_ID[unit.templateId] ?? 1),
    hp: unit.hp,
    maxHp: unit.maxHp,
    shield: unit.shield,
    statuses: toActiveStatuses(unit.statuses),
    isAlly: isAllySide,
    isVanguard: false,
    portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[unit.templateId],
  };
}

/**
 * Turn-mode's counterpart to battleUnits.ts's toBattleUnits, for PvE's "watch it play out"
 * replay of an already-finished turn battle (useTurnBattleReplay) — unlike toTurnBattleUnit
 * above (live PvP state), here hp/shield/statuses come from a replay snapshot that starts at
 * full HP and steps forward with the log, not from the TurnCombatant's own (already-final)
 * fields. Turn mode has no Vanguard/queue reordering, so `templates` is rendered in its own
 * fixed order — no separate order array needed.
 */
export function toTurnReplayBattleUnits(templates: TurnCombatant[], units: Record<string, UnitSnapshot>, isAllySide: boolean): BattleUnit[] {
  return templates.map((unit) => {
    const snapshot = units[unit.id];
    return {
      id: unit.id,
      name: unit.name,
      faction: unit.faction ?? FALLBACK_FACTION,
      rarity: DISPLAY_RARITY_BY_TEMPLATE_ID[unit.templateId] ?? FALLBACK_RARITY,
      level: unit.isAlly ? unit.level : (ENEMY_LEVEL_BY_TEMPLATE_ID[unit.templateId] ?? 1),
      hp: snapshot?.hp ?? unit.maxHp,
      maxHp: unit.maxHp,
      shield: snapshot?.shield ?? 0,
      statuses: snapshot ? toActiveStatusesFromSnapshot(snapshot.statuses) : [],
      isAlly: isAllySide,
      isVanguard: false,
      portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[unit.templateId],
    };
  });
}
