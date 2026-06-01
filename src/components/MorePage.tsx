import { useTranslation } from 'react-i18next';
import { Bluetooth, MonitorPlay, FolderOpen, Globe, BookOpen, ChevronRight, User } from 'lucide-react';

interface MorePageProps {
  onOpenBle: () => void;
  onDeviceMode: () => void;
  onDataFiles: () => void;
  onVersionHistory: () => void;
}

export default function MorePage({ onOpenBle, onDeviceMode, onDataFiles, onVersionHistory }: MorePageProps) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50">
      <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] md:py-5 md:pt-[calc(1.5rem+env(safe-area-inset-top))] px-4 shadow-2xl">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-lg">
            {t('more.title')}
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Tools Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('more.tools')}</h3>
          </div>
          <MenuItem
            icon={Bluetooth}
            label={t('more.bleConnect')}
            desc={t('more.bleConnectDesc')}
            onClick={onOpenBle}
          />
          <div className="mx-4 border-t border-gray-100" />
          <MenuItem
            icon={MonitorPlay}
            label={t('more.simulatedBoard')}
            desc={t('more.simulatedBoardDesc')}
            onClick={onDeviceMode}
          />
        </div>

        {/* Settings Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('more.settings')}</h3>
          </div>
          <MenuItem
            icon={FolderOpen}
            label={t('more.dataFiles')}
            desc={t('more.dataFilesDesc')}
            onClick={onDataFiles}
          />
          <div className="mx-4 border-t border-gray-100" />
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-rose-100 flex items-center justify-center flex-shrink-0">
              <Globe size={20} className="text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-gray-800">{t('more.language')}</div>
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
        </div>

        {/* About Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('more.about')}</h3>
          </div>
          <MenuItem
            icon={BookOpen}
            label={t('more.versionHistory')}
            onClick={onVersionHistory}
          />
          <div className="mx-4 border-t border-gray-100" />
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-rose-100 flex items-center justify-center flex-shrink-0">
              <User size={20} className="text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-gray-800">{t('more.author')}</div>
              <div className="text-xs text-gray-500 mt-0.5">李睿</div>
            </div>
            <span className="text-xs text-gray-400 font-mono">v1.6.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
