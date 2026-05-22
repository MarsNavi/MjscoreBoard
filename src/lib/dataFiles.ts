import { db } from './db';
import { Game, GameResult, Penalty, Player, ScoreRecord, User } from './types';
import { normalizePlayerName } from './playerNames';

export interface MahjongBackupData {
  exported_at?: string;
  app_version?: string;
  data_file?: {
    id?: string;
    name?: string;
  };
  users?: User[];
  games?: Game[];
  players?: Player[];
  scores?: ScoreRecord[];
  penalties?: Penalty[];
  game_results?: GameResult[];
}

export interface DataFileSummary {
  id: string;
  name: string;
  created_at: string;
  last_login_at: string;
  games_count: number;
  finished_games_count: number;
  last_game_at?: string;
}

interface ImportedDataCounts {
  games: number;
  players: number;
  scores: number;
  penalties: number;
  game_results: number;
  skipped_games?: number;
}

const LEGACY_DEFAULT_CODES = new Set(['local', 'micken', '默认数据']);

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

export const getDataFileName = (user: User | null | undefined): string => {
  if (!user) return '默认档案';
  const name = String(user.code || '').trim();
  if (!name || LEGACY_DEFAULT_CODES.has(name)) return '默认档案';
  return name;
};

export const normalizeDataFileName = (name: string | null | undefined, fallback = '未命名档案'): string => {
  const normalized = String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return normalized || fallback;
};

export const normalizeBackupData = (value: unknown): MahjongBackupData => {
  if (!value || typeof value !== 'object') {
    throw new Error('不是有效的牌局档案');
  }

  const raw = value as MahjongBackupData;
  return {
    exported_at: raw.exported_at,
    app_version: raw.app_version,
    data_file: raw.data_file,
    users: asArray<User>(raw.users),
    games: asArray<Game>(raw.games),
    players: asArray<Player>(raw.players),
    scores: asArray<ScoreRecord>(raw.scores),
    penalties: asArray<Penalty>(raw.penalties),
    game_results: asArray<GameResult>(raw.game_results),
  };
};

export const deriveImportDataFileName = (fileName: string, data: MahjongBackupData): string => {
  const fromMeta = normalizeDataFileName(data.data_file?.name, '');
  if (fromMeta) return fromMeta;

  const fromUser = normalizeDataFileName(data.users?.[0]?.code, '');
  if (fromUser && !LEGACY_DEFAULT_CODES.has(fromUser)) return fromUser;

  return normalizeDataFileName(fileName, '导入档案');
};

export const createBlankDataFile = async (name: string): Promise<User> => {
  const now = new Date().toISOString();
  const user: User = {
    id: crypto.randomUUID(),
    code: normalizeDataFileName(name, '新档案'),
    created_at: now,
    last_login_at: now,
  };
  await db.users.add(user);
  return user;
};

export const renameDataFile = async (userId: string, name: string): Promise<void> => {
  await db.users.update(userId, {
    code: normalizeDataFileName(name, '未命名档案'),
    last_login_at: new Date().toISOString(),
  });
};

export const loadDataFileSummaries = async (): Promise<DataFileSummary[]> => {
  const users = await db.users.toArray();

  const summaries = await Promise.all(users.map(async (user) => {
    const games = await db.games.where('creator_id').equals(user.id).toArray();
    const finishedGames = games.filter((game) => game.is_completed || game.status === 'finished');
    const lastGame = [...games].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      id: user.id,
      name: getDataFileName(user),
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      games_count: games.length,
      finished_games_count: finishedGames.length,
      last_game_at: lastGame?.created_at,
    };
  }));

  return summaries.sort((a, b) => {
    const aTime = new Date(a.last_game_at || a.last_login_at || a.created_at).getTime();
    const bTime = new Date(b.last_game_at || b.last_login_at || b.created_at).getTime();
    return bTime - aTime;
  });
};

export const deleteDataFile = async (userId: string): Promise<void> => {
  const games = await db.games.where('creator_id').equals(userId).toArray();
  const gameIds = games.map((game) => game.id);

  await db.transaction('rw', [db.users, db.games, db.players, db.scores, db.penalties, db.game_results], async () => {
    if (gameIds.length > 0) {
      await db.scores.where('game_id').anyOf(gameIds).delete();
      await db.penalties.where('game_id').anyOf(gameIds).delete();
      await db.players.where('game_id').anyOf(gameIds).delete();
      await db.game_results.where('game_id').anyOf(gameIds).delete();
      await db.games.where('id').anyOf(gameIds).delete();
    }
    await db.users.delete(userId);
  });
};

