import { Icon } from '../common/Icon';
import type { MenuItem } from '../../types';

interface SideMenuProps {
  items: MenuItem[];
  activeId: string;
  onSelect: (item: MenuItem) => void;
}

export function SideMenu({ items, activeId, onSelect }: SideMenuProps) {
  return (
    <nav
      className="
        fixed inset-x-0 bottom-0 z-30 flex h-16 shrink-0 items-stretch gap-0.5 overflow-x-auto
        border-t border-code-500/20 bg-void-900/95 px-1 backdrop-blur-md
        lg:static lg:h-auto lg:w-24 lg:flex-col lg:gap-1 lg:overflow-visible lg:border-r lg:border-t-0 lg:bg-void-900/70 lg:px-2 lg:py-4
      "
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        const isLocked = item.status === 'soon';
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            title={isLocked ? `${item.label} — em breve` : item.label}
            className={`
              group relative flex min-w-[3.75rem] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 transition
              lg:min-w-0 lg:flex-none lg:py-3
              ${isActive ? 'bg-code-500/10 text-code-300' : 'text-white/50 hover:bg-void-700/60 hover:text-white/80'}
              ${isLocked ? 'opacity-50' : ''}
            `}
          >
            {isActive && (
              <span className="absolute inset-y-1 left-0 hidden w-0.5 rounded-full bg-code-400 shadow-[0_0_8px_var(--color-code-400)] lg:block" />
            )}
            <div className="relative">
              <Icon name={item.icon} size={20} strokeWidth={isActive ? 2.4 : 2} />
              {isLocked && (
                <span className="absolute -bottom-1 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-void-800 ring-1 ring-void-600">
                  <Icon name="lock" size={8} className="text-white/60" />
                </span>
              )}
            </div>
            <span className="font-display text-[9px] uppercase tracking-wide leading-none sm:text-[10px]">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
