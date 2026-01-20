/*
  # 添加判罚表

  ## 新建表
  1. `penalties` - 判罚记录表
    - `id` (uuid, 主键) - 判罚记录ID
    - `game_id` (uuid, 外键) - 所属游戏ID
    - `round` (integer) - 局数
    - `game_number` (integer) - 盘数
    - `penalty_changes` (jsonb) - 各方位判罚分数 {east: 0, south: 0, west: 0, north: 0}
    - `created_at` (timestamptz) - 创建时间
    - `updated_at` (timestamptz) - 更新时间
    
  ## 说明
  - 每一盘最多只有一条判罚记录
  - 判罚分数默认为0，可以为正数（加分）或负数（减分）
  - 判罚会影响玩家的总分计算
  
  ## 安全性
  - 启用 RLS
  - 公开访问策略（演示用途）
*/

-- 创建判罚表
CREATE TABLE IF NOT EXISTS penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  round integer NOT NULL,
  game_number integer NOT NULL,
  penalty_changes jsonb NOT NULL DEFAULT '{"east": 0, "south": 0, "west": 0, "north": 0}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 创建唯一约束，确保每一盘只有一条判罚记录
CREATE UNIQUE INDEX IF NOT EXISTS penalties_game_round_number_unique 
  ON penalties(game_id, round, game_number);

ALTER TABLE penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to penalties"
  ON penalties FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to penalties"
  ON penalties FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access to penalties"
  ON penalties FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to penalties"
  ON penalties FOR DELETE
  TO anon
  USING (true);