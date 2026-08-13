import { loadJurupariAllies, loadJurupariBoss, loadJurupariComuns } from '../core/loader';
import { runBattle } from '../core/battle';
import { formatLogEntry } from './format';
import type { Combatant } from '../core/types';

function parseArgs(argv: string[]) {
  const useBoss = argv.includes('--boss');
  const seedArg = argv.find((a) => a.startsWith('--seed='));
  const seed = seedArg ? Number(seedArg.split('=')[1]) : 20260813;
  return { useBoss, seed };
}

function printRoster(label: string, units: Combatant[]) {
  console.log(`\n${label}`);
  for (const u of units) {
    console.log(
      `  ${u.name.padEnd(20)} HP ${u.maxHp.toString().padStart(6)}  ATK ${u.base.atk.toString().padStart(4)}  DEF ${u.base.def.toString().padStart(3)}  INI ${u.base.ini.toString().padStart(3)}  ESQ ${(u.base.esq * 100).toFixed(0)}%`,
    );
  }
}

function printFinalHp(label: string, units: Combatant[]) {
  console.log(`\n${label}`);
  for (const u of units) {
    const status = u.hp > 0 ? `${u.hp}/${u.maxHp}` : 'derrotado';
    console.log(`  ${u.name.padEnd(20)} ${status}`);
  }
}

function main() {
  const { useBoss, seed } = parseArgs(process.argv.slice(2));

  const allies = loadJurupariAllies();
  const enemies = useBoss ? loadJurupariBoss() : loadJurupariComuns();

  console.log('Pantheon Idle — Simulação de combate (Jurupari.iso)');
  console.log(`Seed: ${seed}`);
  printRoster('Time do jogador (sinergia mitológica de 4 já aplicada):', allies);
  printRoster(useBoss ? 'Chefe do mundo:' : 'Inimigos comuns (Estágio 4 — 1 de cada arquétipo):', enemies);

  const result = runBattle(allies, enemies, { seed });

  for (const entry of result.log) {
    const line = formatLogEntry(entry);
    if (line !== null) console.log(line);
  }

  console.log(`\nDuração: ${result.rounds} rodada(s).`);
  printFinalHp('HP final — time do jogador:', result.allies);
  printFinalHp('HP final — inimigos:', result.enemies);
}

main();
