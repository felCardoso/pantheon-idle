/** Hand-written to match supabase/migrations/000{1..6}_*.sql — no Supabase CLI access to codegen this. */
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
          updated_at: string;
        };
        Insert: {
          user_id: string;
          fase?: number;
          estagio?: number;
          credits?: number;
          xp?: number;
          starter_boost_claimed?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          fase?: number;
          estagio?: number;
          credits?: number;
          xp?: number;
          starter_boost_claimed?: boolean;
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
        };
        Insert: {
          user_id: string;
          character_id: string;
          acquired_at?: string;
          xp?: number;
        };
        Update: {
          user_id?: string;
          character_id?: string;
          acquired_at?: string;
          xp?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          username: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          username: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          username?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      character_fragments: {
        Row: {
          user_id: string;
          character_id: string;
          count: number;
        };
        Insert: {
          user_id: string;
          character_id: string;
          count?: number;
        };
        Update: {
          user_id?: string;
          character_id?: string;
          count?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
