import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';

export type ClusterRole = 'leader' | 'officer' | 'node';

export interface ClusterInfo {
  id: string;
  name: string;
  tag: string | null;
}

export interface ClusterSummary extends ClusterInfo {
  memberCount: number;
}

export interface ClusterMember {
  userId: string;
  username: string;
  role: ClusterRole;
  joinedAt: string;
}

export interface ClusterChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface UseClusterResult {
  loading: boolean;
  error: string | null;
  /** The player's own Cluster — null if they haven't joined one. */
  cluster: ClusterInfo | null;
  role: ClusterRole | null;
  members: ClusterMember[];
  messages: ClusterChatMessage[];
  searchClusters: (query: string) => Promise<ClusterSummary[]>;
  createCluster: (name: string, tag?: string) => Promise<ActionResult>;
  joinCluster: (clusterId: string) => Promise<ActionResult>;
  leaveCluster: () => Promise<void>;
  kickMember: (userId: string) => Promise<void>;
  setMemberRole: (userId: string, role: ClusterRole) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  refreshMessages: () => Promise<void>;
}

async function usernamesFor(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase.from('profiles').select('user_id, username').in('user_id', userIds);
  return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.username]));
}

/**
 * Loads and manages a player's Cluster (docs/monetizacao-guilda.md section
 * 2) — membership, roster with roles, and chat. A player belongs to at most
 * one Cluster at a time (enforced by a unique index on cluster_members.user_id
 * in migration 0010).
 */
