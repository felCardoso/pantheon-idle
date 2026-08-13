/** Hand-written to match supabase/migrations/0001_player_progress.sql — no Supabase CLI access to codegen this. */
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
          updated_at: string;
        };
        Insert: {
          user_id: string;
          fase?: number;
          estagio?: number;
          credits?: number;
          xp?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          fase?: number;
          estagio?: number;
          credits?: number;
          xp?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
