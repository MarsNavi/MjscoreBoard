import { useCallback, useEffect, useState } from 'react';
import { User, Game } from '../lib/types';
import { db } from '../lib/db';
import { ArrowLeft, Calendar, Trophy, Play, Trash2 } from 'lucide-react';
import { buildPlayersWithCalculatedScores } from '../lib/gameScoring';
import { normalizePlayerName } from '../lib/playerNames';

interface GameHistoryPageProps {
  user: User;
  onBack: () => void;
  onSelectGame: (gameId: string) => void;
  onContinueGame: (gameId: string) => void;
  onDeleteGame: (gameId: string) => void;
}

interface GameResult {
  player_name: string;
  final_score: number;
}

interface PlayerDailyTotal {
  player_name: string;
  total_score: number;
}

const calculateGameScoresFromDetails = async (gameId: string): Promise<GameResult[] | null> => {
  const players = await db.players.where('game_id').equals(gameId).toArray();

  if (!players || players.length === 0) {
    return null;
  }

  const scores = await db.scores.where('game_id').equals(gameId).toArray();
  const penalty = await db.penalties.where('game_id').equals(gameId).first();
  const playersWithScores = buildPlayersWithCalculatedScores(players, scores, penalty);
  return playersWithScores.map((player) => ({
    player_name: normalizePlayerName(player.name, player.player_id),
    final_score: player.score,
  }));
};

export default function GameHistoryPage({
  user,
  onBack,
  onSelectGame,
  onContinueGame,
  onDeleteGame,
}: GameHistoryPageProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [gameResults, setGameResults] = useState<Record<string, GameResult[]>>({});
  const [playerDailyTotals, setPlayerDailyTotals] = useState<PlayerDailyTotal[]>([]);

  const loadGames = useCallback(async () => {
    setLoading(true);
    const data = await db.games.where('creator_id').equals(user.id).toArray();

    if (data) {
      const sortedGames = data.sort((a, b) => {
        if (a.status !== 'finished' && b.status === 'finished') return -1;
        if (a.status === 'finished' && b.status !== 'finished') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setGames(sortedGames);

      const allGameIds = sortedGames.map(g => g.id);

      if (allGameIds.length > 0) {
        const resultsMap: Record<string, GameResult[]> = {};

        await Promise.all(
          allGameIds.map(async (gameId) => {
            // 强制从明细计算，确保数据准确
            const calculatedResults = await calculateGameScoresFromDetails(gameId);
            if (calculatedResults && calculatedResults.length > 0) {
              resultsMap[gameId] = calculatedResults;
            }
          })
        );

        setGameResults(resultsMap);
      }

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentGames = await db.games
        .where('creator_id')
        .equals(user.id)
        .filter(g => (!!g.is_completed || g.status === 'finished') && new Date(g.created_at) >= twentyFourHoursAgo && new Date(g.created_at) <= now)
        .toArray();

      if (recentGames && recentGames.length > 0) {
        const recentGameIds = recentGames.map(g => g.id);
        const playerTotals: Record<string, number> = {};

        await Promise.all(
          recentGameIds.map(async (gameId) => {
            const results = await calculateGameScoresFromDetails(gameId);
            if (results) {
              results.forEach(result => {
                const playerName = normalizePlayerName(result.player_name);
                if (!playerName) return;

                if (!playerTotals[playerName]) {
                  playerTotals[playerName] = 0;
                }
                playerTotals[playerName] += result.final_score;
              });
            }
          })
        );

        const totalsArray: PlayerDailyTotal[] = Object.entries(playerTotals)
          .map(([player_name, total_score]) => ({ player_name, total_score }))
          .sort((a, b) => b.total_score - a.total_score);

        setPlayerDailyTotals(totalsArray);
      } else {
        setPlayerDailyTotals([]);
      }
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getGameStatus = (game: Game) => {
    if (game.is_completed) {
      return '已完成';
    }
    if (game.status === 'finished') {
      return '已结束';
    }
    return `进行中 (${game.current_game}/16)`;
  };

  const handleDelete = async (gameId: string) => {
    setDeletingGameId(gameId);
    await onDeleteGame(gameId);
    await loadGames();
    setDeletingGameId(null);
  };

  const getSortedResults = (gameId: string) => {
    const results = gameResults[gameId];
    if (!results || results.length === 0) return null;

    return [...results].sort((a, b) => b.final_score - a.final_score);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              比赛历史
            </h1>
          </div>

          {!loading && playerDailyTotals.length > 0 && (
            <div className="mb-4 p-4 bg-gradient-to-r from-orange-100 to-rose-100 rounded-xl border-2 border-orange-200">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">24小时内累计</span>
                <span className="text-xs text-gray-600">
                  过去24小时
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {playerDailyTotals.map((player, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/50 rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-700 text-sm">{player.player_name}</span>
                    <span className="font-bold text-gray-800">
                      {player.total_score > 0 ? '+' : ''}{player.total_score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : games.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无比赛记录</div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const isDeleting = deletingGameId === game.id;
                return (
                  <div
                    key={game.id}
                    className={`w-full p-4 rounded-xl border-2 shadow-sm transition-all ${
                      isDeleting
                        ? 'bg-red-100 opacity-50 pointer-events-none border-red-200'
                        : 'bg-white border-orange-200 hover:border-orange-400 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onSelectGame(game.id)}
                        className="flex items-center gap-3 flex-1 text-left hover:opacity-75 transition-opacity"
                      >
                        <Calendar className="text-orange-500" size={20} />
                        <div className="flex-1">
                          {game.game_name && (
                            <div className="font-bold text-lg text-gray-900 mb-1">
                              {game.game_name}
                            </div>
                          )}
                          <div className={`${game.game_name ? 'text-sm' : 'font-semibold'} text-gray-800`}>
                            {formatDate(game.created_at)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {getGameStatus(game)}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        {!game.is_completed && game.status !== 'finished' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onContinueGame(game.id);
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm"
                          >
                            <Play size={14} />
                            继续
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(game.id);
                          }}
                          className="p-2 hover:bg-red-100 text-red-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="删除比赛"
                          disabled={isDeleting}
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    {getSortedResults(game.id) && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex justify-between items-center text-sm">
                          {getSortedResults(game.id)!.map((result, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="font-medium text-gray-700">{result.player_name}</span>
                              <span className="font-bold text-gray-800">
                                {result.final_score > 0 ? '+' : ''}{result.final_score}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {isDeleting && (
                      <div className="mt-2 flex items-center gap-1 text-red-600 text-xs font-medium">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        删除中...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
