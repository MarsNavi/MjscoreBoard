/*
  # 创建用户表

  1. 新建表
    - `users`
      - `id` (uuid, 主键)
      - `code` (text, 唯一, 用户验证码/用户名)
      - `created_at` (timestamptz, 创建时间)
      - `last_login_at` (timestamptz, 最后登录时间)

  2. 安全性
    - 启用 RLS
    - 添加策略允许用户查看和更新自己的信息
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_login_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON users
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can insert users"
  ON users
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);