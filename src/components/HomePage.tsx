import { useCallback, useEffect, useRef, useState } from 'react';
import { Position, User } from '../lib/types';
import { db } from '../lib/db';
import { normalizePlayerName } from '../lib/playerNames';

interface HomePageProps {
  user: User;
  onStartNewGame: () => void;
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
  gameName,
  onGameNameChange,
  tempPlayerNames,
  onNameChange,
}: HomePageProps) {
  const positions: Position[] = ['east', 'south', 'west', 'north'];
  const [commonNames, setCommonNames] = useState<string[]>([]);
  const [focusedPosition, setFocusedPosition] = useState<Position | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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

  const getDefaultPlaceholder = (position: Position): string => {
    const defaults: Record<Position, string> = {
      east: 'A',
      south: 'B',
      west: 'C',
      north: 'D',
    };
    return defaults[position];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZjk5MDAiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzEgMCA2IDIuNjkgNiA2cy0yLjY5IDYtNiA2LTYtMi42OS02LTYgMi42OS02IDYtNk0xMiAzOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40"></div>

      <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] md:py-5 md:pt-[calc(1.5rem+env(safe-area-inset-top))] px-4 shadow-2xl">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-lg">
            国标麻将实时计分板
          </h1>
        </div>
      </div>

      <div className="relative flex-1 p-4 pb-32 md:p-8 md:pb-36">
        <div className="w-full max-w-2xl mx-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl p-5 sm:p-6 border-2 border-orange-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-orange-200/35 to-rose-200/25 rounded-full -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tr from-pink-200/25 to-orange-200/25 rounded-full -ml-16 -mb-16"></div>

            <div className="relative space-y-4 sm:space-y-5">
              <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-rose-600">
                快速开局
              </h2>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-3 flex items-center gap-2">
                  比赛名称（可选）
                </label>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => onGameNameChange(e.target.value)}
                  placeholder="周末友谊赛"
                  className="w-full px-5 py-3 text-center border-2 border-orange-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all text-base sm:text-lg font-medium hover:border-orange-300"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-3 flex items-center gap-2">
                  选手姓名
                </label>
                <div className="grid grid-cols-2 gap-3">
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
                        className="px-3 sm:px-4 py-2.5 text-center border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all font-medium hover:border-orange-300"
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
                className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 hover:from-orange-600 hover:via-red-600 hover:to-rose-700 text-white py-4 rounded-2xl font-black text-lg sm:text-xl transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-[1.02] relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  开始比赛
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