export const buildExportDataForUser = async (userId: string): Promise<MahjongBackupData> => {
  const user = await db.users.get(userId);
  if (!user) throw new Error('档案不存在');

  const games = (await db.games.where('creator_id').equals(userId).toArray()).map((game) => ({
    ...game,
    source_game_id: game.source_game_id || game.id,
    source_data_file_id: game.source_data_file_id || user.id,
  }));
  const gameIds = games.map((game) => game.id);

  const players = gameIds.length > 0
    ? (await db.players.where('game_id').anyOf(gameIds).toArray()).map((player) => ({
      ...player,
      name: normalizePlayerName(player.name, player.player_id),
    }))
    : [];
  const scores = gameIds.length > 0 ? await db.scores.where('game_id').anyOf(gameIds).toArray() : [];
  const penalties = gameIds.length > 0 ? await db.penalties.where('game_id').anyOf(gameIds).toArray() : [];
  const game_results = gameIds.length > 0
    ? (await db.game_results.where('game_id').anyOf(gameIds).toArray()).map((result) => ({
      ...result,
      player_name: normalizePlayerName(result.player_name, result.player_id),
    }))
    : [];

  return {
    exported_at: new Date().toISOString(),
    app_version: '1.5.1',
    data_file: {
      id: user.id,
      name: getDataFileName(user),
    },
    users: [user],
    games,
    players,
    scores,
    penalties,
    game_results,
  };
};

const getGameSourceKey = (game: Game): string | null => {
  return game.source_game_id || game.id || null;
};

const getGameFingerprint = (game: Game, players: Player[] = []): string => {
  const playerNames = players
    .map((player) => normalizePlayerName(player.name, player.player_id))
    .filter(Boolean)
    .sort()
    .join(',');

  return [
    game.created_at || '',
    game.completed_at || '',
    game.game_name || '',
    String(game.current_round || ''),
    String(game.current_game || ''),
    game.status || '',
    playerNames,
  ].join('|');
};

const remapBackupIntoUser = (data: MahjongBackupData, targetUserId: string) => {
  const originalGames = data.games || [];
  const importedAt = new Date().toISOString();
  const gameIdMap = new Map<string, string>();

  originalGames.forEach((game) => {
    if (game.id) {
      gameIdMap.set(game.id, crypto.randomUUID());
    }
  });

  const games: Game[] = originalGames
    .filter((game) => game.id && gameIdMap.has(game.id))
    .map((game) => ({
      ...game,
      id: gameIdMap.get(game.id)!,
      creator_id: targetUserId,
      source_game_id: getGameSourceKey(game) || game.id,
      source_data_file_id: game.source_data_file_id || data.data_file?.id,
      source_imported_at: game.source_imported_at || importedAt,
      created_at: game.created_at || new Date().toISOString(),
    }));

  const players: Player[] = (data.players || [])
    .filter((player) => gameIdMap.has(player.game_id))
    .map((player) => ({
      ...player,
      id: crypto.randomUUID(),
      game_id: gameIdMap.get(player.game_id)!,
      name: normalizePlayerName(player.name, player.player_id),
      created_at: player.created_at || new Date().toISOString(),
    }));

  const scores: ScoreRecord[] = (data.scores || [])
    .filter((score) => gameIdMap.has(score.game_id))
    .map((score) => ({
      ...score,
      id: crypto.randomUUID(),
      game_id: gameIdMap.get(score.game_id)!,
      created_at: score.created_at || new Date().toISOString(),
    }));

  const penalties: Penalty[] = (data.penalties || [])
    .filter((penalty) => gameIdMap.has(penalty.game_id))
    .map((penalty) => ({
      ...penalty,
      id: crypto.randomUUID(),
      game_id: gameIdMap.get(penalty.game_id)!,
      created_at: penalty.created_at || new Date().toISOString(),
    }));

  const game_results: GameResult[] = (data.game_results || [])
    .filter((result) => gameIdMap.has(result.game_id))
    .map((result) => ({
      ...result,
      id: crypto.randomUUID(),
      game_id: gameIdMap.get(result.game_id)!,
      player_name: normalizePlayerName(result.player_name, result.player_id),
      created_at: result.created_at || new Date().toISOString(),
    }));

  return { games, players, scores, penalties, game_results };
};

