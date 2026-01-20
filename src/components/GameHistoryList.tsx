import { useEffect, useState } from 'react';
import { Game } from '../lib/types';
import { db } from '../lib/db';
import { X, Calendar, Trophy, Play, Trash2 } from 'lucide-react';

interface GameHistoryListProps {
  onClose: () => void;
  onSelectGame: (gameId: string) => void;
  onContinueGame: (gameId: string) => void;
  onDeleteGame: (gameId: string) => void;
  creatorId: string;
  currentGameId?: string | null;
}

export default function GameHistoryList({ onClose, onSelectGame, onContinueGame, onDeleteGame, creatorId, currentGameId }: GameHistoryListProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);

  useEffect(() => {
    loadGames();
  }, [creatorId, currentGameId]);

  const loadGames = async () => {
    const data = await db.games.where('creator_id').equals(creatorId).toArray();

    if (data) {
      const sortedGames = data.sort((a, b) => {
        if (currentGameId) {
          if (a.id === currentGameId) return -1;
          if (b.id === currentGameId) return 1;
        }
        if (a.status !== 'finished' && b.status === 'finished') return -1;
        if (a.status === 'finished' && b.status !== 'finished') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setGames(sortedGames);
    }
  };

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Trophy className="text-yellow-500" />
            游戏记录
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {games.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              暂无游戏记录
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const isCurrentGame = currentGameId === game.id;
                const isDeleting = deletingGameId === game.id;
                return (
                <div
                  key={game.id}
                  className={`w-full p-4 rounded-xl shadow-sm transition-all ${
                    isDeleting
                      ? 'bg-red-100 opacity-50 pointer-events-none'
                      : isCurrentGame
                      ? 'bg-gradient-to-r from-orange-100 to-yellow-100 border-2 border-orange-400 shadow-md'
                      : 'bg-gradient-to-r from-blue-50 to-green-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onSelectGame(game.id)}
                      className="flex items-center gap-3 flex-1 text-left hover:opacity-75 transition-opacity"
                    >
                      <Calendar className="text-blue-500" size={20} />
                      <div>
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
                      {!game.is_completed && game.status !== 'finished' && !isCurrentGame && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onContinueGame(game.id);
                          }}
                          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm"
                        >
                          <Play size={14} />
                          继续
                        </button>
                      )}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setDeletingGameId(game.id);
                          await onDeleteGame(game.id);
                          await loadGames();
                          setDeletingGameId(null);
                        }}
                        className="p-2 hover:bg-red-100 text-red-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="删除比赛"
                        disabled={isDeleting}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                  {isCurrentGame && (
                    <div className="mt-2 flex items-center gap-1 text-orange-600 text-xs font-medium">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      当前比赛
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
