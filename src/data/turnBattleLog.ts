import type { StatusType, TurnBattleLogEntry } from '../engine';

const STATUS_LABEL: Record<StatusType, string> = {
  leak: 'Leak',
  trojan: 'Trojan',
  crash: 'Crash',
  fragmentation: 'Fragmentação',
  nanites: 'Nanites',
  throttling: 'Throttling',
  lag: 'Lag',
  target: 'Target',
  buffAtk: 'Processamento',
  buffDef: 'Firewall',
  buffVel: 'Ping',
  buffEsq: 'Evasion',
  buffIce: 'ESP',
};

export interface TurnLogLine {
  id: string;
  text: string;
  tone: 'ally' | 'enemy' | 'neutral';
}

/**
 * Turns one TurnBattleLogEntry into a short feed line for TurnBattleStage — the browser
 * counterpart to tools/battle-cli/formatTurn.ts's terminal formatter (same entries, shorter
 * Portuguese text meant for a small on-screen feed rather than a scrolling terminal).
 * `isAllyName` colors a line by whichever side the unit it names belongs to.
 */
export function describeTurnLogEntry(entry: TurnBattleLogEntry, isAllyName: (name: string) => boolean): TurnLogLine | null {
  const id = `turn-log-${entry.at}-${entry.kind}-${Math.random().toString(36).slice(2, 8)}`;
  const line = (text: string, name: string): TurnLogLine => ({ id, text, tone: isAllyName(name) ? 'ally' : 'enemy' });

  switch (entry.kind) {
    case 'roundStart':
      return { id, text: `— Rodada ${entry.round} —`, tone: 'neutral' };
    case 'turnSkippedStun':
      return line(`${entry.unit} está atordoado e perde o turno.`, entry.unit);
    case 'channelStart':
      return line(`${entry.unit} começa a canalizar uma habilidade.`, entry.unit);
    case 'channelContinue':
      return line(`${entry.unit} continua canalizando (${entry.roundsRemaining} rodada(s)).`, entry.unit);
    case 'channelResolved':
      return line(`${entry.unit} libera a habilidade canalizada!`, entry.unit);
    case 'abilityUsed':
      return line(`${entry.unit} usa ${entry.abilityName}!`, entry.unit);
    case 'dodge':
      return line(`${entry.defender} esquiva do ataque de ${entry.attacker}.`, entry.defender);
    case 'attack': {
      const { attacker, defender, finalDamage, crit, shieldAbsorbed, hpDamage, defenderDied } = entry.result;
      const critNote = crit ? ' crítico!' : '';
      const shieldNote = shieldAbsorbed > 0 ? ` (${Math.round(hpDamage)} no HP)` : '';
      const deathNote = defenderDied ? ' Derrotado!' : '';
      return line(`${attacker.name} ataca ${defender.name}: ${Math.round(finalDamage)} de dano${critNote}${shieldNote}.${deathNote}`, attacker.name);
    }
    case 'statusApplied':
      return line(`${entry.source} aplica ${STATUS_LABEL[entry.status]} em ${entry.target}.`, entry.source);
    case 'statusTick':
      return line(`${entry.target} sofre ${Math.round(entry.amount)} de ${STATUS_LABEL[entry.status]}.`, entry.target);
    case 'heal':
      return line(`${entry.source} cura ${entry.target} em ${entry.amount} HP.`, entry.source);
    case 'shieldGranted':
      return line(`${entry.source} concede ${entry.amount} de escudo a ${entry.target}.`, entry.source);
    case 'directDamage': {
      const deathNote = entry.targetDied ? ' Derrotado!' : '';
      return line(`${entry.source} causa ${Math.round(entry.amount)} de dano direto em ${entry.target}.${deathNote}`, entry.source);
    }
    case 'iceReflect': {
      const deathNote = entry.targetDied ? ' Derrotado!' : '';
      return line(`ICE reflete ${Math.round(entry.amount)} de dano em ${entry.target}.${deathNote}`, entry.target);
    }
    case 'battleEnd':
      return { id, text: entry.winner === 'draw' ? 'Empate!' : entry.winner === 'allies' ? 'Vitória!' : 'Derrota.', tone: 'neutral' };
    case 'battleStart':
    case 'turnStart':
    case 'statusExpired':
    case 'death':
      return null;
  }
}
