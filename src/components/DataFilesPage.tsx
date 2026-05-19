import { useRef, useState } from 'react';
import { Database, FilePlus, FolderOpen, GitMerge, Pencil, Plus, Share2, Trash2, Upload, X } from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { User, Game, Player, ScoreRecord, Penalty, GameResult } from '../lib/types';
import {
  buildExportDataForUser,
  DataFileSummary,
  deriveImportDataFileName,
  getDataFileName,
  importBackupAsNewDataFile,
  MahjongBackupData,
  mergeBackupIntoDataFile,
  normalizeBackupData,
} from '../lib/dataFiles';

interface DataFilesPageProps {
  user: User;
  dataFiles: DataFileSummary[];
  onSwitchDataFile: (userId: string) => Promise<void>;
  onCreateDataFile: () => Promise<void>;
  onRenameDataFile: () => Promise<void>;
  onDeleteDataFile: () => Promise<void>;
  onDataFileChanged: (userId?: string) => Promise<void>;
  onViewHelp: () => void;
}

export default function DataFilesPage({
  user,
  dataFiles,
  onSwitchDataFile,
  onCreateDataFile,
  onRenameDataFile,
  onDeleteDataFile,
  onDataFileChanged,
  onViewHelp,
}: DataFilesPageProps) {
  const [sharingDataFile, setSharingDataFile] = useState(false);
  const [importingDataFile, setImportingDataFile] = useState(false);
  const [showDataFileSwitcher, setShowDataFileSwitcher] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    data: MahjongBackupData;
    defaultName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentDataFile = dataFiles.find((file) => file.id === user.id);
  const activeFileName = currentDataFile?.name || getDataFileName(user);

  const formatLastGameDate = (dateString?: string) => {
    if (!dateString) return '暂无记录';
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const createExportPayload = async () => {
    const data = await buildExportDataForUser(user.id);
    const jsonString = JSON.stringify(data, null, 2);
    const safeName = (data.data_file?.name || 'mahjong')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_');
    const date = new Date();
    const timestamp = date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0') + '_' +
      String(date.getHours()).padStart(2, '0') + '-' +
      String(date.getMinutes()).padStart(2, '0') + '-' +
      String(date.getSeconds()).padStart(2, '0');
    const fileName = `mahjong_${safeName}_${timestamp}.json`;

    return { data, jsonString, fileName };
  };

  const downloadJsonFile = (jsonString: string, fileName: string) => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

      setPendingImport({
        data,
        defaultName: deriveImportDataFileName(file.name, data),
      });
    } catch (error) {
      console.error('Import failed:', error);
      alert('导入失败。请选择本应用分享或备份的牌局档案。');
    }
  };

  const handleMergePendingImport = async () => {
    if (!pendingImport || importingDataFile) return;

    setImportingDataFile(true);
    try {
      const counts = await mergeBackupIntoDataFile(pendingImport.data, user.id);
      await onDataFileChanged(user.id);
      setPendingImport(null);

      if (counts.games === 0 && counts.skipped_games) {
        alert(`没有新增比赛。\n\n已跳过 ${counts.skipped_games} 场重复比赛。`);
      } else {
        alert(`合并完成。\n\n新增比赛：${counts.games} 场\n跳过重复：${counts.skipped_games || 0} 场\n新增选手记录：${counts.players} 条`);
      }
    } catch (error) {
      console.error('Merge failed:', error);
      alert('合并失败，请稍后重试。');
    } finally {
      setImportingDataFile(false);
    }
  };

  const handleImportAsNewDataFile = async () => {
    if (!pendingImport || importingDataFile) return;

    const name = window.prompt('新档案名称：', pendingImport.defaultName);
    if (name === null) return;

    setImportingDataFile(true);
    try {
      const { user: importedUser, counts } = await importBackupAsNewDataFile(pendingImport.data, name);
      await onDataFileChanged(importedUser.id);
      setPendingImport(null);
      alert(`已创建「${importedUser.code}」。\n\n导入比赛：${counts.games} 场\n导入选手记录：${counts.players} 条`);
    } catch (error) {
      console.error('Import as new failed:', error);
      alert('新建档案失败，请稍后重试。');
    } finally {
      setImportingDataFile(false);
    }
  };

  const handleSwitchDataFile = async (userId: string) => {
    await onSwitchDataFile(userId);
    setShowDataFileSwitcher(false);
  };

  const handleExportData = async () => {
    try {
      const { jsonString, fileName } = await createExportPayload();

      if (Capacitor.isNativePlatform()) {
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: jsonString,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          });

          alert(`备份已保存。\n\n位置：Documents/${fileName}`);
        } catch (e) {
          console.error('File write failed', e);
          alert('备份失败，请检查存储权限。');
        }
      } else {
        downloadJsonFile(jsonString, fileName);
        alert('档案已备份。');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('备份失败。');
    }
  };

  const handleShareDataFile = async () => {
    if (sharingDataFile) return;

    setSharingDataFile(true);
    try {
      const { data, jsonString, fileName } = await createExportPayload();
      const title = `${data.data_file?.name || '麻将'} · 牌局档案`;
      const text = '这是一份国标麻将计分档案。接收后可选择合并或另存；合并时会自动跳过重复比赛。';

      if (Capacitor.isNativePlatform()) {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        await Share.share({
          title,
          text,
          files: [savedFile.uri],
          dialogTitle: '分享牌局档案',
        });
        return;
      }

      const file = new File([jsonString], fileName, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        });
      } else {
        downloadJsonFile(jsonString, fileName);
        alert('当前浏览器不支持直接分享，已下载备份文件。');
      }
    } catch (error) {
      console.error('Share data file failed:', error);
      alert('分享档案失败，请稍后重试。');
    } finally {
      setSharingDataFile(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        onChange={handleImportData}
        className="hidden"
      />

      {pendingImport && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black tracking-[0.18em] text-orange-500">导入档案</div>
                <h2 className="mt-1 text-2xl font-black text-gray-900">选择导入方式</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  如果是同一圈牌友的新记录，建议合并；只是想单独查看，就另存为新档案。
                </p>
              </div>
              <button
                onClick={() => setPendingImport(null)}
                disabled={importingDataFile}
                className="rounded-full bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 disabled:opacity-50"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">
              {pendingImport.data.games?.length || 0} 场比赛 · {pendingImport.data.players?.length || 0} 条选手记录
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => {
                  void handleMergePendingImport();
                }}
                disabled={importingDataFile}
                className="flex w-full items-start gap-3 rounded-2xl bg-emerald-500 px-4 py-4 text-left text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-60"
              >
                <GitMerge size={22} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block text-lg font-black">合并到当前档案</span>
                  <span className="mt-1 block text-sm font-semibold text-white/80">适合接收同一圈牌友的新记录，重复比赛会自动跳过。</span>
                </span>
              </button>
              <button
                onClick={() => {
                  void handleImportAsNewDataFile();
                }}
                disabled={importingDataFile}
                className="flex w-full items-start gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-4 text-left text-blue-700 shadow-sm transition-colors hover:bg-blue-50 disabled:opacity-60"
              >
                <FolderOpen size={22} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block text-lg font-black">另存为新档案</span>
                  <span className="mt-1 block text-sm font-semibold text-gray-500">保留为独立档案，不影响当前档案。</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showDataFileSwitcher && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-gray-900">切换档案</h2>
                <p className="mt-1 text-sm text-gray-500">切换后，历史和统计只显示该档案的记录。</p>
              </div>
              <button
                onClick={() => setShowDataFileSwitcher(false)}
                className="rounded-full bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {dataFiles.map((file) => {
                const isActive = file.id === user.id;
                return (
                  <button
                    key={file.id}
                    onClick={() => {
                      void handleSwitchDataFile(file.id);
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-100 bg-white hover:border-orange-200 hover:bg-orange-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-gray-900">{file.name}</div>
                        <div className="mt-1 text-xs font-semibold text-gray-500">
                          {file.games_count} 场比赛 · 最近 {formatLastGameDate(file.last_game_at)}
                        </div>
                      </div>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white">当前</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-4 pb-8">
        <div className="rounded-[2rem] bg-white p-5 sm:p-6 shadow-xl border-2 border-orange-100">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Database size={22} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black tracking-[0.2em] text-orange-500">牌局管理</div>
              <h1 className="mt-1 text-3xl font-black text-gray-900">牌局档案</h1>
              <p className="mt-1 text-sm text-gray-500">每个牌友圈单独保存，历史与统计互不混淆。</p>
            </div>
            <button
              onClick={onViewHelp}
              className="shrink-0 rounded-full border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-black text-orange-700 transition-colors hover:bg-orange-100"
            >
              更新
            </button>
          </div>

          <div className="mt-5 rounded-3xl bg-gradient-to-br from-orange-50 to-rose-50 p-4 border border-orange-100">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-black text-orange-600">当前档案</div>
                <div className="mt-1 truncate text-2xl font-black text-gray-900">{activeFileName}</div>
              </div>
              <button
                onClick={() => setShowDataFileSwitcher(true)}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-black text-orange-700 shadow-sm transition-colors hover:bg-orange-100"
              >
                切换
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/80 px-3 py-2 border border-orange-100">
                <div className="text-lg font-black text-orange-600">{currentDataFile?.games_count ?? 0}</div>
                <div className="text-xs font-semibold text-gray-500">比赛</div>
              </div>
              <div className="rounded-2xl bg-white/80 px-3 py-2 border border-rose-100">
                <div className="text-lg font-black text-rose-600">{currentDataFile?.finished_games_count ?? 0}</div>
                <div className="text-xs font-semibold text-gray-500">完成</div>
              </div>
              <div className="rounded-2xl bg-white/80 px-3 py-2 border border-emerald-100">
                <div className="text-lg font-black text-emerald-700">{formatLastGameDate(currentDataFile?.last_game_at)}</div>
                <div className="text-xs font-semibold text-gray-500">最近</div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-orange-100 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-black tracking-[0.16em] text-gray-400">档案管理</div>
              <div className="text-xs font-bold text-gray-400">共 {dataFiles.length} 个</div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                onClick={() => {
                  void onCreateDataFile();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-50 px-2 py-3 text-xs font-bold text-orange-700 hover:bg-orange-100"
              >
                <Plus size={15} />
                新建
              </button>
              <button
                onClick={() => {
                  void onRenameDataFile();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-2 py-3 text-xs font-bold text-amber-700 hover:bg-amber-100"
              >
                <Pencil size={15} />
                改名
              </button>
              <button
                onClick={handleExportData}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 px-2 py-3 text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                <FilePlus size={15} />
                备份
              </button>
              <button
                onClick={() => {
                  void onDeleteDataFile();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-red-50 px-2 py-3 text-xs font-bold text-red-600 hover:bg-red-100"
              >
                <Trash2 size={15} />
                删除
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-5 sm:p-6 shadow-xl border-2 border-orange-100">
          <div>
            <h2 className="text-xl font-black text-gray-900">分享与导入</h2>
            <p className="mt-1 text-sm text-gray-500">把当前档案发给别人，也可以接收别人发来的档案。</p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              onClick={handleShareDataFile}
              disabled={sharingDataFile}
              className="flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-left text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Share2 size={20} />
              <span>
                <span className="block text-sm font-black">{sharingDataFile ? '正在准备分享' : '分享当前档案'}</span>
                <span className="mt-0.5 block text-xs font-semibold text-orange-700/60">对方可查看，也可合并。</span>
              </span>
            </button>

            <button
              onClick={handleImportClick}
              className="flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-left text-blue-700 transition-colors hover:bg-blue-100"
            >
              <Upload size={20} />
              <span>
                <span className="block text-sm font-black">导入档案</span>
                <span className="mt-0.5 block text-xs font-semibold text-blue-700/60">导入后再选择合并或另存。</span>
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
