import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { CharacterPortrait } from './CharacterPortrait';
import { CharacterDetailModal } from './CharacterDetailModal';
import { Icon } from '../common/Icon';
import { PvpAttackModal } from '../team/PvpAttackModal';
import { buildOwnedRoster, characterPower, type RosterCharacter } from '../../data/roster';
import { CONSTANTS } from '../../engine/core/loader';
import { RARITY_COLOR } from '../../data/theme';
import type { OwnedCharacter } from '../../hooks/useOwnedCharacters';
import type { TeamSlot, UsePlayerTeamsResult } from '../../hooks/usePlayerTeams';
import { MAX_TEAM_MEMBERS } from '../../hooks/usePlayerTeams';
import { TEAM_SLOT_COST_TOKENS } from '../../hooks/usePlayerProgress';
import type { UsePvpResult } from '../../hooks/usePvp';
import type { CharacterAbilityProgress } from '../../hooks/useCharacterProgression';
import type { AbilityTrigger } from '../../engine/schema';
import type { Rarity } from '../../types';

interface TeamPageProps {
  ownedCharacters: OwnedCharacter[];
  teams: UsePlayerTeamsResult;
  unlockedTeamSlots: number;
  vipActive: boolean;
  tokens: number;
  onPurchaseTeamSlot: () => Promise<boolean>;
  pveTeamSlot: number;
  pvpTeamSlot: number;
  onSetPveTeamSlot: (slot: number) => void;
  onSetPvpTeamSlot: (slot: number) => void;
  pvp: UsePvpResult;
  onRewardCredits: (amount: number) => void;
  onToast: (message: string) => void;
  progression: Record<string, CharacterAbilityProgress>;
  credits: number;
  onUpgradeAbility: (characterId: string) => void;
  onUpgradePassive: (characterId: string) => void;
}

const RARITY_ORDER: Record<Rarity, number> = { 'Zero-Day': 0, LTS: 1, Stable: 2, Beta: 3, Alpha: 4 };
const RARITIES: Rarity[] = ['Alpha', 'Beta', 'Stable', 'LTS', 'Zero-Day'];
type SortKey = 'rarity' | 'level' | 'name';

const TRIGGER_LABEL: Record<AbilityTrigger, string> = {
  battleStart: 'Início de batalha',
  onAttack: 'Ao atacar',
  onDamaged: 'Ao ser atingido',
  onCriticalHit: 'Crítico',
};

function resolveTeamMembers(team: TeamSlot, owned: OwnedCharacter[]): OwnedCharacter[] {
  const byId = new Map(owned.map((o) => [o.characterId, o]));
  return team.characterIds.map((id) => byId.get(id)).filter((c): c is OwnedCharacter => !!c);
}

/** Team names always keep the ".cfg" suffix — only the part before it is ever editable. */
const CFG_SUFFIX = '.cfg';
function nameWithoutCfg(name: string): string {
  return name.endsWith(CFG_SUFFIX) ? name.slice(0, -CFG_SUFFIX.length) : name;
}

