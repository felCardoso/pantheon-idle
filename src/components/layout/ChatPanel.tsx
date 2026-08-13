import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../common/Icon';
import type { ChatMessage, ChatTabId } from '../../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  open: boolean;
  onClose: () => void;
}

const TABS: { id: ChatTabId; label: string; icon: string }[] = [
  { id: 'global', label: 'Global', icon: 'globe' },
  { id: 'guild', label: 'Guilda', icon: 'shield' },
  { id: 'anuncios', label: 'Anúncios', icon: 'megaphone' },
  { id: 'log', label: 'Log', icon: 'terminal' },
];

const TONE_CLASS: Record<NonNullable<ChatMessage['tone']>, string> = {
  default: 'text-white/80',
  success: 'text-code-400',
  danger: 'text-signal-red',
  system: 'text-arcane-300',
};

export function ChatPanel({ messages, open, onClose }: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState<ChatTabId>('log');
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  const allMessages = useMemo(() => [...messages, ...localMessages], [messages, localMessages]);
  const filtered = allMessages.filter((m) => m.tab === activeTab);
  const canPost = activeTab === 'global' || activeTab === 'guild';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !canPost) return;
    setLocalMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        tab: activeTab,
        author: 'Você',
        text: draft.trim(),
        time: 'agora',
      },
    ]);
    setDraft('');
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />}

      <section
        className={`
          fixed inset-x-2 bottom-[4.5rem] z-30 flex h-[60vh] flex-col overflow-hidden rounded-xl border border-code-500/25
          bg-void-900/95 backdrop-blur-md transition-transform duration-300
          lg:static lg:inset-auto lg:h-auto lg:min-h-0 lg:flex-1 lg:translate-y-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:border-code-500/20 lg:bg-void-900/60 lg:backdrop-blur-none
          ${open ? 'translate-y-0' : 'translate-y-[120%] lg:translate-y-0'}
        `}
      >
        <div className="flex shrink-0 items-center border-b border-void-600">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition ${
                activeTab === tab.id ? 'text-code-300' : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Icon name={tab.icon} size={13} />
              <span className="hidden sm:inline">{tab.label}</span>
              {activeTab === tab.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-code-400" />}
            </button>
          ))}
          <button onClick={onClose} className="p-2.5 text-white/40 hover:text-white lg:hidden">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2 font-mono text-xs">
          {filtered.length === 0 && <p className="pt-4 text-center text-white/30">Nada por aqui ainda.</p>}
          {filtered.map((m) => (
            <p key={m.id} className={TONE_CLASS[m.tone ?? 'default']}>
              <span className="text-white/30">[{m.time}]</span>{' '}
              {m.author && <span className="font-semibold text-arcane-300">{m.author}: </span>}
              <span>{m.text}</span>
            </p>
          ))}
        </div>

        {canPost && (
          <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2 border-t border-void-600 p-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Mensagem no ${activeTab === 'global' ? 'Global' : 'chat da guilda'}...`}
              className="min-w-0 flex-1 rounded-md border border-void-600 bg-void-800 px-2.5 py-1.5 font-mono text-xs text-white/90 placeholder:text-white/30 focus:border-code-500/60 focus:outline-none"
            />
            <button
              type="submit"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-code-500 text-void-950 transition hover:bg-code-400"
            >
              <Icon name="send" size={14} />
            </button>
          </form>
        )}
      </section>
    </>
  );
}
