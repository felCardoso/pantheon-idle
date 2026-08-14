import { useState } from 'react';
import { Icon } from '../common/Icon';
import type { StageInfo } from '../../types';

interface StagePanelProps {
  stage: StageInfo;
  /** The player's real saved progress within the current fase — distinct from `stage.stage` while detouring (playing an earlier estágio via the mini-map). Estágios before this are completed and selectable. */
  frontierEstagio: number;
  /** Whether "Repetir estágio" mode is active — drives which of Avançar/Repetir is highlighted as primary. */
  stayOnStage: boolean;
  open: boolean;
  onClose: () => void;
  onAdvance: () => void;
  onRepeat: () => void;
  /** Jumps to replay a completed estágio (mini-map dot click). */
  onSelectStage: (estagio: number) => void;
}

export function StagePanel({ stage, frontierEstagio, stayOnStage, open, onClose, onAdvance, onRepeat, onSelectStage }: StagePanelProps) {
  const [retreatOnLoss, setRetreatOnLoss] = useState(true);
  const isDetouring = stage.stage !== frontierEstagio;

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
          {isDetouring && (
            <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-arcane-300">
              <Icon name="rotate-ccw" size={10} />
              Repetição — seu progresso real está no Estágio {frontierEstagio}
            </p>
          )}
          {!isDetouring && stayOnStage && (
            <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-code-300">
              <Icon name="rotate-ccw" size={10} />
              Repetindo este estágio automaticamente
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const nodeEstagio = i + 1;
              const isDone = nodeEstagio < frontierEstagio;
              const isViewing = nodeEstagio === stage.stage;
              const isFrontierMarker = !isViewing && nodeEstagio === frontierEstagio;
              const isSelectable = isDone && !isViewing;
              return (
                <div key={i} className="flex flex-1 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!isSelectable}
                    onClick={() => isSelectable && onSelectStage(nodeEstagio)}
                    title={isSelectable ? `Jogar Estágio ${nodeEstagio}` : `Estágio ${nodeEstagio}`}
                    className={`h-2.5 w-2.5 shrink-0 rounded-full border transition ${
                      isViewing
                        ? 'border-arcane-400 bg-arcane-400 shadow-[0_0_8px_var(--color-arcane-400)]'
                        : isSelectable
                          ? 'cursor-pointer border-code-500 bg-code-500 hover:scale-125'
                          : isFrontierMarker
                            ? 'border-arcane-400/60 bg-void-700'
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
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-display text-xs font-bold uppercase tracking-wide transition ${
              !stayOnStage
                ? 'bg-code-500 text-void-950 hover:bg-code-400'
                : 'border border-void-500 text-white/80 hover:border-code-400 hover:text-code-300'
            }`}
          >
            <Icon name="play" size={15} />
            {isDetouring ? 'Voltar ao progresso' : 'Avançar'}
          </button>
          <button
            onClick={onRepeat}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-display text-xs font-bold uppercase tracking-wide transition ${
              stayOnStage
                ? 'bg-code-500 text-void-950 hover:bg-code-400'
                : 'border border-void-500 text-white/80 hover:border-code-400 hover:text-code-300'
            }`}
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
