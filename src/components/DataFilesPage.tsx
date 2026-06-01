import { useRef, useState } from 'react';
import { Database, FilePlus, FolderOpen, GitMerge, Pencil, Plus, Share2, Trash2, Upload, X, Globe, BookOpen, Bluetooth, MonitorPlay, User as UserIcon, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  onOpenBle: () => void;
  onDeviceMode: () => void;
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
  onOpenBle,
  onDeviceMode,
}: DataFilesPageProps) {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    try { localStorage.setItem('mjscoreboard_lang', lang); } catch {}
  };

  const MenuItem = ({ icon: Icon, label, desc, onClick, trailing }: {
    icon: React.ElementType;
    label: string;
    desc?: string;
    onClick?: () => void;
    trailing?: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-orange-50/60 active:bg-orange-100/60 transition-colors text-left rounded-xl"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-rose-100 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-orange-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-gray-800">{label}</div>
        {desc && <div className="text-xs text-gray-500 mt-0.5">{desc}</div>}
      </div>
      {trailing || <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />}
    </button>
  );
  const [sharingDataFile, setSharingDataFile] = useState(false);
  const [importingDataFile, setImportingDataFile] = useState(false);
  const [showDataFileSwitcher, setShowDataFileSwitcher] = useState(false);
  const [authorClicks, setAuthorClicks] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    data: MahjongBackupData;
    defaultName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentDataFile = dataFiles.find((file) => file.id === user.id);
  const activeFileName = currentDataFile?.name || getDataFileName(user);


  const formatLastGameDate = (dateString?: string) => {
    if (!dateString) return t('files.noRecord');
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
      alert(t('files.importFailedMsg'));
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
        alert(t('files.mergeNoNewGamesMsg', { skipped: counts.skipped_games }));
      } else {
        alert(t('files.mergeSuccessMsg', { games: counts.games, skipped: counts.skipped_games || 0, players: counts.players }));
      }
    } catch (error) {
      console.error('Merge failed:', error);
      alert(t('files.mergeFailedMsg'));
    } finally {
      setImportingDataFile(false);
    }
  };

  const handleImportAsNewDataFile = async () => {
    if (!pendingImport || importingDataFile) return;

    const name = window.prompt(t('files.newFileNamePrompt'), pendingImport.defaultName);
    if (name === null) return;

    setImportingDataFile(true);
    try {
      const { user: importedUser, counts } = await importBackupAsNewDataFile(pendingImport.data, name);
      await onDataFileChanged(importedUser.id);
      setPendingImport(null);
      alert(t('files.importSuccessMsg', { name: importedUser.code, games: counts.games, players: counts.players }));
    } catch (error) {
      console.error('Import as new failed:', error);
      alert(t('files.importNewFailedMsg'));
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

          alert(t('files.backupSavedMsg', { fileName }));
        } catch (e) {
          console.error('File write failed', e);
          alert(t('files.backupFailedPermissionMsg'));
        }
      } else {
        downloadJsonFile(jsonString, fileName);
        alert(t('files.archiveBackedUpMsg'));
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(t('files.backupFailedMsg'));
    }
  };

  const handleShareDataFile = async () => {
    if (sharingDataFile) return;

    setSharingDataFile(true);
    try {
      const { data, jsonString, fileName } = await createExportPayload();
      const title = t('files.shareTitle', { name: data.data_file?.name || '麻将' });
      const text = t('files.shareText');

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
          dialogTitle: t('files.shareDialogTitle'),
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
        alert(t('files.shareNotSupportedMsg'));
      }
    } catch (error) {
      console.error('Share data file failed:', error);
      alert(t('files.shareFailedMsg'));
    } finally {
      setSharingDataFile(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))] space-y-4">
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
                <div className="text-xs font-black tracking-[0.18em] text-orange-500">{t('files.importArchive')}</div>
                <h2 className="mt-1 text-2xl font-black text-gray-900">{t('files.chooseImportMethod')}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {t('files.importMethodDesc')}
                </p>
              </div>
              <button
                onClick={() => setPendingImport(null)}
                disabled={importingDataFile}
                className="rounded-full bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 disabled:opacity-50"
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">
              {t('files.importSummary', { games: pendingImport.data.games?.length || 0, players: pendingImport.data.players?.length || 0 })}
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
                  <span className="block text-lg font-black">{t('files.mergeFile')}</span>
                  <span className="mt-1 block text-sm font-semibold text-white/80">{t('files.mergeDesc')}</span>
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
                  <span className="block text-lg font-black">{t('files.saveAsNew')}</span>
                  <span className="mt-1 block text-sm font-semibold text-gray-500">{t('files.saveAsNewDesc')}</span>
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
                <h2 className="text-2xl font-black text-gray-900">{t('files.switchFile')}</h2>
                <p className="mt-1 text-sm text-gray-500">{t('files.switchFileDesc')}</p>
              </div>
              <button
                onClick={() => setShowDataFileSwitcher(false)}
                className="rounded-full bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200"
                aria-label={t('common.close')}
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
                          {t('files.fileStats', { games: file.games_count, date: formatLastGameDate(file.last_game_at) })}
                        </div>
                      </div>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white">{t('files.current')}</span>
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
              <div className="text-xs font-black tracking-[0.2em] text-orange-500">{t('files.manageGame')}</div>
              <h1 className="mt-1 text-3xl font-black text-gray-900">{t('files.dataFiles')}</h1>
              <p className="mt-1 text-sm text-gray-500">{t('files.dataFilesDesc')}</p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl bg-gradient-to-br from-orange-50 to-rose-50 p-4 border border-orange-100">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-black text-orange-600">{t('files.currentFile')}</div>
                <div className="mt-1 truncate text-2xl font-black text-gray-900">{activeFileName}</div>
              </div>
              <button
                onClick={() => setShowDataFileSwitcher(true)}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-black text-orange-700 shadow-sm transition-colors hover:bg-orange-100"
              >
                {t('files.switch')}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/80 px-3 py-2 border border-orange-100">
                <div className="text-lg font-black text-orange-600">{currentDataFile?.games_count ?? 0}</div>
                <div className="text-xs font-semibold text-gray-500">{t('files.games')}</div>
              </div>
              <div className="rounded-2xl bg-white/80 px-3 py-2 border border-rose-100">
                <div className="text-lg font-black text-rose-600">{currentDataFile?.finished_games_count ?? 0}</div>
                <div className="text-xs font-semibold text-gray-500">{t('files.finished')}</div>
              </div>
              <div className="rounded-2xl bg-white/80 px-3 py-2 border border-emerald-100">
                <div className="text-lg font-black text-emerald-700">{formatLastGameDate(currentDataFile?.last_game_at)}</div>
                <div className="text-xs font-semibold text-gray-500">{t('files.recent')}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-orange-100 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-black tracking-[0.16em] text-gray-400">{t('files.manageFiles')}</div>
              <div className="text-xs font-bold text-gray-400">{t('files.totalFiles', { count: dataFiles.length })}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                onClick={() => {
                  void onCreateDataFile();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-50 px-2 py-3 text-xs font-bold text-orange-700 hover:bg-orange-100"
              >
                <Plus size={15} />
                {t('files.new')}
              </button>
              <button
                onClick={() => {
                  void onRenameDataFile();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-2 py-3 text-xs font-bold text-amber-700 hover:bg-amber-100"
              >
                <Pencil size={15} />
                {t('files.rename')}
              </button>
              <button
                onClick={handleExportData}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 px-2 py-3 text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                <FilePlus size={15} />
                {t('files.backup')}
              </button>
              <button
                onClick={() => {
                  void onDeleteDataFile();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-red-50 px-2 py-3 text-xs font-bold text-red-600 hover:bg-red-100"
              >
                <Trash2 size={15} />
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-5 sm:p-6 shadow-xl border-2 border-orange-100">
          <div>
            <h2 className="text-xl font-black text-gray-900">{t('files.shareAndImport')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('files.shareAndImportDesc')}</p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              onClick={handleShareDataFile}
              disabled={sharingDataFile}
              className="flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-left text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Share2 size={20} />
              <span>
                <span className="block text-sm font-black">{sharingDataFile ? t('files.preparingShare') : t('files.shareFile')}</span>
                <span className="mt-0.5 block text-xs font-semibold text-orange-700/60">{t('files.shareDesc')}</span>
              </span>
            </button>

            <button
              onClick={handleImportClick}
              className="flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-left text-blue-700 transition-colors hover:bg-blue-100"
            >
              <Upload size={20} />
              <span>
                <span className="block text-sm font-black">{t('files.importArchive')}</span>
                <span className="mt-0.5 block text-xs font-semibold text-blue-700/60">{t('files.importDesc')}</span>
              </span>
            </button>
          </div>
        {/* Tools Section */}
        <div className="bg-white rounded-[2rem] shadow-lg border border-orange-100 overflow-hidden mt-4">
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('more.tools', '工具')}</h3>
          </div>
          <MenuItem
            icon={Bluetooth}
            label={t('more.bleConnect', '蓝牙计分板连接')}
            desc={t('more.bleConnectDesc', '连接 ESP32 硬件计分板或手机外设')}
            onClick={onOpenBle}
          />
          <div className="mx-5 border-t border-gray-100" />
          <MenuItem
            icon={MonitorPlay}
            label={t('more.simulatedBoard', '模拟计分板')}
            desc={t('more.simulatedBoardDesc', '将本机作为计分板显示设备')}
            onClick={onDeviceMode}
          />
        </div>

        {/* Settings and About Section */}
        <div className="bg-white rounded-[2rem] shadow-lg border border-orange-100 overflow-hidden mt-4">
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('more.settings', '设置')}</h3>
          </div>
          <div className="flex items-center gap-4 px-5 py-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-rose-100 flex items-center justify-center flex-shrink-0">
              <Globe size={20} className="text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-gray-800">{t('more.language', '语言')}</div>
            </div>
            <select
              value={i18n.language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 focus:outline-none focus:border-orange-400"
            >
              <option value="zh">简体中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
          
          <div className="px-5 pt-4 pb-2 mt-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('more.about', '关于')}</h3>
          </div>
          <MenuItem
            icon={BookOpen}
            label={t('more.versionHistory', '版本历史')}
            onClick={onViewHelp}
          />
          <div className="mx-5 border-t border-gray-100" />
          <div
            className="flex items-center gap-4 px-5 py-3.5 select-none"
            onClick={() => {
              const newClicks = authorClicks + 1;
              setAuthorClicks(newClicks);
              if (newClicks >= 7) {
                setShowContactModal(true);
                setAuthorClicks(0);
              }
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-rose-100 flex items-center justify-center flex-shrink-0">
              <UserIcon size={20} className="text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-gray-800">{t('more.author', '作者')}</div>
              <div className="text-xs text-gray-500 mt-0.5">李睿</div>
            </div>
            <span className="text-xs text-gray-400 font-mono">v1.6.1</span>
          </div>
        </div>

      </div>
      </div>

      {showContactModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all" onClick={() => setShowContactModal(false)}>
          <div 
            className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-[#fdfbf7] shadow-2xl relative overflow-hidden border border-[#f3eee3]" 
            onClick={e => e.stopPropagation()}
          >
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-orange-100/50 rounded-full blur-3xl mix-blend-multiply pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-rose-100/40 rounded-full blur-3xl mix-blend-multiply pointer-events-none"></div>
            
            <button 
              onClick={() => setShowContactModal(false)} 
              className="absolute right-4 top-4 p-2 text-[#bcaaa4] hover:text-gray-600 hover:bg-[#f5f0e6] rounded-full transition-colors z-[60] bg-[#fdfbf7]/80 backdrop-blur"
            >
              <X size={20} />
            </button>
            
            <div className="relative z-10 p-6 sm:p-8 pt-12 sm:pt-14 overflow-y-auto overscroll-contain">
              <h2 className="text-2xl font-black text-[#4e342e] mb-6 tracking-wide">{t('more.letterTitle')}</h2>
              
              <div className="space-y-4 text-[15px] leading-relaxed text-[#5d4037] whitespace-pre-wrap">
                {t('more.letterContent')}
              </div>
              
              <div className="mt-6 text-right">
                <div className="inline-block text-[#8d6e63] font-medium italic">
                  —— {t('more.letterSignature', '愿国标麻将越来越好！')}
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-[#efebe1] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
                <div className="flex items-center gap-2 text-[#6d4c41]">
                  <span className="font-semibold">{t('more.contactName')} :</span>
                  <span className="opacity-90">{t('more.contactPhone')}</span>
                </div>
                <a 
                  href="https://github.com/MarsNavi/MjscoreBoard" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center gap-1.5 text-orange-700 hover:text-orange-800 font-medium transition-colors"
                >
                  <Globe size={14} />
                  <span>GitHub Project</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
