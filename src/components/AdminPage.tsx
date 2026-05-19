import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/db';
import { ArrowLeft, Users, Trophy, Hash } from 'lucide-react';
import { normalizePlayerName } from '../lib/playerNames';

interface UserStats {
  id: string;
  code: string;
  created_at: string;
  total_games: number;
  total_scores: number;
  unique_player_names: number;
}

interface AdminPageProps {
  onBack: () => void;
  currentUserId: string;
}

export function AdminPage({ onBack, currentUserId }: AdminPageProps) {
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadUserStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const users = await db.users.orderBy('created_at').reverse().toArray();

      const statsPromises = (users || []).map(async (user) => {
        const userGames = await db.games.where('creator_id').equals(user.id).toArray();

        const gameIds = (userGames || []).map(g => g.id);
        const totalGames = gameIds.length;

        let totalScores = 0;
        let uniquePlayerNames = 0;

        if (gameIds.length > 0) {
          const scoresCount = await db.scores
            .where('game_id')
            .anyOf(gameIds)
            .count();

          const players = await db.players
            .where('game_id')
            .anyOf(gameIds)
            .toArray();

          totalScores = scoresCount || 0;

          uniquePlayerNames = new Set(
            (players || []).map(p => normalizePlayerName(p.name, p.player_id))
          ).size;
        }

        return {
          id: user.id,
          code: user.code,
          created_at: user.created_at,
          total_games: totalGames,
          total_scores: totalScores,
          unique_player_names: uniquePlayerNames,
        };
      });

      const stats = await Promise.all(statsPromises);
      setUserStats(stats);
    } catch (err) {
      console.error('加载统计数据失败:', err);
      setError('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAdminAccess = useCallback(async () => {
    try {
      const user = await db.users.get(currentUserId);

      if (user?.code === 'micken') {
        setIsAdmin(true);
        await loadUserStats();
      } else {
        setIsAdmin(false);
        setError('无权限访问此页面');
        setLoading(false);
      }
    } catch (err) {
      console.error('检查权限失败:', err);
      setError('检查权限失败');
      setLoading(false);
    }
  }, [currentUserId, loadUserStats]);

  useEffect(() => {
    void checkAdminAccess();
  }, [checkAdminAccess]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
        <div className="text-lg text-gray-600">正在加载…</div>
      </div>
    );
  }

  if (!isAdmin || error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-xl mb-4">{error || '无权限访问'}</div>
          <button
            onClick={onBack}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-all"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-auto bg-gradient-to-br from-blue-50 to-green-50">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="text-white" size={28} />
              <h1 className="text-2xl font-bold text-white">管理面板</h1>
            </div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all"
            >
              <ArrowLeft size={20} />
              返回
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">用户统计</h2>
              <p className="text-gray-600">共 {userStats.length} 个注册用户</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">用户名</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">注册时间</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      <div className="flex items-center justify-center gap-1">
                        <Trophy size={16} />
                        <span>比赛数</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      <div className="flex items-center justify-center gap-1">
                        <Hash size={16} />
                        <span>计分盘数</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      <div className="flex items-center justify-center gap-1">
                        <Users size={16} />
                        <span>选手数</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userStats.map((user, index) => (
                    <tr
                      key={user.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {user.code}
                        {user.code === 'Micken' && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">管理员</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-blue-600">
                        {user.total_games}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-green-600">
                        {user.total_scores}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-purple-600">
                        {user.unique_player_names}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {userStats.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                暂无用户数据
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
