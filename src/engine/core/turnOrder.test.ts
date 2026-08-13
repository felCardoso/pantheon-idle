import { describe, expect, it } from 'vitest';
import { computeTurnOrder } from './turnOrder';
import { makeCombatant } from './testUtils';

describe('computeTurnOrder', () => {
  it('orders living units by INI descending', () => {
    const slow = makeCombatant({ name: 'slow', baseStats: { ini: 50 } });
    const fast = makeCombatant({ name: 'fast', baseStats: { ini: 120 } });
    const mid = makeCombatant({ name: 'mid', baseStats: { ini: 90 } });

    const order = computeTurnOrder([slow, fast, mid]);

    expect(order.map((c) => c.name)).toEqual(['fast', 'mid', 'slow']);
  });

  it('excludes dead units', () => {
    const alive = makeCombatant({ name: 'alive', baseStats: { ini: 50 } });
    const dead = makeCombatant({ name: 'dead', baseStats: { ini: 999, hp: 0 } });

    const order = computeTurnOrder([alive, dead]);

    expect(order.map((c) => c.name)).toEqual(['alive']);
  });

  it('Saci.exe-style alwaysActsFirst overrides INI entirely, every round', () => {
    const speedy = makeCombatant({ name: 'speedy', baseStats: { ini: 200 } });
    const saci = makeCombatant({ name: 'saci', baseStats: { ini: 80 }, alwaysActsFirst: true });

    const order = computeTurnOrder([speedy, saci]);

    expect(order.map((c) => c.name)).toEqual(['saci', 'speedy']);
  });
});
