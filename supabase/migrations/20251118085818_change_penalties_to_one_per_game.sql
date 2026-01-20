/*
  # 修改判罚表结构：一局只有一条判罚记录

  ## 说明
  - 之前的设计是每盘一条判罚记录（16条）
  - 现在改为一局只有一条判罚记录
  - game_number字段不再需要，因为判罚是针对整局的
  
  ## 修改内容
  1. 删除所有现有判罚记录
  2. 删除 game_number 字段
  3. 删除之前的唯一约束
  4. 添加新的唯一约束：每个游戏只能有一条判罚记录
*/

-- 删除所有现有判罚记录
TRUNCATE TABLE penalties;

-- 删除旧的唯一约束
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'penalties_game_id_game_number_unique'
  ) THEN
    ALTER TABLE penalties 
    DROP CONSTRAINT penalties_game_id_game_number_unique;
  END IF;
END $$;

-- 删除 game_number 字段
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'penalties' AND column_name = 'game_number'
  ) THEN
    ALTER TABLE penalties DROP COLUMN game_number;
  END IF;
END $$;

-- 删除 round 字段（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'penalties' AND column_name = 'round'
  ) THEN
    ALTER TABLE penalties DROP COLUMN round;
  END IF;
END $$;

-- 添加唯一约束：每个游戏只能有一条判罚记录
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'penalties_game_id_unique'
  ) THEN
    ALTER TABLE penalties 
    ADD CONSTRAINT penalties_game_id_unique 
    UNIQUE (game_id);
  END IF;
END $$;