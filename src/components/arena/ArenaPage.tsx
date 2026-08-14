import { useEffect, useState } from 'react';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { buildOwnedRoster } from '../../data/roster';
import type { OwnedCharacter } from '../../hooks/useOwnedCharacters';
import type { PvpAttackResult, PvpOpponent, UsePvpResult } from '../../hooks/usePvp';

/** docs/combate.md section 1: "Times de até 5 personagens por lado." */
const MAX_TEAM_SIZE = 5;

interface ArenaPageProps {
  ownedCharacters: OwnedCharacter[];
  pvp: UsePvpResult;
  onRewardCredits: (amount: number) => void;
  onToast: (message: string) => void;
}

export function ArenaPage({ ownedCharacters, pvp, onRewardCredits, onToast }: ArenaPageProps) {
  const roster = buildOwnedRoster(ownedCharacters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opponents, setOpponents] = useState<PvpOpponent[]>([]);
  const [loadingOpponents, setLoadingOpponents] = useState(false);
  const [attacking, setAttacking] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ opponent: PvpOpponent; result: PvpAttackResult } | null>(null);

  useEffect(() => {
    setSelected(new Set(pvp.defenseTeam.map((c) => c.characterId)));
  }, [pvp.defenseTeam]);

  async function refreshOpponents() {
    setLoadingOpponents(true);
    setOpponents(await pvp.findOpponents());
    setLoadingOpponents(false);
  }

  useEffect(() => {
    refreshOpponents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSelected(characterId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(characterId)) next.delete(characterId);
      else if (next.size < MAX_TEAM_SIZE) next.add(characterId);
      return next;
    });
  }

  async function handleSaveDefense() {
    const chosen = ownedCharacters.filter((c) => selected.has(c.characterId));
    await pvp.setDefenseTeam(chosen);
    onToast('Time de defesa salvo.');
  }

  async function handleAttack(opponent: PvpOpponent) {
    if (attacking || ownedCharacters.length === 0) return;
    setAttacking(opponent.userId);
    const result = await pvp.attack(opponent, ownedCharacters);
    setAttacking(null);
    if (!result) {
      onToast('Não foi possível atacar — o oponente pode não ter um time de defesa.');
      return;
    }
    setLastResult({ opponent, result });
    onRewardCredits(result.rewardCredits);
    onToast(result.won ? `Vitória! +${result.rewardCredits} créditos, ${result.ratingDelta >= 0 ? '+' : ''}${result.ratingDelta} rating.` : `Derrota. ${result.ratingDelta >= 0 ? '+' : ''}${result.ratingDelta} rating.`);
    refreshOpponents();
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Arena</h1>
          <p className="text-xs text-white/50">PvP assíncrono — ataque o time de defesa de outros jogadores.</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-arcane-400/25 bg-void-800/50 px-3 py-1.5">
          <div className="text-center">
            <p className="font-mono text-sm font-bold text-arcane-300">{pvp.rating}</p>
            <p className="text-[9px] uppercase tracking-wide text-white/40">Rating</p>
          </div>
          <div className="h-6 w-px bg-void-600" />
          <div className="text-center">
            <p className="font-mono text-sm font-bold text-code-400">{pvp.wins}</p>
            <p className="text-[9px] uppercase tracking-wide text-white/40">Vitórias</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-sm font-bold text-signal-red">{pvp.losses}</p>
            <p className="text-[9px] uppercase tracking-wide text-white/40">Derrotas</p>
          </div>
        </div>
      </div>

      {lastResult && (
        <div
          className={`mb-4 flex items-center justify-between gap-3 rounded-xl border p-4 ${
            lastResult.result.won ? 'border-code-500/30 bg-code-900/20' : 'border-signal-red/30 bg-signal-red/10'
          }`}
        >
          <div>
            <p className={`font-display text-sm font-bold ${lastResult.result.won ? 'text-code-400' : 'text-signal-red'}`}>
              {lastResult.result.won ? 'Vitória!' : 'Derrota'} vs {lastResult.opponent.username}
            </p>
            <p className="text-xs text-white/60">
              +{lastResult.result.rewardCredits} créditos · {lastResult.result.ratingDelta >= 0 ? '+' : ''}
              {lastResult.result.ratingDelta} rating (agora {lastResult.result.newRating})
            </p>
          </div>
          <button onClick={() => setLastResult(null)} className="rounded-lg p-1.5 text-white/40 transition hover:text-white/70">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white/50">
              Time de Defesa ({selected.size}/{MAX_TEAM_SIZE})
            </h2>
            <button
              onClick={handleSaveDefense}
              className="rounded-lg bg-code-500 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400"
            >
              Salvar
            </button>
          </div>
          <p className="mb-2 text-[11px] text-white/40">Escolha até {MAX_TEAM_SIZE} personagens que defendem seu perfil quando você não está online.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {roster.map((c) => {
              const isSelected = selected.has(c.templateId);
              return (
                <button
                  key={c.templateId}
                  onClick={() => toggleSelected(c.templateId)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition ${
                    isSelected ? 'border-arcane-400 bg-arcane-400/10' : 'border-void-600 bg-void-800/40 hover:border-void-500'
                  }`}
                >
                  <CharacterPortrait name={c.name} element={c.element} faction={c.faction} portraitUrl={c.portraitUrl} size={48} />
                  <span className="w-full truncate text-center text-[10px] text-white/70">{c.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white/50">Oponentes</h2>
            <button onClick={refreshOpponents} className="rounded-lg p-1.5 text-white/40 transition hover:text-white/70">
              <Icon name="repeat" size={13} />
            </button>
          </div>
          {loadingOpponents ? (
            <p className="p-4 text-xs text-white/40">Carregando...</p>
          ) : opponents.length === 0 ? (
            <p className="rounded-xl border border-void-600 bg-void-800/30 p-4 text-xs text-white/40">
              Nenhum oponente com time de defesa salvo ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {opponents.map((o) => (
                <div key={o.userId} className="flex items-center justify-between gap-3 rounded-lg border border-void-600 bg-void-800/50 p-3">
                  <div className="flex items-center gap-2">
                    <Icon name="crosshair" size={16} className="text-signal-red" />
                    <div>
                      <p className="text-sm text-white">{o.username}</p>
                      <p className="font-mono text-xs text-white/50">{o.rating} rating</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAttack(o)}
                    disabled={attacking !== null}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-signal-red/80 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-signal-red disabled:opacity-50"
                  >
                    {attacking === o.userId && <Icon name="loader" size={12} className="animate-spin" />}
                    Atacar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
