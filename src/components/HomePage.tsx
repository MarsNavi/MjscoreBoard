import { User, Position, Game, Player, ScoreRecord, Penalty, GameResult } from '../lib/types';
import { db } from '../lib/db';
import { Database, FilePlus, FolderOpen, GitMerge, HelpCircle, History, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { normalizePlayerName } from '../lib/playerNames';
import {
  buildExportDataForUser,
  DataFileSummary,
  deriveImportDataFileName,
  importBackupAsNewDataFile,
  mergeBackupIntoDataFile,
  normalizeBackupData,
} from '../lib/dataFiles';

interface HomePageProps {
  user: User;
  dataFiles: DataFileSummary[];
  onSwitchDataFile: (userId: string) => Promise<void>;
  onCreateDataFile: () => Promise<void>;
  onRenameDataFile: () => Promise<void>;
  onDeleteDataFile: () => Promise<void>;
  onDataFileChanged: (userId?: string) => Promise<void>;
  onStartNewGame: () => void;
  onViewHistory: () => void;
  onViewStats: () => void;
  onViewHelp: () => void;
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
  dataFiles,
  onSwitchDataFile,
  onCreateDataFile,
  onRenameDataFile,
  onDeleteDataFile,
  onDataFileChanged,
  onStartNewGame,
  onViewHistory,
  onViewStats,
  onViewHelp,
  gameName,
  onGameNameChange,
  tempPlayerNames,
  onNameChange,
}: HomePageProps) {
  const positions: Position[] = ['east', 'south', 'west', 'north'];
  const [commonNames, setCommonNames] = useState<string[]>([]);
  const [focusedPosition, setFocusedPosition] = useState<Position | null>(null);
  const [importMode, setImportMode] = useState<'open' | 'merge'>('open');
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentDataFile = dataFiles.find((file) => file.id === user.id);
  const activeFileName = currentDataFile?.name || user.code;

  const formatLastGameDate = (dateString?: string) => {
    if (!dateString) {
      return '暂无';
    }

    return new Date(dateString).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    });
  };

  const loadCommonNames = useCallback(async () => {
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
        const playerName = normalizePlayerName(result.player_name);
        if (playerName) {
          nameCounts[playerName] = (nameCounts[playerName] || 0) + 1;
        }
      });
    }

    if (Object.keys(nameCounts).length === 0) {
      const players = await db.players
        .where('game_id')
        .anyOf(gameIds)
        .toArray();

      players.forEach((player) => {
        const playerName = normalizePlayerName(player.name, player.player_id);
        if (playerName) {
          nameCounts[playerName] = (nameCounts[playerName] || 0) + 1;
        }
      });
    }

    const sortedNames = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    setCommonNames(sortedNames);
  }, [user.id]);

  const loadLastGameData = useCallback(async () => {
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
          onNameChange(player.position as Position, normalizePlayerName(player.name, player.player_id));
        });
      }
    }
  }, [onGameNameChange, onNameChange, user.id]);

  useEffect(() => {
    void loadCommonNames();
    void loadLastGameData();
  }, [loadCommonNames, loadLastGameData]);

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

  const handleSelectSuggestion = (position: Position, name: string) => {
    onNameChange(position, name);
    setFocusedPosition(null);
  };

  const handleImportClick = (mode: 'open' | 'merge') => {
    setImportMode(mode);
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
      const data = normalizeBackupData(JSON.parse(text) as {
          users?: User[];
          games?: Game[];
          players?: Player[];
          scores?: ScoreRecord[];
          penalties?: Penalty[];
          game_results?: GameResult[];
        });

      if (importMode === 'open') {
        const defaultName = deriveImportDataFileName(file.name, data);
        const name = window.prompt('打开为新的数据文件，给它起个名字：', defaultName);
        if (name === null) return;

        const { user: importedUser, counts } = await importBackupAsNewDataFile(data, name);
        await onDataFileChanged(importedUser.id);
        alert(`已打开新的数据文件「${importedUser.code}」。\n\n导入比赛：${counts.games} 场\n导入选手记录：${counts.players} 条`);
        return;
      }

      const confirmMerge = window.confirm('确定要把这个 JSON 文件合并到当前数据文件吗？合并会新增一份独立记录，不会覆盖当前数据。');
      if (!confirmMerge) return;

      const counts = await mergeBackupIntoDataFile(data, user.id);
      await onDataFileChanged(user.id);
      alert(`合并完成。\n\n合并比赛：${counts.games} 场\n合并选手记录：${counts.players} 条`);
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
      const data = await buildExportDataForUser(user.id);
      const jsonString = JSON.stringify(data, null, 2);
      const safeName = (data.data_file?.name || 'mahjong')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_');

      if (Capacitor.isNativePlatform()) {
        try {
          // Format: mahjong_backup_YYYY-MM-DD_HH-mm-ss.json
          const date = new Date();
          const timestamp = date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0') + '_' +
            String(date.getHours()).padStart(2, '0') + '-' +
            String(date.getMinutes()).padStart(2, '0') + '-' +
            String(date.getSeconds()).padStart(2, '0');
            
          const fileName = `mahjong_${safeName}_${timestamp}.json`;
          
          await Filesystem.writeFile({
            path: fileName,
            data: jsonString,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          });
          
          alert(`数据已导出！\n\n文件保存位置: Documents/${fileName}\n\n(请在文件管理器的“文档”或“Documents”文件夹中查找)`);
        } catch (e) {
          console.error('File write failed', e);
          alert('保存文件失败，请检查存储权限');
        }
      } else {
        // Web fallback
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mahjong_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('数据已导出。');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('数据导出失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZjk5MDAiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzEgMCA2IDIuNjkgNiA2cy0yLjY5IDYtNiA2LTYtMi42OS02LTYgMi42OS02IDYtNk0xMiAzOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40"></div>

      <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] md:py-10 md:pt-[calc(2.5rem+env(safe-area-inset-top))] px-4 shadow-2xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-center sm:text-left drop-shadow-lg">
              国标麻将实时计分板
            </h1>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
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
          <div className="bg-white/95 rounded-3xl shadow-xl p-5 sm:p-6 mb-6 border-2 border-amber-100 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-gradient-to-br from-amber-200/40 to-orange-200/20 rounded-full"></div>
            <div className="relative space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Database size={22} className="text-white" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-orange-500 uppercase tracking-wider">数据文件</span>
                      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">共 {dataFiles.length} 个</span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">当前使用</span>
                    </div>
                    <div className="mt-1 text-2xl font-black text-gray-900">{activeFileName}</div>
                    <p className="mt-1 text-sm text-gray-500">历史、统计、常用选手都只读取当前数据文件。</p>
                  </div>
                </div>
                <div className="w-full sm:w-60">
                  <label className="mb-1 block text-xs font-bold text-gray-500">切换数据文件</label>
                  <select
                    value={user.id}
                    onChange={(event) => {
                      void onSwitchDataFile(event.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-orange-200 bg-white font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {dataFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name}（{file.games_count}场）
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-orange-50 rounded-2xl px-3 py-2 border border-orange-100">
                  <div className="text-lg font-black text-orange-600">{currentDataFile?.games_count ?? 0}</div>
                  <div className="text-xs font-semibold text-gray-500">总比赛</div>
                </div>
                <div className="bg-rose-50 rounded-2xl px-3 py-2 border border-rose-100">
                  <div className="text-lg font-black text-rose-600">{currentDataFile?.finished_games_count ?? 0}</div>
                  <div className="text-xs font-semibold text-gray-500">已完成</div>
                </div>
                <div className="bg-emerald-50 rounded-2xl px-3 py-2 border border-emerald-100">
                  <div className="text-lg font-black text-emerald-700">{formatLastGameDate(currentDataFile?.last_game_at)}</div>
                  <div className="text-xs font-semibold text-gray-500">最近比赛</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-3">
                  <div className="mb-2 text-xs font-black tracking-wider text-orange-700">文件管理</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        void onCreateDataFile();
                      }}
                      className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-white hover:bg-orange-100 text-orange-700 text-xs sm:text-sm font-bold transition-colors shadow-sm"
                    >
                      <Plus size={15} />
                      新建
                    </button>
                    <button
                      onClick={() => {
                        void onRenameDataFile();
                      }}
                      className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-white hover:bg-amber-100 text-amber-700 text-xs sm:text-sm font-bold transition-colors shadow-sm"
                    >
                      <Pencil size={15} />
                      重命名
                    </button>
                    <button
                      onClick={() => {
                        void onDeleteDataFile();
                      }}
                      className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-white hover:bg-red-100 text-red-600 text-xs sm:text-sm font-bold transition-colors shadow-sm"
                    >
                      <Trash2 size={15} />
                      删除
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="mb-2 text-xs font-black tracking-wider text-blue-700">导入导出</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleImportClick('open')}
                      className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-white hover:bg-blue-100 text-blue-700 text-xs sm:text-sm font-bold transition-colors shadow-sm"
                    >
                      <FolderOpen size={15} />
                      打开文件
                    </button>
                    <button
                      onClick={() => handleImportClick('merge')}
                      className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-700 text-xs sm:text-sm font-bold transition-colors shadow-sm"
                    >
                      <GitMerge size={15} />
                      合并文件
                    </button>
                    <button
                      onClick={handleExportData}
                      className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-white hover:bg-purple-100 text-purple-700 text-xs sm:text-sm font-bold transition-colors shadow-sm"
                    >
                      <FilePlus size={15} />
                      导出文件
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 leading-relaxed bg-orange-50/70 rounded-2xl px-4 py-3 border border-orange-100">
                “打开文件”会创建一个全新的独立数据文件；“合并文件”会把 JSON 里的比赛追加到当前数据文件，不会覆盖原记录。
              </div>
            </div>
          </div>

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
          </div>
        </div>
      </div>
    </div>
  );
}
