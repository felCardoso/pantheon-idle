import { describe, expect, it } from 'vitest';
import { loadJurupariAllies, loadJurupariBoss, loadJurupariComuns } from './loader';

describe('loadJurupariAllies', () => {
  it('loads the 4 Jurupari.iso characters with the 4-person mythological synergy (+21%) folded into HP/ATK', () => {
    const allies = loadJurupariAllies();
    expect(allies.map((a) => a.name)).toEqual(['Jurupari.exe', 'Boitatá.exe', 'Iara.exe', 'Saci.exe']);

    const jurupari = allies.find((a) => a.name === 'Jurupari.exe')!;
    // docs/mvp.md base: HP 3000, ATK 300 -> +21% synergy
    expect(jurupari.maxHp).toBe(Math.round(3000 * 1.21));
    expect(jurupari.base.atk).toBe(Math.round(300 * 1.21));
    // DEF/INI/ESQ are untouched by synergy
    expect(jurupari.base.def).toBe(0);
    expect(jurupari.base.ini).toBe(110);
    expect(jurupari.base.esq).toBeCloseTo(0.1);
  });

  it('gives Jurupari.exe its +1 round status duration passive and Saci.exe its always-first passive', () => {
    const allies = loadJurupariAllies();
    expect(allies.find((a) => a.name === 'Jurupari.exe')!.statusDurationBonus).toBe(1);
    expect(allies.find((a) => a.name === 'Saci.exe')!.alwaysActsFirst).toBe(true);
  });
});

describe('loadJurupariComuns / loadJurupariBoss', () => {
  it('loads the 3 common archetypes with no synergy bonus applied', () => {
    const comuns = loadJurupariComuns();
    expect(comuns.map((c) => c.name)).toEqual(['Mula-sem-Cabeça.sh', 'Caipora.sh', 'Curupira.sh']);
    expect(comuns.find((c) => c.name === 'Caipora.sh')!.maxHp).toBe(600);
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
    const caipora = scaled.find((c) => c.name === 'Caipora.sh')!;
    expect(caipora.maxHp).toBe(Math.round(600 * Math.pow(1.15, 4)));
    expect(caipora.base.def).toBe(Math.round(30 * Math.pow(1.15, 4)));
  });
});
