/*
  # 允许荒庄记录中winner_position为空

  ## 修改内容
  1. 修改 scores 表
    - 将 `winner_position` 字段改为可空，以支持荒庄（无人和牌）的情况
    - 将 `base_score` 字段改为可空，荒庄时不需要基本分
    
  ## 说明
  - 荒庄是指一盘比赛没有人和牌，四家都记0分
  - 此时 winner_position、loser_position、base_score 都应该为 null
*/

-- 修改 winner_position 字段允许为空
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scores' AND column_name = 'winner_position' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE scores ALTER COLUMN winner_position DROP NOT NULL;
  END IF;
END $$;

-- 修改 base_score 字段允许为空
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scores' AND column_name = 'base_score' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE scores ALTER COLUMN base_score DROP NOT NULL;
  END IF;
END $$;