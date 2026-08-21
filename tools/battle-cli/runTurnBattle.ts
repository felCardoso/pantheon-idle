import {
  applyPlayerAction,
  createTurnBattle,
  loadTurnCombatantsByIds,
  pendingAllyUnit,
  type TurnAction,
  type TurnCombatant,
} from '../../src/engine';
import { formatTurnLogEntry } from './formatTurn';

function parseArgs(argv: string[]) {
  const seedArg = argv.find((a) => a.startsWith('--seed='));
  const seed = seedArg ? Number(seedArg.split('=')[1]) : 20260821;
  return { seed };
}

function printRoster(label: string, units: TurnCombatant[]) {
  console.log(`\n${label}`);
  for (const u of units) {
    const ability = u.activeAbilities[0]?.name ?? '—';
    console.log(`  ${u.name.padEnd(20)} HP ${u.maxHp.toString().padStart(6)}  ATK ${u.base.atk.toString().padStart(4)}  Linha ${u.row.padEnd(5)}  Ativa: ${ability}`);
  }
}

function printFinalHp(label: string, units: TurnCombatant[]) {
  console.log(`\n${label}`);
  for (const u of units) {
    const status = u.hp > 0 ? `${u.hp}/${u.maxHp}` : 'derrotado';
    console.log(`  ${u.name.padEnd(20)} ${status}`);
  }
}

/**
 * A simple scripted stand-in for the (not-yet-built, Phase D) interactive player: use the
 * equipped active ability whenever it's off cooldown, aimed at the lowest-HP legal enemy if the
 * ability needs a chosen target; otherwise basic-attack the lowest-HP legal enemy. This mirrors
 * src/engine/turn/aiPolicy.ts's heuristic, but can't import it directly — tools/battle-cli may
 * only reach the engine through its public barrel (../../src/engine), same rule any other engine
 * consumer follows.
 */
function lowestHpOf(pool: TurnCombatant[]): TurnCombatant | undefined {
  const alive = pool.filter((c) => c.hp > 0);
  return alive.length === 0 ? undefined : alive.reduce((best, c) => (c.hp < best.hp ? c : best));
}

/** Mirrors src/engine/turn/aiPolicy.ts's isSupportAbility — a chosenTarget ability whose effect is heal/grantShield/buffAttribute/dispel is aimed at an ally, not an enemy. */
function isSupportAbility(ability: TurnCombatant['activeAbilities'][number]): boolean {
  const chosenTargetEffect = ability.effects.find((e) => e.target === 'chosenTarget');
  return chosenTargetEffect?.type === 'heal' || chosenTargetEffect?.type === 'grantShield' || chosenTargetEffect?.type === 'buffAttribute' || chosenTargetEffect?.type === 'dispel';
}

function decideScriptedAction(unit: TurnCombatant, allies: TurnCombatant[], enemies: TurnCombatant[]): TurnAction {
  const lowestEnemy = lowestHpOf(enemies);
  const ability = unit.activeAbilities[0];
  if (ability && (unit.abilityCooldownRemaining[ability.id] ?? 0) <= 0) {
    const needsTarget = ability.effects.some((e) => e.target === 'chosenTarget');
    if (!needsTarget) return { type: 'ability' };
    const target = isSupportAbility(ability) ? lowestHpOf(allies) : lowestEnemy;
    if (target) return { type: 'ability', targetId: target.id };
  }
  return { type: 'basicAttack', targetId: lowestEnemy?.id };
}

function main() {
  const { seed } = parseArgs(process.argv.slice(2));

  // Demonstrates the 3 synergy kits from src/engine/data/turnAbilities.json:
  // Zeus stuns the whole enemy team for a round, Saci channels a big hit over 2 rounds (the
  // stun buys him the safety to do it), Curupira empowers an ally's next attack, and Freya
  // (Zero-Day, so her turn-only passive is unlocked) gains ATK whenever Odin's real PvE passive
  // (reused verbatim in turn mode) shields the team at battleStart.
  const allies = loadTurnCombatantsByIds([
    { id: 'odin', xp: 0, rarity: 'Zero-Day', row: 'back' },
    { id: 'freya', xp: 0, rarity: 'Zero-Day', row: 'back' },
    { id: 'zeus', xp: 0, row: 'front' },
    { id: 'saci', xp: 0, row: 'front' },
  ]);
  const enemies = loadTurnCombatantsByIds([
    { id: 'hades', xp: 0, row: 'front' },
    { id: 'atena', xp: 0, row: 'back' },
  ]);

  console.log('Pantheon Idle — Simulação de combate por turnos (PvP 5x5)');
  console.log(`Seed: ${seed}`);
  printRoster('Time atacante:', allies);
  printRoster('Time defensor:', enemies);

  const state = createTurnBattle(allies, enemies, seed);

  let guard = 0;
  while (!state.winner && guard < 200) {
    guard += 1;
    const unit = pendingAllyUnit(state);
    if (!unit) break;
    applyPlayerAction(state, unit.id, decideScriptedAction(unit, state.allies, state.enemies));
  }

  for (const entry of state.log) {
    const line = formatTurnLogEntry(entry);
    if (line !== null) console.log(line);
  }

  console.log(`\nVencedor: ${state.winner}`);
  printFinalHp('HP final — time atacante:', state.allies);
  printFinalHp('HP final — time defensor:', state.enemies);
}

main();
