import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Position, User } from '../lib/types';
import { db } from '../lib/db';
import { normalizePlayerName } from '../lib/playerNames';
import { MonitorPlay, Globe } from 'lucide-react';

interface HomePageProps {
  user: User;
  onStartNewGame: () => void;
  gameName: string;
  onGameNameChange: (name: string) => void;
  tempPlayerNames: Record<Position, string>;
  onNameChange: (position: Position, name: string) => void;
  onDeviceMode: () => void;
}


export default function HomePage({
  user,
  onStartNewGame,
  gameName,
  onGameNameChange,
  tempPlayerNames,
  onNameChange,
  onDeviceMode,
}: HomePageProps) {
  const { t, i18n } = useTranslation();

  const langLabels: Record<string, string> = { zh: '中', en: 'EN', ja: 'JP' };
  const langOrder = ['zh', 'en', 'ja'];
  const cycleLang = () => {
    const next = langOrder[(langOrder.indexOf(i18n.language) + 1) % langOrder.length];
    i18n.changeLanguage(next);
    try { localStorage.setItem('mjscoreboard_lang', next); } catch {}
  };

  const positionLabels: Record<Position, string> = {
    east: t('mahjong.east'),
    south: t('mahjong.south'),
    west: t('mahjong.west'),
    north: t('mahjong.north'),
  };

  const positions: Position[] = ['east', 'south', 'west', 'north'];
  const [commonNames, setCommonNames] = useState<string[]>([]);
  const [focusedPosition, setFocusedPosition] = useState<Position | null>(null);
  const containerRefs = useRef<Record<Position, HTMLDivElement | null>>({
    east: null, south: null, west: null, north: null,
  });

  const loadCommonNames = useCallback(async () => {
    const games = await db.games.where('creator_id').equals(user.id).toArray();
    const gameIds = games.map((game) => game.id);

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

    // Show ALL known players, sorted by frequency
    const sortedNames = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
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
        players.forEach((player) => {
          onNameChange(player.position as Position, normalizePlayerName(player.name, player.player_id));
        });
      }
    }
  }, [onGameNameChange, onNameChange, user.id]);

  useEffect(() => {
    void loadCommonNames();
    void loadLastGameData();
  }, [loadCommonNames, loadLastGameData]);

  // Use a proper click-outside handler that checks all position containers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      // Check if the click is inside any of our position containers
      const isInsideAnyContainer = Object.values(containerRefs.current).some(
        (ref) => ref && ref.contains(target)
      );
      if (!isInsideAnyContainer) {
        setFocusedPosition(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSelectSuggestion = (position: Position, name: string) => {
    onNameChange(position, name);
    setFocusedPosition(null);
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

  // Filter suggestions: match typed text and exclude names already chosen for other positions
  const getFilteredSuggestions = (position: Position): string[] => {
    const currentInput = (tempPlayerNames[position] || '').trim().toLowerCase();
    const otherChosenNames = new Set(
      positions
        .filter((p) => p !== position)
        .map((p) => (tempPlayerNames[p] || '').trim())
        .filter(Boolean)
    );

    return commonNames.filter((name) => {
      // Exclude names already used in other positions
      if (otherChosenNames.has(name)) return false;
      // If user typed something, filter by prefix/contains
      if (currentInput) {
        return name.toLowerCase().includes(currentInput);
      }
      return true;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 flex flex-col relative">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZjk5MDAiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzEgMCA2IDIuNjkgNiA2cy0yLjY5IDYtNiA2LTYtMi42OS02LTYgMi42OS02IDYtNk0xMiAzOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40"></div>

      <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] md:py-5 md:pt-[calc(1.5rem+env(safe-area-inset-top))] px-4 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-lg">
            {t('common.appTitle', '国标麻将实时计分板')}
          </h1>
          <button
            onClick={cycleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors text-sm font-bold backdrop-blur-sm"
            title="Switch Language / 切换语言"
          >
            <Globe size={16} />
            <span>{langLabels[i18n.language] || '中'}</span>
          </button>
        </div>
      </div>

      <div className="relative flex-1 p-4 pb-32 md:p-8 md:pb-36">
        <div className="w-full max-w-2xl mx-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl p-5 sm:p-6 border-2 border-orange-100 relative">
            <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-orange-200/35 to-rose-200/25 rounded-full -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tr from-pink-200/25 to-orange-200/25 rounded-full -ml-16 -mb-16"></div>
            </div>

            <div className="relative space-y-4 sm:space-y-5">
              <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-rose-600">
                {t('game.quickStart')}
              </h2>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-3 flex items-center gap-2">
                  {t('game.gameName')}
                </label>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => onGameNameChange(e.target.value)}
                  placeholder={t('game.gameNamePlaceholder')}
                  className="w-full px-5 py-3 text-center border-2 border-orange-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all text-base sm:text-lg font-medium hover:border-orange-300"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-3 flex items-center gap-2">
                  {t('game.playerNames')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {positions.map((position) => {
                    const filteredSuggestions = getFilteredSuggestions(position);
                    const isOpen = focusedPosition === position && filteredSuggestions.length > 0;

                    return (
                      <div
                        key={position}
                        className="flex flex-col gap-2 relative"
                        ref={(el) => { containerRefs.current[position] = el; }}
                      >
                        <label className="text-xs sm:text-sm font-bold text-gray-600 flex items-center gap-2">
                          <span className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 text-white rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shadow-md">
                            {positionLabels[position]}
                          </span>
                          <span>{positionLabels[position]}{t('mahjong.playerSuffix')}</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={tempPlayerNames[position]}
                            onChange={(e) => onNameChange(position, e.target.value)}
                            onFocus={() => setFocusedPosition(position)}
                            placeholder={getDefaultPlaceholder(position)}
                            className={`w-full px-3 sm:px-4 py-2.5 text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all font-medium hover:border-orange-300 ${
                              isOpen ? 'border-orange-400 rounded-b-none' : 'border-orange-200'
                            }`}
                          />
                          {commonNames.length > 0 && (
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setFocusedPosition(focusedPosition === position ? null : position);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-orange-500 transition-colors"
                              aria-label={t('game.expandPlayerList')}
                            >
                              <svg
                                className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {isOpen && (
                          <div
                            className="absolute top-full left-0 right-0 bg-white rounded-b-xl shadow-2xl border-2 border-t-0 border-orange-400 z-50 max-h-52 overflow-y-auto"
                            style={{ marginTop: '-2px' }}
                          >
                            <div className="py-1">
                              <div className="text-[10px] text-gray-400 px-3 py-1.5 font-bold uppercase tracking-wider">
                                {t('game.commonPlayers')}
                              </div>
                              {filteredSuggestions.map((name, idx) => {
                                const isAlreadySelected = Object.values(tempPlayerNames).some(
                                  (v) => v.trim() === name
                                );
                                return (
                                  <button
                                    key={idx}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSelectSuggestion(position, name);
                                    }}
                                    className={`w-full text-left px-3 py-3 sm:py-2.5 transition-colors font-medium text-sm sm:text-base flex items-center gap-2 ${
                                      isAlreadySelected
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'hover:bg-orange-50 active:bg-orange-100 text-gray-800'
                                    }`}
                                    disabled={isAlreadySelected}
                                  >
                                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-100 to-rose-100 flex items-center justify-center text-xs font-bold text-orange-600 flex-shrink-0">
                                      {name.charAt(0)}
                                    </span>
                                    {name}
                                  </button>
                                );
                              })}
                              {filteredSuggestions.length === 0 && (
                                <div className="px-3 py-3 text-sm text-gray-400 text-center">
                                  {t('game.noMatch')}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={onStartNewGame}
                className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 hover:from-orange-600 hover:via-red-600 hover:to-rose-700 text-white py-4 rounded-2xl font-black text-lg sm:text-xl transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-[1.02] relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {t('game.startGame')}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </button>

              <button
                onClick={onDeviceMode}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-medium text-sm sm:text-base transition-colors flex items-center justify-center gap-2"
              >
                <MonitorPlay size={18} />
                {t('device.displayMode')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
