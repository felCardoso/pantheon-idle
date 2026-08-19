import { Icon } from '../common/Icon';
import { AvatarCrop } from './AvatarCrop';
import { buildCompendium } from '../../data/roster';
import { DISPLAY_PORTRAIT_BY_TEMPLATE_ID } from '../../data/engineDisplay';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface AvatarPickerModalProps {
  ownedCharacterIds: string[];
  currentAvatarCharacterId: string | null;
  onSelect: (characterId: string) => void;
  onClose: () => void;
}

export function AvatarPickerModal({ ownedCharacterIds, currentAvatarCharacterId, onSelect, onClose }: AvatarPickerModalProps) {
  useEscapeToClose(onClose);
  const ownedSet = new Set(ownedCharacterIds);
  const options = buildCompendium().filter((c) => ownedSet.has(c.templateId) && DISPLAY_PORTRAIT_BY_TEMPLATE_ID[c.templateId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative w-full max-w-sm rounded-2xl border border-code-500/25 bg-void-900 p-4 shadow-[0_0_60px_-10px_rgba(57,255,156,0.25)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xs font-bold uppercase tracking-wide text-white text-glow-code">Escolher avatar</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-white/50 transition hover:bg-void-700 hover:text-white">
            <Icon name="x" size={16} />
          </button>
        </div>

        {options.length === 0 ? (
          <p className="rounded-lg border border-void-600 bg-void-800/40 p-4 text-center text-xs text-white/40">
            Nenhum personagem possuído tem arte própria ainda — avatares ficam disponíveis conforme novas artes chegam.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {options.map((c) => {
              const portraitUrl = DISPLAY_PORTRAIT_BY_TEMPLATE_ID[c.templateId]!;
              const selected = c.templateId === currentAvatarCharacterId;
              return (
                <button
                  key={c.templateId}
                  onClick={() => onSelect(c.templateId)}
                  title={c.name}
                  className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition ${
                    selected ? 'bg-code-500/15 ring-2 ring-code-400' : 'hover:bg-void-800/60'
                  }`}
                >
                  <AvatarCrop templateId={c.templateId} portraitUrl={portraitUrl} alt={c.name} size={56} />
                  <span className="w-full truncate text-center text-[10px] text-white/60">{c.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
