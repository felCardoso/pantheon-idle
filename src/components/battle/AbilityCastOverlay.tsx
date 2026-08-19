import type { AbilityCastEvent } from '../../hooks/useBattleReplay';

interface AbilityCastOverlayProps {
  /** At most one per side — a concurrent ally + enemy cast is what renders as a clash across the shared dim backdrop. */
  activeAbilities: AbilityCastEvent[];
}

/** The darken-screen + sliding name-card callout for a just-used ability — shared by PvE's BattleStage and PvP's PvpBattleStage so the "clash" (both sides casting at once) looks identical in both. */
export function AbilityCastOverlay({ activeAbilities }: AbilityCastOverlayProps) {
  if (activeAbilities.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[15] overflow-hidden">
      <div
        key={activeAbilities.map((a) => a.id).join('-')}
        className="absolute inset-0 animate-ability-cast-darken bg-void-950/75 opacity-0 backdrop-blur-[2px]"
      />
      {activeAbilities.map((activeAbility) => (
        <div key={activeAbility.id} className="absolute inset-0">
          {activeAbility.portraitUrl && (
            // Positioning lives on this wrapper, not on the animated element: the keyframes set
            // `transform` outright, which would otherwise wipe out the -translate-y-1/2 that
            // centres the portrait (and the enemy side's mirror).
            <div
              className={`absolute top-1/2 h-[52%] -translate-y-1/2 ${
                activeAbility.isAlly ? 'left-[4%] sm:left-[10%]' : 'right-[4%] sm:right-[10%]'
              }`}
            >
              <div
                className={`h-full animate-ability-cast-portrait overflow-hidden rounded-xl border-2 bg-void-950/60 opacity-0 backdrop-blur-sm ${
                  activeAbility.isAlly ? 'border-code-400/70' : 'border-signal-red/70'
                }`}
                style={{
                  boxShadow: `0 0 24px -6px color-mix(in srgb, var(${activeAbility.isAlly ? '--color-code-500' : '--color-signal-red'}) 50%, transparent)`,
                }}
              >
                <img
                  src={activeAbility.portraitUrl}
                  alt=""
                  className={`h-full w-auto object-contain ${activeAbility.isAlly ? '' : 'scale-x-[-1]'}`}
                />
              </div>
            </div>
          )}
          <div
            className={`relative flex h-full items-center px-4 ${
              activeAbilities.length > 1 ? (activeAbility.isAlly ? 'justify-start sm:pl-[22%]' : 'justify-end sm:pr-[22%]') : 'justify-center'
            }`}
          >
            <div className="animate-ability-cast-text text-center opacity-0">
              <p
                className={`font-display text-[10px] font-bold uppercase tracking-[0.3em] sm:text-xs ${
                  activeAbility.isAlly ? 'text-code-400' : 'text-signal-red'
                }`}
              >
                {activeAbility.unitName}
              </p>
              <p className="font-display text-2xl font-black uppercase tracking-wide text-white text-glow-code sm:text-4xl">
                {activeAbility.abilityName}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
