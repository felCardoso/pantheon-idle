import { describe, expect, it } from 'vitest';
import { loadCharactersByIds, loadJurupariAllies, loadJurupariBoss, loadJurupariComuns } from './loader';

describe('loadJurupariAllies', () => {
  it('loads the 4 Jurupari.iso characters with the 4-person mythological synergy (+21%) folded into HP/ATK', () => {
    const allies = loadJurupariAllies();
    expect(allies.map((a) => a.name)).toEqual(['Jurupari.exe', 'Curupira.exe', 'Caipora.exe', 'Saci.exe']);

    const jurupari = allies.find((a) => a.name === 'Jurupari.exe')!;
    // Every character starts at the Alpha (lowest) tier: HP 800, ATK 80 -> +21% synergy
    expect(jurupari.maxHp).toBe(Math.round(800 * 1.21));
    expect(jurupari.base.atk).toBe(Math.round(80 * 1.21));
    // DEF/INI/ESQ are untouched by synergy
    expect(jurupari.base.def).toBe(0);
    expect(jurupari.base.ini).toBe(80);
    expect(jurupari.base.esq).toBeCloseTo(0.05);
  });

  it('gives Jurupari.exe its +1 round status duration passive and Saci.exe its always-first passive', () => {
    const allies = loadJurupariAllies();
    expect(allies.find((a) => a.name === 'Jurupari.exe')!.statusDurationBonus).toBe(1);
    expect(allies.find((a) => a.name === 'Saci.exe')!.alwaysActsFirst).toBe(true);
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

  it('applies the synergy bonus by team size regardless of which ids are passed', () => {
    const solo = loadCharactersByIds([{ id: 'saci', xp: 0 }]);
    expect(solo[0].maxHp).toBe(800); // no bonus at team size 1 (no "1" entry in synergyByCount)

    const trio = loadCharactersByIds([
      { id: 'jurupari', xp: 0 },
      { id: 'odin', xp: 0 },
      { id: 'zeus', xp: 0 },
    ]);
    // docs/combate.md: +12% at team size 3
    expect(trio[0].maxHp).toBe(Math.round(800 * 1.12));
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

  it('loads Medusa/Hércules/Minotauro, each carrying all 4 of their described abilities (the engine fires every ability a character owns independently)', () => {
    const [medusa, hercules, minotauro] = loadCharactersByIds([
      { id: 'medusa', xp: 0 },
      { id: 'hercules', xp: 0 },
      { id: 'minotauro', xp: 0 },
    ]);
    expect(medusa.name).toBe('Medusa.exe');
    expect(medusa.abilities.map((a) => a.id)).toEqual([
      'medusa-petrificar',
      'medusa-veneno',
      'medusa-armadura-pedra',
      'medusa-espinhos-veneno',
    ]);
    expect(hercules.name).toBe('Hércules.exe');
    expect(hercules.abilities).toHaveLength(4);
    expect(minotauro.name).toBe('Minotauro.exe');
    expect(minotauro.abilities).toHaveLength(4);
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
    expect(boss.maxHp).toBe(12000);
    expect(boss.base.atk).toBe(250);
    expect(boss.base.def).toBe(50);
  });

  it('scales comuns stats by the given multiplier (per-estágio scaling)', () => {
    const scaled = loadJurupariComuns(3, 1.2); // estágio 5 of a fase (+20%)
    const boitata = scaled.find((c) => c.name === 'Boitatá.sh')!;
    expect(boitata.maxHp).toBe(Math.round(600 * 1.2));
    expect(boitata.base.def).toBe(Math.round(30 * 1.2));
  });

  it('scales the boss by an optional multiplier too (team-size scaling)', () => {
    const [boss] = loadJurupariBoss(0.25);
    expect(boss.maxHp).toBe(Math.round(12000 * 0.25));
  });
});
