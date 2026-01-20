import { useEffect, useState } from 'react';
import { User, Position, PlayerId } from '../lib/types';
import { db } from '../lib/db';
import { ArrowLeft, ArrowUpDown } from 'lucide-react';

interface PlayerStats {
  player_name: string;
  games_played: number;
  total_game_score: number;
  total_standard_score: number;
  average_standard_score: number;
}

interface PlayerDetailStats {
  player_name: string;
  total_rounds: number;
  win_rounds: number;
  self_draw_rounds: number;
  loser_rounds: number;
  win_rate: number;
  self_draw_rate: number;
  loser_rate: number;
  avg_win_fan: number;
  avg_loser_fan: number;
}

interface PlayerStatsPageProps {
  user: User;
  onBack: () => void;
}

type SortField = 'games_played' | 'total_game_score' | 'total_standard_score' | 'average_standard_score';
type SortDirection = 'asc' | 'desc';

const getPositionForPlayerInRound = (playerId: PlayerId, roundIndex: number): Position => {
  const rotations: Record<PlayerId, Position[]> = {
    A: ['east', 'south', 'north', 'west'],
    B: ['south', 'east', 'west', 'north'],
    C: ['west', 'north', 'east', 'south'],
    D: ['north', 'west', 'south', 'east'],
  };
  return rotations[playerId][roundIndex % 4];
};

const calculateStandardScore = (rank: number): number => {
  const scores = [4, 2, 1, 0];
  return scores[rank - 1];
};

const calculateGameResultsFromDetails = async (
  gameId: string
): Promise<{ player_name: string; final_score: number; standard_score: number }[] | null> => {
  const players = await db.players.where('game_id').equals(gameId).toArray();

  if (!players || players.length === 0) {
    return null;
  }

  const scores = await db.scores.where('game_id').equals(gameId).toArray();
  scores.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const penalty = await db.penalties.where('game_id').equals(gameId).first();

  const playerScores: Record<string, number> = {};
  players.forEach((player) => {
    playerScores[player.id] = 0;
  });

  if (scores && scores.length > 0) {
    scores.forEach((score) => {
      const scoreChanges = score.score_changes as Record<Position, number>;
      const scoreRoundIndex = Math.floor((score.game_number - 1) / 4);

      players.forEach((player) => {
        const playerPositionAtScoreTime = getPositionForPlayerInRound(player.player_id as PlayerId, scoreRoundIndex);
        const change = scoreChanges[playerPositionAtScoreTime] || 0;
        playerScores[player.id] += change;
      });
    });
  }

  if (penalty) {
    const penaltyChanges = penalty.penalty_changes as Record<Position, number>;

    players.forEach((player) => {
      const change = penaltyChanges[player.position] || 0;
      playerScores[player.id] += change;
    });
  }

  const playersWithScore = players.map((player) => ({
    player_id: player.player_id as PlayerId,
    name: player.name,
    score: playerScores[player.id],
  }));

  const sortedPlayers = [...playersWithScore].sort((a, b) => b.score - a.score);

  const ranks: number[] = [];
  let currentRank = 1;
  for (let i = 0; i < sortedPlayers.length; i++) {
    if (i > 0 && sortedPlayers[i].score === sortedPlayers[i - 1].score) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(currentRank);
    }
    currentRank++;
  }

  const results = sortedPlayers.map((player, index) => {
    const rank = ranks[index];
    const sameRankCount = ranks.filter((r) => r === rank).length;

    let standardScore: number;
    if (sameRankCount === 1) {
      standardScore = calculateStandardScore(rank);
    } else {
      const startIndex = rank - 1;
      const endIndex = startIndex + sameRankCount - 1;
      const totalScore = [4, 2, 1, 0].slice(startIndex, endIndex + 1).reduce((a, b) => a + b, 0);
      standardScore = totalScore / sameRankCount;
    }

    return {
      player_name: player.name,
      final_score: player.score,
      standard_score: standardScore,
    };
  });

  return results;
};

