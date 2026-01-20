/*
  # 更新判罚表结构，确保每局只有一条判罚记录

  ## 修改内容
  1. 修改 penalties 表
    - 添加唯一约束：每个游戏的每一局只能有一条判罚记录
    - 这样可以通过 UPDATE 操作修改判罚，而不是 INSERT 新记录
    
  ## 说明
  - 判罚记录在游戏开始时预创建，初始值为0
  - 裁判修改判罚时，更新现有记录而非新增
  - 确保 game_id + game_number 的组合是唯一的
*/

-- 首先删除可能存在的重复记录，只保留最新的
DO $$
BEGIN
  DELETE FROM penalties a
  USING penalties b
  WHERE a.game_id = b.game_id
    AND a.game_number = b.game_number
    AND a.created_at < b.created_at;
END $$;

-- 添加唯一约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'penalties_game_id_game_number_unique'
  ) THEN
    ALTER TABLE penalties 
    ADD CONSTRAINT penalties_game_id_game_number_unique 
    UNIQUE (game_id, game_number);
  END IF;
END $$;