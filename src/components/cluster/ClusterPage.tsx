import { useEffect, useState } from 'react';
import { Icon } from '../common/Icon';
import type { ClusterMember, ClusterRole, ClusterSummary, UseClusterResult } from '../../hooks/useCluster';

interface ClusterPageProps {
  userId: string;
  cluster: UseClusterResult;
  bandwidth: number;
  onToast: (message: string) => void;
}

const ROLE_LABEL: Record<ClusterRole, string> = { leader: 'Líder', officer: 'Oficial', node: 'Node' };

export function ClusterPage({ userId, cluster, bandwidth, onToast }: ClusterPageProps) {
  if (cluster.loading) {
    return <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5" />;
  }
  return cluster.cluster ? (
    <ClusterRoster userId={userId} cluster={cluster} bandwidth={bandwidth} onToast={onToast} />
  ) : (
    <ClusterBrowser cluster={cluster} onToast={onToast} />
  );
}

function ClusterBrowser({ cluster, onToast }: { cluster: UseClusterResult; onToast: (message: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClusterSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [creating, setCreating] = useState(false);

  async function runSearch(q: string) {
    setSearching(true);
    setResults(await cluster.searchClusters(q));
    setSearching(false);
  }

  useEffect(() => {
    runSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleJoin(id: string, name: string) {
    const result = await cluster.joinCluster(id);
    if (result.ok) onToast(`Você entrou no Cluster ${name}.`);
    else onToast(result.error ?? 'Não foi possível entrar.');
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    const result = await cluster.createCluster(newName, newTag);
    setCreating(false);
    if (result.ok) {
      onToast(`Cluster ${newName} criado!`);
      setNewName('');
      setNewTag('');
    } else {
      onToast(result.error ?? 'Não foi possível criar o Cluster.');
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">Cluster</h1>
        <p className="text-xs text-white/50">Entre em um Cluster existente ou crie o seu — cada jogador pertence a apenas um por vez.</p>
      </div>

      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Criar Cluster</h2>
          <div className="flex flex-col gap-2 rounded-xl border border-arcane-400/25 bg-void-800/50 p-4 sm:flex-row sm:items-center">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do Cluster"
              maxLength={40}
              className="min-w-0 flex-1 rounded-lg border border-void-600 bg-void-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-arcane-400/60 focus:outline-none"
            />
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Tag (opcional)"
              maxLength={8}
              className="rounded-lg border border-void-600 bg-void-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-arcane-400/60 focus:outline-none sm:w-28"
            />
            <button
              onClick={handleCreate}
              disabled={creating || newName.trim().length < 3}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-code-500 px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-void-950 transition hover:bg-code-400 disabled:opacity-50"
            >
              {creating && <Icon name="loader" size={13} className="animate-spin" />}
              Criar
            </button>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white/50">Buscar Clusters</h2>
          </div>
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-void-600 bg-void-800/50 px-3 py-2">
            <Icon name="shield" size={14} className="text-white/40" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                runSearch(e.target.value);
              }}
              placeholder="Pesquisar por nome..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>

          {searching ? (
            <p className="p-4 text-xs text-white/40">Carregando...</p>
          ) : results.length === 0 ? (
            <p className="rounded-xl border border-void-600 bg-void-800/30 p-4 text-xs text-white/40">Nenhum Cluster encontrado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-void-600 bg-void-800/50 p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon name="shield" size={16} className="text-code-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">
                        {c.name}
                        {c.tag && <span className="ml-1.5 text-xs text-white/40">[{c.tag}]</span>}
                      </p>
                      <p className="text-xs text-white/50">{c.memberCount} Node(s)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoin(c.id, c.name)}
                    className="shrink-0 rounded-lg border border-void-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/70 transition hover:border-code-400/60 hover:text-code-300"
                  >
                    Entrar
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

function ClusterRoster({
  userId,
  cluster,
  bandwidth,
  onToast,
}: {
  userId: string;
  cluster: UseClusterResult;
  bandwidth: number;
  onToast: (message: string) => void;
}) {
  const isOfficer = cluster.role === 'leader' || cluster.role === 'officer';

  async function handleLeave() {
    await cluster.leaveCluster();
    onToast('Você saiu do Cluster.');
  }

  async function handleKick(m: ClusterMember) {
    await cluster.kickMember(m.userId);
    onToast(`${m.username} foi removido do Cluster.`);
  }

  async function handlePromote(m: ClusterMember) {
    const next: ClusterRole = m.role === 'node' ? 'officer' : 'leader';
    await cluster.setMemberRole(m.userId, next);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-sm font-bold uppercase tracking-wide text-white text-glow-code sm:text-base">
            {cluster.cluster?.name}
            {cluster.cluster?.tag && <span className="ml-2 text-xs text-white/40">[{cluster.cluster.tag}]</span>}
          </h1>
          <p className="text-xs text-white/50">
            Você é {cluster.role && ROLE_LABEL[cluster.role]} · {cluster.members.length} Node(s) · {bandwidth} Bandwidth
          </p>
        </div>
        <button
          onClick={handleLeave}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-signal-red/30 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-signal-red/80 transition hover:border-signal-red/60 hover:text-signal-red"
        >
          <Icon name="log-out" size={13} />
          Sair
        </button>
      </div>

      <section>
        <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">Roster</h2>
        <div className="flex flex-col gap-2">
          {cluster.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3 rounded-lg border border-void-600 bg-void-800/50 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <Icon name="user" size={16} className="text-white/40" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {m.username}
                    {m.userId === userId && <span className="ml-1.5 text-[10px] text-white/40">(você)</span>}
                  </p>
                  <p className="text-xs text-white/50">{ROLE_LABEL[m.role]}</p>
                </div>
              </div>
              {isOfficer && m.userId !== userId && m.role !== 'leader' && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {cluster.role === 'leader' && (
                    <button
                      onClick={() => handlePromote(m)}
                      title="Promover"
                      className="rounded-lg border border-void-600 p-1.5 text-white/50 transition hover:border-code-400/60 hover:text-code-300"
                    >
                      <Icon name="crown" size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => handleKick(m)}
                    title="Remover"
                    className="rounded-lg border border-void-600 p-1.5 text-white/50 transition hover:border-signal-red/60 hover:text-signal-red"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <p className="mt-6 text-[11px] text-white/30">
        Bandwidth é ganho em atividades cooperativas de Cluster (DDoS Raid) — ainda não disponível.
      </p>
    </div>
  );
}
