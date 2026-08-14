import { Modal } from '../common/Modal';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from './CharacterPortrait';
import { RosterChips } from './RosterChips';
import type { RosterCharacter } from '../../data/roster';

interface CharacterDetailModalProps {
  character: RosterCharacter;
  owned: boolean;
  onClose: () => void;
}

const MAX_STARS = 5;

export function CharacterDetailModal({ character, owned, onClose }: CharacterDetailModalProps) {
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

        <div>
          <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Habilidades</h4>
          <div className="flex flex-col gap-2">
            {character.abilities.map((a, i) => (
              <div key={i} className="rounded-lg border border-void-600 bg-void-900/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-arcane-300">
                  <Icon name="sparkles" size={12} />
                  {a.name ?? a.kind}
                  {a.name && <span className="font-normal text-white/40">· {a.kind}</span>}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/70">{a.description}</p>
              </div>
            ))}
          </div>
        </div>

        {character.lore && <p className="text-xs italic leading-relaxed text-white/50">{character.lore}</p>}
      </div>
    </Modal>
  );
}
