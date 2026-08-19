import { useState } from 'react';
import { Icon } from '../common/Icon';
import { WORLD_BACKGROUND_BY_ID, WORLD_DISPLAY_BY_ID } from '../../data/engineDisplay';
import {
  comparePositions,
  ESTAGIOS_PER_FASE,
  FASES_PER_WORLD,
  isBossStage,
  WORLD_IDS,
  worldIndexForFase,
  type WorldPosition,
} from '../../engine';

interface WorldMapModalProps {
  /** Where the battle view is currently pointed. */
  current: WorldPosition;
  /** Highest position ever reached — everything at or before it is replayable, everything after is locked. */
  frontier: WorldPosition;
  onSelect: (position: WorldPosition) => void;
  onClose: () => void;
}

/** Estágios in a fase, counting the boss's own 6th slot on a world's last fase. */
function estagioCount(fase: number): number {
  return isBossStage({ fase, estagio: ESTAGIOS_PER_FASE + 1 }) ? ESTAGIOS_PER_FASE + 1 : ESTAGIOS_PER_FASE;
}

/**
 * The campaign map: pick any world you've reached, then any fase and estágio inside it.
 *
 * StagePanel's inline strip only ever showed the estágios of the fase you happen to be on, so
 * the other 9 fases of a world — and every other world — were unreachable without playing
 * forward through them again. This is the whole graph.
 */
export function WorldMapModal({ current, frontier, onSelect, onClose }: WorldMapModalProps) {
  const currentWorldIndex = worldIndexForFase(current.fase);
  const frontierWorldIndex = worldIndexForFase(frontier.fase);
  const [viewedWorld, setViewedWorld] = useState(currentWorldIndex);

  const fases = Array.from({ length: FASES_PER_WORLD }, (_, i) => viewedWorld * FASES_PER_WORLD + i + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/85 p-3" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-code-500/25 bg-void-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-void-700 px-4 py-3">
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code">Mapa</h2>
            <p className="text-xs text-white/50">Escolha o mundo, a fase e a onda</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 transition hover:text-white/70">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* World picker */}
        <div className="flex gap-2 overflow-x-auto border-b border-void-700 px-4 py-3">
          {WORLD_IDS.map((worldId, index) => {
            const display = WORLD_DISPLAY_BY_ID[worldId];
            const locked = index > frontierWorldIndex;
            const active = index === viewedWorld;
            return (
              <button
                key={worldId}
                disabled={locked}
                onClick={() => setViewedWorld(index)}
                className={`relative flex w-28 shrink-0 flex-col items-start gap-0.5 overflow-hidden rounded-lg border px-2.5 py-2 text-left transition ${
                  active ? 'border-code-400/70 bg-code-500/10' : locked ? 'border-void-700 opacity-40' : 'border-void-600 hover:border-code-400/40'
                }`}
              >
                {WORLD_BACKGROUND_BY_ID[worldId] && (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-20"
                    style={{ backgroundImage: `url(${WORLD_BACKGROUND_BY_ID[worldId]})` }}
                  />
                )}
                <span className={`relative font-display text-[11px] font-bold ${active ? 'text-code-300' : 'text-white/80'}`}>
                  {locked && <Icon name="lock" size={9} className="mr-1 inline" />}
                  {display.name}
                </span>
                <span className="relative text-[9px] text-white/50">{display.subtitle}</span>
              </button>
            );
          })}
        </div>

        {/* Fases of the selected world, each with its estágio nodes */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-1.5">
            {fases.map((fase) => {
              const total = estagioCount(fase);
              const faseReached = comparePositions({ fase, estagio: 1 }, frontier) <= 0;
              return (
                <div
                  key={fase}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    faseReached ? 'border-void-600 bg-void-800/40' : 'border-void-700/60 opacity-45'
                  }`}
                >
                  <span className="w-14 shrink-0 font-display text-[11px] font-bold uppercase tracking-wide text-white/60">
                    Fase {fase - viewedWorld * FASES_PER_WORLD}
                  </span>
                  <div className="flex flex-1 items-center gap-1.5">
                    {Array.from({ length: total }, (_, i) => {
                      const estagio = i + 1;
                      const position = { fase, estagio };
                      const boss = isBossStage(position);
                      const unlocked = comparePositions(position, frontier) <= 0;
                      const isCurrent = comparePositions(position, current) === 0;
                      return (
                        <div key={estagio} className="flex flex-1 items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!unlocked}
                            onClick={() => {
                              onSelect(position);
                              onClose();
                            }}
                            title={boss ? 'Chefe de Mundo' : `Onda ${estagio}`}
                            className={`flex shrink-0 items-center justify-center rounded-full border transition ${boss ? 'h-5 w-5' : 'h-3 w-3'} ${
                              isCurrent
                                ? 'border-arcane-400 bg-arcane-400 shadow-[0_0_8px_var(--color-arcane-400)]'
                                : boss
                                  ? unlocked
                                    ? 'cursor-pointer border-signal-red bg-signal-red/80 text-void-950 hover:scale-125'
                                    : 'border-signal-red/40 bg-void-700 text-signal-red/60'
                                  : unlocked
                                    ? 'cursor-pointer border-code-500 bg-code-500 hover:scale-125'
                                    : 'border-void-500 bg-void-700'
                            }`}
                          >
                            {boss && <Icon name="skull" size={11} />}
                          </button>
                          {i < total - 1 && <div className={`h-px flex-1 ${unlocked ? 'bg-code-500/50' : 'bg-void-600'}`} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-void-700 px-4 py-2.5 text-[10px] text-white/40">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-code-500 bg-code-500" /> Onda liberada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-arcane-400 bg-arcane-400" /> Atual
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="skull" size={11} className="text-signal-red" /> Chefe
          </span>
        </div>
      </div>
    </div>
  );
}
