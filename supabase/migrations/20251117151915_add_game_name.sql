/*
  # 添加比赛名称字段

  1. 修改
    - 在 `games` 表中添加 `game_name` 字段
      - `game_name` (text) - 比赛名称,允许为空以兼容旧数据
  
  2. 说明
    - 此字段用于存储每局比赛的自定义名称
    - 方便用户在历史记录中识别不同的比赛
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'game_name'
  ) THEN
    ALTER TABLE games ADD COLUMN game_name text;
  END IF;
END $$;
