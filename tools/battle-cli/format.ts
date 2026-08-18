import type { BattleLogEntry, StatusType } from '../../src/engine';

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
  allies: 'time do jogador',
  enemies: 'time inimigo',
  draw: 'empate',
};

export function formatLogEntry(entry: BattleLogEntry): string | null {
  switch (entry.kind) {
    case 'battleStart':
      return '\n=== Início da batalha ===';
    case 'vanguardEnter':
      return `  >> ${entry.unit} assume a Vanguarda.`;
    case 'vanguardExit':
      return `  << ${entry.unit} foi ejetado${entry.replacedBy ? ` — ${entry.replacedBy} assume` : ' — fila vazia'}.`;
    case 'attackBlockedStun':
      return `  ${entry.unit} sofre Crash e perde o ataque.`;
    case 'dodge':
      return `  ${entry.defender} esquiva do ataque de ${entry.attacker}.`;
    case 'abilityUsed':
      return `  ${entry.unit} usa ${entry.abilityName}!`;
    case 'attack': {
      const { attacker, defender, finalDamage, crit, shieldAbsorbed, hpDamage, defenderDied } = entry.result;
      const tags = [crit && 'crítico'].filter(Boolean).join(', ');
      const shieldNote = shieldAbsorbed > 0 ? ` (${Math.round(shieldAbsorbed)} absorvido pelo escudo, ${Math.round(hpDamage)} no HP)` : '';
      const suffix = tags ? ` [${tags}]` : '';
      const deathNote = defenderDied ? ' — derrotado!' : '';
      return `  ${attacker.name} ataca ${defender.name}: ${Math.round(finalDamage)} de dano${suffix}${shieldNote}${deathNote}`;
    }
    case 'statusApplied': {
      const dur = entry.seconds === null ? 'enquanto durar a condição' : `${entry.seconds}s`;
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
      return null; // already noted inline by the attack/tick/overload line
    case 'overload':
      return `  [System Overload] Dano absoluto de ${(entry.percent * 100).toFixed(1)}% do HP máximo em todos os processos vivos.`;
    case 'battleEnd':
      return `\n=== Fim da batalha: vitória do ${WINNER_LABEL[entry.winner]} (${entry.reason === 'timeLimit' ? 'limite de tempo' : 'eliminação'}) ===`;
  }
}
