import { useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { buildCompendium, diagramName } from '../../data/roster';
import type { UseMarketResult } from '../../hooks/useMarket';

interface MarketPageProps {
  market: UseMarketResult;
  fragments: Record<string, number>;
  vipActive: boolean;
  credits: number;
  onAdjustCredits: (delta: number) => void;
  onRefreshFragments: () => Promise<void>;
  onToast: (message: string) => void;
}

const MIN_PRICE_CREDITS = 50;

export function MarketPage({ market, fragments, vipActive, credits, onAdjustCredits, onRefreshFragments, onToast }: MarketPageProps) {
  const compendium = buildCompendium();
  const byId = new Map(compendium.map((c) => [c.templateId, c]));

  const fragmentEntries = Object.entries(fragments).filter(([, count]) => count > 0);
  const [publishCharacterId, setPublishCharacterId] = useState(fragmentEntries[0]?.[0] ?? '');
  const [publishQuantity, setPublishQuantity] = useState(1);
  const [publishPrice, setPublishPrice] = useState(MIN_PRICE_CREDITS);
  const [publishing, setPublishing] = useState(false);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [busyListingId, setBusyListingId] = useState<string | null>(null);

  const maxFragmentsForPublish = fragments[publishCharacterId] ?? 0;

  async function handlePublish() {
    if (publishing || !publishCharacterId || publishQuantity < 1 || publishQuantity > maxFragmentsForPublish || publishPrice < MIN_PRICE_CREDITS) return;
    setPublishing(true);
    const ok = await market.publishListing(publishCharacterId, publishQuantity, publishPrice);
    setPublishing(false);
    if (ok) {
      await onRefreshFragments();
      setPublishQuantity(1);
      onToast('Oferta publicada.');
    } else {
      onToast('Não foi possível publicar a oferta.');
    }
  }

  async function handleCancel(listingId: string) {
    setBusyListingId(listingId);
    const ok = await market.cancelListing(listingId);
    setBusyListingId(null);
    if (ok) {
      await onRefreshFragments();
      onToast('Oferta cancelada — diagramas devolvidos.');
    } else {
      onToast('Não foi possível cancelar a oferta.');
    }
  }

  async function handlePurchase(listingId: string, unitPrice: number, quantity: number) {
    const total = unitPrice * quantity;
    if (!vipActive || credits < total) return;
    setBusyListingId(listingId);
    const ok = await market.purchaseListing(listingId, quantity);
    setBusyListingId(null);
    if (ok) {
      // The RPC already moved credits server-side — mirror the deduction into the client's
      // running total too, so the next unrelated saveProgress doesn't overwrite it with a stale value.
      onAdjustCredits(-total);
      await onRefreshFragments();
      onToast(`Comprado! -${total} créditos.`);
    } else {
      onToast('Não foi possível comprar — estoque ou créditos insuficientes.');
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Mercado de Diagramas</h1>
        <p className="text-xs text-white/50">Assinantes de Root Access negociam `.dat` (diagramas de personagens duplicados) entre si</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Suas ofertas */}
        <section>
          <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Suas ofertas</h2>

          {!vipActive ? (
            <div className="rounded-xl border border-signal-cyan/25 bg-void-800/50 p-4 text-xs text-white/50">
              <div className="mb-1 flex items-center gap-2 text-signal-cyan">
                <Icon name="gem" size={14} />
                <span className="font-display text-xs font-bold uppercase tracking-wide">Requer Root Access</span>
              </div>
              Assine Root Access na Loja para publicar e comprar diagramas de outros jogadores.
            </div>
          ) : (
            <div className="rounded-xl border border-void-600 bg-void-800/40 p-4">
              {fragmentEntries.length === 0 ? (
                <p className="text-xs text-white/40">Você não tem diagramas para vender ainda.</p>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-white/40">Personagem</span>
                    <select
                      value={publishCharacterId}
                      onChange={(e) => {
                        setPublishCharacterId(e.target.value);
                        setPublishQuantity(1);
                      }}
                      className="rounded-lg border border-void-600 bg-void-900 px-2 py-1.5 text-xs text-white/80 focus:outline-none"
                    >
                      {fragmentEntries.map(([characterId, count]) => (
                        <option key={characterId} value={characterId}>
                          {diagramName(byId.get(characterId)?.name ?? characterId)} ({count}x)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-white/40">Quantidade</span>
                    <input
                      type="number"
                      min={1}
                      max={maxFragmentsForPublish}
                      value={publishQuantity}
                      onChange={(e) => setPublishQuantity(Math.max(1, Math.min(maxFragmentsForPublish, Number(e.target.value))))}
                      className="w-20 rounded-lg border border-void-600 bg-void-900 px-2 py-1.5 text-xs text-white/80 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-white/40">Preço/un. (créditos)</span>
                    <input
                      type="number"
                      min={MIN_PRICE_CREDITS}
                      step={10}
                      value={publishPrice}
                      onChange={(e) => setPublishPrice(Math.max(MIN_PRICE_CREDITS, Number(e.target.value)))}
                      className="w-24 rounded-lg border border-void-600 bg-void-900 px-2 py-1.5 text-xs text-white/80 focus:outline-none"
                    />
                  </label>
                  <button
                    onClick={handlePublish}
                    disabled={publishing || maxFragmentsForPublish === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-code-500 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400 disabled:opacity-50"
                  >
                    {publishing && <Icon name="loader" size={12} className="animate-spin" />}
                    Publicar
                  </button>
                </div>
              )}
            </div>
          )}

          {market.myListings.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {market.myListings.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-void-600 bg-void-800/50 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <CharacterPortrait
                      name={byId.get(l.characterId)?.name ?? l.characterId}
                      element={byId.get(l.characterId)?.element ?? 'Encryption'}
                      faction={byId.get(l.characterId)?.faction ?? 'Firewall'}
                      portraitUrl={byId.get(l.characterId)?.portraitUrl}
                      size={40}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{diagramName(byId.get(l.characterId)?.name ?? l.characterId)}</p>
                      <p className="text-xs text-white/50">
                        {l.quantity}x · {l.priceCredits} créditos/un.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancel(l.id)}
                    disabled={busyListingId === l.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-void-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/70 transition hover:border-signal-red/50 hover:text-signal-red disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mercado */}
        <section>
          <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Mercado</h2>
          {market.loading ? (
            <p className="p-4 text-xs text-white/40">Carregando...</p>
          ) : market.listings.length === 0 ? (
            <p className="rounded-xl border border-void-600 bg-void-800/30 p-4 text-xs text-white/40">Nenhuma oferta disponível no momento.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {market.listings.map((l) => {
                const info = byId.get(l.characterId);
                const qty = Math.min(buyQuantities[l.id] ?? 1, l.quantity);
                const total = l.priceCredits * qty;
                const affordable = vipActive && credits >= total;
                return (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-void-600 bg-void-800/50 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CharacterPortrait
                        name={info?.name ?? l.characterId}
                        element={info?.element ?? 'Encryption'}
                        faction={info?.faction ?? 'Firewall'}
                        portraitUrl={info?.portraitUrl}
                        size={40}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{diagramName(info?.name ?? l.characterId)}</p>
                        <p className="text-xs text-white/50">
                          {l.sellerUsername} · {l.quantity}x disponíveis · {l.priceCredits} créditos/un.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={l.quantity}
                        value={qty}
                        onChange={(e) => setBuyQuantities((prev) => ({ ...prev, [l.id]: Math.max(1, Math.min(l.quantity, Number(e.target.value))) }))}
                        className="w-14 rounded-lg border border-void-600 bg-void-900 px-2 py-1.5 text-xs text-white/80 focus:outline-none"
                      />
                      <button
                        onClick={() => handlePurchase(l.id, l.priceCredits, qty)}
                        disabled={!affordable || busyListingId === l.id}
                        className="flex items-center gap-1.5 rounded-lg bg-signal-amber px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-void-950 transition hover:bg-signal-amber/80 disabled:opacity-50"
                      >
                        {busyListingId === l.id && <Icon name="loader" size={12} className="animate-spin" />}
                        <Icon name="coins" size={12} />
                        {total}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
