/** Hand-written to match supabase/migrations/00{01..14}_*.sql — no Supabase CLI access to codegen this. */
export interface Database {
  public: {
    Tables: {
      player_progress: {
        Row: {
          user_id: string;
          fase: number;
          estagio: number;
          credits: number;
          xp: number;
          starter_boost_claimed: boolean;
          tokens: number;
          team_visibility: string;
          vip_expires_at: string | null;
          vip_daily_bonus_claimed_at: string | null;
          bandwidth: number;
          pvp_rating: number;
          pvp_peak_rating: number;
          pvp_wins: number;
          pvp_losses: number;
          unlocked_team_slots: number;
          pve_team_slot: number;
          pvp_team_slot: number;
          bytes: number;
          banner_pity: number;
          banner_guaranteed: boolean;
          recovery_wins_remaining: number | null;
          last_claim_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          fase?: number;
          estagio?: number;
          credits?: number;
          xp?: number;
          starter_boost_claimed?: boolean;
          tokens?: number;
          team_visibility?: string;
          vip_expires_at?: string | null;
          vip_daily_bonus_claimed_at?: string | null;
          bandwidth?: number;
          pvp_rating?: number;
          pvp_peak_rating?: number;
          pvp_wins?: number;
          pvp_losses?: number;
          unlocked_team_slots?: number;
          pve_team_slot?: number;
          pvp_team_slot?: number;
          bytes?: number;
          banner_pity?: number;
          banner_guaranteed?: boolean;
          recovery_wins_remaining?: number | null;
          last_claim_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          fase?: number;
          estagio?: number;
          credits?: number;
          xp?: number;
          starter_boost_claimed?: boolean;
          tokens?: number;
          team_visibility?: string;
          vip_expires_at?: string | null;
          vip_daily_bonus_claimed_at?: string | null;
          bandwidth?: number;
          pvp_rating?: number;
          pvp_peak_rating?: number;
          pvp_wins?: number;
          pvp_losses?: number;
          unlocked_team_slots?: number;
          pve_team_slot?: number;
          pvp_team_slot?: number;
          bytes?: number;
          banner_pity?: number;
          banner_guaranteed?: boolean;
          recovery_wins_remaining?: number | null;
          last_claim_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_characters: {
        Row: {
          user_id: string;
          character_id: string;
          acquired_at: string;
          xp: number;
          rarity: string;
        };
        Insert: {
          user_id: string;
          character_id: string;
          acquired_at?: string;
          xp?: number;
          rarity?: string;
        };
        Update: {
          user_id?: string;
          character_id?: string;
          acquired_at?: string;
          xp?: number;
          rarity?: string;
        };
        Relationships: [];
      };
      character_ability_progress: {
        Row: {
          user_id: string;
          character_id: string;
          ability_level: number;
          passive_level: number;
          selected_ability_id: string | null;
        };
        Insert: {
          user_id: string;
          character_id: string;
          ability_level?: number;
          passive_level?: number;
          selected_ability_id?: string | null;
        };
        Update: {
          user_id?: string;
          character_id?: string;
          ability_level?: number;
          passive_level?: number;
          selected_ability_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          username: string;
          avatar_character_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          username: string;
          avatar_character_id?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          username?: string;
          avatar_character_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      character_fragments: {
        Row: {
          user_id: string;
          character_id: string;
          rarity: string;
          count: number;
        };
        Insert: {
          user_id: string;
          character_id: string;
          rarity?: string;
          count?: number;
        };
        Update: {
          user_id?: string;
          character_id?: string;
          rarity?: string;
          count?: number;
        };
        Relationships: [];
      };
      clusters: {
        Row: {
          id: string;
          name: string;
          tag: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tag?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          tag?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      cluster_members: {
        Row: {
          cluster_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          cluster_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          cluster_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      cluster_messages: {
        Row: {
          id: string;
          cluster_id: string;
          user_id: string;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cluster_id: string;
          user_id: string;
          text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          cluster_id?: string;
          user_id?: string;
          text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pvp_defense_teams: {
        Row: {
          user_id: string;
          characters: unknown;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          characters?: unknown;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          characters?: unknown;
          updated_at?: string;
        };
        Relationships: [];
      };
      pvp_battles: {
        Row: {
          id: string;
          attacker_id: string;
          defender_id: string;
          winner: string;
          log: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          attacker_id: string;
          defender_id: string;
          winner: string;
          log?: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          attacker_id?: string;
          defender_id?: string;
          winner?: string;
          log?: unknown;
          created_at?: string;
        };
        Relationships: [];
      };
      player_teams: {
        Row: {
          user_id: string;
          slot: number;
          name: string;
          characters: unknown;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          slot: number;
          name: string;
          characters?: unknown;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          slot?: number;
          name?: string;
          characters?: unknown;
          updated_at?: string;
        };
        Relationships: [];
      };
      diagram_listings: {
        Row: {
          id: string;
          seller_id: string;
          character_id: string;
          quantity: number;
          price_credits: number;
          rarity: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          character_id: string;
          quantity: number;
          price_credits: number;
          rarity?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          character_id?: string;
          quantity?: number;
          price_credits?: number;
          rarity?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /**
       * Not callable from the browser: revoked from `authenticated` and granted only to
       * service_role (migration 0020), since it writes another player's rating. The
       * pvp-attack Edge Function is the only caller. Kept in these types for reference.
       */
      resolve_pvp_attack: {
        Args: {
          p_attacker_id: string;
          p_defender_id: string;
          p_winner: string;
          p_log: unknown;
          p_attacker_rating_delta: number;
          p_defender_rating_delta: number;
        };
        Returns: void;
      };
      publish_diagram_listing: {
        Args: {
          p_character_id: string;
          p_quantity: number;
          p_price_credits: number;
          p_rarity: string;
        };
        Returns: string;
      };
      cancel_diagram_listing: {
        Args: {
          p_listing_id: string;
        };
        Returns: void;
      };
      purchase_diagram_listing: {
        Args: {
          p_listing_id: string;
          p_quantity: number;
        };
        Returns: void;
      };
      get_pvp_leaderboard: {
        Args: {
          p_limit: number;
        };
        Returns: {
          rank: number;
          user_id: string;
          username: string;
          pvp_rating: number;
          pvp_peak_rating: number;
          pvp_wins: number;
          pvp_losses: number;
        }[];
      };
      get_pvp_ratings: {
        Args: {
          p_user_ids: string[];
        };
        Returns: {
          user_id: string;
          pvp_rating: number;
        }[];
      };
      get_my_pvp_rank: {
        Args: Record<string, never>;
        Returns: {
          rank: number;
          total: number;
        }[];
      };
    };
  };
}
