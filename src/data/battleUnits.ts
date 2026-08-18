import type { Combatant, ReplayState } from '../engine';
import {
  DISPLAY_PORTRAIT_BY_TEMPLATE_ID,
  DISPLAY_RARITY_BY_TEMPLATE_ID,
  ENEMY_LEVEL_BY_TEMPLATE_ID,
  FALLBACK_FACTION,
  FALLBACK_RARITY,
} from './engineDisplay';
import type { ActiveStatus, BattleUnit } from '../types';

function toActiveStatuses(statuses: ReplayState['units'][string]['statuses']): ActiveStatus[] {
  return Object.entries(statuses)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([type, count]) => ({ type: type as ActiveStatus['type'], count: count ?? 0 }));
}

/**
 * Turns this battle's static Combatant templates + a live ReplayState snapshot into what
 * UnitCard/BattleStage actually render. Shared by PvE (useBattleSimulation) and PvP
 * (usePvpBattle) so both read a battle the same way.
 *
 * `isAllySide` is which SCREEN SIDE this call is for (left/ally vs right/enemy) — it is NOT the
 * same thing as a Combatant's own `.isAlly` field, which the engine uses for build rules (player-
 * character stat/ability rules vs enemy-template ones) and stays true even for a PvP *defender*,
 * since defenders are loaded the same way an owner's own roster is. Screen side is positional
 * (whichever of runBattle's two team arrays a unit came from), so the caller — which already
 * knows it's rendering the allies array vs the enemies array — passes it explicitly rather than
 * this function inferring it from `.isAlly`.
 */
export function toBattleUnits(templates: Combatant[], replay: ReplayState, order: string[], isAllySide: boolean): BattleUnit[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  return order.map((id) => {
    const t = byId.get(id)!;
    const snapshot = replay.units[t.id];
    return {
      id: t.id,
      name: t.name,
      faction: t.faction ?? FALLBACK_FACTION,
      rarity: DISPLAY_RARITY_BY_TEMPLATE_ID[t.templateId] ?? FALLBACK_RARITY,
      // t.isAlly (not isAllySide) is what tells a real player-character build (real xp-derived
      // level) apart from a PvE enemy template (level always 0, ENEMY_LEVEL_BY_TEMPLATE_ID's
      // cosmetic placeholder instead) — see this function's doc comment on the distinction.
      level: t.isAlly ? t.level : (ENEMY_LEVEL_BY_TEMPLATE_ID[t.templateId] ?? 1),
      hp: snapshot?.hp ?? t.maxHp,
      maxHp: t.maxHp,
      shield: snapshot?.shield ?? 0,
      statuses: snapshot ? toActiveStatuses(snapshot.statuses) : [],
      isAlly: isAllySide,
      portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[t.templateId],
    };
  });
}
