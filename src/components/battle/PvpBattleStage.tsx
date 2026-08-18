import { UnitCard } from './UnitCard';
import { AbilityCastOverlay } from './AbilityCastOverlay';
import { Icon } from '../common/Icon';
import type { BattleUnit } from '../../types';
import type { AbilityCastEvent, AttackAnimEvent, FloatingText } from '../../hooks/useBattleReplay';

interface PvpBattleStageProps {
  attackerName: string;
  defenderName: string;
  allies: BattleUnit[];
  enemies: BattleUnit[];
  floaters: FloatingText[];
  activeAbilities: AbilityCastEvent[];
  attackAnims: AttackAnimEvent[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  /** Shown once the fight finishes, to reveal the rating/reward summary the caller already has. */
  onContinue: () => void;
}

const WINNER_LABEL: Record<'allies' | 'enemies' | 'draw', string> = {
  allies: 'Vitória!',
  enemies: 'Derrota',
  draw: 'Empate',
};

/**
 * The PvP counterpart of BattleStage: plays one already-resolved attack (usePvpBattle) with the
 * same cyberpunk-simple animation language — ability-clash banners, speed-tiered attacks — but
 * with no world/estágio HUD or Auto/Pausar controls, since a PvP fight isn't part of the
 * fase/estágio grind and always plays start to finish once.
 */
export function PvpBattleStage({
  attackerName,
  defenderName,
  allies,
  enemies,
  floaters,
  activeAbilities,
  attackAnims,
  finished,
  winner,
  onContinue,
}: PvpBattleStageProps) {
  const floatersFor = (unitId: string) => floaters.filter((f) => f.unitId === unitId);
  const attackFor = (unitId: string) => {
    const event = [...attackAnims].reverse().find((a) => a.attackerId === unitId);
    return event ? { id: event.id, tier: event.tier } : null;
  };
  const impactFor = (unitId: string) => {
    const event = [...attackAnims].reverse().find((a) => a.defenderId === unitId && !a.dodged);
    return event ? { id: event.id } : null;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void-950/90 p-3">
      <div className="relative flex h-[min(560px,88vh)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-signal-red/30 bg-void-950">
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
          <div className="flex items-center gap-1.5 opacity-70">
            <Icon name="swords" size={16} className="text-signal-red" />
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white/40">pvp</span>
          </div>
          <p className="font-display text-xs font-bold uppercase tracking-wide text-signal-red">{defenderName}</p>
        </div>

        <div className="relative z-10 flex flex-1 items-end justify-center gap-4 overflow-x-auto px-3 pb-8 sm:gap-10">
          <div className="flex items-end gap-1.5 sm:gap-4">
            {allies.map((unit, i) => (
              <UnitCard key={unit.id} unit={unit} delay={i * 220} floatingTexts={floatersFor(unit.id)} attack={attackFor(unit.id)} impactFlash={impactFor(unit.id)} />
            ))}
          </div>
          <div className="flex items-end gap-1.5 sm:gap-4">
            {enemies.map((unit, i) => (
              <UnitCard key={unit.id} unit={unit} delay={i * 220 + 110} floatingTexts={floatersFor(unit.id)} attack={attackFor(unit.id)} impactFlash={impactFor(unit.id)} />
            ))}
          </div>
        </div>

        <AbilityCastOverlay activeAbilities={activeAbilities} />

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
