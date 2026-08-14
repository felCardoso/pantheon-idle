import type { ReactNode } from 'react';

interface AnimatedBorderCardProps {
  /** Hex color driving the rotating glow — ties each summon card to its own accent. */
  accentColor: string;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a card with a slow, discreet rotating-gradient border ring — a
 * spinning conic-gradient layer peeking through a 1.5px gap around the
 * content, reusing Tailwind's built-in animate-spin (no custom keyframes
 * needed).
 */
export function AnimatedBorderCard({ accentColor, className = '', children }: AnimatedBorderCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-[1.5px] ${className}`}>
      <div
        className="absolute inset-[-60%] [animation-duration:9s] animate-spin"
        style={{ background: `conic-gradient(from 0deg, transparent 0%, ${accentColor} 12%, transparent 28%)` }}
      />
      <div className="relative z-10 h-full rounded-[10px] bg-void-800/95">{children}</div>
    </div>
  );
}
