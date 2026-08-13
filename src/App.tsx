import { useEffect, useState } from 'react';
import { TopBar } from './components/layout/TopBar';
import { SideMenu } from './components/layout/SideMenu';
import { StagePanel } from './components/layout/StagePanel';
import { ChatPanel } from './components/layout/ChatPanel';
import { BattleStage } from './components/battle/BattleStage';
import { WikiModal } from './components/wiki/WikiModal';
import { Toast } from './components/common/Toast';
import { Icon } from './components/common/Icon';
import { ALLY_UNITS, ENEMY_UNITS } from './data/mock/units';
import { PLAYER_STATE, STAGE_INFO } from './data/mock/player';
import { MENU_ITEMS } from './data/mock/menu';
import { CHAT_MESSAGES } from './data/mock/chat';
import type { MenuItem } from './types';

export default function App() {
  const [activeMenuId, setActiveMenuId] = useState('battle');
  const [wikiOpen, setWikiOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
        player={PLAYER_STATE}
        onOpenWiki={() => setWikiOpen(true)}
        onOpenProfile={() => setToast('Perfil — em breve')}
        onOpenNotifications={() => setToast('Notificações — em breve')}
        onOpenSettings={() => setToast('Configurações — em breve')}
      />

      <div className="relative flex min-h-0 flex-1">
        <SideMenu items={MENU_ITEMS} activeId={activeMenuId} onSelect={handleMenuSelect} />

        <div className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">
          <BattleStage allies={ALLY_UNITS} enemies={ENEMY_UNITS} stage={STAGE_INFO} />
        </div>

        <div className="lg:flex lg:w-72 lg:min-h-0 lg:shrink-0 lg:flex-col">
          <StagePanel stage={STAGE_INFO} open={stageOpen} onClose={() => setStageOpen(false)} />
          <ChatPanel messages={CHAT_MESSAGES} open={chatOpen} onClose={() => setChatOpen(false)} />
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
