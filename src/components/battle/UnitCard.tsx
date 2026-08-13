import { Icon } from '../common/Icon';
import { ELEMENT_COLOR, ELEMENT_GLYPH, FACTION_COLOR } from '../../data/theme';
import type { BattleUnit } from '../../types';

interface UnitCardProps {
  unit: BattleUnit;
  delay?: number;
}

export function UnitCard({ unit, delay = 0 }: UnitCardProps) {
  const elementColor = ELEMENT_COLOR[unit.element];
  const factionColor = FACTION_COLOR[unit.faction];
  const isDead = unit.hp <= 0;
  const hpPct = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100));
  const isCritical = !isDead && hpPct <= 25;

  return (
    <div
      className={`flex flex-col items-center gap-1 transition-opacity duration-500 ${isDead ? 'opacity-35 grayscale' : 'animate-idle-bob'}`}
      style={{ animationDelay: `${delay}ms` }}
      title={`${unit.name} · Nv.${unit.level} · ${unit.faction} · ${unit.element}${isDead ? ' · derrotado' : ''}`}
    >
      <div className="flex h-5 w-5 items-center justify-center rounded-[4px] border border-white/20 bg-void-800 font-mono text-[10px] font-bold text-white/90 sm:h-6 sm:w-6 sm:text-[11px]">
        {unit.level}
      </div>

      <div
        className="relative flex h-10 w-10 items-center justify-center rounded-lg sm:h-16 sm:w-16 sm:rounded-xl"
        style={{
          background: `linear-gradient(150deg, ${factionColor}22, #0a0a12)`,
          border: `1.5px solid ${elementColor}aa`,
          boxShadow: isDead ? 'none' : `0 0 14px -2px ${elementColor}88`,
        }}
      >
        <span className="font-display text-sm font-bold sm:text-lg" style={{ color: elementColor }}>
          {ELEMENT_GLYPH[unit.element]}
        </span>
        {isDead && (
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-void-950/60 sm:rounded-xl">
            <Icon name="x" size={18} className="text-signal-red" />
          </span>
        )}
        {!unit.isAlly && !isDead && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-signal-red/90 text-[8px] font-bold text-white ring-2 ring-void-950">
            !
          </span>
        )}
      </div>

      <div className="flex w-12 items-center gap-1 sm:w-16">
        <Icon name="heart" size={10} className={isCritical ? 'text-signal-red' : 'text-white/40'} />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-void-700">
          <div
            className={`h-full rounded-full transition-all ${isCritical ? 'bg-signal-red' : 'bg-code-500'}`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>
      <span className="font-mono text-[9px] text-white/50 sm:text-[10px]">{Math.round(unit.hp)}</span>
    </div>
  );
}
