import { useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './layout/TopBar';
import { SideMenu } from './layout/SideMenu';
import { StagePanel } from './layout/StagePanel';
import { ChatPanel } from './layout/ChatPanel';
import { BattleStage } from './battle/BattleStage';
import { TeamPage } from './roster/TeamPage';
import { CharactersPage } from './roster/CharactersPage';
import { ShopPage } from './shop/ShopPage';
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
import { usePlayerProgress, type TeamVisibility } from '../hooks/usePlayerProgress';
import { useOwnedCharacters, type OwnedCharacter } from '../hooks/useOwnedCharacters';
import { useProfile, type UpdateUsernameResult } from '../hooks/useProfile';
import type { MenuItem } from '../types';

interface GameShellProps {
  userId: string;
  onSignOut: () => void;
}

export function GameShell({ userId, onSignOut }: GameShellProps) {
  const {
    progress,
    starterBoostClaimed,
    tokens,
    teamVisibility,
    loading: progressLoading,
    saveProgress,
    claimStarterBoost,
    spendTokens,
    setTeamVisibility,
  } = usePlayerProgress(userId);
  const { ownedCharacters, fragments, loading: ownedLoading, claimStarter, addXp, acquireCharacter, sellFragment } =
    useOwnedCharacters(userId);
  const { username, avatarCharacterId, loading: profileLoading, updateUsername, updateAvatar } = useProfile(userId);

  if (progressLoading || !progress || ownedLoading || !ownedCharacters) return <Splash />;

  if (ownedCharacters.length === 0) {
    return <OnboardingScreen onSelect={claimStarter} />;
  }

  return (
    <GameShellReady
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
      addXp={addXp}
      acquireCharacter={acquireCharacter}
      sellFragment={sellFragment}
      saveProgress={saveProgress}
      starterBoostClaimed={starterBoostClaimed}
      claimStarterBoost={claimStarterBoost}
      tokens={tokens}
      spendTokens={spendTokens}
      teamVisibility={teamVisibility}
      setTeamVisibility={setTeamVisibility}
    />
  );
}

interface GameShellReadyProps {
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
  fragments: Record<string, number>;
  addXp: (amount: number) => void;
  acquireCharacter: (characterId: string) => Promise<'new' | 'duplicate'>;
  sellFragment: (characterId: string) => void;
  saveProgress: (next: { fase: number; estagio: number; credits: number; xp: number }) => void;
  starterBoostClaimed: boolean;
  claimStarterBoost: () => void;
  tokens: number;
  spendTokens: (amount: number) => Promise<boolean>;
  teamVisibility: TeamVisibility;
  setTeamVisibility: (value: TeamVisibility) => void;
}

/**
 * Mounted only once the saved progress has loaded, so useBattleSimulation's
 * lazy reducer init reads the real starting point instead of always 1-1/0/0.
 */
function GameShellReady({
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
  addXp,
  acquireCharacter,
  sellFragment,
  saveProgress,
  starterBoostClaimed,
  claimStarterBoost,
  tokens,
  spendTokens,
  teamVisibility,
  setTeamVisibility,
}: GameShellReadyProps) {
  const [activeMenuId, setActiveMenuId] = useState('battle');
  const [wikiOpen, setWikiOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const battle = useBattleSimulation({
    initialOwnedCharacters: ownedCharacters,
    initialPosition: { fase: initialFase, estagio: initialEstagio },
    initialCredits,
    initialXp,
  });
  const chatMessages = useMemo(() => [...CHAT_MESSAGES, ...battle.logFeed], [battle.logFeed]);
  // Credits/XP/tokens are real (persisted in Supabase); name is the real username once loaded, falling back to the mock placeholder otherwise.
  const player = useMemo(
    () => ({ ...PLAYER_STATE, name: username ?? PLAYER_STATE.name, credits: battle.credits, xp: battle.xp, tokens }),
    [username, battle.credits, battle.xp, tokens],
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
      />

      <div className="relative flex min-h-0 flex-1">
        <SideMenu items={MENU_ITEMS} activeId={activeMenuId} onSelect={handleMenuSelect} />

        <div className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">
          {activeMenuId === 'team' ? (
            <TeamPage ownedCharacters={ownedCharacters} />
          ) : activeMenuId === 'characters' ? (
            <CharactersPage ownedIds={ownedCharacters.map((c) => c.characterId)} />
          ) : activeMenuId === 'shop' ? (
            <ShopPage
              credits={battle.credits}
              starterBoostClaimed={starterBoostClaimed}
              fragments={fragments}
              onClaimStarterBoost={claimStarterBoost}
              onAcquireCharacter={acquireCharacter}
              onSellFragment={sellFragment}
              onAdjustCredits={battle.adjustCredits}
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
          <ChatPanel messages={chatMessages} open={chatOpen} onClose={() => setChatOpen(false)} />
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
          guildName={player.guildName}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}
