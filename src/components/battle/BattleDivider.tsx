import { Icon } from '../common/Icon';

/**
 * The mirror line between the two formations — horizontal on mobile (where the sides stack) and
 * vertical on desktop (where they sit side by side), with the clash icon sitting on it.
 */
export function BattleDivider() {
  return (
    <div className="flex w-full shrink-0 flex-row items-center gap-2 md:h-full md:w-auto md:flex-col">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-signal-red/40 to-transparent md:h-auto md:w-px md:flex-1 md:bg-gradient-to-b" />
      <span className="flex flex-col items-center gap-0.5 opacity-70">
        <Icon name="swords" size={16} className="text-signal-red" />
        <span className="font-display text-[9px] font-bold uppercase tracking-widest text-white/40">vs</span>
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-signal-red/40 to-transparent md:h-auto md:w-px md:flex-1 md:bg-gradient-to-b" />
    </div>
  );
}
