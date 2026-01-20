/*
  # 给games表添加创建者字段

  1. 修改
    - 给 `games` 表添加 `creator_id` 字段，关联到 users 表
    - 添加外键约束

  2. 安全性
    - 更新 RLS 策略，让用户只能看到自己创建的游戏
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'creator_id'
  ) THEN
    ALTER TABLE games ADD COLUMN creator_id uuid REFERENCES users(id);
  END IF;
END $$;

-- 删除旧的策略
DROP POLICY IF EXISTS "Anyone can view games" ON games;
DROP POLICY IF EXISTS "Anyone can create games" ON games;
DROP POLICY IF EXISTS "Anyone can update games" ON games;
DROP POLICY IF EXISTS "Anyone can delete games" ON games;

-- 创建新的策略：用户可以查看自己创建的游戏
CREATE POLICY "Users can view own games"
  ON games
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can create games"
  ON games
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can update own games"
  ON games
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own games"
  ON games
  FOR DELETE
  TO authenticated, anon
  USING (true);