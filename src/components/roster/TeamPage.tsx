import { CharacterPortrait } from './CharacterPortrait';
import { RosterChips } from './RosterChips';
import { Icon } from '../common/Icon';
import { buildOwnedRoster } from '../../data/roster';
import { CONSTANTS } from '../../engine/core/loader';
import type { OwnedCharacter } from '../../hooks/useOwnedCharacters';

interface TeamPageProps {
  ownedCharacters: OwnedCharacter[];
}

const STAT_ROWS: { key: 'hp' | 'atk' | 'def' | 'ini' | 'esq'; label: string; icon: string; format: (v: number) => string }[] = [
  { key: 'hp', label: 'HP', icon: 'heart', format: (v) => Math.round(v).toLocaleString('pt-BR') },
  { key: 'atk', label: 'ATK', icon: 'swords', format: (v) => Math.round(v).toLocaleString('pt-BR') },
  { key: 'def', label: 'DEF', icon: 'shield', format: (v) => Math.round(v).toLocaleString('pt-BR') },
  { key: 'ini', label: 'INI', icon: 'gauge', format: (v) => Math.round(v).toLocaleString('pt-BR') },
  { key: 'esq', label: 'ESQ', icon: 'wind', format: (v) => `${Math.round(v * 100)}%` },
];

export function TeamPage({ ownedCharacters }: TeamPageProps) {
  const roster = buildOwnedRoster(ownedCharacters);
  const synergyPercent = Math.round((CONSTANTS.synergyByCount[String(roster.length)] ?? 0) * 100);
  const mythologies = Array.from(new Set(roster.map((c) => c.mythology)));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">
            Seu Time
          </h1>
          <p className="text-xs text-white/50">
            {mythologies.join(' · ')} · {roster.length} membro{roster.length === 1 ? '' : 's'}
          </p>
        </div>
        {synergyPercent > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-code-500/30 bg-code-500/10 px-3 py-1">
            <Icon name="sparkles" size={13} className="text-code-400" />
            <span className="font-mono text-[11px] text-code-300">
              Sinergia mitológica +{synergyPercent}% HP/ATK
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {roster.map((c) => (
          <div key={c.templateId} className="flex gap-3 rounded-xl border border-void-600 bg-void-800/50 p-4">
            <CharacterPortrait name={c.name} element={c.element} faction={c.faction} portraitUrl={c.portraitUrl} size={72} />

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-display text-sm font-bold text-white">{c.name}</h2>
                  <span className="shrink-0 font-mono text-[10px] text-white/40">Nv.{c.level}</span>
                </div>
                <RosterChips faction={c.faction} element={c.element} rarity={c.rarity} />
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-void-900">
                    <div
                      className="h-full rounded-full bg-arcane-400 transition-all"
                      style={{ width: `${Math.round((c.xpIntoLevel / c.xpForNextLevel) * 100)}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[9px] text-white/40">
                    {c.xpIntoLevel}/{c.xpForNextLevel} XP
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {STAT_ROWS.map((row) => (
                  <div key={row.key} className="flex flex-col items-center gap-0.5 rounded-md bg-void-900/60 py-1.5">
                    <Icon name={row.icon} size={12} className="text-white/40" />
                    <span className="font-mono text-[11px] font-bold text-white/85">{row.format(c.stats[row.key])}</span>
                    <span className="text-[8px] uppercase tracking-wide text-white/30">{row.label}</span>
                  </div>
                ))}
              </div>

              {(c.alwaysActsFirst || c.statusDurationBonus > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {c.alwaysActsFirst && (
                    <span className="flex items-center gap-1 rounded-full border border-signal-amber/30 bg-signal-amber/10 px-2 py-0.5 text-[10px] text-signal-amber">
                      <Icon name="zap" size={10} />
                      Sempre age primeiro
                    </span>
                  )}
                  {c.statusDurationBonus > 0 && (
                    <span className="flex items-center gap-1 rounded-full border border-arcane-400/30 bg-arcane-400/10 px-2 py-0.5 text-[10px] text-arcane-300">
                      <Icon name="scroll-text" size={10} />
                      Status +{c.statusDurationBonus} rodada{c.statusDurationBonus > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
