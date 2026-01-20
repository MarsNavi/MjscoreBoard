/*
  # Add player_id fields to scores table

  1. Changes
    - Add `winner_player_id` column to track which player won (A/B/C/D)
    - Add `loser_player_id` column to track which player lost (A/B/C/D)
    - Keep existing position columns for backward compatibility
  
  2. Notes
    - player_id is stable across rounds (A is always A)
    - position changes each round (A might be east, then south, etc.)
    - We need to track player_id to correctly display winner/loser
*/

DO $$
BEGIN
  -- Add player_id columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scores' AND column_name = 'winner_player_id'
  ) THEN
    ALTER TABLE scores ADD COLUMN winner_player_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scores' AND column_name = 'loser_player_id'
  ) THEN
    ALTER TABLE scores ADD COLUMN loser_player_id TEXT;
  END IF;
END $$;