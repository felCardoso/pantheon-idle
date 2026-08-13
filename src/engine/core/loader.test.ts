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
    const team = loadCharactersByIds(['jurupari', 'odin', 'zeus']);
    expect(team.map((c) => c.name)).toEqual(['Jurupari.exe', 'Odin.exe', 'Zeus.exe']);
  });

  it('applies the synergy bonus by team size regardless of which ids are passed', () => {
    const solo = loadCharactersByIds(['saci']);
    expect(solo[0].maxHp).toBe(800); // no bonus at team size 1 (no "1" entry in synergyByCount)

    const trio = loadCharactersByIds(['jurupari', 'odin', 'zeus']);
    // docs/combate.md: +12% at team size 3
    expect(trio[0].maxHp).toBe(Math.round(800 * 1.12));
  });

  it('throws for an unknown character id', () => {
    expect(() => loadCharactersByIds(['not-a-real-character'])).toThrow(/Unknown character id/);
  });
});

describe('loadJurupariComuns / loadJurupariBoss', () => {
  it('loads the 3 common archetypes with no synergy bonus applied', () => {
    const comuns = loadJurupariComuns();
    expect(comuns.map((c) => c.name)).toEqual(['Mula-sem-Cabeça.sh', 'Boitatá.sh', 'Iara.sh']);
    expect(comuns.find((c) => c.name === 'Boitatá.sh')!.maxHp).toBe(600);
  });

  it('loads Anhangá.exe with its calibrated stats', () => {
    const [boss] = loadJurupariBoss();
    expect(boss.name).toBe('Anhangá.exe');
    expect(boss.maxHp).toBe(12000);
    expect(boss.base.atk).toBe(250);
    expect(boss.base.def).toBe(50);
  });

  it('scales comuns stats by the given multiplier (docs/mvp.md per-estágio scaling)', () => {
    const scaled = loadJurupariComuns(Math.pow(1.15, 4)); // estágio 5 of a fase
    const boitata = scaled.find((c) => c.name === 'Boitatá.sh')!;
    expect(boitata.maxHp).toBe(Math.round(600 * Math.pow(1.15, 4)));
    expect(boitata.base.def).toBe(Math.round(30 * Math.pow(1.15, 4)));
  });

  it('scales the boss by an optional multiplier too (team-size scaling)', () => {
    const [boss] = loadJurupariBoss(0.25);
    expect(boss.maxHp).toBe(Math.round(12000 * 0.25));
  });
});
