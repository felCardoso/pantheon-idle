import { Icon } from '../common/Icon';
import { AvatarCrop } from '../profile/AvatarCrop';
import { DISPLAY_PORTRAIT_BY_TEMPLATE_ID } from '../../data/engineDisplay';
import type { PlayerState } from '../../types';

interface TopBarProps {
  player: PlayerState;
  avatarCharacterId: string | null;
  onOpenProfile: () => void;
  onOpenWiki: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  /** Credits/tokens badges are shortcuts into the Loja — where both currencies actually get spent. */
  onOpenShop: () => void;
  /** Real Cluster name, or null if the player hasn't joined one yet. */
  clusterName: string | null;
  onOpenCluster: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${n}`;
}

export function TopBar({
  player,
  avatarCharacterId,
  onOpenProfile,
  onOpenWiki,
  onOpenNotifications,
  onOpenSettings,
  onOpenShop,
  clusterName,
  onOpenCluster,
}: TopBarProps) {
  const avatarPortraitUrl = avatarCharacterId ? DISPLAY_PORTRAIT_BY_TEMPLATE_ID[avatarCharacterId] : undefined;

  return (
    <header className="relative z-40 flex h-14 items-center gap-2 border-b border-code-500/20 bg-void-900/90 px-2 backdrop-blur-md sm:h-16 sm:gap-3 sm:px-4">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-code-500/70 to-transparent" />

      {/* Rank */}
      <button className="flex shrink-0 items-center gap-1.5 rounded-lg border border-arcane-500/30 bg-arcane-900/40 px-2 py-1.5 transition hover:border-arcane-400/60 sm:gap-2 sm:px-3">
        <Icon name="crown" size={16} className="text-arcane-300" />
        <div className="hidden flex-col items-start leading-none sm:flex">
          <span className="font-display text-[10px] uppercase tracking-wide text-arcane-300">{player.rankTier}</span>
          <span className="font-mono text-xs text-white/80">{player.rankValue}</span>
        </div>
      </button>

      {/* Cluster */}
      <button
        onClick={onOpenCluster}
        title={clusterName ? 'Ver Cluster' : 'Entrar em um Cluster'}
        className="hidden shrink-0 items-center gap-2 rounded-lg border border-code-500/25 bg-void-800/60 px-3 py-1.5 transition hover:border-code-400/60 md:flex"
      >
        <Icon name="shield" size={16} className="text-code-400" />
        <span className="max-w-[9rem] truncate text-xs text-white/70">{clusterName ?? 'Sem Cluster'}</span>
      </button>

      {/* Buffs */}
      <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto lg:flex">
        {player.buffs.map((buff) => (
          <div
            key={buff.id}
            title={buff.label}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-signal-amber/30 bg-signal-amber/10 px-2.5 py-1"
          >
            <Icon name={buff.icon} size={13} className="text-signal-amber" />
            <span className="font-mono text-[11px] text-signal-amber/90">{buff.remaining}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 lg:hidden" />

      {/* Currencies */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          key={player.credits}
          onClick={onOpenShop}
          title="Ir para a Loja"
          className="flex items-center gap-1.5 rounded-lg border border-signal-amber/25 bg-void-800/60 px-2 py-1.5 transition hover:border-signal-amber/60 hover:bg-void-700 sm:px-3 animate-pulse-once"
        >
          <Icon name="coins" size={15} className="text-signal-amber" />
          <span className="font-mono text-xs text-white/85 sm:text-sm">{formatNumber(player.credits)}</span>
        </button>
        <div
          key={player.xp}
          className="hidden items-center gap-1.5 rounded-lg border border-arcane-400/25 bg-void-800/60 px-2 py-1.5 sm:flex sm:px-3 animate-pulse-once"
        >
          <Icon name="star" size={15} className="text-arcane-300" />
          <span className="font-mono text-xs text-white/85 sm:text-sm">{formatNumber(player.xp)}</span>
        </div>
        <button
          onClick={onOpenShop}
          title="Ir para a Loja"
          className="hidden items-center gap-1.5 rounded-lg border border-signal-cyan/25 bg-void-800/60 px-2 py-1.5 transition hover:border-signal-cyan/60 hover:bg-void-700 sm:flex sm:px-3"
        >
          <Icon name="gem" size={15} className="text-signal-cyan" />
          <span className="font-mono text-xs text-white/85 sm:text-sm">{formatNumber(player.tokens)}</span>
        </button>
      </div>

      <div className="hidden h-6 w-px bg-void-600 sm:block" />

      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <button
          onClick={onOpenWiki}
          title="Wiki"
          className="rounded-lg p-2 text-white/60 transition hover:bg-void-700 hover:text-code-400"
        >
          <Icon name="book-open" size={18} />
        </button>
        <button
          onClick={onOpenNotifications}
          title="Notificações"
          className="relative rounded-lg p-2 text-white/60 transition hover:bg-void-700 hover:text-code-400"
        >
          <Icon name="bell" size={18} />
          {player.notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-signal-red text-[9px] font-bold text-white">
              {player.notificationCount}
            </span>
          )}
        </button>
        <button
          onClick={onOpenSettings}
          title="Configurações"
          className="hidden rounded-lg p-2 text-white/60 transition hover:bg-void-700 hover:text-code-400 sm:block"
        >
          <Icon name="settings" size={18} />
        </button>
        <button
          onClick={onOpenProfile}
          title="Perfil"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-code-500/40 bg-code-900/60 text-code-300 transition hover:border-code-400"
        >
          {avatarCharacterId && avatarPortraitUrl ? (
            <AvatarCrop templateId={avatarCharacterId} portraitUrl={avatarPortraitUrl} alt={player.name} size={30} />
          ) : (
            <Icon name="user" size={16} />
          )}
        </button>
      </div>
    </header>
  );
}
