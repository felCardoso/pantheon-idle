import { CharacterPortrait } from './CharacterPortrait';
import { RosterChips } from './RosterChips';
import { Icon } from '../common/Icon';
import { buildRoster } from '../../data/roster';

export function CharactersPage() {
  const roster = buildRoster();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">
          Personagens
        </h1>
        <p className="text-xs text-white/50">Compêndio de .exe conhecidos · Jurupari.iso — Folclore Brasileiro</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {roster.map((c) => (
          <div
            key={c.templateId}
            className="flex flex-col gap-3 rounded-xl border border-void-600 bg-void-800/50 p-4 transition hover:border-code-500/40"
          >
            <div className="flex items-start gap-3">
              <CharacterPortrait name={c.name} element={c.element} faction={c.faction} portraitUrl={c.portraitUrl} size={72} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-display text-sm font-bold text-white">{c.name}</h2>
                  <span className="shrink-0 font-mono text-[10px] text-white/40">Nv.{c.level}</span>
                </div>
                <RosterChips faction={c.faction} element={c.element} rarity={c.rarity} />
              </div>
            </div>

            <p className="text-xs italic leading-relaxed text-white/50">{c.lore}</p>

            <div className="mt-auto rounded-lg border border-void-600 bg-void-900/60 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-arcane-300">
                <Icon name="sparkles" size={12} />
                {c.abilityName ?? c.abilityKind}
                {c.abilityName && <span className="font-normal text-white/40">· {c.abilityKind}</span>}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/70">{c.abilityDescription}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
