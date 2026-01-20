import { User, Position, Game, Player, ScoreRecord, Penalty, GameResult } from '../lib/types';
import { db } from '../lib/db';
import { History, TrendingUp, HelpCircle, Download, Upload, Bluetooth } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface HomePageProps {
  user: User;
  onStartNewGame: () => void;
  onViewHistory: () => void;
  onViewStats: () => void;
  onViewHelp: () => void;
  onViewDeviceDebug: () => void;
  gameName: string;
  onGameNameChange: (name: string) => void;
  tempPlayerNames: Record<Position, string>;
  onNameChange: (position: Position, name: string) => void;
}

const positionLabels: Record<Position, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

export default function HomePage({
  user,
  onStartNewGame,
  onViewHistory,
  onViewStats,
  onViewHelp,
  onViewDeviceDebug,
  gameName,
  onGameNameChange,
  tempPlayerNames,
  onNameChange,
}: HomePageProps) {
  const positions: Position[] = ['east', 'south', 'west', 'north'];
  const [commonNames, setCommonNames] = useState<string[]>([]);
  const [focusedPosition, setFocusedPosition] = useState<Position | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadCommonNames();
    loadLastGameData();
  }, [user.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setFocusedPosition(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadCommonNames = async () => {
    const games = await db.games.where('creator_id').equals(user.id).toArray();
    const gameIds = games.map(g => g.id);
    
    if (gameIds.length === 0) {
      setCommonNames([]);
      return;
    }

    const results = await db.game_results
      .where('game_id')
      .anyOf(gameIds)
      .toArray();

    const nameCounts: Record<string, number> = {};

    if (results && results.length > 0) {
      results.forEach((result) => {
        if (result.player_name) {
          nameCounts[result.player_name] = (nameCounts[result.player_name] || 0) + 1;
        }
      });
    }

    if (Object.keys(nameCounts).length === 0) {
      const players = await db.players
        .where('game_id')
        .anyOf(gameIds)
        .toArray();

      players.forEach((player) => {
        if (player.name) {
          nameCounts[player.name] = (nameCounts[player.name] || 0) + 1;
        }
      });
    }

    const sortedNames = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    setCommonNames(sortedNames);
  };

  const loadLastGameData = async () => {
    const games = await db.games.where('creator_id').equals(user.id).toArray();
    const sortedGames = games.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastGame = sortedGames[0];

    if (lastGame) {
      if (lastGame.game_name) {
        onGameNameChange(lastGame.game_name);
      }

      const players = await db.players.where('game_id').equals(lastGame.id).toArray();
      
      if (players) {
        players.forEach(player => {
          onNameChange(player.position as Position, player.name);
        });
      }
    }
  };

  const handleSelectSuggestion = (position: Position, name: string) => {
    onNameChange(position, name);
    setFocusedPosition(null);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        users?: User[];
        games?: Game[];
        players?: Player[];
        scores?: ScoreRecord[];
        penalties?: Penalty[];
        game_results?: GameResult[];
      };

      const confirmMerge = window.confirm('导入操作会将文件中的数据与当前本地数据进行合并，可能产生重复记录，确定继续吗？');
      if (!confirmMerge) {
        return;
      }

      await db.transaction('rw', [db.users, db.games, db.players, db.scores, db.penalties, db.game_results], async () => {
        if (data.users && data.users.length > 0) {
          await db.users.bulkPut(data.users as User[]);
        }
        if (data.games && data.games.length > 0) {
          await db.games.bulkPut(data.games as Game[]);
        }
        if (data.players && data.players.length > 0) {
          await db.players.bulkPut(data.players as Player[]);
        }
        if (data.scores && data.scores.length > 0) {
          await db.scores.bulkPut(data.scores as ScoreRecord[]);
        }
        if (data.penalties && data.penalties.length > 0) {
          await db.penalties.bulkPut(data.penalties as Penalty[]);
        }
        if (data.game_results && data.game_results.length > 0) {
          await db.game_results.bulkPut(data.game_results as GameResult[]);
        }
      });

      alert('导入完成，应用将自动刷新以加载合并后的数据。');
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert('数据导入失败，请检查文件格式是否正确。');
    }
  };

  const getDefaultPlaceholder = (position: Position): string => {
    const defaults: Record<Position, string> = {
      east: 'A',
      south: 'B',
      west: 'C',
      north: 'D',
    };
    return defaults[position];
  };

  const handleExportData = async () => {
    try {
      const games = await db.games.toArray();
      const players = await db.players.toArray();
      const scores = await db.scores.toArray();
      const penalties = await db.penalties.toArray();
      const game_results = await db.game_results.toArray();
      const users = await db.users.toArray();

      const data = {
        users,
        games,
        players,
        scores,
        penalties,
        game_results
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mahjong_backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('数据已导出。请妥善保存导出的文件，用于以后恢复或迁移数据。');
    } catch (error) {
      console.error('Export failed:', error);
      alert('数据导出失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZjk5MDAiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzEgMCA2IDIuNjkgNiA2cy0yLjY5IDYtNiA2LTYtMi42OS02LTYgMi42OS02IDYtNk0xMiAzOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40"></div>

      <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white py-6 md:py-10 px-4 shadow-2xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-center sm:text-left drop-shadow-lg">
              国标麻将实时计分板
            </h1>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={handleImportClick}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 sm:px-4 py-2 rounded-xl transition-all backdrop-blur-sm hover:scale-105 shadow-lg"
              >
                <Download size={18} />
                <span className="text-sm sm:text-base font-semibold">导入数据</span>
              </button>
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 sm:px-4 py-2 rounded-xl transition-all backdrop-blur-sm hover:scale-105 shadow-lg"
              >
                <Upload size={18} />
                <span className="text-sm sm:text-base font-semibold">导出数据</span>
              </button>
              <button
                onClick={onViewHelp}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 sm:px-4 py-2 rounded-xl transition-all backdrop-blur-sm hover:scale-105 shadow-lg"
              >
                <HelpCircle size={18} />
                <span className="text-sm sm:text-base font-semibold">版本更新</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        onChange={handleImportData}
        className="hidden"
      />

      <div className="relative flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 mb-6 border-2 border-orange-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-orange-200/30 to-rose-200/30 rounded-full -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-200/30 to-orange-200/30 rounded-full -ml-16 -mb-16"></div>

            <div className="relative text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-rose-600">
                快速开局
              </h2>
            </div>

            <div className="relative space-y-5 sm:space-y-6">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-3 flex items-center gap-2">
                  <span className="text-orange-500">📋</span>
                  比赛名称
                </label>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => onGameNameChange(e.target.value)}
                  placeholder="例如：周末友谊赛（选填）"
                  className="w-full px-5 py-3 sm:py-4 text-center border-2 border-orange-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all text-base sm:text-lg font-medium hover:border-orange-300"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-3 flex items-center gap-2">
                  <span className="text-rose-500">👥</span>
                  选手姓名
                </label>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {positions.map((position) => (
                    <div key={position} className="flex flex-col gap-2 relative">
                      <label className="text-xs sm:text-sm font-bold text-gray-600 flex items-center gap-2">
                        <span className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 text-white rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shadow-md">
                          {positionLabels[position]}
                        </span>
                        <span>{positionLabels[position]}家</span>
                      </label>
                      <input
                        type="text"
                        value={tempPlayerNames[position]}
                        onChange={(e) => onNameChange(position, e.target.value)}
                        onFocus={() => setFocusedPosition(position)}
                        placeholder={getDefaultPlaceholder(position)}
                        className="px-3 sm:px-4 py-2.5 sm:py-3 text-center border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all font-medium hover:border-orange-300"
                      />
                      {focusedPosition === position && commonNames.length > 0 && (
                        <div
                          ref={suggestionsRef}
                          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border-2 border-orange-200 z-50 max-h-48 overflow-y-auto"
                        >
                          <div className="p-2">
                            <div className="text-xs text-gray-500 px-2 py-1 font-semibold">常用选手</div>
                            {commonNames.map((name, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelectSuggestion(position, name)}
                                className="w-full text-left px-3 py-2 hover:bg-orange-50 rounded-lg transition-colors font-medium text-sm"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onStartNewGame}
                className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 hover:from-orange-600 hover:via-red-600 hover:to-rose-700 text-white py-4 sm:py-5 rounded-2xl font-black text-lg sm:text-xl transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-[1.02] relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <span>🀄</span>
                  开始比赛
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              onClick={onViewHistory}
              className="bg-white hover:bg-gradient-to-br hover:from-orange-50 hover:to-rose-50 border-2 border-orange-200 hover:border-orange-400 text-gray-700 hover:text-orange-700 py-3 sm:py-4 rounded-2xl font-bold transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
            >
              <History size={20} className="text-orange-500" />
              <span className="text-sm sm:text-base">比赛历史</span>
            </button>

            <button
              onClick={onViewStats}
              className="bg-white hover:bg-gradient-to-br hover:from-rose-50 hover:to-pink-50 border-2 border-rose-200 hover:border-rose-400 text-gray-700 hover:text-rose-700 py-3 sm:py-4 rounded-2xl font-bold transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
            >
              <TrendingUp size={20} className="text-rose-500" />
              <span className="text-sm sm:text-base">成绩统计</span>
            </button>
            
            <button
              onClick={onViewDeviceDebug}
              className="col-span-2 bg-white hover:bg-gradient-to-br hover:from-slate-50 hover:to-slate-100 border-2 border-slate-200 hover:border-slate-400 text-gray-700 hover:text-slate-700 py-3 sm:py-4 rounded-2xl font-bold transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
            >
              <Bluetooth size={20} className="text-slate-500" />
              <span className="text-sm sm:text-base">设备调试</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
