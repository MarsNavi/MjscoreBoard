import { useCallback, useEffect, useState } from 'react';
import { User, GameResult } from '../lib/types';
import { db } from '../lib/db';
import { ArrowLeft, ArrowUpDown, Loader2, Share2 } from 'lucide-react';
import { buildGameResults, buildPlayersWithCalculatedScores } from '../lib/gameScoring';
import { normalizePlayerName } from '../lib/playerNames';
import { blobToBase64, createStatsShareImage } from '../lib/statsShareImage';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

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

interface PlayerWinningStats {
  player_name: string;
  total_win_rounds: number;
  win_8_15: number;
  win_16_30: number;
  win_31_63: number;
  win_64_plus: number;
  max_fan_rong: number;
  max_fan_self_draw: number;
}

interface PlayerStatsPageProps {
  user: User;
  onBack: () => void;
}

type SortField = 'games_played' | 'total_game_score' | 'total_standard_score' | 'average_standard_score';
type SortDirection = 'asc' | 'desc';

const calculateGameResultsFromDetails = async (
  gameId: string
): Promise<{ player_id: string; player_name: string; final_score: number; standard_score: number; rank: number }[] | null> => {
  const players = await db.players.where('game_id').equals(gameId).toArray();

  if (!players || players.length === 0) {
    return null;
  }

  const scores = await db.scores.where('game_id').equals(gameId).toArray();
  const penalty = await db.penalties.where('game_id').equals(gameId).first();
  const playersWithScores = buildPlayersWithCalculatedScores(players, scores, penalty);
  const results = buildGameResults(gameId, playersWithScores);
  return results.map((result) => ({
    player_id: result.player_id,
    player_name: result.player_name,
    final_score: result.final_score,
    standard_score: result.standard_score,
    rank: result.rank,
  }));
};

