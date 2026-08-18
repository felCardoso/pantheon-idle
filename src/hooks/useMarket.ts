import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';
import type { Rarity } from '../types';

export interface DiagramListing {
  id: string;
  sellerId: string;
  sellerUsername: string;
  characterId: string;
  rarity: Rarity;
  quantity: number;
  priceCredits: number;
}

export interface UseMarketResult {
  /** Other players' listings, newest first. */
  listings: DiagramListing[];
  /** The caller's own active listings. */
  myListings: DiagramListing[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Publishes a listing (requires Root Access + owning `quantity` diagrams of characterId at that rarity). Returns whether it succeeded. */
  publishListing: (characterId: string, rarity: Rarity, quantity: number, priceCredits: number) => Promise<boolean>;
  /** Cancels one of the caller's own listings, refunding the diagrams. Returns whether it succeeded. */
  cancelListing: (listingId: string) => Promise<boolean>;
  /** Buys `quantity` from a listing (requires Root Access + affordability). Returns the buyer's
   * new credits total (for the caller's battle.setWallet) or null if it failed. */
  purchaseListing: (listingId: string, quantity: number) => Promise<number | null>;
}

async function usernamesFor(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase.from('profiles').select('user_id, username').in('user_id', userIds);
  return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.username]));
}

/** Loads and manages the Mercado de Diagramas (docs/monetizacao-guilda.md section 1) — Root Access-gated player-to-player `.dat` trading. */
export function useMarket(userId: string | undefined): UseMarketResult {
  const [listings, setListings] = useState<DiagramListing[]>([]);
  const [myListings, setMyListings] = useState<DiagramListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const { data, error: selectError } = await supabase
      .from('diagram_listings')
      .select('id, seller_id, character_id, quantity, price_credits, rarity')
      .order('created_at', { ascending: false });

    if (selectError) {
      setError(selectError.message);
      return;
    }

    const rows = data ?? [];
    const names = await usernamesFor([...new Set(rows.map((r) => r.seller_id))]);
    const resolved: DiagramListing[] = rows.map((r) => ({
      id: r.id,
      sellerId: r.seller_id,
      sellerUsername: names[r.seller_id] ?? 'Node',
      characterId: r.character_id,
      rarity: r.rarity as Rarity,
      quantity: r.quantity,
      priceCredits: r.price_credits,
    }));

    setListings(userId ? resolved.filter((l) => l.sellerId !== userId) : resolved);
    setMyListings(userId ? resolved.filter((l) => l.sellerId === userId) : []);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setListings([]);
      setMyListings([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  const publishListing = useCallback(
    async (characterId: string, rarity: Rarity, quantity: number, priceCredits: number): Promise<boolean> => {
      if (!userId) return false;
      try {
        await postApi('/api/market/publish', { characterId, rarity, quantity, priceCredits });
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to publish listing');
        return false;
      }
    },
    [userId, refresh],
  );

  const cancelListing = useCallback(
    async (listingId: string): Promise<boolean> => {
      if (!userId) return false;
      try {
        await postApi('/api/market/cancel', { listingId });
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel listing');
        return false;
      }
    },
    [userId, refresh],
  );

  const purchaseListing = useCallback(
    async (listingId: string, quantity: number): Promise<number | null> => {
      if (!userId) return null;
      try {
        const response = await postApi<{ credits: number | null }>('/api/market/purchase', { listingId, quantity });
        await refresh();
        return response.credits;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to purchase listing');
        return null;
      }
    },
    [userId, refresh],
  );

  return { listings, myListings, loading, error, refresh, publishListing, cancelListing, purchaseListing };
}
