import { CharacterPortrait } from './CharacterPortrait';
import { RosterChips } from './RosterChips';
import { Icon } from '../common/Icon';
import { buildCompendium } from '../../data/roster';

interface CharactersPageProps {
  ownedIds: string[];
}

export function CharactersPage({ ownedIds }: CharactersPageProps) {
  const compendium = buildCompendium();
  const ownedSet = new Set(ownedIds);

  const sections = new Map<string, typeof compendium>();
  for (const c of compendium) {
    if (!sections.has(c.mythology)) sections.set(c.mythology, []);
    sections.get(c.mythology)!.push(c);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">
          Personagens
        </h1>
        <p className="text-xs text-white/50">Compêndio de .exe conhecidos, por mitologia</p>
      </div>

      <div className="flex flex-col gap-6">
        {Array.from(sections.entries()).map(([mythology, characters]) => (
          <section key={mythology}>
            <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">{mythology}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {characters.map((c) => {
                const owned = ownedSet.has(c.templateId);
                return (
                  <div
                    key={c.templateId}
                    className={`flex flex-col gap-3 rounded-xl border bg-void-800/50 p-4 transition hover:border-code-500/40 ${
                      owned ? 'border-code-500/30' : 'border-void-600 opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <CharacterPortrait name={c.name} element={c.element} faction={c.faction} portraitUrl={c.portraitUrl} size={72} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-display text-sm font-bold text-white">{c.name}</h3>
                          <span className="shrink-0 font-mono text-[10px] text-white/40">Nv.{c.level}</span>
                        </div>
                        <RosterChips faction={c.faction} element={c.element} rarity={c.rarity} />
                        {owned ? (
                          <span className="flex w-fit items-center gap-1 rounded-full border border-code-500/30 bg-code-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-code-300">
                            <Icon name="check-circle" size={10} />
                            Possuído
                          </span>
                        ) : (
                          <span className="w-fit rounded-full border border-void-600 bg-void-900/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                            Não possuído
                          </span>
                        )}
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
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
