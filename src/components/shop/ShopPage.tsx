import { useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { RosterChips } from '../roster/RosterChips';
import { buildCompendium, pullGachaCharacter } from '../../data/roster';
import { Rng } from '../../engine/core/rng';

// First-pass numbers, easy to retune later.
const GACHA_PACK_PRICE = 1500;
const FRAGMENT_SELL_PRICE = 500;
const STARTER_BOOST_CREDITS = 1000;

interface ShopPageProps {
  credits: number;
  starterBoostClaimed: boolean;
  fragments: Record<string, number>;
  onClaimStarterBoost: () => void;
  onAcquireCharacter: (characterId: string) => Promise<'new' | 'duplicate'>;
  onSellFragment: (characterId: string) => void;
  onAdjustCredits: (delta: number) => void;
  onToast: (message: string) => void;
}

interface PullReveal {
  characterId: string;
  outcome: 'new' | 'duplicate';
}

export function ShopPage({
  credits,
  starterBoostClaimed,
  fragments,
  onClaimStarterBoost,
  onAcquireCharacter,
  onSellFragment,
  onAdjustCredits,
  onToast,
}: ShopPageProps) {
  const [pulling, setPulling] = useState(false);
  const [reveal, setReveal] = useState<PullReveal | null>(null);

  const compendium = buildCompendium();
  const byId = new Map(compendium.map((c) => [c.templateId, c]));
  const fragmentEntries = Object.entries(fragments).filter(([, count]) => count > 0);

  function handleClaimStarterBoost() {
    if (starterBoostClaimed) return;
    onClaimStarterBoost();
    onAdjustCredits(STARTER_BOOST_CREDITS);
    onToast(`+${STARTER_BOOST_CREDITS} créditos resgatados!`);
  }

  async function handlePullGacha() {
    if (pulling || credits < GACHA_PACK_PRICE) return;
    setPulling(true);
    onAdjustCredits(-GACHA_PACK_PRICE);
    const characterId = pullGachaCharacter(new Rng(Date.now() >>> 0));
    const outcome = await onAcquireCharacter(characterId);
    setReveal({ characterId, outcome });
    setPulling(false);
  }

  function handleSellFragment(characterId: string) {
    onSellFragment(characterId);
    onAdjustCredits(FRAGMENT_SELL_PRICE);
    onToast(`+${FRAGMENT_SELL_PRICE} créditos pela venda do diagrama.`);
  }

  const revealInfo = reveal ? byId.get(reveal.characterId) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Loja</h1>
        <p className="text-xs text-white/50">Pacotes de invocação, bônus e diagramas</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Starter boost */}
        <section>
          <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Bônus de boas-vindas</h2>
          <div className="flex flex-col items-start gap-3 rounded-xl border border-signal-amber/25 bg-void-800/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-signal-amber/30 bg-signal-amber/10">
                <Icon name="gift" size={22} className="text-signal-amber" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-white">+{STARTER_BOOST_CREDITS} créditos</p>
                <p className="text-xs text-white/50">Resgate único, disponível uma vez por conta.</p>
              </div>
            </div>
            {starterBoostClaimed ? (
              <span className="flex items-center gap-1.5 rounded-full border border-code-500/30 bg-code-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-code-300">
                <Icon name="check-circle" size={12} />
                Resgatado
              </span>
            ) : (
              <button
                onClick={handleClaimStarterBoost}
                className="shrink-0 rounded-lg bg-signal-amber px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-signal-amber/80"
              >
                Resgatar
              </button>
            )}
          </div>
        </section>

        {/* Gacha pack */}
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
                faction={revealInfo.faction}
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

        {/* Fragments / diagramas */}
        <section>
          <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Diagramas (.dat)</h2>
          {fragmentEntries.length === 0 ? (
            <p className="rounded-xl border border-void-600 bg-void-800/30 p-4 text-xs text-white/40">
              Nenhum diagrama ainda — personagens repetidos de pacotes de invocação aparecem aqui.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {fragmentEntries.map(([characterId, count]) => {
                const info = byId.get(characterId);
                return (
                  <div
                    key={characterId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-void-600 bg-void-800/50 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CharacterPortrait
                        name={info?.name ?? characterId}
                        element={info?.element ?? 'Encryption'}
                        faction={info?.faction ?? 'Firewall'}
                        portraitUrl={info?.portraitUrl}
                        size={40}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{info?.name ?? characterId}</p>
                        <p className="text-xs text-white/50">{count}x diagrama</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSellFragment(characterId)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-void-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/70 transition hover:border-signal-amber/50 hover:text-signal-amber"
                    >
                      <Icon name="coins" size={12} />
                      Vender +{FRAGMENT_SELL_PRICE}
                    </button>
                  </div>
                );
              })}
              <p className="text-[11px] text-white/30">Trocar diagramas com outros jogadores ainda não está disponível — em breve no Mercado.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
