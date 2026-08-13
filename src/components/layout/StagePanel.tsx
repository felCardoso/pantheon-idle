import { useState } from 'react';
import { Icon } from '../common/Icon';
import type { StageInfo } from '../../types';

interface StagePanelProps {
  stage: StageInfo;
  open: boolean;
  onClose: () => void;
  onAdvance: () => void;
  onRepeat: () => void;
}

export function StagePanel({ stage, open, onClose, onAdvance, onRepeat }: StagePanelProps) {
  const [retreatOnLoss, setRetreatOnLoss] = useState(true);

  return (
    <>
      {/* mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`
          fixed right-0 top-14 z-30 flex h-[calc(100%-3.5rem-4rem)] w-72 max-w-[85vw] flex-col gap-3
          border-l border-code-500/20 bg-void-900/95 p-3 backdrop-blur-md transition-transform duration-300
          sm:top-16 sm:h-[calc(100%-4rem-4rem)]
          lg:static lg:top-0 lg:h-auto lg:shrink-0 lg:w-72 lg:max-w-none lg:translate-x-0 lg:bg-void-900/60 lg:backdrop-blur-none
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code">
              {stage.worldName}
            </p>
            <p className="text-xs text-white/50">{stage.worldSubtitle}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/40 transition hover:bg-void-700 hover:text-white">
            <Icon name="chevron-right" size={16} />
          </button>
        </div>

        <div className={`rounded-lg border px-3 py-2 ${stage.isBoss ? 'border-signal-red/40 bg-signal-red/10' : 'border-void-600 bg-void-800/60'}`}>
          <div className="flex items-center justify-between text-xs">
            <span className={stage.isBoss ? 'font-bold text-signal-red' : 'text-white/50'}>
              Fase {stage.phase} · {stage.isBoss ? 'Chefe de Mundo' : `Estágio ${stage.stage}/${stage.totalStages}`}
            </span>
            <span className="font-mono text-code-400">
              Round {stage.round} · T{stage.turn}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const nodeStage = stage.stage - ((stage.stage - 1) % 5) + i;
              const isDone = nodeStage < stage.stage;
              const isCurrent = nodeStage === stage.stage;
              return (
                <div key={i} className="flex flex-1 items-center gap-1.5">
                  <div
                    className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                      isCurrent
                        ? 'border-arcane-400 bg-arcane-400 shadow-[0_0_8px_var(--color-arcane-400)]'
                        : isDone
                          ? 'border-code-500 bg-code-500'
                          : 'border-void-500 bg-void-700'
                    }`}
                  />
                  {i < 4 && <div className={`h-px flex-1 ${isDone ? 'bg-code-500/60' : 'bg-void-600'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onAdvance}
            className="flex items-center justify-center gap-2 rounded-lg bg-code-500 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400"
          >
            <Icon name="play" size={15} />
            Avançar
          </button>
          <button
            onClick={onRepeat}
            className="flex items-center justify-center gap-2 rounded-lg border border-void-500 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-white/80 transition hover:border-code-400 hover:text-code-300"
          >
            <Icon name="rotate-ccw" size={15} />
            Repetir estágio
          </button>
          <button
            onClick={() => setRetreatOnLoss((v) => !v)}
            className="flex items-center justify-between gap-2 rounded-lg border border-void-600 px-3 py-2 text-xs text-white/60 transition hover:border-signal-red/50"
          >
            <span className="flex items-center gap-2">
              <Icon name="flag-off" size={14} />
              Retirar-se ao perder
            </span>
            <span
              className={`flex h-4 w-7 items-center rounded-full p-0.5 transition ${retreatOnLoss ? 'justify-end bg-signal-red/70' : 'justify-start bg-void-600'}`}
            >
              <span className="h-3 w-3 rounded-full bg-white" />
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1" />
      </aside>
    </>
  );
}