export default function PlayerStatsPage({ user, onBack }: PlayerStatsPageProps) {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [detailStats, setDetailStats] = useState<PlayerDetailStats[]>([]);
  const [winningStats, setWinningStats] = useState<PlayerWinningStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [sortField, setSortField] = useState<SortField>('total_standard_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  const loadDetailStats = useCallback(async (gameIds: string[]) => {
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
      win8to15: number;
      win16to30: number;
      win31to63: number;
      win64plus: number;
      maxFanRong: number;
      maxFanSelfDraw: number;
    }>();

    players.forEach((player) => {
      const playerName = normalizePlayerName(player.name, player.player_id);
      if (!playerStatsMap.has(playerName)) {
        playerStatsMap.set(playerName, {
          totalRounds: 0,
          winRounds: 0,
          selfDrawRounds: 0,
          loserRounds: 0,
          totalWinFan: 0,
          totalLoserFan: 0,
          win8to15: 0,
          win16to30: 0,
          win31to63: 0,
          win64plus: 0,
          maxFanRong: 0,
          maxFanSelfDraw: 0,
        });
      }
    });

    const playerIdToName = new Map<string, Map<string, string>>();
    players.forEach((player) => {
      if (!playerIdToName.has(player.game_id)) {
        playerIdToName.set(player.game_id, new Map());
      }
      playerIdToName.get(player.game_id)!.set(player.player_id, normalizePlayerName(player.name, player.player_id));
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
          const fan = score.base_score;
          stats.totalWinFan += fan;

          if (fan >= 8 && fan <= 15) stats.win8to15++;
          else if (fan >= 16 && fan <= 30) stats.win16to30++;
          else if (fan >= 31 && fan <= 63) stats.win31to63++;
          else if (fan >= 64) stats.win64plus++;

          if (!score.loser_position) {
            stats.selfDrawRounds++;
            if (fan > stats.maxFanSelfDraw) stats.maxFanSelfDraw = fan;
          } else {
             if (fan > stats.maxFanRong) stats.maxFanRong = fan;
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

    const validPlayers = new Set(detailStatsArray.map(s => s.player_name));
    const filteredWinningStats = Array.from(playerStatsMap.entries())
      .filter(([name]) => validPlayers.has(name))
      .map(([name, data]) => ({
        player_name: name,
        total_win_rounds: data.winRounds,
        win_8_15: data.win8to15,
        win_16_30: data.win16to30,
        win_31_63: data.win31to63,
        win_64_plus: data.win64plus,
        max_fan_rong: data.maxFanRong,
        max_fan_self_draw: data.maxFanSelfDraw,
      }));

    setDetailStats(detailStatsArray);
    setWinningStats(filteredWinningStats);
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);

    const games = await db.games.where('creator_id').equals(user.id).toArray();
    // Filter out games that are not fully completed (16 rounds)
    // Assuming 'finished' or 'is_completed' means full game
    // If you want to include incomplete games, remove this filter
    const finishedGames = games.filter((g) => g.is_completed || g.status === 'finished');

    if (finishedGames.length === 0) {
      setStats([]);
      setDetailStats([]);
      setWinningStats([]);
      setLoading(false);
      return;
    }

    const gameIds = finishedGames.map((g) => g.id);

    // Force rebuild game_results cache for all finished games to ensure consistency
    // This fixes historical data issues where game_results might be incorrect or missing
    // We calculate first, then use a transaction to delete and add to avoid race conditions causing duplicates
    
    const newGameResults: GameResult[] = [];
    
    for (const gameId of gameIds) {
      const calculatedResults = await calculateGameResultsFromDetails(gameId);
      if (calculatedResults) {
         calculatedResults.forEach(r => {
           newGameResults.push({
             id: crypto.randomUUID(),
             game_id: gameId,
             player_id: r.player_id,
             player_name: normalizePlayerName(r.player_name, r.player_id),
             final_score: r.final_score,
             rank: r.rank,
             standard_score: r.standard_score,
             created_at: new Date().toISOString()
           });
         });
      }
    }
    
    // Use transaction to atomically delete old and add new results
    await db.transaction('rw', db.game_results, async () => {
      await db.game_results.where('game_id').anyOf(gameIds).delete();
      if (newGameResults.length > 0) {
        await db.game_results.bulkAdd(newGameResults);
      }
    });

    // Use the calculated results directly for stats to avoid another DB query
    const results = newGameResults;

    const playerMap = new Map<string, { totalStandardScore: number; totalGameScore: number; count: number }>();

    await Promise.all(
      gameIds.map(async (gameId) => {
        // Find existing results for this game
        const gameResultRows = results.filter((r) => r.game_id === gameId);

        let gameResultsForStats:
          | { player_name: string; final_score: number; standard_score: number }[]
          | null = null;

        if (gameResultRows.length > 0) {
            // Since we just rebuilt the cache, we can trust the data in DB.
            // But we still sort just in case.
             gameResultsForStats = gameResultRows.map(r => ({
                player_name: normalizePlayerName(r.player_name, r.player_id),
                final_score: Number(r.final_score),
                standard_score: Number(r.standard_score)
             }));
        } else {
          // This should ideally not happen if rebuild succeeded, but as a fallback
          gameResultsForStats = await calculateGameResultsFromDetails(gameId);
        }

        if (!gameResultsForStats) {
          return;
        }

        gameResultsForStats.forEach((result) => {
          const playerName = normalizePlayerName(result.player_name);
          if (!playerName) return;

          const existing = playerMap.get(playerName) || {
            totalStandardScore: 0,
            totalGameScore: 0,
            count: 0,
          };
          playerMap.set(playerName, {
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
  }, [loadDetailStats, user.id]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const getShareFileName = () => {
    const now = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');
    return `mahjong_stats_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.png`;
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareStats = async () => {
    if (loading || sortedStats.length === 0 || sharing) return;

    setSharing(true);
    try {
      const fileName = getShareFileName();
      const blob = await createStatsShareImage({
        summaryStats: sortedStats,
        detailStats,
        winningStats,
        generatedAt: new Date(),
      });

      if (Capacitor.isNativePlatform()) {
        const data = await blobToBase64(blob);
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: '国标麻将成绩统计',
          text: '国标麻将比赛成绩统计长图',
          files: [savedFile.uri],
          dialogTitle: '分享成绩统计',
        });
        return;
      }

      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: '国标麻将成绩统计',
          text: '国标麻将比赛成绩统计长图',
          files: [file],
        });
      } else {
        downloadBlob(blob, fileName);
      }
    } catch (error) {
      console.error('Share stats failed:', error);
      alert('分享失败，请稍后重试。');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
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
            <button
              onClick={handleShareStats}
              disabled={loading || stats.length === 0 || sharing}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              {sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
              <span className="hidden sm:inline">{sharing ? '生成中' : '分享'}</span>
            </button>
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

                  {winningStats.length > 0 && (
                    <>
                      <h2 className="text-xl font-bold text-gray-800 mb-4 mt-8">和牌数据</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b-2 border-gray-200">
                              <th className="text-left py-3 px-2 font-bold text-gray-700">选手</th>
                              <th className="text-center py-3 px-2 font-bold text-gray-700">和牌总盘数</th>
                              <th className="text-center py-3 px-2 font-bold text-gray-700">8-15番</th>
                              <th className="text-center py-3 px-2 font-bold text-gray-700">16-30番</th>
                              <th className="text-center py-3 px-2 font-bold text-gray-700">31-63番</th>
                              <th className="text-center py-3 px-2 font-bold text-gray-700">64番+</th>
                              <th className="text-center py-3 px-2 font-bold text-gray-700">点和最大番</th>
                              <th className="text-center py-3 px-2 font-bold text-gray-700">自摸最大番</th>
                            </tr>
                          </thead>
                          <tbody>
                            {winningStats.map((stat) => (
                              <tr
                                key={stat.player_name}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="py-3 px-2 font-medium text-gray-800">
                                  {stat.player_name}
                                </td>
                                <td className="py-3 px-2 text-center text-gray-800">
                                  {stat.total_win_rounds}
                                </td>
                                <td className="py-3 px-2 text-center text-gray-800">
                                  {stat.win_8_15}
                                </td>
                                <td className="py-3 px-2 text-center text-gray-800">
                                  {stat.win_16_30}
                                </td>
                                <td className="py-3 px-2 text-center text-gray-800">
                                  {stat.win_31_63}
                                </td>
                                <td className="py-3 px-2 text-center text-gray-800">
                                  {stat.win_64_plus}
                                </td>
                                <td className="py-3 px-2 text-center text-gray-800">
                                  {stat.max_fan_rong}
                                </td>
                                <td className="py-3 px-2 text-center text-gray-800">
                                  {stat.max_fan_self_draw}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
