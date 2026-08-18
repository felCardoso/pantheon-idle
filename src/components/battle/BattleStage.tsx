import { TeamFormation } from './TeamFormation';
import { BattleDivider } from './BattleDivider';
import { AbilityCastOverlay } from './AbilityCastOverlay';
import { Icon } from '../common/Icon';
import { WORLD_BACKGROUND_BY_ID } from '../../data/engineDisplay';
import { localFaseNumber } from '../../engine';
import type { BattleUnit, StageInfo } from '../../types';
import type { AbilityCastEvent, AttackAnimEvent, FloatingText, Reward } from '../../hooks/useBattleSimulation';

interface BattleStageProps {
  allies: BattleUnit[];
  enemies: BattleUnit[];
  stage: StageInfo;
  playing: boolean;
  onSetPlaying: (playing: boolean) => void;
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  /** Credits/XP earned by the battle that just finished — shown on the overlay below the result label. */
  lastReward: Reward | null;
  onNextBattle: () => void;
  floaters: FloatingText[];
  /** At most one per side — a concurrent ally + enemy cast renders as a clash (both banners share one dim backdrop). */
  activeAbilities: AbilityCastEvent[];
  attackAnims: AttackAnimEvent[];
}

const WINNER_LABEL: Record<'allies' | 'enemies' | 'draw', string> = {
  allies: 'Vitória!',
  enemies: 'Derrota',
  draw: 'Empate',
};

export function BattleStage({
  allies,
  enemies,
  stage,
  playing,
  onSetPlaying,
  finished,
  winner,
  lastReward,
  onNextBattle,
  floaters,
  activeAbilities,
  attackAnims,
}: BattleStageProps) {
  const floatersFor = (unitId: string) => floaters.filter((f) => f.unitId === unitId);
  // Newest event per unit only — a unit can't be mid-swing twice at once, and a fresh id is what
  // restarts UnitCard's CSS animation (see its `key={attack?.id}`).
  const attackFor = (unitId: string) => {
    const event = [...attackAnims].reverse().find((a) => a.attackerId === unitId);
    return event ? { id: event.id, tier: event.tier } : null;
  };
  const impactFor = (unitId: string) => {
    const event = [...attackAnims].reverse().find((a) => a.defenderId === unitId && !a.dodged);
    return event ? { id: event.id } : null;
  };
  const backgroundArt = WORLD_BACKGROUND_BY_ID[stage.worldId];

  return (
    <main className="relative flex-1 overflow-hidden bg-void-950">
      {/* world background */}
      {backgroundArt && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundArt})` }}
        />
      )}

      {/* atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background: backgroundArt
            ? 'linear-gradient(180deg, rgba(7,7,16,0.35) 0%, rgba(7,7,16,0.15) 45%, rgba(7,7,16,0.75) 100%)'
            : 'radial-gradient(60% 45% at 50% 18%, rgba(195,74,255,0.16), transparent 70%), radial-gradient(70% 50% at 50% 100%, rgba(57,255,156,0.12), transparent 70%), linear-gradient(180deg, #0b0b16 0%, #0a0a12 55%, #070710 100%)',
        }}
      />
      <div className={`circuit-grid absolute inset-0 ${backgroundArt ? 'opacity-10' : 'opacity-40'}`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 w-full animate-scanline bg-gradient-to-b from-code-500/10 to-transparent" />

      {!backgroundArt && (
        <>
          {/* moon */}
          <div className="absolute left-1/2 top-10 h-20 w-20 -translate-x-1/2 rounded-full bg-arcane-300/20 blur-2xl sm:h-28 sm:w-28" />
          <div className="absolute left-1/2 top-12 h-10 w-10 -translate-x-1/2 rounded-full border border-arcane-300/40 bg-arcane-300/10 sm:h-16 sm:w-16" />
        </>
      )}

      {/* HUD overlay */}
      <div className="relative z-10 flex items-start justify-between p-3 sm:p-4">
        <div
          className={`rounded-lg border px-2.5 py-1.5 backdrop-blur-sm ${stage.isBoss ? 'border-signal-red/40 bg-signal-red/10' : 'border-code-500/25 bg-void-950/50'}`}
        >
          <p
            className={`font-display text-[10px] font-bold uppercase tracking-wider sm:text-xs ${stage.isBoss ? 'text-signal-red' : 'text-code-300'}`}
          >
            {stage.worldName} · Fase {localFaseNumber(stage.phase)} · {stage.isBoss ? 'Chefe de Mundo' : `Onda ${stage.stage}/${stage.totalStages}`}
          </p>
          <p className="text-[10px] text-white/40">{stage.worldSubtitle}</p>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-void-600 bg-void-950/50 p-1 backdrop-blur-sm">
          <button
            onClick={() => onSetPlaying(true)}
            className={`rounded-full px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wide transition sm:px-3 sm:text-xs ${
              playing ? 'bg-code-500 text-void-950' : 'text-white/50'
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => onSetPlaying(false)}
            className={`rounded-full px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wide transition sm:px-3 sm:text-xs ${
              !playing ? 'bg-signal-amber text-void-950' : 'text-white/50'
            }`}
          >
            Pausar
          </button>
        </div>

        <div className="invisible rounded-lg border border-void-600 bg-void-950/50 px-2.5 py-1.5 text-right backdrop-blur-sm sm:visible">
          <p className="font-mono text-xs text-white/70">Rodada {stage.round}</p>
        </div>
      </div>

      {/* formation — enemies above / right, allies below / left (see TeamFormation) */}
      <div className="absolute inset-x-0 bottom-0 top-16 z-10 flex flex-col-reverse items-center justify-center gap-1 px-2 pb-4 sm:px-4 sm:pb-6 md:flex-row md:gap-3">
        <TeamFormation units={allies} isAllySide floatersFor={floatersFor} attackFor={attackFor} impactFor={impactFor} />
        <BattleDivider />
        <TeamFormation units={enemies} isAllySide={false} floatersFor={floatersFor} attackFor={attackFor} impactFor={impactFor} />
      </div>

      <AbilityCastOverlay activeAbilities={activeAbilities} />

      {finished && winner && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-void-950/70 backdrop-blur-sm">
          <p
            className={`font-display text-2xl font-black uppercase tracking-widest sm:text-4xl ${
              winner === 'allies' ? 'text-code-400 text-glow-code' : winner === 'enemies' ? 'text-signal-red' : 'text-arcane-300'
            }`}
          >
            {WINNER_LABEL[winner]}
          </p>
          {lastReward && (
            <p className="font-mono text-sm text-white/70">
              +{lastReward.credits} C{lastReward.xp > 0 ? ` / +${lastReward.xp} XP` : ''}
            </p>
          )}
          {!playing && (
            <button
              onClick={onNextBattle}
              className="flex items-center gap-2 rounded-lg bg-code-500 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400"
            >
              <Icon name="play" size={15} />
              Nova batalha
            </button>
          )}
        </div>
      )}
    </main>
  );
}
