/*
  # 添加玩家身份标识

  1. 修改
    - 在 `players` 表添加 `player_id` 字段，表示玩家真实身份(A/B/C/D)
    - player_id 值为 'A', 'B', 'C', 'D'，代表四位真实选手
    - position 表示当前所在的方位(east/south/west/north)
    - 分数和名字跟着 player_id 走，不跟着 position 走
  
  2. 说明
    - 每4局，选手会轮换座位，player_id 与 position 的映射关系会改变
    - 初始 A 在 east，B 在 south，C 在 west，D 在 north
    - 轮换规则：东→南→北→西→东（每轮顺时针三个位置）
*/

-- 添加 player_id 字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'player_id'
  ) THEN
    ALTER TABLE players ADD COLUMN player_id text NOT NULL DEFAULT 'A';
  END IF;
END $$;

-- 为现有数据设置默认的 player_id
-- 这个更新只会在首次运行时生效
UPDATE players
SET player_id = CASE position
  WHEN 'east' THEN 'A'
  WHEN 'south' THEN 'B'
  WHEN 'west' THEN 'C'
  WHEN 'north' THEN 'D'
END
WHERE player_id = 'A';