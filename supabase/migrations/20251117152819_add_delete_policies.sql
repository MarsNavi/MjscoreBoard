/*
  # 添加删除权限策略

  1. 修改
    - 为 `games` 表添加 DELETE 策略
    - 为 `players` 表添加 DELETE 策略
    - 为 `scores` 表添加 DELETE 策略
  
  2. 说明
    - 允许公开删除操作(演示用途)
    - 这些策略是撤销功能必需的
*/

-- 为 games 表添加删除策略
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'games' 
    AND policyname = 'Allow public delete access to games'
  ) THEN
    CREATE POLICY "Allow public delete access to games"
      ON games FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

-- 为 players 表添加删除策略
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'players' 
    AND policyname = 'Allow public delete access to players'
  ) THEN
    CREATE POLICY "Allow public delete access to players"
      ON players FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

-- 为 scores 表添加删除策略
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'scores' 
    AND policyname = 'Allow public delete access to scores'
  ) THEN
    CREATE POLICY "Allow public delete access to scores"
      ON scores FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;
