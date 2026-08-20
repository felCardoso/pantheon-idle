import { useMemo, useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { CharacterSelectorPanel } from '../roster/CharacterSelectorPanel';
import { ModuleInventory, ModuleSlots } from './ModuleSlots';
import {
  ABILITY_MAX_LEVEL_BY_RARITY,
  ABILITY_UPGRADE_COST_CREDITS,
  PASSIVE_UPGRADE_COST_CREDITS,
  passiveLevelOneIsFree,
  passiveMaxLevel,
} from '../../data/abilityProgression';
import { VERSION_MAX, VERSION_MIN, formatVersion, versionUpgradeCost } from '../../data/characterVersion';
import { activeOptionsFor, benchOptionsFor, passiveAbilityFor } from '../../engine';
import { buildOwnedRoster } from '../../data/roster';
import { RARITY_COLOR } from '../../data/theme';
import type { OwnedCharacter, FragmentStack } from '../../hooks/useOwnedCharacters';
import type { CharacterAbilityProgress } from '../../hooks/useCharacterProgression';
import type { OwnedModule } from '../../hooks/usePlayerModules';

interface UpgradesPageProps {
  ownedCharacters: OwnedCharacter[];
  fragments: FragmentStack[];
  progression: Record<string, CharacterAbilityProgress>;
  credits: number;
  modules: OwnedModule[];
  onUpgradeAbility: (characterId: string) => void;
  onUpgradeBench: (characterId: string) => void;
  onUpgradePassive: (characterId: string) => void;
  onUpgradeVersion: (characterId: string) => void;
  onEquipModule: (moduleRowId: string, characterId: string | null) => void;
}

type Tab = 'abilities' | 'modules';

/** One upgradable ability track, rendered identically for the active, bench and passive kits. */
function AbilityTrack({
  title,
  abilityName,
  level,
  maxLevel,
  cost,
  credits,
  lockedReason,
  onUpgrade,
}: {
  title: string;
  abilityName: string;
  level: number;
  maxLevel: number;
  cost: number | undefined;
  credits: number;
  lockedReason?: string;
  onUpgrade: () => void;
}) {
  const maxed = level >= maxLevel && maxLevel > 0;
  const affordable = cost !== undefined && credits >= cost;
  const canUpgrade = !lockedReason && !maxed && cost !== undefined && affordable;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-void-600 bg-void-900/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-white/40">{title}</p>
          <p className="truncate text-xs text-white/85">{abilityName || '—'}</p>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-code-300">
          {level}/{maxLevel || '—'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < level ? 'bg-code-500' : i < maxLevel ? 'bg-void-600' : 'bg-void-800'}`}
          />
        ))}
      </div>

      {lockedReason ? (
        <p className="flex items-center gap-1 text-[10px] text-white/40">
          <Icon name="lock" size={10} />
          {lockedReason}
        </p>
      ) : maxed ? (
        <p className="text-[10px] uppercase tracking-wide text-code-300">Nível máximo para esta raridade</p>
      ) : (
        <button
          onClick={onUpgrade}
          disabled={!canUpgrade}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-code-500 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400 disabled:cursor-not-allowed disabled:bg-void-700 disabled:text-white/40"
        >
          <Icon name="chevron-up" size={12} />
          {cost === undefined ? 'Indisponível' : cost === 0 ? 'Ativar — grátis' : `${cost.toLocaleString('pt-BR')} C`}
        </button>
      )}
    </div>
  );
}

export function UpgradesPage({
  ownedCharacters,
  fragments,
  progression,
  credits,
  modules,
  onUpgradeAbility,
  onUpgradeBench,
  onUpgradePassive,
  onUpgradeVersion,
  onEquipModule,
}: UpgradesPageProps) {
  const ownedRoster = useMemo(() => buildOwnedRoster(ownedCharacters), [ownedCharacters]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('abilities');

  const selected = ownedRoster.find((c) => c.templateId === selectedId) ?? ownedRoster[0] ?? null;
  const owned = ownedCharacters.find((c) => c.characterId === selected?.templateId);
  const rarity = owned?.rarity ?? null;
  const progress = selected ? progression[selected.templateId] : undefined;

  const abilityLevel = progress?.abilityLevel ?? 1;
  const benchLevel = progress?.benchLevel ?? 1;
  const passiveLevel = progress?.passiveLevel ?? 0;
  const version = progress?.version ?? VERSION_MIN;

  const abilityMax = rarity ? ABILITY_MAX_LEVEL_BY_RARITY[rarity] : 0;
  const passiveMax = rarity ? passiveMaxLevel(rarity, version) : 0;
  // Mirrors the server (app/api/characters/ability): a Zero-Day copy gets level 1 of its passive
  // for nothing, while a character that reached the gate via v2.0 buys it.
  const passiveNextCost =
    passiveLevel === 0 && rarity && passiveLevelOneIsFree(rarity) ? 0 : PASSIVE_UPGRADE_COST_CREDITS[passiveLevel + 1];

  // Fragments pool across rarities: version is a per-character axis, so every copy's fragments
  // count toward the same track.
  const fragmentTotal = selected ? fragments.filter((f) => f.characterId === selected.templateId).reduce((sum, f) => sum + f.count, 0) : 0;
  const nextVersionCost = version < VERSION_MAX ? versionUpgradeCost(version + 1) : null;

  const activeName = selected ? (activeOptionsFor(selected.templateId)[0]?.name ?? '') : '';
  const benchName = selected ? (benchOptionsFor(selected.templateId)[0]?.name ?? '') : '';
  const passiveName = selected ? (passiveAbilityFor(selected.templateId)?.name ?? '') : '';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Upgrades</h1>
        <p className="text-xs text-white/50">Melhorias de habilidade, versão e módulos (`.dll`) por personagem</p>
      </div>

      {ownedRoster.length === 0 ? (
        <p className="rounded-xl border border-void-600 bg-void-800/30 p-6 text-center text-xs text-white/40">
          Você ainda não possui nenhum personagem — invoque um em Invocações primeiro.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          {/* LEFT: tabs + the selected character's upgrades */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'abilities' as const, label: 'Melhorias de personagem', icon: 'chevron-up' },
                  { id: 'modules' as const, label: 'Módulos', icon: 'sparkles' },
                ]
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 font-display text-xs font-bold uppercase tracking-wide transition ${
                    tab === t.id ? 'border-code-400/60 bg-code-500/10 text-code-300' : 'border-void-600 text-white/50 hover:text-white/80'
                  }`}
                >
                  <Icon name={t.icon} size={13} />
                  {t.label}
                </button>
              ))}
            </div>

            {selected && (
              <div className="flex flex-col gap-3 rounded-xl border border-void-600 bg-void-800/40 p-4">
                <div className="flex items-center gap-3">
                  <CharacterPortrait
                    name={selected.name}
                    faction={selected.faction}
                    rarity={selected.rarity}
                    portraitUrl={selected.portraitUrl}
                    size={56}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold text-white">{selected.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{ borderColor: `${RARITY_COLOR[selected.rarity]}66`, color: RARITY_COLOR[selected.rarity] }}
                      >
                        {selected.rarity}
                      </span>
                      <span className="rounded-full border border-arcane-400/40 bg-arcane-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-arcane-300">
                        {formatVersion(version)}
                      </span>
                    </div>
                  </div>
                </div>

                {tab === 'abilities' ? (
                  <>
                    {/* Version — the axis that unlocks the passive, so it sits above the tracks it gates. */}
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-arcane-400/25 bg-void-900/50 p-3">
                      <div className="min-w-0">
                        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Versão</p>
                        <p className="text-xs text-white/85">
                          {formatVersion(version)}
                          {version < VERSION_MAX && ` → ${formatVersion(version + 1)}`}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-white/50">
                          {fragmentTotal} fragmento{fragmentTotal === 1 ? '' : 's'}
                          {nextVersionCost !== null && ` / ${nextVersionCost}`}
                        </p>
                      </div>
                      {version >= VERSION_MAX ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-arcane-300">Versão máxima</span>
                      ) : (
                        <button
                          onClick={() => selected && onUpgradeVersion(selected.templateId)}
                          disabled={nextVersionCost === null || fragmentTotal < nextVersionCost}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-arcane-500 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-void-950 transition hover:bg-arcane-400 disabled:cursor-not-allowed disabled:bg-void-700 disabled:text-white/40"
                        >
                          <Icon name="chevron-up" size={12} />
                          Evoluir
                        </button>
                      )}
                    </div>

                    <AbilityTrack
                      title="Habilidade ativa"
                      abilityName={activeName}
                      level={abilityLevel}
                      maxLevel={abilityMax}
                      cost={ABILITY_UPGRADE_COST_CREDITS[abilityLevel + 1]}
                      credits={credits}
                      onUpgrade={() => selected && onUpgradeAbility(selected.templateId)}
                    />
                    <AbilityTrack
                      title="Habilidade de banco"
                      abilityName={benchName}
                      level={benchLevel}
                      maxLevel={abilityMax}
                      cost={ABILITY_UPGRADE_COST_CREDITS[benchLevel + 1]}
                      credits={credits}
                      lockedReason={benchName ? undefined : 'Este personagem ainda não tem habilidade de banco autorada.'}
                      onUpgrade={() => selected && onUpgradeBench(selected.templateId)}
                    />
                    <AbilityTrack
                      title="Passiva"
                      abilityName={passiveName}
                      level={passiveLevel}
                      maxLevel={passiveMax}
                      cost={passiveNextCost}
                      credits={credits}
                      lockedReason={passiveMax === 0 ? `Destrava na ${formatVersion(VERSION_MAX)} ou com uma cópia Zero-Day.` : undefined}
                      onUpgrade={() => selected && onUpgradePassive(selected.templateId)}
                    />
                  </>
                ) : (
                  <>
                    <ModuleSlots characterId={selected.templateId} modules={modules} onEquip={onEquipModule} />
                    <div className="mt-1 border-t border-void-700 pt-3">
                      <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Guardados</p>
                      <ModuleInventory modules={modules} characterId={selected.templateId} onEquip={onEquipModule} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: the same roster grid the Team page uses */}
          <CharacterSelectorPanel
            ownedCharacters={ownedCharacters}
            onSelect={setSelectedId}
            isSelected={(id) => id === selected?.templateId}
          />
        </div>
      )}
    </div>
  );
}
