import { Modal } from '../common/Modal';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from './CharacterPortrait';
import { RosterChips } from './RosterChips';
import {
  ABILITY_MAX_LEVEL_BY_RARITY,
  ABILITY_UPGRADE_COST_CREDITS,
  PASSIVE_MAX_LEVEL_BY_RARITY,
  PASSIVE_UNLOCK_RARITY,
  PASSIVE_UPGRADE_COST_CREDITS,
} from '../../data/abilityProgression';
import { RARITY_RANK, type RosterCharacter } from '../../data/roster';
import type { Rarity } from '../../types';

interface CharacterDetailModalProps {
  character: RosterCharacter;
  owned: boolean;
  /** The card's current best owned rarity, or null if not owned at all — gates both upgrade tracks below. */
  ownedRarity: Rarity | null;
  abilityLevel: number;
  passiveLevel: number;
  credits: number;
  onUpgradeAbility: () => void;
  onUpgradePassive: () => void;
  onClose: () => void;
}

const MAX_STARS = 5;

export function CharacterDetailModal({
  character,
  owned,
  ownedRarity,
  abilityLevel,
  passiveLevel,
  credits,
  onUpgradeAbility,
  onUpgradePassive,
  onClose,
}: CharacterDetailModalProps) {
  const abilityMax = ownedRarity ? ABILITY_MAX_LEVEL_BY_RARITY[ownedRarity] : 0;
  const passiveMax = ownedRarity ? PASSIVE_MAX_LEVEL_BY_RARITY[ownedRarity] : 0;
  const passiveUnlocked = !!ownedRarity && RARITY_RANK[ownedRarity] >= RARITY_RANK[PASSIVE_UNLOCK_RARITY];

  const nextAbilityCost = ABILITY_UPGRADE_COST_CREDITS[abilityLevel + 1];
  const canUpgradeAbility = owned && abilityLevel < abilityMax && nextAbilityCost !== undefined && credits >= nextAbilityCost;

  const nextPassiveCost = PASSIVE_UPGRADE_COST_CREDITS[passiveLevel + 1] ?? 0;
  const canUpgradePassive = owned && passiveUnlocked && passiveLevel < passiveMax && credits >= nextPassiveCost;

  return (
    <Modal title={character.name} icon="id-card" onClose={onClose}>
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <CharacterPortrait
            name={character.name}
            element={character.element}
            rarity={character.rarity}
            portraitUrl={character.portraitUrl}
            size={88}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-base font-bold text-white">{character.name}</h3>
              {owned ? (
                <span className="flex items-center gap-1 rounded-full border border-code-500/30 bg-code-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-code-300">
                  <Icon name="check-circle" size={10} />
                  Possuído
                </span>
              ) : (
                <span className="rounded-full border border-void-600 bg-void-900/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                  Não possuído
                </span>
              )}
            </div>
            <p className="text-xs text-white/50">
              {character.mythology} · Nível {character.level}
            </p>
            <RosterChips faction={character.faction} element={character.element} rarity={character.rarity} />
            <div className="flex items-center gap-0.5" title={`${character.stars}/${MAX_STARS} estrelas`}>
              {Array.from({ length: MAX_STARS }).map((_, i) => (
                <Icon
                  key={i}
                  name="star"
                  size={13}
                  className={i < character.stars ? 'text-signal-amber' : 'text-white/20'}
                />
              ))}
            </div>
          </div>
        </div>

        {owned && (
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
                onClick={onUpgradeAbility}
                disabled={!canUpgradeAbility}
                className="flex items-center gap-1.5 rounded-lg border border-code-500/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-code-300 transition hover:bg-code-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="coins" size={12} />
                Melhorar · {nextAbilityCost}
              </button>
            )}
          </div>
        )}

        <div>
          <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Estatísticas</h4>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(
              [
                { icon: 'heart', label: 'HP', value: Math.round(character.stats.hp) },
                { icon: 'swords', label: 'ATK', value: Math.round(character.stats.atk) },
                { icon: 'shield', label: 'DEF', value: `${Math.round(character.stats.def * 100)}%` },
                { icon: 'zap', label: 'INI', value: `${Math.round(character.stats.ini * 100)}%` },
                { icon: 'wind', label: 'ESQ', value: `${Math.round(character.stats.esq * 100)}%` },
                { icon: 'shield-off', label: 'ICE', value: `${Math.round(character.stats.ice * 100)}%` },
              ] as const
            ).map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 rounded-lg border border-void-600 bg-void-900/60 py-2">
                <Icon name={stat.icon} size={13} className="text-white/50" />
                <span className="font-mono text-xs font-bold text-white">{stat.value}</span>
                <span className="text-[9px] uppercase tracking-wide text-white/40">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Habilidades</h4>
          <div className="flex flex-col gap-2">
            {character.abilities.map((a, i) => {
              const isPassive = a.kind === 'Passiva';
              const locked = isPassive && !passiveUnlocked;
              return (
                <div
                  key={i}
                  title={locked ? 'Somente LTS+' : undefined}
                  className={`relative rounded-lg border border-void-600 bg-void-900/60 p-3 ${locked ? 'opacity-50' : ''}`}
                >
                  {locked && (
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-void-500 bg-void-950/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/60">
                      <Icon name="lock" size={10} />
                      Somente LTS+
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-arcane-300">
                    <Icon name="sparkles" size={12} />
                    {a.name ?? a.kind}
                    {a.name && <span className="font-normal text-white/40">· {a.kind}</span>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/70">{a.description}</p>
                  {isPassive && !locked && owned && (
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-void-700 pt-2">
                      <span className="font-mono text-[11px] text-white/60">
                        Passiva {passiveLevel}/{passiveMax}
                      </span>
                      {passiveLevel < passiveMax && (
                        <button
                          onClick={onUpgradePassive}
                          disabled={!canUpgradePassive}
                          className="flex items-center gap-1 rounded-lg border border-arcane-400/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-arcane-300 transition hover:bg-arcane-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Icon name="coins" size={11} />
                          Melhorar · {nextPassiveCost}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {character.lore && <p className="text-xs italic leading-relaxed text-white/50">{character.lore}</p>}
      </div>
    </Modal>
  );
}
