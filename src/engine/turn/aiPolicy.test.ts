import { describe, expect, it } from 'vitest';
import { decideEnemyAction } from './aiPolicy';
import { makeTurnAbility, makeTurnCombatant } from './testUtils';

describe('decideEnemyAction — chosenTarget ability allegiance', () => {
  it('aims a support ability (buffAttribute) at its own lowest-HP ally, never at the opposing side', () => {
    const empowerAlly = makeTurnAbility({
      id: 'empower-ally',
      trigger: 'onTurnStart',
      effects: [{ type: 'buffAttribute', target: 'chosenTarget', attribute: 'atk', magnitude: { kind: 'percent', value: 0.5 }, durationSeconds: 1 }],
    });
    const caster = makeTurnCombatant({ id: 'caster', name: 'Caster', activeAbilities: [empowerAlly] });
    const woundedAlly = makeTurnCombatant({ id: 'ally', name: 'Ally', hp: 100, maxHp: 1000 });
    const enemy = makeTurnCombatant({ id: 'enemy', name: 'Enemy', isAlly: false, hp: 1, maxHp: 1000 }); // lowest HP overall, but on the wrong side

    const action = decideEnemyAction(caster, [caster, woundedAlly], [enemy]);
    expect(action).toEqual({ type: 'ability', targetId: 'ally' });
  });

  it('aims an offense ability (directDamage) at the opposing side, never at its own team', () => {
    const bolt = makeTurnAbility({
      id: 'bolt',
      trigger: 'onTurnStart',
      effects: [{ type: 'directDamage', target: 'chosenTarget', magnitude: { kind: 'flat', value: 100 } }],
    });
    const caster = makeTurnCombatant({ id: 'caster', name: 'Caster', activeAbilities: [bolt] });
    const ally = makeTurnCombatant({ id: 'ally', name: 'Ally', hp: 1, maxHp: 1000 }); // lowest HP overall, but on the caster's own side
    const enemy = makeTurnCombatant({ id: 'enemy', name: 'Enemy', isAlly: false, hp: 500, maxHp: 1000 });

    const action = decideEnemyAction(caster, [caster, ally], [enemy]);
    expect(action).toEqual({ type: 'ability', targetId: 'enemy' });
  });
});
