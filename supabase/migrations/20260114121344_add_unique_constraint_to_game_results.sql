/*
  # 为 game_results 表添加唯一约束

  1. 变更内容
    - 在 game_results 表上添加唯一约束
    - 防止同一场比赛的同一个玩家位置被插入多次
    - 唯一约束基于 (game_id, player_id) 组合

  2. 安全说明
    - 此约束确保数据完整性
    - 防止重复记录导致统计错误
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'game_results_game_player_unique'
  ) THEN
    ALTER TABLE game_results 
    ADD CONSTRAINT game_results_game_player_unique 
    UNIQUE (game_id, player_id);
  END IF;
END $$;
