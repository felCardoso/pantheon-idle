import { useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './layout/TopBar';
import { SideMenu } from './layout/SideMenu';
import { StagePanel } from './layout/StagePanel';
import { ChatPanel } from './layout/ChatPanel';
import { BattleStage } from './battle/BattleStage';
import { TeamPage } from './roster/TeamPage';
import { CharactersPage } from './roster/CharactersPage';
import { ShopPage } from './shop/ShopPage';
import { GachaPage } from './gacha/GachaPage';
import { ClusterPage } from './cluster/ClusterPage';
import { MarketPage } from './market/MarketPage';
import { ProfileModal } from './profile/ProfileModal';
import { OnboardingScreen } from './onboarding/OnboardingScreen';
import { WikiModal } from './wiki/WikiModal';
import { Toast } from './common/Toast';
import { Splash } from './common/Splash';
import { Icon } from './common/Icon';
import { PLAYER_STATE } from '../data/mock/player';
import { MENU_ITEMS } from '../data/mock/menu';
import { CHAT_MESSAGES } from '../data/mock/chat';
import { useBattleSimulation } from '../hooks/useBattleSimulation';
import {
  CLUSTER_CREDIT_XP_BONUS_PERCENT,
  usePlayerProgress,
  VIP_CREDIT_XP_BONUS_PERCENT,
  type TeamVisibility,
} from '../hooks/usePlayerProgress';
import { useOwnedCharacters, type OwnedCharacter } from '../hooks/useOwnedCharacters';
import { usePlayerTeams } from '../hooks/usePlayerTeams';
import { useProfile, type UpdateUsernameResult } from '../hooks/useProfile';
import { useCluster } from '../hooks/useCluster';
import { usePvp } from '../hooks/usePvp';
import { useMarket } from '../hooks/useMarket';
import type { ChatMessage, MenuItem } from '../types';

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
    loading: progressLoading,
    saveProgress,
    claimStarterBoost,
    spendTokens,
    adjustBytes,
    setTeamVisibility,
    purchaseVip,
    claimDailyVipBonus,
    purchaseTeamSlot,
    setPveTeamSlot,
    setPvpTeamSlot,
  } = usePlayerProgress(userId);
  const { ownedCharacters, fragments, loading: ownedLoading, claimStarter, addXp, acquireCharacter, sellFragment, refreshFragments } =
    useOwnedCharacters(userId);
  const { username, avatarCharacterId, loading: profileLoading, updateUsername, updateAvatar } = useProfile(userId);
  const cluster = useCluster(userId);
  const pvp = usePvp(userId);
  const teams = usePlayerTeams(userId);
  const market = useMarket(userId);

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

  const bonusMultiplier = 1 + (vipActive ? VIP_CREDIT_XP_BONUS_PERCENT : 0) + (cluster.cluster ? CLUSTER_CREDIT_XP_BONUS_PERCENT : 0);

  async function handleAcquireCharacter(characterId: string): Promise<'new' | 'duplicate'> {
    const outcome = await acquireCharacter(characterId);
    if (outcome === 'new') await teams.autoAddToTeam1(characterId);
    return outcome;
  }

  const pveTeam = teams.teams.find((t) => t.slot === pveTeamSlot);
  const pveOwnedIds = new Set(pveTeam?.characterIds ?? []);
  const pveResolvedCharacters = ownedCharacters.filter((c) => pveOwnedIds.has(c.characterId));
  // Defensive fallback — battles always need at least 1 character (useBattleSimulation has "no
  // fallback team"); this can only be empty during the brief window before a fresh account's
  // teams finish initializing.
  const pveCharacters = pveResolvedCharacters.length > 0 ? pveResolvedCharacters : ownedCharacters.slice(0, 5);

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
      pveCharacters={pveCharacters}
      fragments={fragments}
      addXp={addXp}
      acquireCharacter={handleAcquireCharacter}
      sellFragment={sellFragment}
      refreshFragments={refreshFragments}
      saveProgress={saveProgress}
      starterBoostClaimed={starterBoostClaimed}
      claimStarterBoost={claimStarterBoost}
      tokens={tokens}
      spendTokens={spendTokens}
      bytes={bytes}
      adjustBytes={adjustBytes}
      teamVisibility={teamVisibility}
      setTeamVisibility={setTeamVisibility}
      vipActive={vipActive}
      vipExpiresAt={vipExpiresAt}
      purchaseVip={purchaseVip}
      claimDailyVipBonus={claimDailyVipBonus}
      bonusMultiplier={bonusMultiplier}
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
  /** Just the currently-selected PvE team's members (see GameShell's pveCharacters), what actually fights. */
  pveCharacters: OwnedCharacter[];
  fragments: Record<string, number>;
  addXp: (amount: number) => void;
  acquireCharacter: (characterId: string) => Promise<'new' | 'duplicate'>;
  sellFragment: (characterId: string) => void;
  refreshFragments: () => Promise<void>;
  saveProgress: (next: { fase: number; estagio: number; credits: number; xp: number }) => void;
  starterBoostClaimed: boolean;
  claimStarterBoost: () => void;
  tokens: number;
  spendTokens: (amount: number) => Promise<boolean>;
  bytes: number;
  adjustBytes: (delta: number) => Promise<boolean>;
  teamVisibility: TeamVisibility;
  setTeamVisibility: (value: TeamVisibility) => void;
  vipActive: boolean;
  vipExpiresAt: string | null;
  purchaseVip: () => Promise<boolean>;
  claimDailyVipBonus: () => Promise<boolean>;
  bonusMultiplier: number;
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
  pveCharacters,
  fragments,
  addXp,
  acquireCharacter,
  sellFragment,
  refreshFragments,
  saveProgress,
  starterBoostClaimed,
  claimStarterBoost,
  tokens,
  spendTokens,
  bytes,
  adjustBytes,
  teamVisibility,
  setTeamVisibility,
  vipActive,
  vipExpiresAt,
  purchaseVip,
  claimDailyVipBonus,
  bonusMultiplier,
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
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const battle = useBattleSimulation({
    initialOwnedCharacters: pveCharacters,
    initialPosition: { fase: initialFase, estagio: initialEstagio },
    initialCredits,
    initialXp,
    bonusMultiplier,
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
  // Credits/XP/tokens are real (persisted in Supabase); name is the real username once loaded, falling back to the mock placeholder otherwise.
  const player = useMemo(
    () => ({ ...PLAYER_STATE, name: username ?? PLAYER_STATE.name, credits: battle.credits, xp: battle.xp, tokens, bytes }),
    [username, battle.credits, battle.xp, tokens, bytes],
  );

  const hasMounted = useRef(false);
  const prevBattleXpRef = useRef(initialXp);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevBattleXpRef.current = battle.xp;
      return;
    }
    // frontierFase/frontierEstagio (not battle.stage.phase/stage) is the player's real saved
    // position — replaying an earlier estágio via the mini-map moves the live-viewed stage
    // without ever regressing this.
    saveProgress({ fase: battle.frontierFase, estagio: battle.frontierEstagio, credits: battle.credits, xp: battle.xp });
    // Every owned character fights together, so whatever XP the battle just paid out also levels them up.
    const gained = battle.xp - prevBattleXpRef.current;
    prevBattleXpRef.current = battle.xp;
    if (gained > 0) addXp(gained);
  }, [battle.frontierFase, battle.frontierEstagio, battle.credits, battle.xp, saveProgress, addXp]);

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
            />
          ) : activeMenuId === 'characters' ? (
            <CharactersPage ownedCharacters={ownedCharacters} />
          ) : activeMenuId === 'shop' ? (
            <ShopPage
              credits={battle.credits}
              tokens={tokens}
              starterBoostClaimed={starterBoostClaimed}
              onClaimStarterBoost={claimStarterBoost}
              onAcquireCharacter={acquireCharacter}
              onAdjustCredits={battle.adjustCredits}
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
              ownedCharacters={ownedCharacters}
              onAcquireCharacter={acquireCharacter}
              onAdjustCredits={battle.adjustCredits}
              onSpendTokens={spendTokens}
              onToast={setToast}
            />
          ) : activeMenuId === 'guild' ? (
            <ClusterPage userId={userId} cluster={cluster} bandwidth={0} onToast={setToast} />
          ) : activeMenuId === 'market' ? (
            <MarketPage
              market={market}
              fragments={fragments}
              vipActive={vipActive}
              credits={battle.credits}
              bytes={bytes}
              onAdjustCredits={battle.adjustCredits}
              onAdjustBytes={adjustBytes}
              onSellFragment={sellFragment}
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
          pvpWins={pvp.wins}
          pvpLosses={pvp.losses}
          pvpDefenseTeam={pvp.defenseTeam}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}