export function TeamPage({
  ownedCharacters,
  teams,
  unlockedTeamSlots,
  vipActive,
  tokens,
  onPurchaseTeamSlot,
  pveTeamSlot,
  pvpTeamSlot,
  onSetPveTeamSlot,
  onSetPvpTeamSlot,
  pvp,
  onRewardCredits,
  onToast,
  progression,
  credits,
  onUpgradeAbility,
  onUpgradePassive,
}: TeamPageProps) {
  const [activeSlot, setActiveSlot] = useState(1);
  const [renamingSlot, setRenamingSlot] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [attackModalOpen, setAttackModalOpen] = useState(false);
  /** Set by clicking an empty team slot — the next selector-card click (or drop) fills that exact position instead of toggling add/remove. */
  const [pickingSlotIndex, setPickingSlotIndex] = useState<number | null>(null);
  const [detailCharacter, setDetailCharacter] = useState<RosterCharacter | null>(null);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [mythologyFilter, setMythologyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('rarity');

  const effectiveUnlockedSlots = vipActive ? 5 : unlockedTeamSlots;
  const activeTeam = teams.teams.find((t) => t.slot === activeSlot) ?? teams.teams[0];

  const ownedById = useMemo(() => new Map(ownedCharacters.map((o) => [o.characterId, o])), [ownedCharacters]);
  const activeTeamOwned = useMemo(
    () => activeTeam.characterIds.map((id) => ownedById.get(id)).filter((c): c is OwnedCharacter => !!c),
    [activeTeam.characterIds, ownedById],
  );
  const activeTeamRoster = useMemo(() => buildOwnedRoster(activeTeamOwned), [activeTeamOwned]);

  const ownedRoster = useMemo(() => buildOwnedRoster(ownedCharacters), [ownedCharacters]);
  const mythologies = useMemo(() => Array.from(new Set(ownedRoster.map((c) => c.mythology))), [ownedRoster]);
  const filteredSelector = ownedRoster
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((c) => rarityFilter === 'all' || c.rarity === rarityFilter)
    .filter((c) => mythologyFilter === 'all' || c.mythology === mythologyFilter)
    .sort((a, b) => {
      if (sortBy === 'rarity') return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      if (sortBy === 'level') return b.level - a.level;
      return a.name.localeCompare(b.name);
    });

  const teamPower = activeTeamRoster.reduce((sum, c) => sum + characterPower(c.stats), 0);
  const synergyPercent = Math.round((CONSTANTS.synergyByCount[String(activeTeamRoster.length)] ?? 0) * 100);
  const orderOfAction = [...activeTeamRoster].sort((a, b) => (b.alwaysActsFirst ? 1 : 0) - (a.alwaysActsFirst ? 1 : 0) || b.stats.ini - a.stats.ini);

  // The PvP dropdown/team it points to is the one an attacker actually fights (docs/gdd.md
  // section 6) — mirror it into pvp_defense_teams any time either changes, replacing the old
  // Arena page's separate "save defense team" step entirely.
  const pvpTeam = teams.teams.find((t) => t.slot === pvpTeamSlot);
  useEffect(() => {
    if (!pvpTeam || pvpTeam.characterIds.length === 0) return;
    pvp.setDefenseTeam(resolveTeamMembers(pvpTeam, ownedCharacters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pvpTeamSlot, pvpTeam?.characterIds, ownedCharacters]);

  function handleSelectSlot(slot: number) {
    if (slot > effectiveUnlockedSlots) return;
    setActiveSlot(slot);
    setRenamingSlot(null);
  }

  async function handlePurchaseSlot(slot: number) {
    if (slot > effectiveUnlockedSlots + 1) return;
    const ok = await onPurchaseTeamSlot();
    onToast(ok ? `${teams.teams.find((t) => t.slot === slot)?.name ?? `Time${slot}.cfg`} desbloqueado!` : 'Tokens insuficientes.');
  }

  function startRename(slot: number, currentName: string) {
    setRenamingSlot(slot);
    setRenameValue(nameWithoutCfg(currentName));
  }

  async function confirmRename() {
    if (renamingSlot !== null && renameValue.trim()) {
      await teams.renameTeam(renamingSlot, `${renameValue.trim()}${CFG_SUFFIX}`);
    }
    setRenamingSlot(null);
  }

  async function removeFromTeam(characterId: string) {
    if (activeTeam.characterIds.length <= 1) {
      onToast('Um time precisa de ao menos 1 personagem.');
      return;
    }
    await teams.setTeamCharacters(
      activeTeam.slot,
      activeTeam.characterIds.filter((id) => id !== characterId),
    );
  }

  async function toggleAdd(characterId: string) {
    const inTeam = activeTeam.characterIds.includes(characterId);
    if (inTeam) {
      await removeFromTeam(characterId);
      return;
    }
    if (activeTeam.characterIds.length >= MAX_TEAM_MEMBERS) {
      onToast(`Time cheio (máx. ${MAX_TEAM_MEMBERS}).`);
      return;
    }
    await teams.setTeamCharacters(activeTeam.slot, [...activeTeam.characterIds, characterId]);
  }

  /** Places characterId at an exact slot position — index < current length replaces that member, index === length appends. Used by both the "+" pick-mode flow and drag-and-drop. */
  async function placeAt(index: number, characterId: string) {
    if (activeTeam.characterIds.includes(characterId)) {
      onToast('Personagem já está no time.');
      return;
    }
    if (index >= MAX_TEAM_MEMBERS) return;
    const next = [...activeTeam.characterIds];
    if (index < next.length) next[index] = characterId;
    else next.push(characterId);
    await teams.setTeamCharacters(activeTeam.slot, next);
  }

  async function handleSelectorCardClick(characterId: string) {
    if (pickingSlotIndex !== null) {
      await placeAt(pickingSlotIndex, characterId);
      setPickingSlotIndex(null);
      return;
    }
    await toggleAdd(characterId);
  }

  function handleDropOnSlot(index: number, e: DragEvent) {
    e.preventDefault();
    const characterId = e.dataTransfer.getData('text/plain');
    if (characterId) placeAt(index, characterId);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Seu Time</h1>
        <p className="text-xs text-white/50">Configure até 5 loadouts (.cfg) e escolha qual usar no PvE e no PvP</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Team tabs */}
          <div className="flex flex-wrap gap-1.5">
            {teams.teams.map((t) => {
              const locked = t.slot > effectiveUnlockedSlots;
              const active = t.slot === activeSlot;
              return (
                <div key={t.slot} className="flex items-center">
                  {renamingSlot === t.slot ? (
                    <div className="flex items-center gap-0.5 rounded-lg border border-code-400/50 bg-void-800 px-2 py-1.5">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                        onBlur={confirmRename}
                        className="w-20 bg-transparent font-mono text-xs text-white focus:outline-none"
                      />
                      <span className="font-mono text-xs text-white/40">{CFG_SUFFIX}</span>
                    </div>
                  ) : locked ? (
                    <button
                      onClick={() => handlePurchaseSlot(t.slot)}
                      disabled={t.slot !== effectiveUnlockedSlots + 1 || tokens < TEAM_SLOT_COST_TOKENS}
                      className="flex items-center gap-1.5 rounded-lg border border-void-600 bg-void-800/40 px-3 py-2 text-xs text-white/40 transition hover:border-signal-cyan/40 hover:text-signal-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-void-600 disabled:hover:text-white/40"
                    >
                      <Icon name="lock" size={12} />
                      {t.name}
                      <span className="flex items-center gap-0.5 font-mono text-[10px]">
                        <Icon name="gem" size={10} />
                        {TEAM_SLOT_COST_TOKENS}
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectSlot(t.slot)}
                      className={`group flex items-center gap-1.5 rounded-lg border px-3 py-2 font-display text-xs font-bold uppercase tracking-wide transition ${
                        active ? 'border-code-400/60 bg-code-500/10 text-code-300' : 'border-void-600 text-white/50 hover:text-white/80'
                      }`}
                    >
                      {t.name}
                      {t.slot === pveTeamSlot && (
                        <span className="rounded-full border border-signal-cyan/40 bg-signal-cyan/10 px-1 py-0.5 text-[8px] text-signal-cyan">PVE</span>
                      )}
                      {t.slot === pvpTeamSlot && (
                        <span className="rounded-full border border-signal-red/40 bg-signal-red/10 px-1 py-0.5 text-[8px] text-signal-red">PVP</span>
                      )}
                      <Icon
                        name="pencil"
                        size={11}
                        className="opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(t.slot, t.name);
                        }}
                      />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active team's members */}
          <div className="flex flex-wrap gap-3 rounded-xl border border-void-600 bg-void-800/40 p-3">
            {Array.from({ length: MAX_TEAM_MEMBERS }, (_, i) => activeTeamRoster[i]).map((c, i) =>
              c ? (
                <div
                  key={c.templateId}
                  className="group relative flex w-16 flex-col items-center gap-1"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnSlot(i, e)}
                >
                  <button onClick={() => setDetailCharacter(c)} className="relative">
                    <CharacterPortrait name={c.name} element={c.element} rarity={c.rarity} portraitUrl={c.portraitUrl} size={64} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromTeam(c.templateId);
                    }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-void-600 bg-void-950 text-white/60 opacity-0 transition hover:border-signal-red/60 hover:text-signal-red group-hover:opacity-100"
                  >
                    <Icon name="x" size={11} />
                  </button>
                  <span className="font-mono text-[9px] text-white/60">Nv.{c.level}</span>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-void-900">
                    <div
                      className="h-full rounded-full bg-arcane-400"
                      style={{ width: `${Math.round((c.xpIntoLevel / c.xpForNextLevel) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  key={`empty-${i}`}
                  onClick={() => setPickingSlotIndex((prev) => (prev === i ? null : i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnSlot(i, e)}
                  className={`flex h-16 w-16 items-center justify-center rounded-xl border border-dashed transition ${
                    pickingSlotIndex === i
                      ? 'animate-pulse border-code-400 bg-code-500/10 text-code-300'
                      : 'border-void-600 text-white/20 hover:border-void-500 hover:text-white/40'
                  }`}
                >
                  <Icon name="plus" size={18} />
                </button>
              ),
            )}
          </div>
          {pickingSlotIndex !== null && (
            <p className="-mt-2 flex items-center gap-1.5 text-[11px] text-code-300">
              <Icon name="sparkles" size={12} />
              Escolha um personagem na lista à direita para preencher o slot.
            </p>
          )}

          {/* Team power */}
          <div className="rounded-xl border border-signal-amber/25 bg-void-800/50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-bold uppercase tracking-widest text-white/50">Poder do time</span>
              <span className="font-display text-lg font-bold text-signal-amber text-glow-code">{teamPower.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* PvE / PvP selectors */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-void-600 bg-void-800/60 px-3 py-2">
              <Icon name="swords" size={13} className="shrink-0 text-signal-cyan" />
              <span className="shrink-0 text-[11px] text-white/50">PvE</span>
              <select
                value={pveTeamSlot}
                onChange={(e) => onSetPveTeamSlot(Number(e.target.value))}
                className="w-full bg-transparent text-xs text-white/90 focus:outline-none"
              >
                {teams.teams
                  .filter((t) => t.slot <= effectiveUnlockedSlots)
                  .map((t) => (
                    <option key={t.slot} value={t.slot} className="bg-void-900">
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-void-600 bg-void-800/60 px-3 py-2">
              <Icon name="crosshair" size={13} className="shrink-0 text-signal-red" />
              <span className="shrink-0 text-[11px] text-white/50">PvP</span>
              <select
                value={pvpTeamSlot}
                onChange={(e) => onSetPvpTeamSlot(Number(e.target.value))}
                className="w-full bg-transparent text-xs text-white/90 focus:outline-none"
              >
                {teams.teams
                  .filter((t) => t.slot <= effectiveUnlockedSlots)
                  .map((t) => (
                    <option key={t.slot} value={t.slot} className="bg-void-900">
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              onClick={() => setAttackModalOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-signal-red/90 px-3 py-2 font-display text-[11px] font-bold uppercase tracking-wide text-void-950 transition hover:bg-signal-red"
            >
              <Icon name="crosshair" size={13} />
              Buscar oponentes
            </button>
          </div>

          {/* Synergy + order of action */}
          <div className="rounded-xl border border-void-600 bg-void-800/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white/50">Sinergia</h2>
              {synergyPercent > 0 && (
                <span className="flex items-center gap-1.5 rounded-full border border-code-500/30 bg-code-500/10 px-2.5 py-1 font-mono text-[11px] text-code-300">
                  <Icon name="sparkles" size={12} />+{synergyPercent}% HP/ATK
                </span>
              )}
            </div>
            {activeTeamRoster.length === 0 ? (
              <p className="text-xs text-white/40">Adicione personagens ao time para ver a ordem de ação.</p>
            ) : (
              <>
                <p className="mb-3 text-[11px] text-white/40">
                  Personagens do mesmo mundo/mitologia ganham bônus por time — atualmente:{' '}
                  {Array.from(new Set(activeTeamRoster.map((c) => c.mythology))).join(' · ')}
                </p>
                <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Ordem de ação</h3>
                <div className="flex flex-col gap-2">
                  {orderOfAction.map((c, i) => (
                    <div key={c.templateId} className="rounded-lg border border-void-600 bg-void-900/40 p-2.5">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-void-800 font-mono text-[10px] text-white/60">
                          {i + 1}
                        </span>
                        <span className="truncate text-xs font-bold text-white">{c.name}</span>
                        {c.alwaysActsFirst && (
                          <span className="shrink-0 rounded-full border border-signal-amber/30 bg-signal-amber/10 px-1.5 py-0.5 text-[9px] text-signal-amber">
                            Sempre primeiro
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 pl-7">
                        {c.abilities.map((a, ai) => (
                          <div key={ai} className="flex items-center gap-1.5 text-[10px] text-white/50">
                            <span className="shrink-0 rounded-full border border-arcane-400/30 bg-arcane-400/10 px-1.5 py-0.5 font-bold uppercase tracking-wide text-arcane-300">
                              {TRIGGER_LABEL[a.trigger]}
                            </span>
                            <span className="truncate">{a.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: character selector */}
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

          {filteredSelector.length === 0 ? (
            <p className="rounded-xl border border-void-600 bg-void-800/30 p-6 text-center text-xs text-white/40">Nenhum personagem encontrado.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {filteredSelector.map((c: RosterCharacter) => {
                const inTeam = activeTeam.characterIds.includes(c.templateId);
                const rarityColor = RARITY_COLOR[c.rarity];
                const picking = pickingSlotIndex !== null;
                return (
                  <button
                    key={c.templateId}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', c.templateId)}
                    onClick={() => handleSelectorCardClick(c.templateId)}
                    className={`group relative aspect-[3/4] overflow-hidden rounded-lg border text-left transition hover:brightness-110 ${
                      picking ? 'ring-2 ring-code-400 ring-offset-1 ring-offset-void-950 animate-pulse cursor-copy' : ''
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
                    {inTeam && (
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
      </div>

      {attackModalOpen && <PvpAttackModal pvp={pvp} onRewardCredits={onRewardCredits} onToast={onToast} onClose={() => setAttackModalOpen(false)} />}
      {detailCharacter && (
        <CharacterDetailModal
          character={detailCharacter}
          owned
          ownedRarity={ownedById.get(detailCharacter.templateId)?.rarity ?? null}
          abilityLevel={progression[detailCharacter.templateId]?.abilityLevel ?? 1}
          passiveLevel={progression[detailCharacter.templateId]?.passiveLevel ?? 0}
          credits={credits}
          onUpgradeAbility={() => onUpgradeAbility(detailCharacter.templateId)}
          onUpgradePassive={() => onUpgradePassive(detailCharacter.templateId)}
          onClose={() => setDetailCharacter(null)}
        />
      )}
    </div>
  );
}
