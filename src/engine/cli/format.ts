import type { BattleLogEntry } from '../core/types';
import type { StatusType } from '../schema';

const STATUS_LABEL: Record<StatusType, string> = {
  virus: 'Vírus',
  sangramento: 'Sangramento',
  veneno: 'Veneno',
  atordoamento: 'Atordoamento',
  enfraquecimento: 'Enfraquecimento',
  corrosao: 'Corrosão',
  lentidao: 'Lentidão',
  regeneracao: 'Regeneração',
  marcado: 'Marcado',
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
    case 'roundStart':
      return `\n--- Rodada ${entry.round} ---`;
    case 'turnSkippedStun':
      return `  ${entry.unit} está atordoado e perde a ação.`;
    case 'dodge':
      return `  ${entry.defender} esquiva do ataque de ${entry.attacker}.`;
    case 'attack': {
      const { attacker, defender, finalDamage, crit, elementalAdvantage, shieldAbsorbed, hpDamage, defenderDied } = entry.result;
      const tags = [crit && 'crítico', elementalAdvantage && 'vantagem elemental'].filter(Boolean).join(', ');
      const shieldNote = shieldAbsorbed > 0 ? ` (${Math.round(shieldAbsorbed)} absorvido pelo escudo, ${Math.round(hpDamage)} no HP)` : '';
      const suffix = tags ? ` [${tags}]` : '';
      const deathNote = defenderDied ? ' — derrotado!' : '';
      return `  ${attacker.name} ataca ${defender.name}: ${Math.round(finalDamage)} de dano${suffix}${shieldNote}${deathNote}`;
    }
    case 'statusApplied': {
      const rounds = entry.rounds === null ? 'até o próximo ataque recebido' : `${entry.rounds} rodada(s)`;
      return `  ${entry.source} aplica ${STATUS_LABEL[entry.status]} em ${entry.target} (${rounds}).`;
    }
    case 'statusTick':
      return `  ${entry.target} sofre ${Math.round(entry.amount)} de ${STATUS_LABEL[entry.status]}.`;
    case 'statusExpired':
      return `  ${STATUS_LABEL[entry.status]} expira em ${entry.target}.`;
    case 'heal':
      return `  ${entry.source} cura ${entry.target} em ${entry.amount} HP.`;
    case 'shieldGranted':
      return `  ${entry.source} concede ${entry.amount} de escudo a ${entry.target}.`;
    case 'death':
      return null; // already noted inline by the attack/tick/enrage line
    case 'enrage':
      return `  [Anti-rodada-infinita] Dano verdadeiro de ${(entry.percent * 100).toFixed(1)}% do HP máximo em todos os combatentes vivos.`;
    case 'battleEnd':
      return `\n=== Fim da batalha: vitória do ${WINNER_LABEL[entry.winner]} (${entry.reason === 'roundLimit' ? 'limite de rodadas' : 'eliminação'}) ===`;
  }
}
