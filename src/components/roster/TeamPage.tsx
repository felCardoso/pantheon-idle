import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { CharacterPortrait } from './CharacterPortrait';
import { CharacterDetailModal } from './CharacterDetailModal';
import { CharacterSelectorPanel } from './CharacterSelectorPanel';
import { Icon } from '../common/Icon';
import { PvpLeaderboardModal } from '../team/PvpLeaderboardModal';
import { buildOwnedRoster, characterPower, type RosterCharacter } from '../../data/roster';
import { CONSTANTS, type Row } from '../../engine';
import type { OwnedCharacter } from '../../hooks/useOwnedCharacters';
import type { TeamSlot, UsePlayerTeamsResult } from '../../hooks/usePlayerTeams';
import { MAX_TEAM_MEMBERS } from '../../hooks/usePlayerTeams';
import { TEAM_SLOT_COST_TOKENS } from '../../hooks/usePlayerProgress';
import type { UsePvpResult } from '../../hooks/usePvp';
import { selectedAbilityMapFrom, type UseCharacterProgressionResult } from '../../hooks/useCharacterProgression';

interface TeamPageProps {
  userId: string;
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
  onToast: (message: string) => void;
  characterProgression: UseCharacterProgressionResult;
}

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
  userId,
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
  onToast,
  characterProgression,
}: TeamPageProps) {
  const [activeSlot, setActiveSlot] = useState(1);
  const [renamingSlot, setRenamingSlot] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  /** Set by clicking an empty team slot — the next selector-card click (or drop) fills that exact position instead of toggling add/remove. */
  const [pickingSlotIndex, setPickingSlotIndex] = useState<number | null>(null);
  const [detailCharacter, setDetailCharacter] = useState<RosterCharacter | null>(null);

  const effectiveUnlockedSlots = vipActive ? 5 : unlockedTeamSlots;
  const activeTeam = teams.teams.find((t) => t.slot === activeSlot) ?? teams.teams[0];

  const ownedById = useMemo(() => new Map(ownedCharacters.map((o) => [o.characterId, o])), [ownedCharacters]);
  const activeTeamOwned = useMemo(
    () => activeTeam.characterIds.map((id) => ownedById.get(id)).filter((c): c is OwnedCharacter => !!c),
    [activeTeam.characterIds, ownedById],
  );
  const activeTeamRoster = useMemo(() => buildOwnedRoster(activeTeamOwned), [activeTeamOwned]);

  const teamPower = activeTeamRoster.reduce((sum, c) => sum + characterPower(c.stats), 0);
  const synergyPercent = Math.round((CONSTANTS.synergyByCount[String(activeTeamRoster.length)] ?? 0) * 100);

  // The PvP dropdown/team it points to is the one an attacker actually fights (docs/gdd.md
  // section 6) — mirror it into pvp_defense_teams any time either changes, replacing the old
  // Arena page's separate "save defense team" step entirely.
  const pvpTeam = teams.teams.find((t) => t.slot === pvpTeamSlot);
  const selectedAbilityByCharacterId = useMemo(
    () => selectedAbilityMapFrom(characterProgression.progression),
    [characterProgression.progression],
  );
  // Row (front/back, src/engine/turn/formation.ts) for each current PvP-team member — defaults a
  // member never explicitly toggled to 'front', keeps whatever the player already set otherwise.
  const pvpFormation = useMemo(() => {
    const next: Record<string, Row> = {};
    for (const id of pvpTeam?.characterIds ?? []) next[id] = pvp.defenseFormation[id] ?? 'front';
    return next;
  }, [pvpTeam?.characterIds, pvp.defenseFormation]);
  useEffect(() => {
    if (!pvpTeam || pvpTeam.characterIds.length === 0) return;
    pvp.setDefenseTeam(resolveTeamMembers(pvpTeam, ownedCharacters), selectedAbilityByCharacterId, pvpFormation);
    // pvpFormation deliberately excluded: setDefenseTeam changing pvp.defenseFormation would
    // otherwise recompute pvpFormation and re-fire this effect in a loop. It only needs to react
    // to membership/ability changes — toggleFormationRow below handles formation edits directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pvpTeamSlot, pvpTeam?.characterIds, ownedCharacters, selectedAbilityByCharacterId]);

  async function toggleFormationRow(characterId: string) {
    if (!pvpTeam) return;
    const nextRow: Row = (pvpFormation[characterId] ?? 'front') === 'front' ? 'back' : 'front';
    await pvp.setDefenseTeam(resolveTeamMembers(pvpTeam, ownedCharacters), selectedAbilityByCharacterId, { ...pvpFormation, [characterId]: nextRow });
  }

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

  /**
   * Places characterId at an exact slot position — index < current length replaces that member,
   * index === length appends. Used by both the "+" pick-mode flow and drag-and-drop.
   *
   * A character already on the team is *moved* rather than rejected: slot order is the combat
   * queue (index 0 is the Vanguard), so dragging someone to the front is how a player picks who
   * leads. Refusing the drop would leave emptying the whole team as the only way to reorder it.
   */
  async function placeAt(index: number, characterId: string) {
    if (index >= MAX_TEAM_MEMBERS) return;
    const current = activeTeam.characterIds;
    const from = current.indexOf(characterId);

    if (from !== -1) {
      if (from === index) return;
      const next = current.filter((id) => id !== characterId);
      next.splice(Math.min(index, next.length), 0, characterId);
      await teams.setTeamCharacters(activeTeam.slot, next);
      return;
    }

    const next = [...current];
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

  /**
   * One position in the combat queue. Index 0 is the Vanguard — the unit that actually fights
   * until it falls — so it renders larger and highlighted, while 1..4 are the bench waiting to
   * relay in. Both are the same drop target, so a bench member can be dragged onto the Vanguard
   * slot to take the lead.
   */
  function renderSlot(index: number) {
    const isVanguard = index === 0;
    const c = activeTeamRoster[index];
    const portraitSize = isVanguard ? 80 : 56;

    if (!c) {
      return (
        <button
          key={`empty-${index}`}
          onClick={() => setPickingSlotIndex((prev) => (prev === index ? null : index))}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDropOnSlot(index, e)}
          className={`flex items-center justify-center rounded-xl border border-dashed transition ${
            isVanguard ? 'h-20 w-20' : 'h-14 w-14'
          } ${
            pickingSlotIndex === index
              ? 'animate-pulse border-code-400 bg-code-500/10 text-code-300'
              : isVanguard
                ? 'border-signal-amber/40 text-signal-amber/40 hover:border-signal-amber/70 hover:text-signal-amber/70'
                : 'border-void-600 text-white/20 hover:border-void-500 hover:text-white/40'
          }`}
        >
          <Icon name="plus" size={isVanguard ? 22 : 16} />
        </button>
      );
    }

    return (
      <div
        key={c.templateId}
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', c.templateId)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDropOnSlot(index, e)}
        className={`group relative flex cursor-grab flex-col items-center gap-1 active:cursor-grabbing ${isVanguard ? 'w-20' : 'w-14'}`}
      >
        <button
          onClick={() => setDetailCharacter(c)}
          className={`relative rounded-xl ${isVanguard ? 'ring-2 ring-signal-amber/60' : ''}`}
        >
          <CharacterPortrait name={c.name} faction={c.faction} rarity={c.rarity} portraitUrl={c.portraitUrl} size={portraitSize} />
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
          <div className="h-full rounded-full bg-arcane-400" style={{ width: `${Math.round((c.xpIntoLevel / c.xpForNextLevel) * 100)}%` }} />
        </div>
      </div>
    );
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

          {/* Active team's members — slot 0 is the Vanguard, 1..4 the bench (see renderSlot). */}
          <div className="flex flex-col gap-3 rounded-xl border border-void-600 bg-void-800/40 p-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <span className="flex items-center gap-1 font-display text-[9px] font-bold uppercase tracking-widest text-signal-amber">
                <Icon name="swords" size={10} />
                Vanguarda
              </span>
              {renderSlot(0)}
            </div>

            <div className="h-px w-full bg-void-600 sm:h-24 sm:w-px" />

            <div className="flex flex-col gap-1.5">
              <span className="font-display text-[9px] font-bold uppercase tracking-widest text-white/40">Banco</span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: MAX_TEAM_MEMBERS - 1 }, (_, i) => renderSlot(i + 1))}
              </div>
            </div>
          </div>
          {pickingSlotIndex !== null && (
            <p className="-mt-2 flex items-center gap-1.5 text-[11px] text-code-300">
              <Icon name="sparkles" size={12} />
              Escolha um personagem na lista à direita para preencher {pickingSlotIndex === 0 ? 'a Vanguarda' : 'o slot'}.
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
              onClick={() => setLeaderboardOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-arcane-400/30 bg-arcane-900/30 px-3 py-2 font-display text-[11px] font-bold uppercase tracking-wide text-arcane-300 transition hover:border-arcane-400/60"
            >
              <Icon name="trophy" size={13} />
              Ranking
            </button>
          </div>

          {/* Formation editor — only meaningful for the .cfg currently marked PvP, since
              row (front/back) is what src/engine/turn/formation.ts reads for the turn-based PvP
              battle a random encounter (docs/gdd.md §6) drops the player into. */}
          {activeSlot === pvpTeamSlot && activeTeamRoster.length > 0 && (
            <div className="rounded-xl border border-signal-red/25 bg-void-800/40 p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Icon name="crosshair" size={12} className="text-signal-red" />
                <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white/50">Formação (PvP)</h2>
              </div>
              <p className="mb-3 text-[11px] text-white/40">
                A frente é o único alvo de ataques enquanto tiver alguém vivo — o fundo só é atingido quando a frente cai.
              </p>
              <div className="flex flex-wrap gap-2">
                {activeTeamRoster.map((c) => {
                  const row = pvpFormation[c.templateId] ?? 'front';
                  return (
                    <button
                      key={c.templateId}
                      onClick={() => toggleFormationRow(c.templateId)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                        row === 'front'
                          ? 'border-signal-amber/50 bg-signal-amber/10 text-signal-amber'
                          : 'border-void-600 bg-void-800/60 text-white/50 hover:border-white/30'
                      }`}
                    >
                      {c.name}
                      <span className="font-display text-[9px] uppercase tracking-wide">{row === 'front' ? 'Frente' : 'Fundo'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
              <p className="text-xs text-white/40">Adicione personagens ao time para ver a ordem de fila.</p>
            ) : (
              <>
                <p className="mb-3 text-[11px] text-white/40">
                  Personagens do mesmo mundo/mitologia ganham bônus por time — atualmente:{' '}
                  {Array.from(new Set(activeTeamRoster.map((c) => c.mythology))).join(' · ')}
                </p>
                <p className="text-[11px] text-white/40">
                  A ordem dos slots é a fila de combate: quem está na <span className="text-signal-amber">Vanguarda</span> luta
                  até cair, e o banco entra na sequência em que está. Arraste um personagem para a Vanguarda para trocar quem
                  começa.
                </p>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: the same roster grid Upgrades uses */}
        <CharacterSelectorPanel
          ownedCharacters={ownedCharacters}
          onSelect={handleSelectorCardClick}
          isSelected={(id) => activeTeam.characterIds.includes(id)}
          highlight={pickingSlotIndex !== null}
          draggable
        />
      </div>

      {leaderboardOpen && <PvpLeaderboardModal pvp={pvp} userId={userId} onClose={() => setLeaderboardOpen(false)} />}
      {detailCharacter && (
        <CharacterDetailModal
          character={detailCharacter}
          owned
          ownedRarity={ownedById.get(detailCharacter.templateId)?.rarity ?? null}
          version={characterProgression.progression[detailCharacter.templateId]?.version}
          selectedAbilityId={characterProgression.progression[detailCharacter.templateId]?.selectedAbilityId}
          onSelectAbility={(abilityId) => characterProgression.setSelectedAbility(detailCharacter.templateId, abilityId)}
          onClose={() => setDetailCharacter(null)}
        />
      )}
    </div>
  );
}
