import { describe, expect, it } from 'vitest';
import { loadCharactersByIds, loadJurupariAllies, loadJurupariBoss, loadJurupariComuns, loadWorldBoss, loadWorldComuns } from './loader';

describe('loadJurupariAllies', () => {
  it('loads the 4 Jurupari.iso characters with the 4-person mythological synergy (+21%) folded into HP/ATK', () => {
    const allies = loadJurupariAllies();
    expect(allies.map((a) => a.name)).toEqual(['Jurupari.exe', 'Curupira.exe', 'Caipora.exe', 'Saci.exe']);

    const jurupari = allies.find((a) => a.name === 'Jurupari.exe')!;
    // Every character starts at the Alpha (lowest) tier: HP 800, ATK 80 -> +21% synergy
    expect(jurupari.maxHp).toBe(Math.round(800 * 1.21));
    expect(jurupari.base.atk).toBe(Math.round(80 * 1.21));
    // DEF/INI/ESQ/ICE are ability-granted only (schema.ts) — 0 for every ally today, untouched by
    // synergy or level scaling.
    expect(jurupari.base.def).toBe(0);
    expect(jurupari.base.vel).toBe(0);
    expect(jurupari.base.esq).toBe(0);
    expect(jurupari.base.ice).toBe(0);
  });

  it('gives Jurupari.exe its +1s status duration passive', () => {
    const allies = loadJurupariAllies();
    expect(allies.find((a) => a.name === 'Jurupari.exe')!.statusDurationBonus).toBe(1);
  });
});