export const importBackupAsNewDataFile = async (
  data: MahjongBackupData,
  name: string
): Promise<{ user: User; counts: ImportedDataCounts }> => {
  const now = new Date().toISOString();
  const user: User = {
    id: crypto.randomUUID(),
    code: normalizeDataFileName(name, '导入档案'),
    created_at: now,
    last_login_at: now,
  };
  const mapped = remapBackupIntoUser(data, user.id);

  await db.transaction('rw', [db.users, db.games, db.players, db.scores, db.penalties, db.game_results], async () => {
    await db.users.add(user);
    if (mapped.games.length > 0) await db.games.bulkAdd(mapped.games);
    if (mapped.players.length > 0) await db.players.bulkAdd(mapped.players);
    if (mapped.scores.length > 0) await db.scores.bulkAdd(mapped.scores);
    if (mapped.penalties.length > 0) await db.penalties.bulkAdd(mapped.penalties);
    if (mapped.game_results.length > 0) await db.game_results.bulkAdd(mapped.game_results);
  });

  return {
    user,
    counts: {
      games: mapped.games.length,
      players: mapped.players.length,
      scores: mapped.scores.length,
      penalties: mapped.penalties.length,
      game_results: mapped.game_results.length,
    },
  };
};

export const mergeBackupIntoDataFile = async (
  data: MahjongBackupData,
  targetUserId: string
): Promise<ImportedDataCounts> => {
  const incomingGames = data.games || [];
  const existingGames = await db.games.where('creator_id').equals(targetUserId).toArray();
  const existingGameIds = existingGames.map((game) => game.id);
  const existingPlayers = existingGameIds.length > 0
    ? await db.players.where('game_id').anyOf(existingGameIds).toArray()
    : [];
  const incomingPlayers = data.players || [];

  const playersByGameId = (players: Player[]) => {
    const map = new Map<string, Player[]>();
    players.forEach((player) => {
      const list = map.get(player.game_id) || [];
      list.push(player);
      map.set(player.game_id, list);
    });
    return map;
  };

  const existingPlayersByGameId = playersByGameId(existingPlayers);
  const incomingPlayersByGameId = playersByGameId(incomingPlayers);
  const existingKeys = new Set<string>();

  existingGames.forEach((game) => {
    const sourceKey = getGameSourceKey(game);
    if (sourceKey) existingKeys.add(`source:${sourceKey}`);
    existingKeys.add(`fingerprint:${getGameFingerprint(game, existingPlayersByGameId.get(game.id) || [])}`);
  });

  const uniqueGames: Game[] = [];
  let skippedGames = 0;

  incomingGames.forEach((game) => {
    const sourceKey = getGameSourceKey(game);
    const fingerprint = getGameFingerprint(game, incomingPlayersByGameId.get(game.id) || []);
    const isDuplicate = (sourceKey && existingKeys.has(`source:${sourceKey}`)) ||
      existingKeys.has(`fingerprint:${fingerprint}`);

    if (isDuplicate) {
      skippedGames += 1;
      return;
    }

    uniqueGames.push(game);
    if (sourceKey) existingKeys.add(`source:${sourceKey}`);
    existingKeys.add(`fingerprint:${fingerprint}`);
  });

  const uniqueGameIds = new Set(uniqueGames.map((game) => game.id));
  const uniqueData: MahjongBackupData = {
    ...data,
    games: uniqueGames,
    players: (data.players || []).filter((player) => uniqueGameIds.has(player.game_id)),
    scores: (data.scores || []).filter((score) => uniqueGameIds.has(score.game_id)),
    penalties: (data.penalties || []).filter((penalty) => uniqueGameIds.has(penalty.game_id)),
    game_results: (data.game_results || []).filter((result) => uniqueGameIds.has(result.game_id)),
  };

  const mapped = remapBackupIntoUser(uniqueData, targetUserId);

  await db.transaction('rw', [db.games, db.players, db.scores, db.penalties, db.game_results], async () => {
    if (mapped.games.length > 0) await db.games.bulkAdd(mapped.games);
    if (mapped.players.length > 0) await db.players.bulkAdd(mapped.players);
    if (mapped.scores.length > 0) await db.scores.bulkAdd(mapped.scores);
    if (mapped.penalties.length > 0) await db.penalties.bulkAdd(mapped.penalties);
    if (mapped.game_results.length > 0) await db.game_results.bulkAdd(mapped.game_results);
  });

  return {
    games: mapped.games.length,
    players: mapped.players.length,
    scores: mapped.scores.length,
    penalties: mapped.penalties.length,
    game_results: mapped.game_results.length,
    skipped_games: skippedGames,
  };
};
