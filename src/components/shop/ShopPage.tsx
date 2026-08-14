import { useMemo, useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { RosterChips } from '../roster/RosterChips';
import { buildCompendium, currentShowcaseWeek, pickWeeklyShowcase } from '../../data/roster';
import { FALLBACK_RARITY } from '../../data/engineDisplay';
import type { AcquireOutcome } from '../../hooks/useOwnedCharacters';
import type { Rarity } from '../../types';
import {
  CLUSTER_CREDIT_XP_BONUS_PERCENT,
  VIP_COST_TOKENS,
  VIP_CREDIT_XP_BONUS_PERCENT,
  VIP_DAILY_BONUS_TOKENS,
  VIP_DURATION_DAYS,
} from '../../hooks/usePlayerProgress';

// First-pass numbers, easy to retune later.
const STARTER_BOOST_CREDITS = 1000;
const SHOWCASE_CHARACTER_PRICE_CREDITS = 2000;
/** Slot 0 is open to everyone; slots 1-2 require an active Root Access subscription. */
const SHOWCASE_FREE_SLOTS = 1;

interface ShopPageProps {
  credits: number;
  tokens: number;
  starterBoostClaimed: boolean;
  onClaimStarterBoost: () => void;
  onAcquireCharacter: (characterId: string, rarity: Rarity) => Promise<AcquireOutcome>;
  onAdjustCredits: (delta: number) => void;
  onToast: (message: string) => void;
  vipActive: boolean;
  vipExpiresAt: string | null;
  onPurchaseVip: () => Promise<boolean>;
  onClaimDailyVipBonus: () => Promise<boolean>;
  inCluster: boolean;
}

export function ShopPage({
  credits,
  tokens,
  starterBoostClaimed,
  onClaimStarterBoost,
  onAcquireCharacter,
  onAdjustCredits,
  onToast,
  vipActive,
  vipExpiresAt,
  onPurchaseVip,
  onClaimDailyVipBonus,
  inCluster,
}: ShopPageProps) {
  const [purchasingVip, setPurchasingVip] = useState(false);

  async function handlePurchaseVip() {
    if (purchasingVip) return;
    setPurchasingVip(true);
    const ok = await onPurchaseVip();
    setPurchasingVip(false);
    onToast(ok ? `Root Access ativado por ${VIP_DURATION_DAYS} dias!` : 'Tokens insuficientes.');
  }

  async function handleClaimDailyBonus() {
    const ok = await onClaimDailyVipBonus();
    onToast(ok ? `+${VIP_DAILY_BONUS_TOKENS} tokens resgatados!` : 'Bônus diário já resgatado hoje.');
  }

  const compendium = buildCompendium();
  const byId = new Map(compendium.map((c) => [c.templateId, c]));
  const showcaseIds = useMemo(() => pickWeeklyShowcase(currentShowcaseWeek()), []);
  const [buyingShowcaseId, setBuyingShowcaseId] = useState<string | null>(null);

  function handleClaimStarterBoost() {
    if (starterBoostClaimed) return;
    onClaimStarterBoost();
    onAdjustCredits(STARTER_BOOST_CREDITS);
    onToast(`+${STARTER_BOOST_CREDITS} créditos resgatados!`);
  }

  async function handleBuyShowcase(characterId: string, slotIndex: number) {
    if (buyingShowcaseId) return;
    if (slotIndex >= SHOWCASE_FREE_SLOTS && !vipActive) return;
    if (credits < SHOWCASE_CHARACTER_PRICE_CREDITS) return;
    setBuyingShowcaseId(characterId);
    onAdjustCredits(-SHOWCASE_CHARACTER_PRICE_CREDITS);
    const outcome = await onAcquireCharacter(characterId, FALLBACK_RARITY);
    setBuyingShowcaseId(null);
    onToast(outcome === 'new' ? 'Novo personagem desbloqueado!' : 'Já possuído — convertido em +1 diagrama.');
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Loja</h1>
        <p className="text-xs text-white/50">Vitrine semanal e bônus</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Root Access (VIP) */}
        <section>
          <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Root Access</h2>
          <div className="rounded-xl border border-signal-cyan/25 bg-void-800/50 p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-signal-cyan/30 bg-signal-cyan/10">
                  <Icon name="gem" size={22} className="text-signal-cyan" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-white">
                    {vipActive ? 'Root Access ativo' : `${VIP_DURATION_DAYS} dias de Root Access`}
                  </p>
                  <p className="text-xs text-white/50">
                    {vipActive && vipExpiresAt
                      ? `Expira em ${new Date(vipExpiresAt).toLocaleDateString('pt-BR')} — renove para acumular mais dias.`
                      : `+${Math.round(VIP_CREDIT_XP_BONUS_PERCENT * 100)}% Créditos/XP, bônus diário de Tokens.`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {vipActive && (
                  <button
                    onClick={handleClaimDailyBonus}
                    className="flex items-center gap-1.5 rounded-lg border border-signal-cyan/40 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-signal-cyan transition hover:bg-signal-cyan/10"
                  >
                    <Icon name="gift" size={13} />
                    Bônus diário
                  </button>
                )}
                <button
                  onClick={handlePurchaseVip}
                  disabled={purchasingVip || tokens < VIP_COST_TOKENS}
                  className="flex items-center gap-2 rounded-lg bg-signal-cyan px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-signal-cyan/80 disabled:opacity-50"
                >
                  {purchasingVip && <Icon name="loader" size={13} className="animate-spin" />}
                  <Icon name="gem" size={13} />
                  {VIP_COST_TOKENS}
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-white/30">
              Sem processador de pagamento real conectado ainda — compra feita com Tokens como espaço reservado até a assinatura recorrente
              chegar.
              {inCluster && ` Bônus de Créditos/XP do Cluster (+${Math.round(CLUSTER_CREDIT_XP_BONUS_PERCENT * 100)}%) é cumulativo com este.`}
            </p>
          </div>
        </section>

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

        {/* Weekly character showcase */}
        <section>
          <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Personagens em Destaque</h2>
          <p className="mb-2 text-[11px] text-white/40">Rotação semanal — compra direta, sem sorteio. 1 personagem liberado para todos; 2 exclusivos para Root Access.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {showcaseIds.map((characterId, index) => {
              const info = byId.get(characterId);
              const locked = index >= SHOWCASE_FREE_SLOTS && !vipActive;
              const affordable = credits >= SHOWCASE_CHARACTER_PRICE_CREDITS;
              const buying = buyingShowcaseId === characterId;
              return (
                <div key={characterId} className="flex flex-col items-center gap-2 rounded-xl border border-arcane-400/25 bg-void-800/50 p-4 text-center">
                  <div className="relative">
                    <CharacterPortrait
                      name={info?.name ?? characterId}
                      element={info?.element ?? 'Encryption'}
                      rarity={info?.rarity ?? FALLBACK_RARITY}
                      portraitUrl={info?.portraitUrl}
                      size={64}
                    />
                    {index >= SHOWCASE_FREE_SLOTS && (
                      <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-signal-cyan text-void-950">
                        <Icon name="crown" size={12} />
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm font-bold text-white">{info?.name ?? characterId}</p>
                  {info && <RosterChips faction={info.faction} element={info.element} rarity={info.rarity} />}
                  <button
                    onClick={() => handleBuyShowcase(characterId, index)}
                    disabled={buying || locked || !affordable}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-arcane-400 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-arcane-400/80 disabled:opacity-50"
                  >
                    {buying && <Icon name="loader" size={13} className="animate-spin" />}
                    {locked ? (
                      <>
                        <Icon name="lock" size={12} />
                        Root Access
                      </>
                    ) : (
                      <>
                        <Icon name="coins" size={12} />
                        {SHOWCASE_CHARACTER_PRICE_CREDITS}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
