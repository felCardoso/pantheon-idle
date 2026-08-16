import { useState } from 'react';
import { motion } from 'framer-motion';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { Icon } from '../common/Icon';
import { RARITY_COLOR } from '../../data/theme';
import type { RosterCharacter } from '../../data/roster';

interface SummonReelProps {
  /** Full scroll sequence — every item but the last is a decoy, the last is the actual pull. */
  items: RosterCharacter[];
  /** Fires once the reel has stopped and the lock-in flourish has played. */
  onComplete: () => void;
}

const CARD_SIZE = 72;
const GAP = 10;
const STEP = CARD_SIZE + GAP;
const VIEWPORT_CARDS = 5;
const CENTER_SLOT = Math.floor(VIEWPORT_CARDS / 2);
const SPIN_DURATION = 3.2;
const LOCK_FLOURISH_MS = 420;

/** Slot-machine-style reel: scrolls decelerating through decoy portraits before locking onto the pull, with a rarity-colored glitch flourish on landing. */
export function SummonReel({ items, onComplete }: SummonReelProps) {
  const [locked, setLocked] = useState(false);
  const winnerIndex = items.length - 1;
  const winner = items[winnerIndex];
  const finalX = -(winnerIndex - CENTER_SLOT) * STEP;
  const rarityColor = RARITY_COLOR[winner.rarity];
  const markerLeft = CENTER_SLOT * STEP - GAP / 2;
  const markerWidth = CARD_SIZE + GAP;

  function handleReelStop() {
    setLocked(true);
    setTimeout(onComplete, LOCK_FLOURISH_MS);
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-arcane-400/25 bg-void-950/60 p-4">
      <motion.div
        className="relative overflow-hidden rounded-lg"
        style={{ width: VIEWPORT_CARDS * STEP - GAP, height: CARD_SIZE + 16 }}
        animate={locked ? { x: [0, -3, 3, -2, 2, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* center marker — pulses to the winner's rarity color on lock */}
        <motion.div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border-2"
          style={{ left: markerLeft, width: markerWidth, height: CARD_SIZE + 16 }}
          animate={{
            borderColor: locked ? [`${rarityColor}55`, rarityColor, `${rarityColor}aa`] : `${rarityColor}55`,
            boxShadow: locked ? [`0 0 0px ${rarityColor}00`, `0 0 22px ${rarityColor}`, `0 0 10px ${rarityColor}aa`] : `0 0 0px ${rarityColor}00`,
          }}
          transition={{ duration: 0.4 }}
        />
        <Icon
          name="chevron-down"
          size={13}
          className="pointer-events-none absolute top-0 z-10 text-arcane-300"
          style={{ left: markerLeft + markerWidth / 2 - 6.5 }}
        />
        <Icon
          name="chevron-down"
          size={13}
          className="pointer-events-none absolute bottom-0 z-10 rotate-180 text-arcane-300"
          style={{ left: markerLeft + markerWidth / 2 - 6.5 }}
        />

        {/* edge fade so cards feel like they scroll in/out instead of hard-clipping */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-void-950 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-void-950 to-transparent" />

        <motion.div
          className="absolute top-2 flex items-center"
          style={{ gap: GAP }}
          initial={{ x: 0 }}
          animate={{ x: finalX }}
          transition={{ duration: SPIN_DURATION, ease: [0.1, 0.7, 0.15, 1] }}
          onAnimationComplete={handleReelStop}
        >
          {items.map((c, i) => (
            <div
              key={`${c.templateId}-${i}`}
              className={locked && i === winnerIndex ? '[filter:brightness(2)_saturate(1.6)]' : undefined}
              style={{ transition: 'filter 0.15s ease-out' }}
            >
              <CharacterPortrait name={c.name} faction={c.faction} rarity={c.rarity} portraitUrl={c.portraitUrl} size={CARD_SIZE} />
            </div>
          ))}
        </motion.div>
      </motion.div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">
        {locked ? 'Decodificado.' : 'Decodificando .exe...'}
      </p>
    </div>
  );
}
