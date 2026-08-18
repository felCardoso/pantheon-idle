import { UnitCard } from './UnitCard';
import type { BattleUnit } from '../../types';
import type { AttackAnimTier, FloatingText } from '../../hooks/useBattleReplay';

interface TeamFormationProps {
  units: BattleUnit[];
  /** Left column on desktop / bottom half on mobile. The enemy side mirrors both axes. */
  isAllySide: boolean;
  floatersFor: (unitId: string) => FloatingText[];
  attackFor: (unitId: string) => { id: string; tier: AttackAnimTier } | null;
  impactFor: (unitId: string) => { id: string } | null;
}

/**
 * One side's 5-unit formation: the Vanguard rendered large and closest to the center line, with
 * the bench (up to 4) lined up behind it — a column on desktop, a row on mobile, so the whole
 * board is the same shape rotated 90 degrees. The bench is centered and evenly spaced whatever
 * its length, so a side that has lost units stays visually balanced instead of drifting.
 *
 * Direction is driven entirely by flex order: the ally side puts the bench first (bench is on the
 * outside, vanguard toward the middle) and the enemy side reverses the axis to mirror it.
 */
export function TeamFormation({ units, isAllySide, floatersFor, attackFor, impactFor }: TeamFormationProps) {
  const vanguard = units.find((u) => u.isVanguard) ?? null;
  const bench = units.filter((u) => !u.isVanguard);

  const axis = isAllySide
    ? 'flex-col-reverse md:flex-row' // mobile: bench below vanguard · desktop: bench left of it
    : 'flex-col md:flex-row-reverse';

  return (
    <div className={`flex flex-1 items-center justify-center gap-2 sm:gap-4 ${axis}`}>
      <div className="flex flex-row items-center justify-center gap-1.5 sm:gap-3 md:flex-col">
        {bench.map((unit, i) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            size="bench"
            delay={i * 220 + (isAllySide ? 0 : 110)}
            floatingTexts={floatersFor(unit.id)}
            attack={attackFor(unit.id)}
            impactFlash={impactFor(unit.id)}
          />
        ))}
      </div>

      {/* Reserves the vanguard slot even when a side has none left, so the board doesn't jump. */}
      <div className="flex min-h-[92px] min-w-[76px] items-center justify-center sm:min-h-[124px] sm:min-w-[96px]">
        {vanguard && (
          <UnitCard
            unit={vanguard}
            size="vanguard"
            floatingTexts={floatersFor(vanguard.id)}
            attack={attackFor(vanguard.id)}
            impactFlash={impactFor(vanguard.id)}
          />
        )}
      </div>
    </div>
  );
}
