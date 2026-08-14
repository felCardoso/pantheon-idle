import { useMemo, useState } from 'react';
import { CharacterDetailModal } from './CharacterDetailModal';
import { PixelFigure } from '../battle/PixelFigure';
import { Icon } from '../common/Icon';
import { buildFullRosterView, type RosterCharacter } from '../../data/roster';
import { ELEMENT_COLOR, RARITY_COLOR } from '../../data/theme';
import type { OwnedCharacter } from '../../hooks/useOwnedCharacters';
import type { CharacterAbilityProgress } from '../../hooks/useCharacterProgression';
import type { Rarity } from '../../types';

interface CharactersPageProps {
  ownedCharacters: OwnedCharacter[];
  progression: Record<string, CharacterAbilityProgress>;
  credits: number;
  onUpgradeAbility: (characterId: string) => void;
  onUpgradePassive: (characterId: string) => void;
}

const RARITY_ORDER: Record<Rarity, number> = { 'Zero-Day': 0, LTS: 1, Stable: 2, Beta: 3, Alpha: 4 };
const RARITIES: Rarity[] = ['Alpha', 'Beta', 'Stable', 'LTS', 'Zero-Day'];
type SortKey = 'rarity' | 'level' | 'name';

export function CharactersPage({ ownedCharacters, progression, credits, onUpgradeAbility, onUpgradePassive }: CharactersPageProps) {
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [mythologyFilter, setMythologyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('rarity');
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [selected, setSelected] = useState<RosterCharacter | null>(null);

  const ownedSet = useMemo(() => new Set(ownedCharacters.map((o) => o.characterId)), [ownedCharacters]);
  const ownedByCharacterId = useMemo(() => new Map(ownedCharacters.map((o) => [o.characterId, o])), [ownedCharacters]);
  const fullRoster = useMemo(() => buildFullRosterView(ownedCharacters), [ownedCharacters]);
  const mythologies = useMemo(() => Array.from(new Set(fullRoster.map((c) => c.mythology))), [fullRoster]);

  const filtered = fullRoster
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((c) => rarityFilter === 'all' || c.rarity === rarityFilter)
    .filter((c) => mythologyFilter === 'all' || c.mythology === mythologyFilter)
    .filter((c) => !onlyOwned || ownedSet.has(c.templateId))
    .sort((a, b) => {
      // Owned characters always come first, regardless of the chosen sort — the secondary sort
      // only breaks ties within each group.
      const ownedDiff = Number(ownedSet.has(b.templateId)) - Number(ownedSet.has(a.templateId));
      if (ownedDiff !== 0) return ownedDiff;
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

        <button
          onClick={() => setOnlyOwned((v) => !v)}
          aria-pressed={onlyOwned}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold uppercase tracking-wide transition ${
            onlyOwned ? 'border-code-400/60 bg-code-500/10 text-code-300' : 'border-void-600 bg-void-800/60 text-white/60 hover:text-white/80'
          }`}
        >
          <Icon name="check-circle" size={13} />
          Somente Adquiridos
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-void-600 bg-void-800/30 p-6 text-center text-xs text-white/40">
          Nenhum personagem encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {filtered.map((c) => {
            const owned = ownedSet.has(c.templateId);
            const rarityColor = RARITY_COLOR[c.rarity];
            const elementColor = ELEMENT_COLOR[c.element];
            return (
              <button
                key={c.templateId}
                onClick={() => setSelected(c)}
                className="group relative aspect-[3/4] overflow-hidden rounded-lg border text-left transition hover:brightness-110"
                style={{ borderColor: rarityColor, boxShadow: `0 0 10px -4px ${rarityColor}99` }}
              >
                {/* portrait fills the card */}
                <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${rarityColor}33, #0a0a12)` }}>
                  {c.portraitUrl ? (
                    <img
                      src={c.portraitUrl}
                      alt={c.name}
                      className={`h-full w-full object-cover ${owned ? '' : 'opacity-25 grayscale brightness-75'}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <PixelFigure className={`h-[70%] w-[70%] ${owned ? '' : 'opacity-25 brightness-75'}`} style={{ color: elementColor }} />
                    </div>
                  )}
                </div>

                {/* bottom scrim so name/stat badges stay legible over the art */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-void-950 via-void-950/75 to-transparent" />

                {/* level badge, top-left */}
                <span className="absolute left-1.5 top-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border border-white/40 bg-void-950 px-1 font-mono text-[11px] font-bold text-white">
                  {c.level}
                </span>

                {owned && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-code-500/90 text-void-950">
                    <Icon name="check-circle" size={12} />
                  </span>
                )}

                <div className="absolute inset-x-1.5 bottom-8">
                  <p className="truncate text-[11px] font-bold text-white">{c.name}</p>
                  <p className="truncate text-[9px] text-white/50">{c.mythology}</p>
                </div>

                <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
                  <span className="flex items-center gap-0.5 rounded-full border border-signal-red/30 bg-signal-red/20 px-1.5 py-0.5 text-[9px] font-bold text-signal-red">
                    <Icon name="swords" size={9} />
                    {Math.round(c.stats.atk)}
                  </span>
                  <span className="flex items-center gap-0.5 rounded-full border border-code-500/30 bg-code-500/20 px-1.5 py-0.5 text-[9px] font-bold text-code-300">
                    <Icon name="heart" size={9} />
                    {Math.round(c.stats.hp)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <CharacterDetailModal
          character={selected}
          owned={ownedSet.has(selected.templateId)}
          ownedRarity={ownedByCharacterId.get(selected.templateId)?.rarity ?? null}
          abilityLevel={progression[selected.templateId]?.abilityLevel ?? 1}
          passiveLevel={progression[selected.templateId]?.passiveLevel ?? 0}
          credits={credits}
          onUpgradeAbility={() => onUpgradeAbility(selected.templateId)}
          onUpgradePassive={() => onUpgradePassive(selected.templateId)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
