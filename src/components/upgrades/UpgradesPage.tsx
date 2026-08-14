import { useMemo, useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import {
  ABILITY_MAX_LEVEL_BY_RARITY,
  ABILITY_UPGRADE_COST_CREDITS,
  PASSIVE_MAX_LEVEL_BY_RARITY,
  PASSIVE_UNLOCK_RARITY,
  PASSIVE_UPGRADE_COST_CREDITS,
} from '../../data/abilityProgression';
import { buildOwnedRoster, RARITY_RANK } from '../../data/roster';
import { RARITY_COLOR } from '../../data/theme';
import type { OwnedCharacter } from '../../hooks/useOwnedCharacters';
import type { CharacterAbilityProgress } from '../../hooks/useCharacterProgression';

interface UpgradesPageProps {
  ownedCharacters: OwnedCharacter[];
  progression: Record<string, CharacterAbilityProgress>;
  credits: number;
  onUpgradeAbility: (characterId: string) => void;
  onUpgradePassive: (characterId: string) => void;
}

interface ModuleSlotDef {
  key: string;
  label: string;
  icon: string;
  accent: string;
}

const ATTACK_SLOTS: ModuleSlotDef[] = [
  { key: 'attack-1', label: 'Ataque I', icon: 'swords', accent: '#ff4d5e' },
  { key: 'attack-2', label: 'Ataque II', icon: 'swords', accent: '#ff4d5e' },
  { key: 'attack-3', label: 'Ataque III', icon: 'swords', accent: '#ff4d5e' },
];

const DEFENSE_SLOTS: ModuleSlotDef[] = [
  { key: 'defense-1', label: 'Defesa I', icon: 'shield', accent: '#39a0ff' },
  { key: 'defense-2', label: 'Defesa II', icon: 'shield', accent: '#39a0ff' },
  { key: 'defense-3', label: 'Defesa III', icon: 'shield', accent: '#39a0ff' },
];

const SUPPORT_SLOTS: ModuleSlotDef[] = [
  { key: 'support-1', label: 'Suporte I', icon: 'heart', accent: '#39ff9c' },
  { key: 'support-2', label: 'Suporte II', icon: 'heart', accent: '#39ff9c' },
  { key: 'support-3', label: 'Suporte III', icon: 'heart', accent: '#39ff9c' },
];

function ModuleSlotCard({ slot }: { slot: ModuleSlotDef }) {
  return (
    <div
      title="Em breve"
      className="relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-void-600 bg-void-900/40 opacity-60"
    >
      <Icon name={slot.icon} size={18} style={{ color: slot.accent }} />
      <span className="text-center text-[9px] font-bold uppercase tracking-wide text-white/50">{slot.label}</span>
      <span className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full border border-void-500 bg-void-950/90 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/40">
        <Icon name="lock" size={8} />
        Em breve
      </span>
    </div>
  );
}

export function UpgradesPage({ ownedCharacters, progression, credits, onUpgradeAbility, onUpgradePassive }: UpgradesPageProps) {
  const ownedRoster = useMemo(() => buildOwnedRoster(ownedCharacters), [ownedCharacters]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCharacter = ownedRoster.find((c) => c.templateId === selectedId) ?? ownedRoster[0] ?? null;
  const selectedOwned = ownedCharacters.find((c) => c.characterId === selectedCharacter?.templateId);
  const ownedRarity = selectedOwned?.rarity ?? null;

  const abilityLevel = selectedCharacter ? progression[selectedCharacter.templateId]?.abilityLevel ?? 1 : 1;
  const passiveLevel = selectedCharacter ? progression[selectedCharacter.templateId]?.passiveLevel ?? 0 : 0;
  const abilityMax = ownedRarity ? ABILITY_MAX_LEVEL_BY_RARITY[ownedRarity] : 0;
  const passiveMax = ownedRarity ? PASSIVE_MAX_LEVEL_BY_RARITY[ownedRarity] : 0;
  const passiveUnlocked = !!ownedRarity && RARITY_RANK[ownedRarity] >= RARITY_RANK[PASSIVE_UNLOCK_RARITY];

  const nextAbilityCost = ABILITY_UPGRADE_COST_CREDITS[abilityLevel + 1];
  const canUpgradeAbility = abilityLevel < abilityMax && nextAbilityCost !== undefined && credits >= nextAbilityCost;

  const nextPassiveCost = PASSIVE_UPGRADE_COST_CREDITS[passiveLevel + 1] ?? 0;
  const canUpgradePassive = passiveUnlocked && passiveLevel < passiveMax && credits >= nextPassiveCost;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Upgrades</h1>
        <p className="text-xs text-white/50">Progressão de habilidades e módulos (`.dll`) por personagem</p>
      </div>

      {ownedRoster.length === 0 ? (
        <p className="rounded-xl border border-void-600 bg-void-800/30 p-6 text-center text-xs text-white/40">
          Você ainda não possui nenhum personagem — invoque um em Invocações primeiro.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {/* Left: character picker + ability/passive leveling */}
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Habilidades</h2>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {ownedRoster.map((c) => {
                const active = selectedCharacter?.templateId === c.templateId;
                return (
                  <button
                    key={c.templateId}
                    onClick={() => setSelectedId(c.templateId)}
                    className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 transition ${
                      active ? 'border-code-400 bg-code-500/10' : 'border-void-600 bg-void-800/40 hover:border-void-500'
                    }`}
                  >
                    <CharacterPortrait name={c.name} element={c.element} rarity={c.rarity} portraitUrl={c.portraitUrl} size={44} />
                    <span className="max-w-[3.5rem] truncate text-[9px] text-white/60">{c.name}</span>
                  </button>
                );
              })}
            </div>

            {selectedCharacter && (
              <div className="flex flex-col gap-3 rounded-xl border border-void-600 bg-void-800/40 p-4">
                <div className="flex items-center gap-3">
                  <CharacterPortrait
                    name={selectedCharacter.name}
                    element={selectedCharacter.element}
                    rarity={selectedCharacter.rarity}
                    portraitUrl={selectedCharacter.portraitUrl}
                    size={56}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold text-white">{selectedCharacter.name}</p>
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{ borderColor: `${RARITY_COLOR[selectedCharacter.rarity]}66`, color: RARITY_COLOR[selectedCharacter.rarity] }}
                    >
                      {selectedCharacter.rarity}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-void-600 bg-void-900/60 p-3">
                  <div className="flex items-center gap-2">
                    <Icon name="arrow-up-circle" size={16} className="text-code-400" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/40">Nível de Habilidade</p>
                      <p className="font-mono text-sm font-bold text-white">
                        {abilityLevel}/{abilityMax}
                      </p>
                    </div>
                  </div>
                  {abilityLevel < abilityMax && (
                    <button
                      onClick={() => onUpgradeAbility(selectedCharacter.templateId)}
                      disabled={!canUpgradeAbility}
                      className="flex items-center gap-1.5 rounded-lg border border-code-500/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-code-300 transition hover:bg-code-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon name="coins" size={12} />
                      Melhorar · {nextAbilityCost}
                    </button>
                  )}
                </div>

                <div
                  title={passiveUnlocked ? undefined : 'Somente LTS+'}
                  className={`flex items-center justify-between gap-3 rounded-lg border border-void-600 bg-void-900/60 p-3 ${passiveUnlocked ? '' : 'opacity-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name={passiveUnlocked ? 'sparkles' : 'lock'} size={16} className={passiveUnlocked ? 'text-arcane-300' : 'text-white/40'} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/40">Nível de Passiva</p>
                      <p className="font-mono text-sm font-bold text-white">
                        {passiveUnlocked ? `${passiveLevel}/${passiveMax}` : 'Somente LTS+'}
                      </p>
                    </div>
                  </div>
                  {passiveUnlocked && passiveLevel < passiveMax && (
                    <button
                      onClick={() => onUpgradePassive(selectedCharacter.templateId)}
                      disabled={!canUpgradePassive}
                      className="flex items-center gap-1.5 rounded-lg border border-arcane-400/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-arcane-300 transition hover:bg-arcane-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon name="coins" size={12} />
                      Melhorar · {nextPassiveCost}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Right: Módulos placeholder grid */}
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Módulos (`.dll`)</h2>
            <div className="flex flex-col gap-4 rounded-xl border border-void-600 bg-void-800/40 p-4">
              {/* Runa Ultimate — the single primary slot */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-signal-amber/80">Runa Ultimate</p>
                <div
                  title="Em breve"
                  className="relative mx-auto flex aspect-square w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-signal-amber/40 bg-signal-amber/5 opacity-70 sm:w-28"
                >
                  <Icon name="orbit" size={26} className="text-signal-amber" />
                  <span className="text-center text-[9px] font-bold uppercase tracking-wide text-signal-amber/70">Runa Ultimate</span>
                  <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full border border-signal-amber/40 bg-void-950/90 px-1.5 py-0.5 text-[8px] font-bold uppercase text-signal-amber/70">
                    <Icon name="lock" size={8} />
                    Em breve
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-signal-red/80">Ataque</p>
                <div className="grid grid-cols-3 gap-2">
                  {ATTACK_SLOTS.map((slot) => (
                    <ModuleSlotCard key={slot.key} slot={slot} />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-signal-cyan/80">Defesa</p>
                <div className="grid grid-cols-3 gap-2">
                  {DEFENSE_SLOTS.map((slot) => (
                    <ModuleSlotCard key={slot.key} slot={slot} />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-code-300/80">Suporte</p>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPORT_SLOTS.map((slot) => (
                    <ModuleSlotCard key={slot.key} slot={slot} />
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-white/30">Sistema de módulos em desenvolvimento — em breve você poderá equipar runas para customizar cada personagem.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
