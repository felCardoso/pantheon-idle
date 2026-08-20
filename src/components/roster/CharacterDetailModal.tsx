import { Modal } from '../common/Modal';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from './CharacterPortrait';
import { RosterChips } from './RosterChips';
import { PASSIVE_UNLOCK_RARITY } from '../../data/abilityProgression';
import { PASSIVE_UNLOCK_VERSION, VERSION_MIN, formatVersion } from '../../data/characterVersion';
import { RARITY_RANK, type RosterCharacter } from '../../data/roster';
import type { Rarity } from '../../types';

interface CharacterDetailModalProps {
  character: RosterCharacter;
  owned: boolean;
  /** The card's current best owned rarity, or null if not owned at all — one of the passive's two unlock paths (see `version` below). Actual ability/passive leveling happens in the Upgrades page, not here. */
  ownedRarity: Rarity | null;
  /** The card's current version (tenths — see characterVersion.ts), the passive's second unlock
   * path. Omitted where the caller has no progression to read (e.g. GachaPage browsing the
   * banner character) — the passive then shows locked unless rarity alone clears it, same as
   * before this prop existed. */
  version?: number;
  /** The player's equipped active ability id, if they've chosen one — undefined/not matching an activeOptions id falls back to activeOptions[0] (same default the engine itself applies, see loader.ts's resolveCombatantAbilities). */
  selectedAbilityId?: string | null;
  /** Persists a new equipped active ability. Omit to render the active-ability list read-only (e.g. browsing an unowned character) — no picker buttons, just the option's info. */
  onSelectAbility?: (abilityId: string) => void;
  onClose: () => void;
}

const MAX_STARS = 5;

export function CharacterDetailModal({ character, owned, ownedRarity, version, selectedAbilityId, onSelectAbility, onClose }: CharacterDetailModalProps) {
  // Two independent unlock paths (docs/combate.md §3): a Zero-Day copy, or reaching v2.0 at any
  // rarity. Mirrors passiveMaxLevel's gate (abilityProgression.ts) without the level-count part,
  // which this read-only card doesn't need.
  const byRarity = !!ownedRarity && RARITY_RANK[ownedRarity] >= RARITY_RANK[PASSIVE_UNLOCK_RARITY];
  const byVersion = (version ?? VERSION_MIN) >= PASSIVE_UNLOCK_VERSION;
  const passiveUnlocked = byRarity || byVersion;
  const equippedId = character.activeOptions.some((a) => a.id === selectedAbilityId) ? selectedAbilityId : character.activeOptions[0]?.id;

  return (
    <Modal title={character.name} icon="id-card" onClose={onClose}>
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <CharacterPortrait
            name={character.name}
            faction={character.faction}
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
            <RosterChips faction={character.faction} rarity={character.rarity} />
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

        <div>
          <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Estatísticas</h4>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(
              [
                { icon: 'heart', label: 'HP', value: Math.round(character.stats.hp) },
                { icon: 'swords', label: 'ATK', value: Math.round(character.stats.atk) },
                { icon: 'shield', label: 'DEF', value: `${Math.round(character.stats.def * 100)}%` },
                { icon: 'zap', label: 'VEL', value: `${Math.round(character.stats.vel * 100)}%` },
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

        {character.activeOptions.length > 0 && (
          <div>
            <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">
              Habilidade ativa {onSelectAbility && character.activeOptions.length > 1 && <span className="font-normal normal-case text-white/30">— toque para equipar</span>}
            </h4>
            <div className="flex flex-col gap-2">
              {character.activeOptions.map((a) => {
                const equipped = a.id === equippedId;
                const Wrapper = onSelectAbility ? 'button' : 'div';
                return (
                  <Wrapper
                    key={a.id}
                    {...(onSelectAbility ? { onClick: () => onSelectAbility(a.id), type: 'button' as const } : {})}
                    className={`relative rounded-lg border p-3 text-left transition ${
                      equipped ? 'border-code-400 bg-code-500/10' : 'border-void-600 bg-void-900/60 hover:border-void-500'
                    }`}
                  >
                    {equipped && (
                      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-code-400/40 bg-code-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-code-300">
                        <Icon name="check-circle" size={10} />
                        Equipada
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-arcane-300">
                      <Icon name="sparkles" size={12} />
                      {a.name ?? a.kind}
                      {a.name && <span className="font-normal text-white/40">· {a.kind}</span>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-white/70">{a.description}</p>
                  </Wrapper>
                );
              })}
            </div>
          </div>
        )}

        {(character.passive || character.innateTrait) && (
          <div>
            <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Passiva</h4>
            {(() => {
              const p = character.passive ?? { name: character.innateTrait!.name, kind: 'Passiva' as const, description: character.innateTrait!.description };
              const locked = !!character.passive && !passiveUnlocked;
              return (
                <div
                  title={locked ? `Zero-Day, ou ${formatVersion(PASSIVE_UNLOCK_VERSION)} em qualquer raridade` : undefined}
                  className={`relative rounded-lg border border-void-600 bg-void-900/60 p-3 ${locked ? 'opacity-50' : ''}`}
                >
                  {locked && (
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-void-500 bg-void-950/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/60">
                      <Icon name="lock" size={10} />
                      Zero-Day ou {formatVersion(PASSIVE_UNLOCK_VERSION)}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-arcane-300">
                    <Icon name="sparkles" size={12} />
                    {p.name ?? p.kind}
                    {p.name && <span className="font-normal text-white/40">· {p.kind}</span>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/70">{p.description}</p>
                </div>
              );
            })()}
          </div>
        )}

        {character.lore && <p className="text-xs italic leading-relaxed text-white/50">{character.lore}</p>}

        {owned && (
          <p className="text-[11px] text-white/30">
            Melhore o nível de habilidade e passiva deste personagem na aba <span className="text-white/50">Upgrades</span>.
          </p>
        )}
      </div>
    </Modal>
  );
}