export default function PlayerStatsPage({ user, onBack }: PlayerStatsPageProps) {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [detailStats, setDetailStats] = useState<PlayerDetailStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('total_standard_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadStats();
  }, [user.id]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedStats = [...stats].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    const comparison = (aValue - bValue) * multiplier;

    if (comparison === 0 && sortField === 'total_standard_score') {
      return b.total_game_score - a.total_game_score;
    }

    return comparison;
  });

  const loadStats = async () => {
    setLoading(true);

    const games = await db.games.where('creator_id').equals(user.id).toArray();

    const finishedGames = games.filter((g) => g.is_completed || g.status === 'finished');

    if (finishedGames.length === 0) {
      setStats([]);
      setDetailStats([]);
      setLoading(false);
      return;
    }

    const gameIds = finishedGames.map((g) => g.id);

    const results = await db.game_results
      .where('game_id')
      .anyOf(gameIds)
      .toArray();

    const playerMap = new Map<string, { totalStandardScore: number; totalGameScore: number; count: number }>();

    await Promise.all(
      gameIds.map(async (gameId) => {
        const gameResultRows = results.filter((r) => r.game_id === gameId);

        let gameResultsForStats:
          | { player_name: string; final_score: number; standard_score: number }[]
          | null = null;

        if (gameResultRows.length > 0) {
          gameResultsForStats = gameResultRows.map((r) => ({
            player_name: r.player_name,
            final_score: Number(r.final_score),
            standard_score: Number(r.standard_score),
          }));
        } else {
          gameResultsForStats = await calculateGameResultsFromDetails(gameId);
        }

        if (!gameResultsForStats) {
          return;
        }

        gameResultsForStats.forEach((result) => {
          const existing = playerMap.get(result.player_name) || {
            totalStandardScore: 0,
            totalGameScore: 0,
            count: 0,
          };
          playerMap.set(result.player_name, {
            totalStandardScore: existing.totalStandardScore + Number(result.standard_score),
            totalGameScore: existing.totalGameScore + Number(result.final_score),
            count: existing.count + 1,
          });
        });
      })
    );

    const playerStats: PlayerStats[] = Array.from(playerMap.entries()).map(([name, data]) => ({
      player_name: name,
      games_played: data.count,
      total_game_score: data.totalGameScore,
      total_standard_score: data.totalStandardScore,
      average_standard_score: data.totalStandardScore / data.count,
    }));

    setStats(playerStats);

    await loadDetailStats(gameIds);

    setLoading(false);
  };

  const loadDetailStats = async (gameIds: string[]) => {
    const players = await db.players
      .where('game_id')
      .anyOf(gameIds)
      .toArray();

    if (!players || players.length === 0) {
      return;
    }

    const scores = await db.scores
      .where('game_id')
      .anyOf(gameIds)
      .toArray();

    if (!scores) {
      return;
    }

    const playerStatsMap = new Map<string, {
      totalRounds: number;
      winRounds: number;
      selfDrawRounds: number;
      loserRounds: number;
      totalWinFan: number;
      totalLoserFan: number;
    }>();

    players.forEach((player) => {
      if (!playerStatsMap.has(player.name)) {
        playerStatsMap.set(player.name, {
          totalRounds: 0,
          winRounds: 0,
          selfDrawRounds: 0,
          loserRounds: 0,
          totalWinFan: 0,
          totalLoserFan: 0,
        });
      }
    });

    const playerIdToName = new Map<string, Map<string, string>>();
    players.forEach((player) => {
      if (!playerIdToName.has(player.game_id)) {
        playerIdToName.set(player.game_id, new Map());
      }
      playerIdToName.get(player.game_id)!.set(player.player_id, player.name);
    });

    scores.forEach((score) => {
      const gamePlayerMap = playerIdToName.get(score.game_id);
      if (!gamePlayerMap) return;

      const winnerName = score.winner_player_id ? gamePlayerMap.get(score.winner_player_id) : null;
      const loserName = score.loser_player_id ? gamePlayerMap.get(score.loser_player_id) : null;

      gamePlayerMap.forEach((playerName) => {
        const stats = playerStatsMap.get(playerName);
        if (!stats) return;

        stats.totalRounds++;

        if (playerName === winnerName) {
          stats.winRounds++;
          stats.totalWinFan += score.base_score;
          if (!score.loser_position) {
            stats.selfDrawRounds++;
          }
        }

        if (playerName === loserName) {
          stats.loserRounds++;
          stats.totalLoserFan += score.base_score;
        }
      });
    });

    const detailStatsArray: PlayerDetailStats[] = Array.from(playerStatsMap.entries())
      .map(([name, data]) => ({
        player_name: name,
        total_rounds: data.totalRounds,
        win_rounds: data.winRounds,
        self_draw_rounds: data.selfDrawRounds,
        loser_rounds: data.loserRounds,
        win_rate: data.totalRounds > 0 ? (data.winRounds / data.totalRounds) * 100 : 0,
        self_draw_rate: data.winRounds > 0 ? (data.selfDrawRounds / data.winRounds) * 100 : 0,
        loser_rate: data.totalRounds > 0 ? (data.loserRounds / data.totalRounds) * 100 : 0,
        avg_win_fan: data.winRounds > 0 ? data.totalWinFan / data.winRounds : 0,
        avg_loser_fan: data.loserRounds > 0 ? data.totalLoserFan / data.loserRounds : 0,
      }))
      .filter(stat => stat.total_rounds > 0);

    setDetailStats(detailStatsArray);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
<div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800">成绩统计</h1>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : stats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无已完成的比赛数据
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-4">战绩一览</h2>
              <div className="overflow-x-auto mb-8">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-2 font-bold text-gray-700">选手</th>
                      <th className="text-center py-3 px-2 font-bold text-gray-700">
                        <button
                          onClick={() => handleSort('games_played')}
                          className="flex items-center justify-center gap-1 w-full hover:text-orange-600 transition-colors"
                        >
                          场次
                          <ArrowUpDown size={14} />
                        </button>
                      </th>
                      <th className="text-center py-3 px-2 font-bold text-gray-700">
                        <button
                          onClick={() => handleSort('total_standard_score')}
                          className="flex items-center justify-center gap-1 w-full hover:text-orange-600 transition-colors"
                        >
                          总标准分
                          <ArrowUpDown size={14} />
                        </button>
                      </th>
                      <th className="text-center py-3 px-2 font-bold text-gray-700">
                        <button
                          onClick={() => handleSort('average_standard_score')}
                          className="flex items-center justify-center gap-1 w-full hover:text-orange-600 transition-colors"
                        >
                          平均标准分
                          <ArrowUpDown size={14} />
                        </button>
                      </th>
                      <th className="text-center py-3 px-2 font-bold text-gray-700">
                        <button
                          onClick={() => handleSort('total_game_score')}
                          className="flex items-center justify-center gap-1 w-full hover:text-orange-600 transition-colors"
                        >
                          总比赛分
                          <ArrowUpDown size={14} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStats.map((stat) => (
                      <tr
                        key={stat.player_name}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-2 font-medium text-gray-800">
                          {stat.player_name}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-800">
                          {stat.games_played}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="font-bold text-gray-800">
                            {stat.total_standard_score.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="font-bold text-gray-800">
                            {stat.average_standard_score.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="font-bold text-gray-800">
                            {stat.total_game_score > 0 ? '+' : ''}{stat.total_game_score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detailStats.length > 0 && (
                <>
                  <h2 className="text-xl font-bold text-gray-800 mb-4 mt-8">详细数据</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-3 px-2 font-bold text-gray-700">选手</th>
                          <th className="text-center py-3 px-2 font-bold text-gray-700">总盘数</th>
                          <th className="text-center py-3 px-2 font-bold text-gray-700">和牌盘数</th>
                          <th className="text-center py-3 px-2 font-bold text-gray-700">和牌率</th>
                          <th className="text-center py-3 px-2 font-bold text-gray-700">和牌平均番</th>
                          <th className="text-center py-3 px-2 font-bold text-gray-700">自摸盘数</th>
                          <th className="text-center py-3 px-2 font-bold text-gray-700">自摸率</th>
                          <th className="text-center py-3 px-2 font-bold text-gray-700">放铳盘数</th>
                          <th className="text-center py-3 px-2 font-bold text-gray-700">放铳率</th>
                          <th className="text-center py-3 px-2 font-bold text-gray-700">放铳平均番</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailStats.map((stat) => (
                          <tr
                            key={stat.player_name}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-3 px-2 font-medium text-gray-800">
                              {stat.player_name}
                            </td>
                            <td className="py-3 px-2 text-center text-gray-800">
                              {stat.total_rounds}
                            </td>
                            <td className="py-3 px-2 text-center text-gray-800">
                              {stat.win_rounds}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className="font-bold text-green-600">
                                {stat.win_rate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center text-gray-800">
                              {stat.win_rounds > 0 ? stat.avg_win_fan.toFixed(1) : '-'}
                            </td>
                            <td className="py-3 px-2 text-center text-gray-800">
                              {stat.self_draw_rounds}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className="font-bold text-blue-600">
                                {stat.self_draw_rate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center text-gray-800">
                              {stat.loser_rounds}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className="font-bold text-red-600">
                                {stat.loser_rate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center text-gray-800">
                              {stat.loser_rounds > 0 ? stat.avg_loser_fan.toFixed(1) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
