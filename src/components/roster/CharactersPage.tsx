import { useMemo, useState } from 'react';
import { CharacterPortrait } from './CharacterPortrait';
import { CharacterDetailModal } from './CharacterDetailModal';
import { Icon } from '../common/Icon';
import { buildCompendium, type RosterCharacter } from '../../data/roster';
import { RARITY_COLOR } from '../../data/theme';
import type { Rarity } from '../../types';

interface CharactersPageProps {
  ownedIds: string[];
}

const RARITY_ORDER: Record<Rarity, number> = { Quantum: 0, LTS: 1, Stable: 2, RC: 3, Beta: 4, Alpha: 5 };
const RARITIES: Rarity[] = ['Alpha', 'Beta', 'RC', 'Stable', 'LTS', 'Quantum'];
type SortKey = 'rarity' | 'level' | 'name';

export function CharactersPage({ ownedIds }: CharactersPageProps) {
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [mythologyFilter, setMythologyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('rarity');
  const [selected, setSelected] = useState<RosterCharacter | null>(null);

  const compendium = buildCompendium();
  const ownedSet = new Set(ownedIds);
  const mythologies = useMemo(() => Array.from(new Set(compendium.map((c) => c.mythology))), [compendium]);

  const filtered = compendium
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((c) => rarityFilter === 'all' || c.rarity === rarityFilter)
    .filter((c) => mythologyFilter === 'all' || c.mythology === mythologyFilter)
    .sort((a, b) => {
      if (sortBy === 'rarity') return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      if (sortBy === 'level') return b.level - a.level;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">
          Personagens
        </h1>
        <p className="text-xs text-white/50">Compêndio de .exe conhecidos</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-void-600 bg-void-800/60 px-3 py-2 sm:max-w-xs">
          <Icon name="user" size={14} className="shrink-0 text-white/40" />
          <input
            type="text"
            placeholder="Buscar personagem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-white/90 placeholder:text-white/30 focus:outline-none"
          />
        </label>

        <select
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value as Rarity | 'all')}
          className="rounded-lg border border-void-600 bg-void-800/60 px-2.5 py-2 text-xs text-white/80 focus:outline-none"
        >
          <option value="all">Raridade: todas</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              Raridade: {r}
            </option>
          ))}
        </select>

        <select
          value={mythologyFilter}
          onChange={(e) => setMythologyFilter(e.target.value)}
          className="rounded-lg border border-void-600 bg-void-800/60 px-2.5 py-2 text-xs text-white/80 focus:outline-none"
        >
          <option value="all">Mitologia: todas</option>
          {mythologies.map((m) => (
            <option key={m} value={m}>
              Mitologia: {m}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-lg border border-void-600 bg-void-800/60 px-2.5 py-2 text-xs text-white/80 focus:outline-none"
        >
          <option value="rarity">Ordenar: Raridade</option>
          <option value="level">Ordenar: Nível</option>
          <option value="name">Ordenar: Nome</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-void-600 bg-void-800/30 p-6 text-center text-xs text-white/40">
          Nenhum personagem encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {filtered.map((c) => {
            const owned = ownedSet.has(c.templateId);
            const color = RARITY_COLOR[c.rarity];
            return (
              <button
                key={c.templateId}
                onClick={() => setSelected(c)}
                className="relative flex flex-col items-center gap-2 rounded-xl border bg-void-800/50 p-3 text-left transition hover:bg-void-800/80"
                style={{ borderColor: `${color}66` }}
              >
                {owned && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-code-500/90 text-void-950">
                    <Icon name="check-circle" size={11} />
                  </span>
                )}
                <div className={owned ? '' : 'opacity-50'}>
                  <CharacterPortrait name={c.name} element={c.element} faction={c.faction} portraitUrl={c.portraitUrl} size={64} />
                </div>
                <div className="flex w-full flex-col items-center gap-0.5 text-center">
                  <span className="truncate text-xs font-bold text-white">{c.name}</span>
                  <span className="text-[10px] text-white/40">
                    Nv.{c.level} · {c.mythology}
                  </span>
                </div>
                <div className="flex w-full items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-signal-red/80">
                    <Icon name="swords" size={10} />
                    {Math.round(c.stats.atk)}
                  </span>
                  <span className="flex items-center gap-1 text-code-400/90">
                    <Icon name="heart" size={10} />
                    {Math.round(c.stats.hp)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && <CharacterDetailModal character={selected} owned={ownedSet.has(selected.templateId)} onClose={() => setSelected(null)} />}
    </div>
  );
}
