import { motion } from 'framer-motion';
import { Icon } from '../common/Icon';
import { PixelFigure } from './PixelFigure';
import { StatusBadge } from './StatusBadge';
import { FACTION_COLOR, RARITY_COLOR, NEGATIVE_STATUSES } from '../../data/theme';
import type { BattleUnit } from '../../types';
import type { AttackAnimTier, FloatingText } from '../../hooks/useBattleSimulation';

interface UnitCardProps {
  unit: BattleUnit;
  delay?: number;
  floatingTexts?: FloatingText[];
  /** Set while this unit is mid-swing as the attacker — id changes every attack so the CSS animation restarts, tier picks which one plays (see useBattleReplay.ts's attackTierFor). */
  attack?: { id: string; tier: AttackAnimTier } | null;
  /** Set briefly while this unit is on the receiving end of a landed (non-dodged) hit. */
  impactFlash?: { id: string } | null;
}

/** Ranged is too fast to lunge for every hit (fires only); a moderate cadence steps in and still fires; a slow one is one heavy, committed strike with no projectile. */
const LUNGE_CLASS: Partial<Record<AttackAnimTier, string>> = {
  lightMelee: 'animate-attack-lunge-light',
  heavyMelee: 'animate-attack-lunge-heavy',
};
const SHOWS_PROJECTILE: Partial<Record<AttackAnimTier, true>> = { ranged: true, lightMelee: true };

const FLOATER_STYLE: Record<FloatingText['kind'], string> = {
  damage: 'text-white',
  crit: 'text-signal-red text-base sm:text-lg',
  heal: 'text-code-400',
  shield: 'text-signal-cyan',
};

const FLOATER_PREFIX: Record<FloatingText['kind'], string> = {
  damage: '-',
  crit: '-',
  heal: '+',
  shield: '+',
};

export function UnitCard({ unit, delay = 0, floatingTexts = [], attack = null, impactFlash = null }: UnitCardProps) {
  const factionColor = FACTION_COLOR[unit.faction];
  const rarityColor = RARITY_COLOR[unit.rarity];
  const isDead = unit.hp <= 0;
  const hpPct = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100));
  const shieldPct = Math.max(0, Math.min(100, (unit.shield / unit.maxHp) * 100));
  const isCritical = !isDead && hpPct <= 25;
  const negativeStatuses = unit.statuses.filter((s) => NEGATIVE_STATUSES.has(s.type));
  const lungeClass = attack ? LUNGE_CLASS[attack.tier] : undefined;
  const showsProjectile = attack ? SHOWS_PROJECTILE[attack.tier] : false;
  // Allies face right (toward the enemy column), enemies face left — one keyframe set serves
  // both sides via this CSS var (see index.css's attack-lunge-*/attack-projectile).
  const lungeDir = unit.isAlly ? 1 : -1;

  return (
    <motion.div
      layout
      layoutId={unit.id}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={`flex flex-col items-center gap-1 transition-opacity duration-500 ${isDead ? 'opacity-35 grayscale' : 'animate-idle-bob'}`}
      style={{ animationDelay: `${delay}ms` }}
      title={`${unit.name} · Nv.${unit.level} · ${unit.faction}${isDead ? ' · derrotado' : ''}`}
    >
      {/* negative status effects — above the character */}
      <div className="flex h-4 items-center gap-0.5 sm:h-5">
        {negativeStatuses.map((status) => (
          <StatusBadge key={status.type} status={status} />
        ))}
      </div>

      <div className="flex h-5 w-5 items-center justify-center rounded-[4px] border border-white/20 bg-void-800 font-mono text-[10px] font-bold text-white/90 sm:h-6 sm:w-6 sm:text-[11px]">
        {unit.level}
      </div>

      <div
        key={attack?.id}
        className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg sm:h-16 sm:w-16 sm:rounded-xl ${lungeClass ?? ''}`}
        style={{
          background: `linear-gradient(150deg, ${rarityColor}22, #0a0a12)`,
          border: `1.5px solid ${factionColor}aa`,
          boxShadow: isDead ? 'none' : `0 0 14px -2px ${factionColor}88`,
          ['--lunge-dir' as string]: lungeDir,
        }}
      >
        {unit.portraitUrl ? (
          <img src={unit.portraitUrl} alt={unit.name} className="h-full w-full object-cover" />
        ) : (
          <PixelFigure className="h-[85%] w-[85%]" style={{ color: factionColor }} />
        )}
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
        {showsProjectile && (
          <span
            key={`projectile-${attack?.id}`}
            className="animate-attack-projectile pointer-events-none absolute left-1/2 top-1/2 h-1 w-3 -translate-y-1/2 rounded-full"
            style={{ background: factionColor, boxShadow: `0 0 6px 1px ${factionColor}`, ['--lunge-dir' as string]: lungeDir }}
          />
        )}
        {impactFlash && (
          <span
            key={`impact-${impactFlash.id}`}
            className="animate-impact-flash pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.85), transparent 70%)' }}
          />
        )}
      </div>

      {/* HP bar, with floating combat text anchored just above it */}
      <div className="relative flex w-12 items-center gap-1 sm:w-16">
        {floatingTexts.map((f, i) => (
          <span
            key={f.id}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{ bottom: `${4 + i * 13}px` }}
          >
            <span
              className={`animate-float-up block whitespace-nowrap font-mono text-[10px] font-bold sm:text-xs ${FLOATER_STYLE[f.kind]}`}
            >
              {FLOATER_PREFIX[f.kind]}
              {Math.round(f.amount)}
            </span>
          </span>
        ))}
        <Icon name="heart" size={10} className={isCritical ? 'text-signal-red' : 'text-white/40'} />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-void-700">
          <div
            className={`h-full rounded-full transition-all ${isCritical ? 'bg-signal-red' : 'bg-code-500'}`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>
      <span className="font-mono text-[9px] text-white/50 sm:text-[10px]">{Math.round(unit.hp)}</span>

      {/* shield — below HP */}
      {unit.shield > 0 && (
        <>
          <div className="flex w-12 items-center gap-1 sm:w-16">
            <Icon name="shield" size={9} className="text-signal-cyan/70" />
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-void-700">
              <div className="h-full rounded-full bg-signal-cyan transition-all" style={{ width: `${shieldPct}%` }} />
            </div>
          </div>
          <span className="font-mono text-[8px] text-signal-cyan/80 sm:text-[9px]">{Math.round(unit.shield)}</span>
        </>
      )}
    </motion.div>
  );
}
