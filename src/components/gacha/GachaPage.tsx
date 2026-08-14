import { useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { RosterChips } from '../roster/RosterChips';
import { buildCompendium, pullGachaCharacter } from '../../data/roster';
import { Rng } from '../../engine/core/rng';

// First-pass number, easy to retune later.
const GACHA_PACK_PRICE = 1500;

interface GachaPageProps {
  credits: number;
  onAcquireCharacter: (characterId: string) => Promise<'new' | 'duplicate'>;
  onAdjustCredits: (delta: number) => void;
}

interface PullReveal {
  characterId: string;
  outcome: 'new' | 'duplicate';
}

export function GachaPage({ credits, onAcquireCharacter, onAdjustCredits }: GachaPageProps) {
  const [pulling, setPulling] = useState(false);
  const [reveal, setReveal] = useState<PullReveal | null>(null);

  const compendium = buildCompendium();
  const byId = new Map(compendium.map((c) => [c.templateId, c]));

  async function handlePullGacha() {
    if (pulling || credits < GACHA_PACK_PRICE) return;
    setPulling(true);
    onAdjustCredits(-GACHA_PACK_PRICE);
    const characterId = pullGachaCharacter(new Rng(Date.now() >>> 0));
    const outcome = await onAcquireCharacter(characterId);
    setReveal({ characterId, outcome });
    setPulling(false);
  }

  const revealInfo = reveal ? byId.get(reveal.characterId) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Invocações</h1>
        <p className="text-xs text-white/50">Cápsulas de invocação de personagens (`.zip`)</p>
      </div>

      <section>
        <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Pacote de invocação</h2>
        <div className="flex flex-col items-start gap-3 rounded-xl border border-arcane-400/25 bg-void-800/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-arcane-400/30 bg-arcane-400/10">
              <Icon name="package" size={22} className="text-arcane-300" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-white">1 personagem aleatório</p>
              <p className="text-xs text-white/50">Duplicado vira +1 diagrama, que pode ser vendido.</p>
            </div>
          </div>
          <button
            onClick={handlePullGacha}
            disabled={pulling || credits < GACHA_PACK_PRICE}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-code-500 px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400 disabled:opacity-50"
          >
            {pulling && <Icon name="loader" size={13} className="animate-spin" />}
            <Icon name="coins" size={13} />
            {GACHA_PACK_PRICE}
          </button>
        </div>

        {revealInfo && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-code-500/30 bg-code-900/20 p-4">
            <CharacterPortrait
              name={revealInfo.name}
              element={revealInfo.element}
              rarity={revealInfo.rarity}
              portraitUrl={revealInfo.portraitUrl}
              size={56}
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-white">
                {reveal!.outcome === 'new' ? 'Novo personagem desbloqueado!' : 'Personagem repetido'}
              </p>
              <div className="flex items-center gap-2">
                <span className="truncate text-xs text-white/70">{revealInfo.name}</span>
                <RosterChips faction={revealInfo.faction} element={revealInfo.element} rarity={revealInfo.rarity} />
              </div>
              {reveal!.outcome === 'duplicate' && <p className="mt-1 text-[11px] text-white/50">Convertido em +1 diagrama.</p>}
            </div>
            <button onClick={() => setReveal(null)} className="shrink-0 rounded-lg p-1.5 text-white/40 transition hover:text-white/70">
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
