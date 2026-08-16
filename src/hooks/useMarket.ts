import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  /** Buys `quantity` from a listing (requires Root Access + affordability). Returns whether it succeeded. */
  purchaseListing: (listingId: string, quantity: number) => Promise<boolean>;
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
      const { error: rpcError } = await supabase.rpc('publish_diagram_listing', {
        p_character_id: characterId,
        p_quantity: quantity,
        p_price_credits: priceCredits,
        p_rarity: rarity,
      });
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      await refresh();
      return true;
    },
    [userId, refresh],
  );

  const cancelListing = useCallback(
    async (listingId: string): Promise<boolean> => {
      if (!userId) return false;
      const { error: rpcError } = await supabase.rpc('cancel_diagram_listing', { p_listing_id: listingId });
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      await refresh();
      return true;
    },
    [userId, refresh],
  );

  const purchaseListing = useCallback(
    async (listingId: string, quantity: number): Promise<boolean> => {
      if (!userId) return false;
      const { error: rpcError } = await supabase.rpc('purchase_diagram_listing', { p_listing_id: listingId, p_quantity: quantity });
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      await refresh();
      return true;
    },
    [userId, refresh],
  );

  return { listings, myListings, loading, error, refresh, publishListing, cancelListing, purchaseListing };
}
