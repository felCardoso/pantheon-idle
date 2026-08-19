import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { Icon } from '../common/Icon';
import { buildOwnedRoster, type RosterCharacter } from '../../data/roster';
import { RARITY_COLOR } from '../../data/theme';
import type { OwnedCharacter } from '../../hooks/useOwnedCharacters';
import type { Rarity } from '../../types';

const RARITY_ORDER: Record<Rarity, number> = { 'Zero-Day': 0, LTS: 1, Stable: 2, Beta: 3, Alpha: 4 };
const RARITIES: Rarity[] = ['Alpha', 'Beta', 'Stable', 'LTS', 'Zero-Day'];
type SortKey = 'rarity' | 'level' | 'name';

interface CharacterSelectorPanelProps {
  ownedCharacters: OwnedCharacter[];
  onSelect: (characterId: string) => void;
  /** Marks a card as chosen — the Team page ticks members, Upgrades highlights the one being edited. */
  isSelected?: (characterId: string) => boolean;
  /** Draws attention to the whole grid while the caller is waiting for a pick. */
  highlight?: boolean;
  /** Makes cards draggable, carrying the character id as text/plain. */
  draggable?: boolean;
  /** Rendered above the grid — the Team page uses it for its "escolha um personagem" hint. */
  children?: ReactNode;
}

/**
 * The filterable roster grid, shared by Time and Upgrades.
 *
 * Both screens need "pick one of your characters" with the same search/rarity/mythology/sort
 * controls, and duplicating it once meant the two could drift apart — a filter fixed on one and
 * not the other.
 */
export function CharacterSelectorPanel({
  ownedCharacters,
  onSelect,
  isSelected,
  highlight = false,
  draggable = false,
  children,
}: CharacterSelectorPanelProps) {
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [mythologyFilter, setMythologyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('rarity');

  const ownedRoster = useMemo(() => buildOwnedRoster(ownedCharacters), [ownedCharacters]);
  const mythologies = useMemo(() => Array.from(new Set(ownedRoster.map((c) => c.mythology))), [ownedRoster]);

  const filtered = ownedRoster
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((c) => rarityFilter === 'all' || c.rarity === rarityFilter)
    .filter((c) => mythologyFilter === 'all' || c.mythology === mythologyFilter)
    .sort((a, b) => {
      if (sortBy === 'rarity') return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      if (sortBy === 'level') return b.level - a.level;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-void-600 bg-void-800/60 px-3 py-2">
          <Icon name="user" size={13} className="shrink-0 text-white/40" />
          <input
            type="text"
            placeholder="Buscar personagem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-white/90 placeholder:text-white/30 focus:outline-none"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value as Rarity | 'all')}
            className="min-w-0 rounded-lg border border-void-600 bg-void-800/60 px-2 py-2 text-[11px] text-white/80 focus:outline-none"
          >
            <option value="all">Raridade: todas</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={mythologyFilter}
            onChange={(e) => setMythologyFilter(e.target.value)}
            className="min-w-0 rounded-lg border border-void-600 bg-void-800/60 px-2 py-2 text-[11px] text-white/80 focus:outline-none"
          >
            <option value="all">Mitologia: todas</option>
            {mythologies.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="min-w-0 rounded-lg border border-void-600 bg-void-800/60 px-2 py-2 text-[11px] text-white/80 focus:outline-none"
          >
            <option value="rarity">Ordenar: Raridade</option>
            <option value="level">Ordenar: Nível</option>
            <option value="name">Ordenar: Nome</option>
          </select>
        </div>
      </div>

      {children}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-void-600 bg-void-800/30 p-6 text-center text-xs text-white/40">Nenhum personagem encontrado.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {filtered.map((c: RosterCharacter) => {
            const selected = isSelected?.(c.templateId) ?? false;
            const rarityColor = RARITY_COLOR[c.rarity];
            return (
              <button
                key={c.templateId}
                draggable={draggable}
                onDragStart={draggable ? (e: DragEvent) => e.dataTransfer.setData('text/plain', c.templateId) : undefined}
                onClick={() => onSelect(c.templateId)}
                className={`group relative aspect-[3/4] overflow-hidden rounded-lg border text-left transition hover:brightness-110 ${
                  highlight ? 'animate-pulse cursor-copy ring-2 ring-code-400 ring-offset-1 ring-offset-void-950' : ''
                }`}
                style={{ borderColor: rarityColor, boxShadow: `0 0 8px -4px ${rarityColor}99` }}
              >
                <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${rarityColor}33, #0a0a12)` }}>
                  {c.portraitUrl && <img src={c.portraitUrl} alt={c.name} className="h-full w-full object-cover" />}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-void-950 via-void-950/75 to-transparent" />
                <span className="absolute left-1 top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/40 bg-void-950 px-1 font-mono text-[10px] font-bold text-white">
                  {c.level}
                </span>
                {selected && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-code-500/90 text-void-950">
                    <Icon name="check-circle" size={10} />
                  </span>
                )}
                <div className="absolute inset-x-1 bottom-6">
                  <p className="truncate text-[10px] font-bold text-white">{c.name}</p>
                  <p className="truncate text-[8px] text-white/50">{c.mythology}</p>
                </div>
                <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
                  <span className="flex items-center gap-0.5 rounded-full border border-signal-red/30 bg-signal-red/20 px-1 py-0 text-[8px] font-bold text-signal-red">
                    <Icon name="swords" size={7} />
                    {Math.round(c.stats.atk)}
                  </span>
                  <span className="flex items-center gap-0.5 rounded-full border border-code-500/30 bg-code-500/20 px-1 py-0 text-[8px] font-bold text-code-300">
                    <Icon name="heart" size={7} />
                    {Math.round(c.stats.hp)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
