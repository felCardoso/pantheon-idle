import { useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './layout/TopBar';
import { SideMenu } from './layout/SideMenu';
import { StagePanel } from './layout/StagePanel';
import { ChatPanel } from './layout/ChatPanel';
import { BattleStage } from './battle/BattleStage';
import { TeamPage } from './roster/TeamPage';
import { CharactersPage } from './roster/CharactersPage';
import { OnboardingScreen } from './onboarding/OnboardingScreen';
import { WikiModal } from './wiki/WikiModal';
import { Toast } from './common/Toast';
import { Splash } from './common/Splash';
import { Icon } from './common/Icon';
import { PLAYER_STATE } from '../data/mock/player';
import { MENU_ITEMS } from '../data/mock/menu';
import { CHAT_MESSAGES } from '../data/mock/chat';
import { useBattleSimulation } from '../hooks/useBattleSimulation';
import { usePlayerProgress } from '../hooks/usePlayerProgress';
import { useOwnedCharacters, type OwnedCharacter } from '../hooks/useOwnedCharacters';
import type { MenuItem } from '../types';

interface GameShellProps {
  userId: string;
  userEmail: string;
  onSignOut: () => void;
}

export function GameShell({ userId, userEmail, onSignOut }: GameShellProps) {
  const { progress, loading: progressLoading, saveProgress } = usePlayerProgress(userId);
  const { ownedCharacters, loading: ownedLoading, claimStarter, addXp } = useOwnedCharacters(userId);

  if (progressLoading || !progress || ownedLoading || !ownedCharacters) return <Splash />;

  if (ownedCharacters.length === 0) {
    return <OnboardingScreen onSelect={claimStarter} />;
  }

  return (
    <GameShellReady
      userEmail={userEmail}
      onSignOut={onSignOut}
      initialFase={progress.fase}
      initialEstagio={progress.estagio}
      initialCredits={progress.credits}
      initialXp={progress.xp}
      ownedCharacters={ownedCharacters}
      addXp={addXp}
      saveProgress={saveProgress}
    />
  );
}

interface GameShellReadyProps {
  userEmail: string;
  onSignOut: () => void;
  initialFase: number;
  initialEstagio: number;
  initialCredits: number;
  initialXp: number;
  ownedCharacters: OwnedCharacter[];
  addXp: (amount: number) => void;
  saveProgress: (next: { fase: number; estagio: number; credits: number; xp: number }) => void;
}

/**
 * Mounted only once the saved progress has loaded, so useBattleSimulation's
 * lazy reducer init reads the real starting point instead of always 1-1/0/0.
 */
function GameShellReady({
  userEmail,
  onSignOut,
  initialFase,
  initialEstagio,
  initialCredits,
  initialXp,
  ownedCharacters,
  addXp,
  saveProgress,
}: GameShellReadyProps) {
  const [activeMenuId, setActiveMenuId] = useState('battle');
  const [wikiOpen, setWikiOpen] = useState(false);
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
  // Credits/XP are now real (persisted in Supabase) — no more mock baseline stacked on top.
  const player = useMemo(() => ({ ...PLAYER_STATE, credits: battle.credits, xp: battle.xp }), [battle.credits, battle.xp]);

  const hasMounted = useRef(false);
  const prevBattleXpRef = useRef(initialXp);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevBattleXpRef.current = battle.xp;
      return;
    }
    saveProgress({ fase: battle.stage.phase, estagio: battle.stage.stage, credits: battle.credits, xp: battle.xp });
    // Every owned character fights together, so whatever XP the battle just paid out also levels them up.
    const gained = battle.xp - prevBattleXpRef.current;
    prevBattleXpRef.current = battle.xp;
    if (gained > 0) addXp(gained);
  }, [battle.stage.phase, battle.stage.stage, battle.credits, battle.xp, saveProgress, addXp]);

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
        userEmail={userEmail}
        onSignOut={onSignOut}
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
          ) : (
            <BattleStage
              allies={battle.allies}
              enemies={battle.enemies}
              stage={battle.stage}
              playing={battle.playing}
              onSetPlaying={battle.setPlaying}
              finished={battle.finished}
              winner={battle.winner}
              onNextBattle={battle.startNewBattle}
              floaters={battle.floaters}
            />
          )}
        </div>

        <div className="lg:flex lg:w-72 lg:min-h-0 lg:shrink-0 lg:flex-col">
          <StagePanel
            stage={battle.stage}
            open={stageOpen}
            onClose={() => setStageOpen(false)}
            onAdvance={battle.startNewBattle}
            onRepeat={battle.repeatBattle}
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
      <Toast message={toast} />
    </div>
  );
}
