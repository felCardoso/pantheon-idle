import type { StatusType, TurnBattleLogEntry } from '../../src/engine';

const STATUS_LABEL: Record<StatusType, string> = {
  leak: 'Leak',
  trojan: 'Trojan',
  crash: 'Crash',
  fragmentation: 'Fragmentação',
  nanites: 'Nanites',
  throttling: 'Throttling',
  lag: 'Lag',
  target: 'Target',
  buffAtk: 'Processamento aumentado',
  buffDef: 'Firewall aumentado',
  buffVel: 'Ping aumentado',
  buffEsq: 'Evasion aumentada',
  buffIce: 'ESP aumentado',
};

const WINNER_LABEL: Record<'allies' | 'enemies' | 'draw', string> = {
  allies: 'time atacante',
  enemies: 'time defensor',
  draw: 'empate',
};

const SIDE_LABEL: Record<'allies' | 'enemies', string> = { allies: 'atacante', enemies: 'defensor' };

/** Turn-native sibling of format.ts — same switch-over-`kind` shape, driving tools/battle-cli/runTurnBattle.ts. */
export function formatTurnLogEntry(entry: TurnBattleLogEntry): string | null {
  switch (entry.kind) {
    case 'battleStart':
      return '\n=== Início da batalha ===';
    case 'roundStart':
      return `\n--- Rodada ${entry.round} ---`;
    case 'turnStart':
      return `  >> Turno de ${entry.unit} (${SIDE_LABEL[entry.side]})`;
    case 'turnSkippedStun':
      return `  ${entry.unit} está sob Crash e perde o turno.`;
    case 'channelStart':
      return `  ${entry.unit} começa a canalizar ${entry.abilityId} (${entry.roundsRemaining} rodada(s) restantes).`;
    case 'channelContinue':
      return `  ${entry.unit} continua canalizando (${entry.roundsRemaining} rodada(s) restantes).`;
    case 'channelResolved':
      return `  ${entry.unit} libera ${entry.abilityId}!`;
    case 'abilityUsed':
      return `  ${entry.unit} usa ${entry.abilityName}!`;
    case 'dodge':
      return `  ${entry.defender} esquiva do ataque de ${entry.attacker}.`;
    case 'attack': {
      const { attacker, defender, finalDamage, crit, shieldAbsorbed, hpDamage, defenderDied } = entry.result;
      const tags = [crit && 'crítico'].filter(Boolean).join(', ');
      const shieldNote = shieldAbsorbed > 0 ? ` (${Math.round(shieldAbsorbed)} absorvido pelo escudo, ${Math.round(hpDamage)} no HP)` : '';
      const suffix = tags ? ` [${tags}]` : '';
      const deathNote = defenderDied ? ' — derrotado!' : '';
      return `  ${attacker.name} ataca ${defender.name}: ${Math.round(finalDamage)} de dano${suffix}${shieldNote}${deathNote}`;
    }
    case 'statusApplied': {
      const dur = entry.seconds === null ? 'enquanto durar a condição' : `${entry.seconds} rodada(s)`;
      return `  ${entry.source} aplica ${STATUS_LABEL[entry.status]} em ${entry.target} (${dur}).`;
    }
    case 'statusTick':
      return `  ${entry.target} sofre ${Math.round(entry.amount)} de ${STATUS_LABEL[entry.status]}.`;
    case 'statusExpired':
      return `  ${STATUS_LABEL[entry.status]} expira em ${entry.target}.`;
    case 'heal':
      return `  ${entry.source} cura ${entry.target} em ${entry.amount} HP.`;
    case 'shieldGranted':
      return `  ${entry.source} concede ${entry.amount} de escudo a ${entry.target}.`;
    case 'iceReflect': {
      const shieldNote = entry.shieldAbsorbed > 0 ? ` (${Math.round(entry.shieldAbsorbed)} absorvido pelo escudo, ${Math.round(entry.hpDamage)} no HP)` : '';
      const deathNote = entry.targetDied ? ' — derrotado!' : '';
      return `  ICE de ${entry.source} reflete ${Math.round(entry.amount)} de dano em ${entry.target}${shieldNote}${deathNote}`;
    }
    case 'directDamage': {
      const shieldNote = entry.shieldAbsorbed > 0 ? ` (${Math.round(entry.shieldAbsorbed)} absorvido pelo escudo, ${Math.round(entry.hpDamage)} no HP)` : '';
      const deathNote = entry.targetDied ? ' — derrotado!' : '';
      return `  ${entry.source} causa ${Math.round(entry.amount)} de dano direto em ${entry.target}${shieldNote}${deathNote}`;
    }
    case 'death':
      return null; // already noted inline by the attack/directDamage line
    case 'battleEnd':
      return `\n=== Fim da batalha: vitória do ${WINNER_LABEL[entry.winner]} (${entry.reason === 'roundLimit' ? 'limite de rodadas' : 'eliminação'}) ===`;
  }
}
