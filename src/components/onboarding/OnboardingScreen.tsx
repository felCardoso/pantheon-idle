import { useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { RosterChips } from '../roster/RosterChips';
import { pickStarterOptions, type RosterCharacter } from '../../data/roster';
import { Rng } from '../../engine/core/rng';

interface OnboardingScreenProps {
  onSelect: (characterId: string) => void;
}

export function OnboardingScreen({ onSelect }: OnboardingScreenProps) {
  const [options] = useState<RosterCharacter[]>(() => pickStarterOptions(new Rng(Date.now() >>> 0)));
  const [picked, setPicked] = useState<string | null>(null);

  function handlePick(id: string) {
    if (picked) return;
    setPicked(id);
    onSelect(id);
  }

  return (
    <div className="circuit-grid relative min-h-dvh overflow-y-auto bg-void-950 p-4 py-10">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(50% 40% at 50% 0%, rgba(57,255,156,0.12), transparent 70%), radial-gradient(45% 35% at 100% 100%, rgba(195,74,255,0.12), transparent 70%)',
        }}
      />

      <div className={`relative mx-auto w-full ${options.length >= 4 ? 'max-w-6xl' : 'max-w-4xl'}`}>
        <div className="mb-6 text-center">
          <h1 className="font-display text-xl font-black uppercase tracking-widest text-white text-glow-code sm:text-2xl">
            Escolha seu primeiro .exe
          </h1>
          <p className="mt-2 text-sm text-white/50">Um personagem de cada mitologia disponível — essa escolha é permanente.</p>
        </div>

        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${options.length >= 3 ? 'lg:grid-cols-3' : ''} ${options.length >= 4 ? 'xl:grid-cols-4' : ''}`}>
          {options.map((c) => (
            <div
              key={c.templateId}
              className="flex flex-col gap-3 rounded-2xl border border-code-500/25 bg-void-900/90 p-5 shadow-[0_0_60px_-15px_rgba(57,255,156,0.2)] backdrop-blur-md"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <CharacterPortrait name={c.name} element={c.element} rarity={c.rarity} portraitUrl={c.portraitUrl} size={88} />
                <div>
                  <h2 className="font-display text-sm font-bold text-white">{c.name}</h2>
                  <p className="text-[10px] uppercase tracking-wide text-white/40">{c.mythology}</p>
                </div>
                <RosterChips faction={c.faction} element={c.element} rarity={c.rarity} />
              </div>

              <p className="min-h-10 text-xs italic leading-relaxed text-white/50">{c.lore}</p>

              <div className="rounded-lg border border-void-600 bg-void-800/60 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-arcane-300">
                  <Icon name="sparkles" size={12} />
                  {c.abilities[0].name ?? c.abilities[0].kind}
                  {c.abilities[0].name && <span className="font-normal text-white/40">· {c.abilities[0].kind}</span>}
                  {c.abilities.length > 1 && <span className="font-normal text-white/40">· +{c.abilities.length - 1}</span>}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/70">{c.abilities[0].description}</p>
              </div>

              <button
                onClick={() => handlePick(c.templateId)}
                disabled={picked !== null}
                className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-code-500 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400 disabled:opacity-60"
              >
                {picked === c.templateId && <Icon name="loader" size={14} className="animate-spin" />}
                Escolher
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