describe('loadCharactersByIds', () => {
  it('looks up characters across mythologies by id', () => {
    const team = loadCharactersByIds([
      { id: 'jurupari', xp: 0 },
      { id: 'odin', xp: 0 },
      { id: 'zeus', xp: 0 },
    ]);
    expect(team.map((c) => c.name)).toEqual(['Jurupari.exe', 'Odin.exe', 'Zeus.exe']);
  });

  it('applies the synergy bonus per same-mythology subgroup, not by raw team size', () => {
    const solo = loadCharactersByIds([{ id: 'saci', xp: 0 }]);
    expect(solo[0].maxHp).toBe(800); // no bonus at group size 1 (no "1" entry in synergyByCount)

    // jurupari/odin/zeus are 3 different mythologies (Folclore/Nórdica/Grega) — a mixed team gets
    // no bonus for any of them, since each mythology's own subgroup size is still just 1.
    const mixedTrio = loadCharactersByIds([
      { id: 'jurupari', xp: 0 },
      { id: 'odin', xp: 0 },
      { id: 'zeus', xp: 0 },
    ]);
    expect(mixedTrio.map((c) => c.maxHp)).toEqual([800, 800, 800]);

    // curupira/caipora/saci are all Folclore Brasileiro — a same-mythology trio gets the real +12%.
    const sameMythologyTrio = loadCharactersByIds([
      { id: 'curupira', xp: 0 },
      { id: 'caipora', xp: 0 },
      { id: 'saci', xp: 0 },
    ]);
    expect(sameMythologyTrio[0].maxHp).toBe(Math.round(800 * 1.12));

    // Mixing mythologies applies each character's own mythology-subgroup bonus independently: the
    // 2 Folclore members get +5% (group of 2), the 1 Nórdica member gets none (group of 1).
    const partialMix = loadCharactersByIds([
      { id: 'curupira', xp: 0 },
      { id: 'caipora', xp: 0 },
      { id: 'odin', xp: 0 },
    ]);
    expect(partialMix.map((c) => c.maxHp)).toEqual([Math.round(800 * 1.05), Math.round(800 * 1.05), 800]);
  });

  it('throws for an unknown character id', () => {
    expect(() => loadCharactersByIds([{ id: 'not-a-real-character', xp: 0 }])).toThrow(/Unknown character id/);
  });

  it('derives level from xp and scales stats via levelMultiplier (+2%/level)', () => {
    const [fresh] = loadCharactersByIds([{ id: 'saci', xp: 0 }]);
    expect(fresh.level).toBe(0);
    expect(fresh.maxHp).toBe(800);

    // 100 xp crosses the level-0 threshold -> level 1 -> +2%
    const [leveled] = loadCharactersByIds([{ id: 'saci', xp: 100 }]);
    expect(leveled.level).toBe(1);
    expect(leveled.maxHp).toBe(Math.round(800 * 1.02));
  });

  it('resolves Medusa/Hércules/Minotauro to only their first candidate active ability (v2: one equipped active at a time; activeOptions[0] wins with no selection)', () => {
    const [medusa, hercules, minotauro] = loadCharactersByIds([
      { id: 'medusa', xp: 0 },
      { id: 'hercules', xp: 0 },
      { id: 'minotauro', xp: 0 },
    ]);
    expect(medusa.name).toBe('Medusa.exe');
    expect(medusa.activeAbilities.map((a) => a.id)).toEqual(['medusa-petrificar']);
    expect(hercules.name).toBe('Hércules.exe');
    expect(hercules.activeAbilities.map((a) => a.id)).toEqual(['hercules-impacto']);
    expect(minotauro.name).toBe('Minotauro.exe');
    expect(minotauro.activeAbilities.map((a) => a.id)).toEqual(['minotauro-provocar']);
  });

  it('resolves Amaterasu.exe (Mitologia Japonesa) to only her first candidate active ability', () => {
    const [amaterasu] = loadCharactersByIds([{ id: 'amaterasu', xp: 0 }]);
    expect(amaterasu.name).toBe('Amaterasu.exe');
    expect(amaterasu.activeAbilities.map((a) => a.id)).toEqual(['amaterasu-regen-team']);
  });

  it('equips selectedAbilityId when it names an id actually in activeOptions', () => {
    const [medusa] = loadCharactersByIds([{ id: 'medusa', xp: 0, selectedAbilityId: 'medusa-petrificar' }]);
    expect(medusa.activeAbilities.map((a) => a.id)).toEqual(['medusa-petrificar']);
  });

  it('falls back to activeOptions[0] when selectedAbilityId is not one of the character\'s options (e.g. a stale/unauthored id)', () => {
    const [medusa] = loadCharactersByIds([{ id: 'medusa', xp: 0, selectedAbilityId: 'not-a-real-option' }]);
    expect(medusa.activeAbilities.map((a) => a.id)).toEqual(['medusa-petrificar']);
  });

  it('never equips a passive below Zero-Day, and equipping the active is unaffected by rarity', () => {
    // No character has an authored passiveAbilityId yet, so passiveAbilities is
    // empty at every tier — this pins the gate's *shape* (rarity never leaks
    // into the active slot) rather than a positive unlock, which needs content.
    for (const rarity of ['Alpha', 'LTS', 'Zero-Day'] as const) {
      const [medusa] = loadCharactersByIds([{ id: 'medusa', xp: 0, rarity }]);
      expect(medusa.activeAbilities.map((a) => a.id)).toEqual(['medusa-petrificar']);
      expect(medusa.passiveAbilities).toEqual([]);
    }
  });
});

