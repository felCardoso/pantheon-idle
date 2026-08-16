import { useEffect, useState } from 'react';
import { Icon } from '../common/Icon';
import { pvpRankTierFor } from '../../data/pvpRank';
import type { MyPvpRank, PvpLeaderboardEntry, UsePvpResult } from '../../hooks/usePvp';

interface PvpLeaderboardModalProps {
  pvp: UsePvpResult;
  userId: string | undefined;
  onClose: () => void;
}

const LEADERBOARD_SIZE = 50;

/** Global PvP ranking (docs/gdd.md §6) — top LEADERBOARD_SIZE players by rating, plus the caller's own position when they're outside that slice. */
export function PvpLeaderboardModal({ pvp, userId, onClose }: PvpLeaderboardModalProps) {
  const [entries, setEntries] = useState<PvpLeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<MyPvpRank | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [leaderboard, rank] = await Promise.all([pvp.fetchLeaderboard(LEADERBOARD_SIZE), pvp.fetchMyRank()]);
      if (cancelled) return;
      setEntries(leaderboard);
      setMyRank(rank);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meInTop = entries.some((e) => e.userId === userId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-void-600 bg-void-900 p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white">Ranking PvP</h2>
            <p className="text-xs text-white/50">Os {LEADERBOARD_SIZE} hackers com maior rating do Panteão Digital.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 transition hover:text-white/70">
            <Icon name="x" size={16} />
          </button>
        </div>

        {myRank && !meInTop && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-arcane-400/30 bg-arcane-900/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-arcane-300">#{myRank.rank}</span>
              <span className="text-[11px] text-white/60">de {myRank.total} jogadores</span>
            </div>
            <span className="font-display text-[10px] uppercase tracking-wide text-arcane-300">{pvpRankTierFor(pvp.rating).name}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-xs text-white/40">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="rounded-xl border border-void-600 bg-void-800/30 p-4 text-xs text-white/40">Ninguém no ranking ainda.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {entries.map((e) => {
                const isMe = e.userId === userId;
                const tier = pvpRankTierFor(e.rating);
                return (
                  <div
                    key={e.userId}
                    className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 ${
                      isMe ? 'border-arcane-400/40 bg-arcane-900/30' : 'border-void-600 bg-void-800/50'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`w-6 shrink-0 text-right font-mono text-xs font-bold ${
                          e.rank <= 3 ? 'text-signal-amber' : 'text-white/40'
                        }`}
                      >
                        {e.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">
                          {e.username}
                          {isMe && <span className="ml-1.5 text-[10px] font-normal text-arcane-300">(você)</span>}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-white/40">{tier.name}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-right">
                      <div>
                        <p className="font-mono text-xs font-bold text-arcane-300">{e.rating}</p>
                        <p className="text-[9px] text-white/40">
                          {e.wins}V / {e.losses}D
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
