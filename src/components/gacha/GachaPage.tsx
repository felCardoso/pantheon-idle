import { useMemo, useRef, useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { RosterChips } from '../roster/RosterChips';
import { CharacterDetailModal } from '../roster/CharacterDetailModal';
import { SummonReel } from './SummonReel';
import { AnimatedBorderCard } from './AnimatedBorderCard';
import { buildCompendium, currentShowcaseWeek, pickWeeklyBannerCharacter, RARITY_RANK, type GachaTier, type RosterCharacter } from '../../data/roster';
import { BANNER_PULL_PRICE_TOKENS, COMMON_PULL_PRICE_CREDITS, IMPROVED_PULL_PRICE_TOKENS, BUNDLE_SIZE, bundlePrice } from '../../data/gachaPricing';
import { MODULE_CAPSULE_BUNDLE, MODULE_CAPSULE_BUNDLE_COST_TOKENS, MODULE_CAPSULE_COST_TOKENS } from '../../data/playerEconomy';
import { FRAGMENTS_PER_DUPLICATE_BY_RARITY } from '../../data/characterVersion';
import { MODULE_BY_ID, describeModule, type ModuleRarity } from '../../data/modules';
import { RARITY_COLOR } from '../../data/theme';
import { BANNER_PITY_MAX } from '../../hooks/usePlayerProgress';
import { postApi } from '../../lib/apiClient';
import type { AcquireOutcome, OwnedCharacter } from '../../hooks/useOwnedCharacters';
import type { Rarity } from '../../types';

/** Decoy portraits scrolled through before landing on a pull's flourish winner — purely visual. */
const REEL_LENGTH = 24;
/** The banner's spotlighted character always displays at this rarity, independent of anything a pull actually rolls. */
const BANNER_DISPLAY_RARITY: Rarity = 'Zero-Day';

/** Módulo grades, mirroring upgrades/ModuleSlots.tsx so a rune reads the same in both screens. */
const MODULE_GRADE_COLOR: Record<ModuleRarity, string> = { S: '#ffd029', A: '#c34aff', B: '#39a0ff', C: '#8b93a7' };

interface GachaRollResponse {
  results: { characterId: string; rarity: Rarity; outcome: AcquireOutcome }[];
  credits: number;
  tokens: number;
  bannerPity: number;
  bannerGuaranteed: boolean;
}

interface ModuleRollResponse {
  modules: { moduleId: string; rarity: ModuleRarity; slot: string }[];
  tokens: number;
}

interface GachaClaimPityResponse {
  result: { characterId: string; rarity: Rarity; outcome: AcquireOutcome };
  bannerPity: number;
  bannerGuaranteed: boolean;
}

interface GachaPageProps {
  credits: number;
  tokens: number;
  xp: number;
  ownedCharacters: OwnedCharacter[];
  onToast: (message: string) => void;
  bannerPity: number;
  /** Reconciles battle.credits/xp with an /api/gacha/** route's authoritative response — see useBattleSimulation.ts's setWallet. */
  onSetWallet: (credits: number, xp: number) => void;
  /** Reconciles tokens/bannerPity/bannerGuaranteed with an /api/gacha/** route's authoritative response — see usePlayerProgress.ts's syncFromGachaResponse. */
  onSyncGachaState: (next: { tokens: number; bannerPity: number; bannerGuaranteed: boolean }) => void;
  /** Called once per pull that resolved 'new' — adds the character to Time1 if it has room. */
  onNewCharacter: (characterId: string) => void;
  /** Re-reads player_modules after a `.rar` capsule so Melhorias sees the new runes. */
  onModulesChanged: () => void;
  /** Syncs the token balance a `.rar` capsule debited, without touching banner pity. */
  onSetTokens: (tokens: number) => void;
}

interface PullResult {
  characterId: string;
  rarity: Rarity;
  outcome: AcquireOutcome;
}

const OUTCOME_LABEL: Record<AcquireOutcome, string> = {
  new: 'Novo personagem desbloqueado!',
  upgraded: 'Carta evoluída para uma raridade maior!',
  duplicate: 'Personagem repetido',
};

export function GachaPage({
  credits,
  tokens,
  xp,
  ownedCharacters,
  onToast,
  bannerPity,
  onSetWallet,
  onSyncGachaState,
  onNewCharacter,
  onModulesChanged,
  onSetTokens,
}: GachaPageProps) {
  const [pulling, setPulling] = useState(false);
  const [reelItems, setReelItems] = useState<RosterCharacter[] | null>(null);
  const [reveal, setReveal] = useState<PullResult | null>(null);
  const [batchReveal, setBatchReveal] = useState<PullResult[] | null>(null);
  const [viewingBanner, setViewingBanner] = useState(false);
  const [claimingPity, setClaimingPity] = useState(false);
  const [rollingModules, setRollingModules] = useState(false);
  const [moduleReveal, setModuleReveal] = useState<ModuleRollResponse['modules'] | null>(null);
  const pendingRef = useRef<PullResult[]>([]);

  const compendium = buildCompendium();
  const byId = useMemo(() => new Map(compendium.map((c) => [c.templateId, c])), [compendium]);
  const ownedByCharacterId = useMemo(() => new Map(ownedCharacters.map((o) => [o.characterId, o])), [ownedCharacters]);
  const ownedSet = useMemo(() => new Set(ownedCharacters.map((o) => o.characterId)), [ownedCharacters]);
  const bannerCharacterId = useMemo(() => pickWeeklyBannerCharacter(currentShowcaseWeek()), []);
  const bannerCharacter = byId.get(bannerCharacterId);
  // The banner spotlight always reads as Zero-Day, regardless of the compendium's baseline rarity or what pulls actually roll.
  const bannerDisplay = bannerCharacter ? { ...bannerCharacter, rarity: BANNER_DISPLAY_RARITY } : null;
  const pityReady = bannerPity >= BANNER_PITY_MAX;

  async function resolvePulls(count: 1 | 10, tier: GachaTier) {
    if (pulling) return;
    setPulling(true);

    let response: GachaRollResponse;
    try {
      response = await postApi<GachaRollResponse>('/api/gacha/roll', { tier, count });
    } catch (err) {
      setPulling(false);
      onToast(err instanceof Error ? err.message : 'Falha ao invocar.');
      return;
    }

    onSetWallet(response.credits, xp);
    onSyncGachaState({ tokens: response.tokens, bannerPity: response.bannerPity, bannerGuaranteed: response.bannerGuaranteed });
    for (const r of response.results) {
      if (r.outcome === 'new') onNewCharacter(r.characterId);
    }

    const results = response.results;
    const flourishWinnerId = [...results].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity])[0].characterId;
    const winner = byId.get(flourishWinnerId);
    if (!winner) {
      // Shouldn't happen — the server only ever returns ids the compendium knows about.
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

  async function handleClaimPity() {
    if (claimingPity || !pityReady || !bannerCharacter) return;
    setClaimingPity(true);

    let response: GachaClaimPityResponse;
    try {
      response = await postApi<GachaClaimPityResponse>('/api/gacha/claim-pity');
    } catch (err) {
      setClaimingPity(false);
      onToast(err instanceof Error ? err.message : 'Falha ao extrair.');
      return;
    }

    onSyncGachaState({ tokens, bannerPity: response.bannerPity, bannerGuaranteed: response.bannerGuaranteed });
    setClaimingPity(false);
    onToast(
      response.result.outcome === 'duplicate'
        ? `Diagrama Zero-Day de ${bannerCharacter.name} extraído — convertido em fragmento.`
        : `${bannerCharacter.name}.exe extraído com root access garantido!`,
    );
  }

  async function handleRollModules(count: number) {
    if (rollingModules) return;
    setRollingModules(true);
    try {
      const response = await postApi<ModuleRollResponse>('/api/modules/roll', { count });
      onSetTokens(response.tokens);
      setModuleReveal(response.modules);
      onModulesChanged();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao abrir a cápsula.');
    }
    setRollingModules(false);
  }

  const revealInfo = reveal ? byId.get(reveal.characterId) : null;
  const revealDisplay = revealInfo && reveal ? { ...revealInfo, rarity: reveal.rarity } : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Invocações</h1>
        <p className="text-xs text-white/50">Cápsulas de invocação de personagens (`.zip`)</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Banner semanal */}
        {bannerDisplay && (
          <AnimatedBorderCard accentColor={RARITY_COLOR[bannerDisplay.rarity]}>
            <div className="relative overflow-hidden rounded-[10px] p-4 sm:p-5">
              {/* discreet rotating glow wash behind the banner content */}
              <div
                className="pointer-events-none absolute inset-[-100%] animate-spin opacity-20 [animation-duration:14s]"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0%, ${RARITY_COLOR[bannerDisplay.rarity]} 8%, transparent 20%, transparent 50%, ${RARITY_COLOR[bannerDisplay.rarity]} 58%, transparent 70%)`,
                }}
              />
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="flex w-fit items-center gap-1.5 rounded-full border border-signal-cyan/30 bg-signal-cyan/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-signal-cyan">
                    <Icon name="crown" size={11} />
                    Banner Semanal
                  </span>
                  <div>
                    <p className="font-display text-base font-bold text-white sm:text-lg">{bannerDisplay.name}</p>
                    <RosterChips faction={bannerDisplay.faction} rarity={bannerDisplay.rarity} />
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
                      onClick={() => resolvePulls(1, 'banner')}
                      disabled={pulling || tokens < BANNER_PULL_PRICE_TOKENS}
                      className="flex items-center gap-1.5 rounded-lg bg-signal-cyan px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-signal-cyan/80 disabled:opacity-50"
                    >
                      {pulling && <Icon name="loader" size={13} className="animate-spin" />}
                      1x <Icon name="gem" size={12} /> {BANNER_PULL_PRICE_TOKENS}
                    </button>
                    <button
                      onClick={() => resolvePulls(BUNDLE_SIZE, 'banner')}
                      disabled={pulling || tokens < bundlePrice(BANNER_PULL_PRICE_TOKENS)}
                      className="flex items-center gap-1.5 rounded-lg border border-signal-cyan/50 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-signal-cyan transition hover:bg-signal-cyan/10 disabled:opacity-50"
                    >
                      10x <Icon name="gem" size={12} /> {bundlePrice(BANNER_PULL_PRICE_TOKENS)}
                    </button>
                  </div>

                  {/* Hard pity — X/150, guaranteed banner character once maxed */}
                  <div className="mt-1 flex w-full max-w-xs flex-col gap-1">
                    <div className="h-2 w-full overflow-hidden rounded-full border border-signal-cyan/20 bg-void-900/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-signal-cyan/70 to-signal-cyan transition-all"
                        style={{ width: `${Math.min(100, (bannerPity / BANNER_PITY_MAX) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-white/40">
                        Garantia: {Math.min(bannerPity, BANNER_PITY_MAX)}/{BANNER_PITY_MAX}
                      </span>
                      <button
                        onClick={handleClaimPity}
                        disabled={!pityReady || claimingPity}
                        className="flex items-center gap-1 rounded-full border border-signal-amber/50 bg-signal-amber/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-signal-amber transition hover:bg-signal-amber/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {claimingPity && <Icon name="loader" size={10} className="animate-spin" />}
                        <Icon name="unlock" size={10} />
                        Extrair Executável Garantido
                      </button>
                    </div>
                  </div>
                </div>
                <CharacterPortrait
                  name={bannerDisplay.name}
                  faction={bannerDisplay.faction}
                  rarity={bannerDisplay.rarity}
                  portraitUrl={bannerDisplay.portraitUrl}
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
                  onClick={() => resolvePulls(1, 'normal')}
                  disabled={pulling || credits < COMMON_PULL_PRICE_CREDITS}
                  className="flex items-center gap-1.5 rounded-lg bg-code-500 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400 disabled:opacity-50"
                >
                  {pulling && <Icon name="loader" size={13} className="animate-spin" />}
                  1x <Icon name="coins" size={12} /> {COMMON_PULL_PRICE_CREDITS}
                </button>
                <button
                  onClick={() => resolvePulls(BUNDLE_SIZE, 'normal')}
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
                  onClick={() => resolvePulls(1, 'hard')}
                  disabled={pulling || tokens < IMPROVED_PULL_PRICE_TOKENS}
                  className="flex items-center gap-1.5 rounded-lg bg-arcane-400 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-arcane-400/80 disabled:opacity-50"
                >
                  {pulling && <Icon name="loader" size={13} className="animate-spin" />}
                  1x <Icon name="gem" size={12} /> {IMPROVED_PULL_PRICE_TOKENS}
                </button>
                <button
                  onClick={() => resolvePulls(BUNDLE_SIZE, 'hard')}
                  disabled={pulling || tokens < bundlePrice(IMPROVED_PULL_PRICE_TOKENS)}
                  className="flex items-center gap-1.5 rounded-lg border border-arcane-400/50 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-arcane-300 transition hover:bg-arcane-400/10 disabled:opacity-50"
                >
                  10x <Icon name="gem" size={12} /> {bundlePrice(IMPROVED_PULL_PRICE_TOKENS)}
                </button>
              </div>
            </div>
          </AnimatedBorderCard>
        </div>

        {/* Cápsula `.rar` — Módulos */}
        <AnimatedBorderCard accentColor="#ffa229">
          <div className="flex flex-col gap-3 rounded-[10px] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-signal-amber/30 bg-signal-amber/10">
                <Icon name="cpu" size={20} className="text-signal-amber" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-white">Cápsula `.rar` — Módulos</p>
                <p className="text-xs text-white/50">
                  1 módulo aleatório de grau C a S. Equipe-os em Melhorias &gt; Módulos. Chefes de Mundo também soltam módulos (grau B+).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleRollModules(1)}
                disabled={rollingModules || tokens < MODULE_CAPSULE_COST_TOKENS}
                className="flex items-center gap-1.5 rounded-lg bg-signal-amber px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-signal-amber/80 disabled:opacity-50"
              >
                {rollingModules && <Icon name="loader" size={13} className="animate-spin" />}
                1x <Icon name="gem" size={12} /> {MODULE_CAPSULE_COST_TOKENS}
              </button>
              <button
                onClick={() => handleRollModules(MODULE_CAPSULE_BUNDLE)}
                disabled={rollingModules || tokens < MODULE_CAPSULE_BUNDLE_COST_TOKENS}
                className="flex items-center gap-1.5 rounded-lg border border-signal-amber/50 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-signal-amber transition hover:bg-signal-amber/10 disabled:opacity-50"
              >
                {MODULE_CAPSULE_BUNDLE}x <Icon name="gem" size={12} /> {MODULE_CAPSULE_BUNDLE_COST_TOKENS}
              </button>
            </div>
          </div>
        </AnimatedBorderCard>

        {moduleReveal && (
          <div className="rounded-xl border border-signal-amber/30 bg-signal-amber/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-sm font-bold text-white">
                {moduleReveal.length === 1 ? 'Módulo extraído!' : `${moduleReveal.length} módulos extraídos!`}
              </p>
              <button onClick={() => setModuleReveal(null)} className="shrink-0 rounded-lg p-1.5 text-white/40 transition hover:text-white/70">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {moduleReveal.map((m, i) => {
                const definition = MODULE_BY_ID[m.moduleId];
                if (!definition) return null;
                const color = MODULE_GRADE_COLOR[m.rarity] ?? '#8b93a7';
                return (
                  <div key={`${m.moduleId}-${i}`} className="flex items-start gap-2 rounded-lg border border-void-600 bg-void-900/50 p-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold"
                      style={{ color, border: `1px solid ${color}66` }}
                    >
                      {m.rarity}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">{definition.name}</p>
                      <p className="text-[11px] text-white/50">{describeModule(definition, m.rarity)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reelItems && <SummonReel items={reelItems} onComplete={handleReelComplete} />}

        {revealDisplay && reveal && (
          <div className="flex items-center gap-3 rounded-xl border border-code-500/30 bg-code-900/20 p-4">
            <CharacterPortrait
              name={revealDisplay.name}
              faction={revealDisplay.faction}
              rarity={revealDisplay.rarity}
              portraitUrl={revealDisplay.portraitUrl}
              size={56}
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-white">{OUTCOME_LABEL[reveal.outcome]}</p>
              <div className="flex items-center gap-2">
                <span className="truncate text-xs text-white/70">{revealDisplay.name}</span>
                <RosterChips faction={revealDisplay.faction} rarity={revealDisplay.rarity} />
              </div>
              {reveal.outcome === 'duplicate' && (
                <p className="mt-1 text-[11px] text-white/50">Convertido em +{FRAGMENTS_PER_DUPLICATE_BY_RARITY[reveal.rarity]} diagramas.</p>
              )}
              {reveal.outcome === 'upgraded' && <p className="mt-1 text-[11px] text-white/50">Nível de personagem resetado — habilidades preservadas.</p>}
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
                const badgeLabel = r.outcome === 'new' ? 'novo' : r.outcome === 'upgraded' ? 'up!' : `+${FRAGMENTS_PER_DUPLICATE_BY_RARITY[r.rarity]}`;
                return (
                  <div key={`${r.characterId}-${i}`} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <CharacterPortrait name={info.name} faction={info.faction} rarity={r.rarity} portraitUrl={info.portraitUrl} size={48} />
                      <span
                        className={`absolute -right-1 -top-1 rounded-full px-1 py-0.5 text-[8px] font-bold uppercase leading-none ${
                          r.outcome === 'new' ? 'bg-code-500 text-void-950' : r.outcome === 'upgraded' ? 'bg-signal-amber text-void-950' : 'bg-void-700 text-white/70'
                        }`}
                      >
                        {badgeLabel}
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

      {viewingBanner && bannerDisplay && (
        <CharacterDetailModal
          character={bannerDisplay}
          owned={ownedSet.has(bannerCharacterId)}
          ownedRarity={ownedByCharacterId.get(bannerCharacterId)?.rarity ?? null}
          onClose={() => setViewingBanner(false)}
        />
      )}
    </div>
  );
}