describe('loadJurupariComuns / loadJurupariBoss', () => {
  it('loads exactly `count` enemies, one of each archetype in order, with no synergy bonus applied', () => {
    const comuns = loadJurupariComuns(3);
    expect(comuns.map((c) => c.name)).toEqual(['Mula-sem-Cabeça.sh', 'Boitatá.sh', 'Iara.sh']);
    expect(comuns.find((c) => c.name === 'Boitatá.sh')!.maxHp).toBe(600);
  });

  it('supports a wave smaller than the 3 archetypes', () => {
    const comuns = loadJurupariComuns(2);
    expect(comuns.map((c) => c.name)).toEqual(['Mula-sem-Cabeça.sh', 'Boitatá.sh']);
  });

  it('cycles back through the archetypes with unique ids once count exceeds 3', () => {
    const comuns = loadJurupariComuns(5);
    expect(comuns.map((c) => c.name)).toEqual([
      'Mula-sem-Cabeça.sh',
      'Boitatá.sh',
      'Iara.sh',
      'Mula-sem-Cabeça.sh',
      'Boitatá.sh',
    ]);
    expect(comuns.map((c) => c.id)).toEqual([
      'script-kiddie',
      'firewall-turret',
      'corrupted-daemon',
      'script-kiddie#2',
      'firewall-turret#2',
    ]);
  });

  it('loads Anhangá.exe with its calibrated stats', () => {
    const [boss] = loadJurupariBoss();
    expect(boss.name).toBe('Anhangá.exe');
    expect(boss.maxHp).toBe(2000);
    expect(boss.base.atk).toBe(112);
    expect(boss.base.def).toBe(0.2);
  });

  it('scales only the pools (HP/ATK) by the given multiplier, never DEF/VEL/ESQ', () => {
    // Difficulty has to scale once, not several times over: DEF is a mitigation fraction and
    // VEL a rate, so multiplying them alongside HP/ATK compounded a world's step into a far
    // steeper jump than its multiplier implied. They now stay exactly as authored.
    const scaled = loadJurupariComuns(3, 1.2); // estágio 5 of a fase (+20%)
    const boitata = scaled.find((c) => c.name === 'Boitatá.sh')!;
    expect(boitata.maxHp).toBe(Math.round(600 * 1.2));
    expect(boitata.base.def).toBeCloseTo(0.3);
    expect(boitata.base.vel).toBeCloseTo(0.4);
  });

  it('scales the boss by an optional multiplier too (team-size scaling)', () => {
    const [boss] = loadJurupariBoss(0.25);
    expect(boss.maxHp).toBe(Math.round(2000 * 0.25));
  });
});

describe('loadWorldComuns / loadWorldBoss', () => {
  it('loads every world\'s comuns at the same calibrated baseline (world difficulty comes from the statMultiplier, not hand-tuned comuns stats)', () => {
    for (const worldId of ['jurupari', 'duat', 'orun', 'takamagahara', 'olympus', 'yggdrasil'] as const) {
      expect(loadWorldComuns(worldId, 3).map((c) => c.maxHp)).toEqual([200, 600, 350]);
    }
  });

  it('gives each world\'s boss its own stat profile, so the six fights do not all play the same', () => {
    // Unlike the comuns, bosses are individually calibrated: they were once six copies of one
    // placeholder block (12000 HP / 250 ATK / 0.5 DEF), which no roster could out-damage inside
    // the 50s limit at any level. Each is now its own archetype, sized against real player DPS.
    const profiles = ['jurupari', 'duat', 'orun', 'takamagahara', 'olympus', 'yggdrasil'].map((w) => {
      const [boss] = loadWorldBoss(w as Parameters<typeof loadWorldBoss>[0]);
      return { hp: boss.maxHp, atk: boss.base.atk, def: boss.base.def, vel: boss.base.vel };
    });
    // Every boss sits in a band a levelled team can actually chew through.
    for (const p of profiles) {
      expect(p.hp).toBeGreaterThanOrEqual(1500);
      expect(p.hp).toBeLessThanOrEqual(3000);
    }
    // ...and no two share the same shape.
    expect(new Set(profiles.map((p) => `${p.hp}/${p.atk}/${p.def}/${p.vel}`)).size).toBe(profiles.length);
  });

  it('gives each world its own themed names, distinct from every other world and from the ally roster', () => {
    expect(loadWorldBoss('duat')[0].name).toBe('Set.exe');
    expect(loadWorldBoss('orun')[0].name).toBe('Ogum.exe');
    expect(loadWorldBoss('takamagahara')[0].name).toBe('Yamata-no-Orochi.exe');
    expect(loadWorldBoss('olympus')[0].name).toBe('Typhon.exe'); // not "Medusa.exe" — collides with the ally character
    expect(loadWorldBoss('yggdrasil')[0].name).toBe('Fenrir.exe');
  });
});
