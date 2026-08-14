import { useMemo, useRef, useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { RosterChips } from '../roster/RosterChips';
import { CharacterDetailModal } from '../roster/CharacterDetailModal';
import { SummonReel } from './SummonReel';
import { AnimatedBorderCard } from './AnimatedBorderCard';
import {
  buildCompendium,
  currentShowcaseWeek,
  pickWeeklyBannerCharacter,
  pullGachaCharacter,
  type RosterCharacter,
} from '../../data/roster';
import { RARITY_COLOR } from '../../data/theme';
import { Rng } from '../../engine/core/rng';
import type { OwnedCharacter } from '../../hooks/useOwnedCharacters';
import type { Rarity } from '../../types';

// First-pass numbers, easy to retune later — change these to retune the whole gacha economy.
const BANNER_PULL_PRICE_TOKENS = 20;
const COMMON_PULL_PRICE_CREDITS = 1500;
const IMPROVED_PULL_PRICE_TOKENS = 15;
const BUNDLE_SIZE = 10;
const BUNDLE_DISCOUNT_PERCENT = 0.1;
/** Decoy portraits scrolled through before landing on a pull's flourish winner — purely visual. */
const REEL_LENGTH = 24;

/** The 10x price for any unit price, always `BUNDLE_SIZE` at `BUNDLE_DISCOUNT_PERCENT` off. */
function bundlePrice(unitPrice: number): number {
  return Math.round(unitPrice * BUNDLE_SIZE * (1 - BUNDLE_DISCOUNT_PERCENT));
}

const RARITY_RANK: Record<Rarity, number> = { Alpha: 0, Beta: 1, Stable: 2, LTS: 3, 'Zero-Day': 4 };

interface GachaPageProps {
  credits: number;
  tokens: number;
  ownedCharacters: OwnedCharacter[];
  onAcquireCharacter: (characterId: string) => Promise<'new' | 'duplicate'>;
  onAdjustCredits: (delta: number) => void;
  onSpendTokens: (amount: number) => Promise<boolean>;
  onToast: (message: string) => void;
}

interface PullResult {
  characterId: string;
  outcome: 'new' | 'duplicate';
}

export function GachaPage({ credits, tokens, ownedCharacters, onAcquireCharacter, onAdjustCredits, onSpendTokens, onToast }: GachaPageProps) {
  const [pulling, setPulling] = useState(false);
  const [reelItems, setReelItems] = useState<RosterCharacter[] | null>(null);
  const [reveal, setReveal] = useState<PullResult | null>(null);
  const [batchReveal, setBatchReveal] = useState<PullResult[] | null>(null);
  const [viewingBanner, setViewingBanner] = useState(false);
  const pendingRef = useRef<PullResult[]>([]);

  const compendium = buildCompendium();
  const byId = useMemo(() => new Map(compendium.map((c) => [c.templateId, c])), [compendium]);
  const ownedSet = useMemo(() => new Set(ownedCharacters.map((o) => o.characterId)), [ownedCharacters]);
  const bannerCharacterId = useMemo(() => pickWeeklyBannerCharacter(currentShowcaseWeek()), []);
  const bannerCharacter = byId.get(bannerCharacterId);

  async function resolvePulls(count: number, pay: () => Promise<boolean>) {
    if (pulling) return;
    setPulling(true);
    const paid = await pay();
    if (!paid) {
      setPulling(false);
      onToast('Saldo insuficiente.');
      return;
    }

    const results: PullResult[] = [];
    for (let i = 0; i < count; i++) {
      const characterId = pullGachaCharacter(new Rng((Date.now() + i) >>> 0));
      const outcome = await onAcquireCharacter(characterId);
      results.push({ characterId, outcome });
    }

    const flourishWinnerId = [...results].sort((a, b) => {
      const rarityA = byId.get(a.characterId)?.rarity ?? 'Alpha';
      const rarityB = byId.get(b.characterId)?.rarity ?? 'Alpha';
      return RARITY_RANK[rarityB] - RARITY_RANK[rarityA];
    })[0].characterId;
    const winner = byId.get(flourishWinnerId);
    if (!winner) {
      // Shouldn't happen — pullGachaCharacter only ever returns ids the compendium knows about.
      setPulling(false);
      if (count === 1) setReveal(results[0]);
      else setBatchReveal(results);
      return;
    }

    const decoys = Array.from({ length: REEL_LENGTH - 1 }, () => compendium[Math.floor(Math.random() * compendium.length)]);
    pendingRef.current = results;
    setReveal(null);
    setBatchReveal(null);
    setReelItems([...decoys, winner]);
  }

  function handleReelComplete() {
    setReelItems(null);
    const results = pendingRef.current;
    pendingRef.current = [];
    if (results.length === 1) setReveal(results[0]);
    else setBatchReveal(results);
    setPulling(false);
  }

  async function payCredits(amount: number): Promise<boolean> {
    if (credits < amount) return false;
    onAdjustCredits(-amount);
    return true;
  }

  async function payTokens(amount: number): Promise<boolean> {
    return onSpendTokens(amount);
  }

  const revealInfo = reveal ? byId.get(reveal.characterId) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Invocações</h1>
        <p className="text-xs text-white/50">Cápsulas de invocação de personagens (`.zip`)</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Banner semanal */}
        {bannerCharacter && (
          <AnimatedBorderCard accentColor={RARITY_COLOR[bannerCharacter.rarity]}>
            <div className="relative overflow-hidden rounded-[10px] p-4 sm:p-5">
              {/* discreet rotating glow wash behind the banner content */}
              <div
                className="pointer-events-none absolute inset-[-100%] animate-spin opacity-20 [animation-duration:14s]"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0%, ${RARITY_COLOR[bannerCharacter.rarity]} 8%, transparent 20%, transparent 50%, ${RARITY_COLOR[bannerCharacter.rarity]} 58%, transparent 70%)`,
                }}
              />
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="flex w-fit items-center gap-1.5 rounded-full border border-signal-cyan/30 bg-signal-cyan/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-signal-cyan">
                    <Icon name="crown" size={11} />
                    Banner Semanal
                  </span>
                  <div>
                    <p className="font-display text-base font-bold text-white sm:text-lg">{bannerCharacter.name}</p>
                    <RosterChips faction={bannerCharacter.faction} element={bannerCharacter.element} rarity={bannerCharacter.rarity} />
                  </div>
                  <button
                    onClick={() => setViewingBanner(true)}
                    className="flex w-fit items-center gap-1.5 rounded-lg border border-void-600 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/70 transition hover:border-code-400/50 hover:text-code-300"
                  >
                    <Icon name="id-card" size={12} />
                    Ver personagem
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => resolvePulls(1, () => payTokens(BANNER_PULL_PRICE_TOKENS))}
                      disabled={pulling || tokens < BANNER_PULL_PRICE_TOKENS}
                      className="flex items-center gap-1.5 rounded-lg bg-signal-cyan px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-signal-cyan/80 disabled:opacity-50"
                    >
                      {pulling && <Icon name="loader" size={13} className="animate-spin" />}
                      1x <Icon name="gem" size={12} /> {BANNER_PULL_PRICE_TOKENS}
                    </button>
                    <button
                      onClick={() => resolvePulls(BUNDLE_SIZE, () => payTokens(bundlePrice(BANNER_PULL_PRICE_TOKENS)))}
                      disabled={pulling || tokens < bundlePrice(BANNER_PULL_PRICE_TOKENS)}
                      className="flex items-center gap-1.5 rounded-lg border border-signal-cyan/50 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-signal-cyan transition hover:bg-signal-cyan/10 disabled:opacity-50"
                    >
                      10x <Icon name="gem" size={12} /> {bundlePrice(BANNER_PULL_PRICE_TOKENS)}
                    </button>
                  </div>
                </div>
                <CharacterPortrait
                  name={bannerCharacter.name}
                  element={bannerCharacter.element}
                  rarity={bannerCharacter.rarity}
                  portraitUrl={bannerCharacter.portraitUrl}
                  size={120}
                  className="shrink-0"
                />
              </div>
            </div>
          </AnimatedBorderCard>
        )}

        {/* Invocação Comum + Melhorada */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AnimatedBorderCard accentColor="#39ff9c">
            <div className="flex flex-col gap-3 rounded-[10px] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-code-500/30 bg-code-500/10">
                  <Icon name="package" size={20} className="text-code-400" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-white">Invocação Comum</p>
                  <p className="text-xs text-white/50">1 personagem aleatório, pago em Créditos.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => resolvePulls(1, () => payCredits(COMMON_PULL_PRICE_CREDITS))}
                  disabled={pulling || credits < COMMON_PULL_PRICE_CREDITS}
                  className="flex items-center gap-1.5 rounded-lg bg-code-500 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400 disabled:opacity-50"
                >
                  {pulling && <Icon name="loader" size={13} className="animate-spin" />}
                  1x <Icon name="coins" size={12} /> {COMMON_PULL_PRICE_CREDITS}
                </button>
                <button
                  onClick={() => resolvePulls(BUNDLE_SIZE, () => payCredits(bundlePrice(COMMON_PULL_PRICE_CREDITS)))}
                  disabled={pulling || credits < bundlePrice(COMMON_PULL_PRICE_CREDITS)}
                  className="flex items-center gap-1.5 rounded-lg border border-code-500/50 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-code-300 transition hover:bg-code-500/10 disabled:opacity-50"
                >
                  10x <Icon name="coins" size={12} /> {bundlePrice(COMMON_PULL_PRICE_CREDITS)}
                </button>
              </div>
            </div>
          </AnimatedBorderCard>

          <AnimatedBorderCard accentColor="#c34aff">
            <div className="flex flex-col gap-3 rounded-[10px] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-arcane-400/30 bg-arcane-400/10">
                  <Icon name="sparkles" size={20} className="text-arcane-300" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-white">Invocação Melhorada</p>
                  <p className="text-xs text-white/50">1 personagem aleatório, pago em Tokens.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => resolvePulls(1, () => payTokens(IMPROVED_PULL_PRICE_TOKENS))}
                  disabled={pulling || tokens < IMPROVED_PULL_PRICE_TOKENS}
                  className="flex items-center gap-1.5 rounded-lg bg-arcane-400 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-arcane-400/80 disabled:opacity-50"
                >
                  {pulling && <Icon name="loader" size={13} className="animate-spin" />}
                  1x <Icon name="gem" size={12} /> {IMPROVED_PULL_PRICE_TOKENS}
                </button>
                <button
                  onClick={() => resolvePulls(BUNDLE_SIZE, () => payTokens(bundlePrice(IMPROVED_PULL_PRICE_TOKENS)))}
                  disabled={pulling || tokens < bundlePrice(IMPROVED_PULL_PRICE_TOKENS)}
                  className="flex items-center gap-1.5 rounded-lg border border-arcane-400/50 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-arcane-300 transition hover:bg-arcane-400/10 disabled:opacity-50"
                >
                  10x <Icon name="gem" size={12} /> {bundlePrice(IMPROVED_PULL_PRICE_TOKENS)}
                </button>
              </div>
            </div>
          </AnimatedBorderCard>
        </div>

        {reelItems && <SummonReel items={reelItems} onComplete={handleReelComplete} />}

        {revealInfo && (
          <div className="flex items-center gap-3 rounded-xl border border-code-500/30 bg-code-900/20 p-4">
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

        {batchReveal && (
          <div className="rounded-xl border border-code-500/30 bg-code-900/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-sm font-bold text-white">{batchReveal.length} personagens invocados!</p>
              <button onClick={() => setBatchReveal(null)} className="shrink-0 rounded-lg p-1.5 text-white/40 transition hover:text-white/70">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {batchReveal.map((r, i) => {
                const info = byId.get(r.characterId);
                if (!info) return null;
                return (
                  <div key={`${r.characterId}-${i}`} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <CharacterPortrait name={info.name} element={info.element} rarity={info.rarity} portraitUrl={info.portraitUrl} size={48} />
                      <span
                        className={`absolute -right-1 -top-1 rounded-full px-1 py-0.5 text-[8px] font-bold uppercase leading-none ${
                          r.outcome === 'new' ? 'bg-code-500 text-void-950' : 'bg-void-700 text-white/70'
                        }`}
                      >
                        {r.outcome === 'new' ? 'novo' : '+1'}
                      </span>
                    </div>
                    <span className="max-w-[3.5rem] truncate text-center text-[9px] text-white/60">{info.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {viewingBanner && bannerCharacter && (
        <CharacterDetailModal character={bannerCharacter} owned={ownedSet.has(bannerCharacterId)} onClose={() => setViewingBanner(false)} />
      )}
    </div>
  );
}
