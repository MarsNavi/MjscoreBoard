/*
  # 麻将计分系统数据库结构

  ## 新建表
  1. `games` - 游戏场次表
    - `id` (uuid, 主键) - 游戏ID
    - `created_at` (timestamptz) - 创建时间
    - `current_round` (integer) - 当前局数
    - `current_game` (integer) - 当前盘数 (1-16)
    - `status` (text) - 游戏状态 (active/finished)
    
  2. `players` - 玩家表
    - `id` (uuid, 主键) - 玩家ID
    - `game_id` (uuid, 外键) - 所属游戏ID
    - `position` (text) - 方位 (east/south/west/north)
    - `name` (text) - 玩家姓名
    - `score` (integer) - 当前分数
    - `created_at` (timestamptz) - 创建时间
    
  3. `scores` - 计分记录表
    - `id` (uuid, 主键) - 记录ID
    - `game_id` (uuid, 外键) - 所属游戏ID
    - `round` (integer) - 局数
    - `game_number` (integer) - 盘数
    - `winner_position` (text) - 和牌者方位
    - `loser_position` (text) - 点炮者方位 (null表示自摸)
    - `base_score` (integer) - 基本分数
    - `score_changes` (jsonb) - 各方位分数变化
    - `created_at` (timestamptz) - 创建时间
    
  ## 安全性
  - 所有表启用 RLS
  - 公开访问策略 (演示用途)
*/

-- 创建游戏表
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  current_round integer DEFAULT 1,
  current_game integer DEFAULT 1,
  status text DEFAULT 'active'
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to games"
  ON games FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to games"
  ON games FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access to games"
  ON games FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- 创建玩家表
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  position text NOT NULL,
  name text DEFAULT '',
  score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to players"
  ON players FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to players"
  ON players FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access to players"
  ON players FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- 创建计分记录表
CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  round integer NOT NULL,
  game_number integer NOT NULL,
  winner_position text NOT NULL,
  loser_position text,
  base_score integer NOT NULL,
  score_changes jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to scores"
  ON scores FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to scores"
  ON scores FOR INSERT
  TO anon
  WITH CHECK (true);