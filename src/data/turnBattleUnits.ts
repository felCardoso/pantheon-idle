import type { StatusEffectInstance, TurnCombatant } from '../engine';
import { DISPLAY_PORTRAIT_BY_TEMPLATE_ID, DISPLAY_RARITY_BY_TEMPLATE_ID, ENEMY_LEVEL_BY_TEMPLATE_ID, FALLBACK_FACTION, FALLBACK_RARITY } from './engineDisplay';
import type { ActiveStatus, BattleUnit } from '../types';

function toActiveStatuses(statuses: StatusEffectInstance[]): ActiveStatus[] {
  const counts = new Map<ActiveStatus['type'], number>();
  for (const s of statuses) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
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
