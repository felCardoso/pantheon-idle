import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface ModalProps {
  title: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, icon, onClose, children }: ModalProps) {
  useEscapeToClose(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full max-h-[42rem] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-code-500/25 bg-void-900 shadow-[0_0_60px_-10px_rgba(57,255,156,0.25)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-code-500/70 to-transparent" />

        <header className="flex shrink-0 items-center justify-between border-b border-void-600 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            {icon && <Icon name={icon} size={18} className="text-code-400" />}
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">
              {title}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 transition hover:bg-void-700 hover:text-white">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
