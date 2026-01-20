/*
  # Add Game Completion Status

  1. Changes to `games` table
    - Add `is_completed` (boolean) - indicates if the game is finished
    - Add `early_ended` (boolean) - indicates if the game was ended early
    - Add `completed_at` (timestamptz) - when the game was completed
  
  2. Changes to `players` table
    - Add `confirmed_result` (boolean) - indicates if player confirmed the final result
    - Add `confirmed_at` (timestamptz) - when the player confirmed

  3. Notes
    - All new columns have safe defaults
    - is_completed defaults to false
    - early_ended defaults to false
    - confirmed_result defaults to false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'is_completed'
  ) THEN
    ALTER TABLE games ADD COLUMN is_completed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'early_ended'
  ) THEN
    ALTER TABLE games ADD COLUMN early_ended boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE games ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'confirmed_result'
  ) THEN
    ALTER TABLE players ADD COLUMN confirmed_result boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE players ADD COLUMN confirmed_at timestamptz;
  END IF;
END $$;