export function useCluster(userId: string | undefined): UseClusterResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cluster, setCluster] = useState<ClusterInfo | null>(null);
  const [role, setRole] = useState<ClusterRole | null>(null);
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [messages, setMessages] = useState<ClusterChatMessage[]>([]);
  const clusterIdRef = useRef<string | null>(null);

  const loadMessages = useCallback(async (clusterId: string) => {
    const { data, error: selectError } = await supabase
      .from('cluster_messages')
      .select('id, user_id, text, created_at')
      .eq('cluster_id', clusterId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (selectError || !data) return;
    const names = await usernamesFor([...new Set(data.map((m) => m.user_id))]);
    setMessages(
      data
        .map((m) => ({ id: m.id, userId: m.user_id, username: names[m.user_id] ?? 'Node', text: m.text, createdAt: m.created_at }))
        .reverse(),
    );
  }, []);

  const loadOwnCluster = useCallback(async (uid: string) => {
    const { data: membership, error: membershipError } = await supabase
      .from('cluster_members')
      .select('cluster_id, role')
      .eq('user_id', uid)
      .maybeSingle();

    if (membershipError) {
      setError(membershipError.message);
      setCluster(null);
      setRole(null);
      setMembers([]);
      setMessages([]);
      clusterIdRef.current = null;
      return;
    }

    if (!membership) {
      setCluster(null);
      setRole(null);
      setMembers([]);
      setMessages([]);
      clusterIdRef.current = null;
      return;
    }

    clusterIdRef.current = membership.cluster_id;
    setRole(membership.role as ClusterRole);

    const [{ data: clusterRow }, { data: memberRows }] = await Promise.all([
      supabase.from('clusters').select('id, name, tag').eq('id', membership.cluster_id).maybeSingle(),
      supabase.from('cluster_members').select('user_id, role, joined_at').eq('cluster_id', membership.cluster_id).order('joined_at', { ascending: true }),
    ]);

    setCluster(clusterRow ? { id: clusterRow.id, name: clusterRow.name, tag: clusterRow.tag } : null);

    const rows = memberRows ?? [];
    const names = await usernamesFor(rows.map((m) => m.user_id));
    setMembers(rows.map((m) => ({ userId: m.user_id, username: names[m.user_id] ?? 'Node', role: m.role as ClusterRole, joinedAt: m.joined_at })));

    await loadMessages(membership.cluster_id);
  }, [loadMessages]);

  useEffect(() => {
    if (!userId) {
      setCluster(null);
      setRole(null);
      setMembers([]);
      setMessages([]);
      clusterIdRef.current = null;
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      await loadOwnCluster(userId);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadOwnCluster]);

  // Light poll for new chat messages while a Cluster is open — no realtime
  // channel wired up (unverifiable without a live Supabase connection in
  // this sandbox), so this is the safer, testable alternative.
  useEffect(() => {
    if (!cluster) return;
    const id = setInterval(() => {
      if (clusterIdRef.current) loadMessages(clusterIdRef.current);
    }, 10000);
    return () => clearInterval(id);
  }, [cluster, loadMessages]);

  const searchClusters = useCallback(async (query: string): Promise<ClusterSummary[]> => {
    let request = supabase.from('clusters').select('id, name, tag').order('name', { ascending: true }).limit(20);
    if (query.trim()) request = request.ilike('name', `%${query.trim()}%`);
    const { data, error: selectError } = await request;
    if (selectError || !data) return [];

    const counts = await Promise.all(
      data.map(async (c) => {
        const { count } = await supabase.from('cluster_members').select('user_id', { count: 'exact', head: true }).eq('cluster_id', c.id);
        return count ?? 0;
      }),
    );
    return data.map((c, i) => ({ id: c.id, name: c.name, tag: c.tag, memberCount: counts[i] }));
  }, []);

  const createCluster = useCallback(
    async (name: string, tag?: string): Promise<ActionResult> => {
      if (!userId) return { ok: false, error: 'not signed in' };
      const trimmed = name.trim();
      if (trimmed.length < 3) return { ok: false, error: 'nome precisa ter pelo menos 3 caracteres' };

      try {
        await postApi('/api/cluster', { name: trimmed, tag });
        await loadOwnCluster(userId);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Failed to create Cluster' };
      }
    },
    [userId, loadOwnCluster],
  );

  const joinCluster = useCallback(
    async (clusterId: string): Promise<ActionResult> => {
      if (!userId) return { ok: false, error: 'not signed in' };
      try {
        await postApi('/api/cluster/join', { clusterId });
        await loadOwnCluster(userId);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Failed to join Cluster' };
      }
    },
    [userId, loadOwnCluster],
  );

  const leaveCluster = useCallback(async () => {
    if (!userId || !clusterIdRef.current) return;
    try {
      await postApi('/api/cluster/leave');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave Cluster');
      return;
    }
    setCluster(null);
    setRole(null);
    setMembers([]);
    setMessages([]);
    clusterIdRef.current = null;
  }, [userId]);

  const kickMember = useCallback(
    async (targetUserId: string) => {
      if (!clusterIdRef.current) return;
      try {
        await postApi('/api/cluster/kick', { targetUserId });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove member');
      }
      if (userId) await loadOwnCluster(userId);
    },
    [userId, loadOwnCluster],
  );

  const setMemberRole = useCallback(
    async (targetUserId: string, newRole: ClusterRole) => {
      if (!clusterIdRef.current) return;
      try {
        await postApi('/api/cluster/role', { targetUserId, role: newRole });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to change role');
      }
      if (userId) await loadOwnCluster(userId);
    },
    [userId, loadOwnCluster],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!userId || !clusterIdRef.current || !text.trim()) return;
      try {
        await postApi('/api/cluster/message', { text: text.trim() });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      }
      await loadMessages(clusterIdRef.current);
    },
    [userId, loadMessages],
  );

  const refreshMessages = useCallback(async () => {
    if (clusterIdRef.current) await loadMessages(clusterIdRef.current);
  }, [loadMessages]);

  return {
    loading,
    error,
    cluster,
    role,
    members,
    messages,
    searchClusters,
    createCluster,
    joinCluster,
    leaveCluster,
    kickMember,
    setMemberRole,
    sendMessage,
    refreshMessages,
  };
}
