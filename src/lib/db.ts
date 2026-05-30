import Dexie, { Table } from 'dexie';
import { User, Game, Player, ScoreRecord, Penalty, GameResult } from './types';

export class MahjongDB extends Dexie {
  users!: Table<User>;
  games!: Table<Game>;
  players!: Table<Player>;
  scores!: Table<ScoreRecord>;
  penalties!: Table<Penalty>;
  game_results!: Table<GameResult>;

  constructor() {
    super('MahjongDB');
    this.version(1).stores({
      users: 'id, code',
      games: 'id, creator_id, created_at',
      players: 'id, game_id, [game_id+position]',
      scores: 'id, game_id',
      penalties: 'id, game_id',
      game_results: 'id, game_id, player_id'
    });
  }
}

export const db = new MahjongDB();

// Initialize DB with data if empty
export async function initDB() {
  await db.users.count();
}
