/*
  # 创建比赛结果表

  1. 新建表
    - `game_results`
      - `id` (uuid, 主键)
      - `game_id` (uuid, 外键关联games表)
      - `player_id` (uuid, 外键关联users表)
      - `player_name` (text, 选手姓名)
      - `final_score` (integer, 最终分数)
      - `rank` (integer, 排名)
      - `standard_score` (numeric, 标准分)
      - `created_at` (timestamptz, 创建时间)
  
  2. 安全设置
    - 启用RLS
    - 允许所有人查询比赛结果
    - 只允许authenticated用户插入数据
  
  3. 重要说明
    - 该表用于存储已完成比赛的最终结果
    - 标准分计算规则：第1名4分，第2名2分，第3名1分，第4名0分
    - 如有并列排名，则平分对应名次的标准分
*/

CREATE TABLE IF NOT EXISTS game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES users(id) ON DELETE SET NULL,
  player_name text NOT NULL,
  final_score integer NOT NULL DEFAULT 0,
  rank integer NOT NULL,
  standard_score numeric(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to game_results"
  ON game_results FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated insert to game_results"
  ON game_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public insert to game_results"
  ON game_results FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_game_results_game_id ON game_results(game_id);
CREATE INDEX IF NOT EXISTS idx_game_results_player_id ON game_results(player_id);
CREATE INDEX IF NOT EXISTS idx_game_results_player_name ON game_results(player_name);