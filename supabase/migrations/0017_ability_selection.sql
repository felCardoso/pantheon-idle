-- Pantheon Idle: ability-selection system (docs/combate.md v2 section 5 —
-- "todo personagem possui 3 opções de habilidades ativas, o jogador equipa
-- uma por vez"). Run this once in the Supabase SQL Editor, after migration
-- 0016.

-- Which of the character's activeOptions (src/engine/data/characters/*.json)
-- the player currently has equipped. Null = no explicit choice yet, in which
-- case the engine falls back to activeOptions[0] (see loader.ts's
-- resolveCombatantAbilities) — same default every character already had
-- before this column existed, so leaving it unset changes nothing.
alter table public.character_ability_progress
  add column if not exists selected_ability_id text;
