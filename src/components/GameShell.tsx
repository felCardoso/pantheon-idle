import { useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './layout/TopBar';
import { SideMenu } from './layout/SideMenu';
import { StagePanel } from './layout/StagePanel';
import { ChatPanel } from './layout/ChatPanel';
import { BattleStage } from './battle/BattleStage';
import { WorldMapModal } from './battle/WorldMapModal';
import { PvpBattlePlayer } from './battle/PvpBattlePlayer';
import { TeamPage } from './roster/TeamPage';
import { CharactersPage } from './roster/CharactersPage';
import { ShopPage } from './shop/ShopPage';
import { GachaPage } from './gacha/GachaPage';
import { ClusterPage } from './cluster/ClusterPage';
import { MarketPage } from './market/MarketPage';
import { UpgradesPage } from './upgrades/UpgradesPage';
import { ProfileModal } from './profile/ProfileModal';
import { OnboardingScreen } from './onboarding/OnboardingScreen';
import { WikiModal } from './wiki/WikiModal';
import { Toast } from './common/Toast';
import { Splash } from './common/Splash';
import { Icon } from './common/Icon';
import { PLAYER_STATE } from '../data/mock/player';
import { pvpRankTierFor } from '../data/pvpRank';
import { MENU_ITEMS } from '../data/mock/menu';
import { CHAT_MESSAGES } from '../data/mock/chat';
import { useBattleSimulation } from '../hooks/useBattleSimulation';
import { usePlayerProgress, type TeamVisibility } from '../hooks/usePlayerProgress';
import { useOwnedCharacters, type FragmentStack, type OwnedCharacter } from '../hooks/useOwnedCharacters';
import { usePlayerTeams } from '../hooks/usePlayerTeams';
import { useProfile, type UpdateUsernameResult } from '../hooks/useProfile';
import { useCluster } from '../hooks/useCluster';
import { usePvp, type PvpAttackResult } from '../hooks/usePvp';
import { useMarket } from '../hooks/useMarket';
import { useCharacterProgression } from '../hooks/useCharacterProgression';
import type { ChatMessage, MenuItem, Rarity } from '../types';

interface GameShellProps {
  userId: string;
  onSignOut: () => void;
}

export function GameShell({ userId, onSignOut }: GameShellProps) {
  const {
    progress,
    starterBoostClaimed,
    tokens,
    bytes,
    teamVisibility,
    vipActive,
    vipExpiresAt,
    unlockedTeamSlots,
    pveTeamSlot,
    pvpTeamSlot,
    bannerPity,
    loading: progressLoading,
    claimStarterBoost,
    spendTokens,
    setBytesFromServer,
    setTeamVisibility,
    purchaseVip,
    claimDailyVipBonus,
    purchaseTeamSlot,
    setPveTeamSlot,
    setPvpTeamSlot,
    syncFromGachaResponse,
  } = usePlayerProgress(userId);
  const { ownedCharacters, fragments, loading: ownedLoading, claimStarter, applyBattleXp, sellFragment, refreshFragments } = useOwnedCharacters(userId);
  const { username, avatarCharacterId, loading: profileLoading, updateUsername, updateAvatar } = useProfile(userId);
  const cluster = useCluster(userId);
  const pvp = usePvp(userId);
  const teams = usePlayerTeams(userId);
  const market = useMarket(userId);
  const characterProgression = useCharacterProgression(userId);

  if (progressLoading || !progress || ownedLoading || !ownedCharacters) return <Splash />;

  if (ownedCharacters.length === 0) {
    return (
      <OnboardingScreen
        onSelect={async (characterId) => {
          // Both start optimistically-updating local state before either awaits its Supabase
          // write, so Promise.all (not sequential awaits) avoids a flash of empty teams once
          // ownedCharacters.length flips this component over to GameShellReady below.
          await Promise.all([claimStarter(characterId), teams.initializeAllTeams(characterId)]);
        }}
      />
    );
  }

  return (
    <GameShellReady
      userId={userId}
      username={username}
      avatarCharacterId={profileLoading ? null : avatarCharacterId}
      updateUsername={updateUsername}
      updateAvatar={updateAvatar}
      onSignOut={onSignOut}
      initialFase={progress.fase}
      initialEstagio={progress.estagio}
      initialCredits={progress.credits}
      initialXp={progress.xp}
      ownedCharacters={ownedCharacters}
      fragments={fragments}
      applyBattleXp={applyBattleXp}
      sellFragment={sellFragment}
      refreshFragments={refreshFragments}
      starterBoostClaimed={starterBoostClaimed}
      claimStarterBoost={claimStarterBoost}
      tokens={tokens}
      spendTokens={spendTokens}
      bytes={bytes}
      setBytesFromServer={setBytesFromServer}
      bannerPity={bannerPity}
      syncFromGachaResponse={syncFromGachaResponse}
      characterProgression={characterProgression}
      teamVisibility={teamVisibility}
      setTeamVisibility={setTeamVisibility}
      vipActive={vipActive}
      vipExpiresAt={vipExpiresAt}
      purchaseVip={purchaseVip}
      claimDailyVipBonus={claimDailyVipBonus}
      cluster={cluster}
      pvp={pvp}
      teams={teams}
      unlockedTeamSlots={unlockedTeamSlots}
      pveTeamSlot={pveTeamSlot}
      pvpTeamSlot={pvpTeamSlot}
      purchaseTeamSlot={purchaseTeamSlot}
      setPveTeamSlot={setPveTeamSlot}
      setPvpTeamSlot={setPvpTeamSlot}
      market={market}
    />
  );
}

interface GameShellReadyProps {
  userId: string;
  username: string | null;
  avatarCharacterId: string | null;
  updateUsername: (name: string) => Promise<UpdateUsernameResult>;
  updateAvatar: (characterId: string) => void;
  onSignOut: () => void;
  initialFase: number;
  initialEstagio: number;
  initialCredits: number;
  initialXp: number;
  ownedCharacters: OwnedCharacter[];
  fragments: FragmentStack[];
  applyBattleXp: (xpByCharacterId: Record<string, number>) => void;
  sellFragment: (characterId: string, rarity: Rarity) => Promise<{ grantedBytes: number; bytes: number } | null>;
  refreshFragments: () => Promise<void>;
  starterBoostClaimed: boolean;
  claimStarterBoost: () => Promise<number | null>;
  tokens: number;
  spendTokens: (amount: number) => Promise<boolean>;
  bytes: number;
  setBytesFromServer: (bytes: number) => void;
  bannerPity: number;
  syncFromGachaResponse: (next: { tokens: number; bannerPity: number; bannerGuaranteed: boolean }) => void;
  characterProgression: ReturnType<typeof useCharacterProgression>;
  teamVisibility: TeamVisibility;
  setTeamVisibility: (value: TeamVisibility) => void;
  vipActive: boolean;
  vipExpiresAt: string | null;
  purchaseVip: () => Promise<boolean>;
  claimDailyVipBonus: () => Promise<boolean>;
  cluster: ReturnType<typeof useCluster>;
  pvp: ReturnType<typeof usePvp>;
  teams: ReturnType<typeof usePlayerTeams>;
  unlockedTeamSlots: number;
  pveTeamSlot: number;
  pvpTeamSlot: number;
  purchaseTeamSlot: () => Promise<boolean>;
  setPveTeamSlot: (slot: number) => void;
  setPvpTeamSlot: (slot: number) => void;
  market: ReturnType<typeof useMarket>;
}

/**
 * Mounted only once the saved progress has loaded, so useBattleSimulation's
 * lazy reducer init reads the real starting point instead of always 1-1/0/0.
 */
function GameShellReady({
  userId,
  username,
  avatarCharacterId,
  updateUsername,
  updateAvatar,
  onSignOut,
  initialFase,
  initialEstagio,
  initialCredits,
  initialXp,
  ownedCharacters,
  fragments,
  applyBattleXp,
  sellFragment,
  refreshFragments,
  starterBoostClaimed,
  claimStarterBoost,
  tokens,
  spendTokens,
  bytes,
  setBytesFromServer,
  bannerPity,
  syncFromGachaResponse,
  characterProgression,
  teamVisibility,
  setTeamVisibility,
  vipActive,
  vipExpiresAt,
  purchaseVip,
  claimDailyVipBonus,
  cluster,
  pvp,
  teams,
  unlockedTeamSlots,
  pveTeamSlot,
  pvpTeamSlot,
  purchaseTeamSlot,
  setPveTeamSlot,
  setPvpTeamSlot,
  market,
}: GameShellReadyProps) {
  const [activeMenuId, setActiveMenuId] = useState('battle');
  const [wikiOpen, setWikiOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  /** The rolled PvP encounter's resolved fight, once pvp.attack has run it. */
  const [encounterBattle, setEncounterBattle] = useState<{ opponentName: string; result: PvpAttackResult } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Roster/abilities/bonuses aren't passed: app/api/battle/resolve reads them from the
  // player's own rows, so the client can't misreport what it fought with or earned.
  const battle = useBattleSimulation({
    initialPosition: { fase: initialFase, estagio: initialEstagio },
    initialCredits,
    initialXp,
  });
  const clusterChatMessages = useMemo<ChatMessage[]>(
    () =>
      cluster.messages.map((m) => ({
        id: m.id,
        tab: 'guild' as const,
        author: m.username,
        text: m.text,
        time: new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      })),
    [cluster.messages],
  );
  const chatMessages = useMemo(() => [...CHAT_MESSAGES, ...battle.logFeed], [battle.logFeed]);

  async function handleUpgradeAbility(characterId: string) {
    const nextCredits = await characterProgression.upgradeAbility(characterId);
    if (nextCredits === null) {
      setToast(characterProgression.error ?? 'Não foi possível melhorar a habilidade.');
      return;
    }
    battle.setWallet(nextCredits, battle.xp);
    setToast('Habilidade melhorada!');
  }

  async function handleUpgradePassive(characterId: string) {
    const nextCredits = await characterProgression.upgradePassive(characterId);
    if (nextCredits === null) {
      setToast(characterProgression.error ?? 'Não foi possível melhorar a passiva.');
      return;
    }
    battle.setWallet(nextCredits, battle.xp);
    setToast('Passiva melhorada!');
  }

  async function handleSellFragment(characterId: string, rarity: Rarity) {
    const result = await sellFragment(characterId, rarity);
    if (result) setBytesFromServer(result.bytes);
    return result;
  }
  // Credits/XP/tokens are real (persisted in Supabase); name is the real username once loaded, falling back to the mock placeholder otherwise.
  // rankTier/rankValue are computed from the real pvp_rating (src/data/pvpRank.ts) instead of PLAYER_STATE's mock values.
  const player = useMemo(
    () => ({
      ...PLAYER_STATE,
      name: username ?? PLAYER_STATE.name,
      rankTier: pvpRankTierFor(pvp.rating).name,
      rankValue: String(pvp.rating),
      credits: battle.credits,
      xp: battle.xp,
      tokens,
      bytes,
    }),
    [username, pvp.rating, battle.credits, battle.xp, tokens, bytes],
  );

  // The server writes progress, the wallet and the fighters' XP when it resolves a battle
  // (lib/battle-resolve.ts), so there is nothing to persist from here any more — the client only
  // mirrors what came back, so the Team page doesn't lag a battle behind. Keyed by character id
  // because only the fielded team earns XP; spreading one number across the roster would show
  // levels the database doesn't have.
  const lastXpByCharacterId = battle.lastXpByCharacterId;
  useEffect(() => {
    applyBattleXp(lastXpByCharacterId);
  }, [lastXpByCharacterId, applyBattleXp]);

  // Random PvP encounters (lib/battle-resolve.ts's rollPvpEncounter): the server decides a run
  // has bumped into another player, and the fight goes through the same authoritative
  // pvp-attack path as the opponent list's Atacar button.
  const encounter = battle.pvpEncounter;
  const clearPvpEncounter = battle.clearPvpEncounter;
  // `pvp` is a fresh object every render, so the effect below re-runs constantly; without this
  // guard a second attack could fire while the first is still in flight, charging the player
  // two rating changes for one encounter.
  const encounterInFlightRef = useRef<string | null>(null);
  useEffect(() => {
    if (!encounter || encounterBattle) return;
    if (encounterInFlightRef.current === encounter.userId) return;
    encounterInFlightRef.current = encounter.userId;
    let cancelled = false;
    (async () => {
      const outcome = await pvp.attack(encounter);
      if (cancelled) return;
      if (!outcome.ok) {
        // Nothing to show — drop the encounter and let the grind carry on.
        setToast(outcome.message);
        encounterInFlightRef.current = null;
        clearPvpEncounter();
        return;
      }
      setEncounterBattle({ opponentName: encounter.username, result: outcome.result });
    })();
    return () => {
      cancelled = true;
    };
  }, [encounter, encounterBattle, pvp, clearPvpEncounter]);

  function handleEncounterContinue() {
    const finished = encounterBattle;
    setEncounterBattle(null);
    encounterInFlightRef.current = null;
    clearPvpEncounter();
    if (!finished) return;
    battle.setWallet(battle.credits + finished.result.rewardCredits, battle.xp);
    setToast(
      finished.result.won
        ? `PvP: vitória contra ${finished.opponentName}! +${finished.result.rewardCredits} créditos, ${finished.result.ratingDelta >= 0 ? '+' : ''}${finished.result.ratingDelta} rating.`
        : `PvP: derrota para ${finished.opponentName}. ${finished.result.ratingDelta >= 0 ? '+' : ''}${finished.result.ratingDelta} rating.`,
    );
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function handleMenuSelect(item: MenuItem) {
    if (item.status === 'soon') {
      setToast(`${item.label} — em breve`);
      return;
    }
    setActiveMenuId(item.id);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden font-body">
      <TopBar
        player={player}
        avatarCharacterId={avatarCharacterId}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenWiki={() => setWikiOpen(true)}
        onOpenNotifications={() => setToast('Notificações — em breve')}
        onOpenSettings={() => setToast('Configurações — em breve')}
        onOpenShop={() => setActiveMenuId('shop')}
        clusterName={cluster.cluster?.name ?? null}
        onOpenCluster={() => setActiveMenuId('guild')}
      />

      <div className="relative flex min-h-0 flex-1">
        <SideMenu items={MENU_ITEMS} activeId={activeMenuId} onSelect={handleMenuSelect} />

        <div className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">
          {activeMenuId === 'team' ? (
            <TeamPage
              userId={userId}
              ownedCharacters={ownedCharacters}
              teams={teams}
              unlockedTeamSlots={unlockedTeamSlots}
              vipActive={vipActive}
              tokens={tokens}
              onPurchaseTeamSlot={purchaseTeamSlot}
              pveTeamSlot={pveTeamSlot}
              pvpTeamSlot={pvpTeamSlot}
              onSetPveTeamSlot={setPveTeamSlot}
              onSetPvpTeamSlot={setPvpTeamSlot}
              pvp={pvp}
              onRewardCredits={battle.adjustCredits}
              onToast={setToast}
              characterProgression={characterProgression}
            />
          ) : activeMenuId === 'characters' ? (
            <CharactersPage ownedCharacters={ownedCharacters} />
          ) : activeMenuId === 'forge' ? (
            <UpgradesPage
              ownedCharacters={ownedCharacters}
              progression={characterProgression.progression}
              credits={battle.credits}
              onUpgradeAbility={handleUpgradeAbility}
              onUpgradePassive={handleUpgradePassive}
            />
          ) : activeMenuId === 'shop' ? (
            <ShopPage
              credits={battle.credits}
              xp={battle.xp}
              tokens={tokens}
              starterBoostClaimed={starterBoostClaimed}
              onClaimStarterBoost={claimStarterBoost}
              onSetWallet={battle.setWallet}
              onNewCharacter={teams.autoAddToTeam1}
              onToast={setToast}
              vipActive={vipActive}
              vipExpiresAt={vipExpiresAt}
              onPurchaseVip={purchaseVip}
              onClaimDailyVipBonus={claimDailyVipBonus}
              inCluster={!!cluster.cluster}
            />
          ) : activeMenuId === 'summon' ? (
            <GachaPage
              credits={battle.credits}
              tokens={tokens}
              xp={battle.xp}
              ownedCharacters={ownedCharacters}
              onToast={setToast}
              bannerPity={bannerPity}
              onSetWallet={battle.setWallet}
              onSyncGachaState={syncFromGachaResponse}
              onNewCharacter={teams.autoAddToTeam1}
            />
          ) : activeMenuId === 'guild' ? (
            <ClusterPage userId={userId} cluster={cluster} bandwidth={0} onToast={setToast} />
          ) : activeMenuId === 'market' ? (
            <MarketPage
              market={market}
              fragments={fragments}
              vipActive={vipActive}
              credits={battle.credits}
              xp={battle.xp}
              bytes={bytes}
              onSetWallet={battle.setWallet}
              onSellFragment={handleSellFragment}
              onRefreshFragments={refreshFragments}
              onToast={setToast}
            />
          ) : (
            <BattleStage
              allies={battle.allies}
              enemies={battle.enemies}
              stage={battle.stage}
              playing={battle.playing}
              onSetPlaying={battle.setPlaying}
              finished={battle.finished}
              winner={battle.winner}
              lastReward={battle.lastReward}
              onNextBattle={battle.startNewBattle}
              floaters={battle.floaters}
              activeAbilities={battle.activeAbilities}
              attackAnims={battle.attackAnims}
              error={battle.error}
              onRetry={battle.retryBattle}
              loading={battle.loading}
            />
          )}
        </div>

        <div className="lg:flex lg:w-72 lg:min-h-0 lg:shrink-0 lg:flex-col">
          <StagePanel
            stage={battle.stage}
            frontierFase={battle.frontierFase}
            frontierEstagio={battle.frontierEstagio}
            mode={battle.mode}
            retreatOnLoss={battle.retreatOnLoss}
            onToggleRetreatOnLoss={() => battle.setRetreatOnLoss(!battle.retreatOnLoss)}
            recoveryWinsRemaining={battle.recoveryWinsRemaining}
            open={stageOpen}
            onClose={() => setStageOpen(false)}
            onAdvance={battle.startNewBattle}
            onRepeat={battle.repeatBattle}
            onSelectStage={battle.playStage}
            onOpenMap={() => setMapOpen(true)}
          />
          <ChatPanel
            messages={chatMessages}
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            clusterMessages={clusterChatMessages}
            inCluster={!!cluster.cluster}
            onSendClusterMessage={cluster.sendMessage}
          />
        </div>

        {/* floating handles (mobile + collapsed-desktop convenience) */}
        {!stageOpen && (
          <button
            onClick={() => setStageOpen(true)}
            className="fixed right-2 top-[4.25rem] z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-code-500/30 bg-void-900/90 text-code-400 backdrop-blur-md lg:hidden"
          >
            <Icon name="map" size={16} />
          </button>
        )}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-20 right-2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-code-500/40 bg-void-900/90 text-code-400 shadow-lg backdrop-blur-md lg:hidden"
          >
            <Icon name="terminal" size={18} />
          </button>
        )}
      </div>

      {wikiOpen && <WikiModal onClose={() => setWikiOpen(false)} />}
      {profileOpen && (
        <ProfileModal
          onClose={() => setProfileOpen(false)}
          onSignOut={onSignOut}
          username={username}
          avatarCharacterId={avatarCharacterId}
          onUpdateAvatar={updateAvatar}
          onUpdateUsername={updateUsername}
          tokens={tokens}
          onSpendTokens={spendTokens}
          ownedCharacters={ownedCharacters}
          frontierFase={battle.frontierFase}
          teamVisibility={teamVisibility}
          onChangeTeamVisibility={setTeamVisibility}
          rankTier={player.rankTier}
          rankValue={player.rankValue}
          clusterName={cluster.cluster?.name ?? null}
          pvpRating={pvp.rating}
          pvpPeakRating={pvp.peakRating}
          pvpWins={pvp.wins}
          pvpLosses={pvp.losses}
          pvpDefenseTeam={pvp.defenseTeam}
        />
      )}
      {mapOpen && (
        <WorldMapModal
          current={{ fase: battle.stage.phase, estagio: battle.stage.stage }}
          frontier={{ fase: battle.frontierFase, estagio: battle.frontierEstagio }}
          onSelect={battle.playPosition}
          onClose={() => setMapOpen(false)}
        />
      )}
      {encounterBattle && (
        <PvpBattlePlayer
          key={encounterBattle.opponentName + encounterBattle.result.newRating}
          opponentName={encounterBattle.opponentName}
          result={encounterBattle.result}
          onContinue={handleEncounterContinue}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}
