import { useMemo, useState } from 'react';
import { UnitCard } from './UnitCard';
import { BattleDivider } from './BattleDivider';
import { Icon } from '../common/Icon';
import { toTurnBattleUnit } from '../../data/turnBattleUnits';
import { describeTurnLogEntry } from '../../data/turnBattleLog';
import type { TurnAction, TurnCombatant, TurnBattleLogEntry } from '../../engine';

interface TurnBattleStageProps {
  attackerName: string;
  defenderName: string;
  allies: TurnCombatant[];
  enemies: TurnCombatant[];
  round: number;
  pendingAllyUnitId: string | null;
  log: TurnBattleLogEntry[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  loading: boolean;
  error: string | null;
  onAct: (unitId: string, action: TurnAction) => void;
  /** Shown once the fight finishes, to reveal the rating/reward summary the caller already has. */
  onContinue: () => void;
}

const WINNER_LABEL: Record<'allies' | 'enemies' | 'draw', string> = {
  allies: 'Vitória!',
  enemies: 'Derrota',
  draw: 'Empate',
};

/** Living units in `pool` a chosen target may legally be picked from: the front row while it has anyone alive, else the whole back row — mirrors src/engine/turn/formation.ts's rule, duplicated here purely to highlight legal picks; the server (pvp-turn-act) is the actual authority. */
function legalRow(pool: TurnCombatant[]): TurnCombatant[] {
  const alive = pool.filter((c) => c.hp > 0);
  const front = alive.filter((c) => c.row === 'front');
  return front.length > 0 ? front : alive.filter((c) => c.row === 'back');
}

/** Mirrors src/engine/turn/aiPolicy.ts's isSupportAbility — a chosenTarget ability whose effect is heal/grantShield/dispel, or a buffAttribute with a non-negative magnitude, is aimed at an ally; a negative-magnitude buffAttribute (a stat debuff, e.g. a boss's def shred) and directDamage/applyStatus are aimed at an enemy. */
function isSupportAbility(ability: TurnCombatant['activeAbilities'][number]): boolean {
  const effect = ability.effects.find((e) => e.target === 'chosenTarget');
  if (!effect) return false;
  if (effect.type === 'heal' || effect.type === 'grantShield' || effect.type === 'dispel') return true;
  if (effect.type === 'buffAttribute') {
    const m = effect.magnitude;
    if (m.kind === 'flat' || m.kind === 'percent') return m.value >= 0;
    return true;
  }
  return false;
}

type PendingChoice = { type: 'basicAttack' } | { type: 'ability' };

function TeamColumn({
  title,
  units,
  isAllySide,
  targetableIds,
  onPickTarget,
}: {
  title: string;
  units: TurnCombatant[];
  isAllySide: boolean;
  targetableIds: Set<string> | null;
  onPickTarget: (unitId: string) => void;
}) {
  const front = units.filter((u) => u.row === 'front');
  const back = units.filter((u) => u.row === 'back');

  function renderRow(rowUnits: TurnCombatant[]) {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {rowUnits.map((u) => {
          const targetable = targetableIds?.has(u.id) ?? false;
          const card = <UnitCard key={u.id} unit={toTurnBattleUnit(u, isAllySide)} />;
          if (!targetable) return <div key={u.id}>{card}</div>;
          return (
            <button
              key={u.id}
              onClick={() => onPickTarget(u.id)}
              className="animate-pulse rounded-lg ring-2 ring-signal-amber transition hover:ring-code-400"
            >
              {card}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white/40">{title}</span>
      <span className="text-[9px] uppercase tracking-wide text-white/25">Frente</span>
      {renderRow(front)}
      <span className="mt-1 text-[9px] uppercase tracking-wide text-white/25">Fundo</span>
      {renderRow(back)}
    </div>
  );
}

/**
 * The interactive turn-based PvP screen: pick a unit's action (basic attack or its equipped
 * ability), then a target if one's needed, respecting formation — every choice is a request the
 * server (pvp-turn-act) confirms or rejects, this component only ever shows what came back.
 *
 * Deliberately simpler than PvE's BattleStage/real-time PvP's old PvpBattleStage: there's no
 * continuous animation stream to drive (floaters, cast overlays, speed-tiered attack lunges) —
 * each action here is one deliberate, server-confirmed step, so a compact log feed plus HP/status
 * cards carries the whole fight legibly without porting that machinery.
 */
export function TurnBattleStage({
  attackerName,
  defenderName,
  allies,
  enemies,
  round,
  pendingAllyUnitId,
  log,
  finished,
  winner,
  loading,
  error,
  onAct,
  onContinue,
}: TurnBattleStageProps) {
  const [choice, setChoice] = useState<PendingChoice | null>(null);
  const pendingUnit = allies.find((u) => u.id === pendingAllyUnitId) ?? null;
  const ability = pendingUnit?.activeAbilities[0];
  const abilityOnCooldown = !!(ability && (pendingUnit!.abilityCooldownRemaining[ability.id] ?? 0) > 0);

  const isAllyName = useMemo(() => {
    const names = new Set(allies.map((u) => u.name));
    return (name: string) => names.has(name);
  }, [allies]);

  const feed = useMemo(() => {
    const lines = log.map((e) => describeTurnLogEntry(e, isAllyName)).filter((l): l is NonNullable<typeof l> => l !== null);
    return lines.slice(-10);
  }, [log, isAllyName]);

  function startChoice(next: PendingChoice) {
    if (!pendingUnit) return;
    if (next.type === 'ability') {
      if (!ability || abilityOnCooldown) return;
      const needsTarget = ability.effects.some((e) => e.target === 'chosenTarget');
      if (!needsTarget) {
        onAct(pendingUnit.id, { type: 'ability' });
        setChoice(null);
        return;
      }
    }
    setChoice(next);
  }

  function pickTarget(unitId: string) {
    if (!pendingUnit || !choice) return;
    onAct(pendingUnit.id, { type: choice.type, targetId: unitId });
    setChoice(null);
  }

  const targetingAllies = choice?.type === 'ability' && ability && isSupportAbility(ability);
  const targetableIds =
    choice && pendingUnit
      ? new Set(legalRow(targetingAllies ? allies : enemies).map((u) => u.id))
      : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void-950/90 p-3">
      <div className="relative flex h-[min(680px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-signal-red/30 bg-void-950">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 45% at 50% 18%, rgba(255,59,92,0.14), transparent 70%), radial-gradient(70% 50% at 50% 100%, rgba(57,255,156,0.1), transparent 70%), linear-gradient(180deg, #0b0b16 0%, #0a0a12 55%, #070710 100%)',
          }}
        />
        <div className="circuit-grid absolute inset-0 opacity-30" />

        <div className="relative z-10 flex items-center justify-between px-4 py-3">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-code-400">{attackerName}</p>
          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white/40">pvp · rodada {round}</span>
          <p className="font-display text-xs font-bold uppercase tracking-wide text-signal-red">{defenderName}</p>
        </div>

        <div className="relative z-10 flex flex-1 flex-col-reverse items-stretch justify-center gap-2 overflow-y-auto px-3 pb-2 md:flex-row md:gap-3">
          <TeamColumn title={attackerName} units={allies} isAllySide targetableIds={targetingAllies ? targetableIds : null} onPickTarget={pickTarget} />
          <BattleDivider />
          <TeamColumn title={defenderName} units={enemies} isAllySide={false} targetableIds={!targetingAllies ? targetableIds : null} onPickTarget={pickTarget} />
        </div>

        {/* Battle log feed */}
        <div className="relative z-10 mx-3 mb-2 h-20 shrink-0 overflow-y-auto rounded-lg border border-void-700 bg-void-900/60 px-2 py-1.5">
          {feed.map((l) => (
            <p
              key={l.id}
              className={`text-[10px] leading-4 ${l.tone === 'ally' ? 'text-code-300' : l.tone === 'enemy' ? 'text-signal-red/90' : 'text-white/40'}`}
            >
              {l.text}
            </p>
          ))}
        </div>

        {error && (
          <div className="relative z-10 mx-3 mb-2 rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-1.5 text-[11px] text-signal-red">
            {error}
          </div>
        )}

        {/* Action panel */}
        {!finished && pendingUnit && (
          <div className="relative z-10 mx-3 mb-3 flex flex-col gap-2 rounded-xl border border-void-600 bg-void-800/60 p-3">
            {choice ? (
              <p className="flex items-center gap-1.5 text-[11px] text-signal-amber">
                <Icon name="crosshair" size={12} className="animate-pulse" />
                Escolha um alvo destacado{targetingAllies ? ' (aliado)' : ''}.
                <button onClick={() => setChoice(null)} className="ml-auto text-white/40 hover:text-white/70">
                  cancelar
                </button>
              </p>
            ) : (
              <>
                <p className="text-[11px] text-white/60">
                  Vez de <span className="text-white">{pendingUnit.name}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={loading}
                    onClick={() => startChoice({ type: 'basicAttack' })}
                    className="flex items-center gap-1.5 rounded-lg bg-signal-red/80 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-signal-red disabled:opacity-50"
                  >
                    <Icon name="swords" size={13} />
                    Ataque básico
                  </button>
                  {ability && (
                    <button
                      disabled={loading || abilityOnCooldown}
                      onClick={() => startChoice({ type: 'ability' })}
                      className="flex items-center gap-1.5 rounded-lg border border-arcane-400/40 bg-arcane-900/30 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-arcane-300 transition hover:border-arcane-400/70 disabled:opacity-40"
                    >
                      <Icon name="zap" size={13} />
                      {ability.name}
                      {abilityOnCooldown && ` (cooldown)`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!finished && !pendingUnit && (
          <div className="relative z-10 mx-3 mb-3 flex items-center justify-center gap-2 rounded-xl border border-void-600 bg-void-800/40 p-3 text-[11px] text-white/40">
            <Icon name="loader" size={13} className="animate-spin" />
            Aguardando o time defensor...
          </div>
        )}

        {finished && winner && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-void-950/70 backdrop-blur-sm">
            <p
              className={`font-display text-2xl font-black uppercase tracking-widest sm:text-4xl ${
                winner === 'allies' ? 'text-code-400 text-glow-code' : winner === 'enemies' ? 'text-signal-red' : 'text-arcane-300'
              }`}
            >
              {WINNER_LABEL[winner]}
            </p>
            <button
              onClick={onContinue}
              className="flex items-center gap-2 rounded-lg bg-code-500 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400"
            >
              Continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
