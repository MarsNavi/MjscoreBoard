import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Position, Player, User } from '../lib/types';
import { db } from '../lib/db';
import { normalizePlayerName } from '../lib/playerNames';

interface GameCenterProps {
  currentGame: number;
  totalGames: number;
  onStartGame: () => void;
  gameStarted: boolean;
  players: Player[];
  onNameChange: (position: Position, name: string) => void;
  gameName: string;
  onGameNameChange: (name: string) => void;
  tempPlayerNames?: Record<Position, string>;
  currentUser?: User | null;
}

const getRoundDisplay = (currentGame: number) => {
  const roundIndex = Math.floor((currentGame - 1) / 4);
  const gameInRound = ((currentGame - 1) % 4) + 1;
  const roundLabels = ['east', 'south', 'west', 'north'];
  const roundLabelKey = roundLabels[roundIndex] || 'east';

  return { roundLabelKey, gameInRound };
};

export default function GameCenter({
  currentGame,
  totalGames,
  onStartGame,
  gameStarted,
  players,
  onNameChange,
  gameName,
  onGameNameChange,
  tempPlayerNames,
  currentUser,
}: GameCenterProps) {
  const { t } = useTranslation();
  const positions: Position[] = ['east', 'south', 'west', 'north'];
  const { roundLabelKey, gameInRound } = getRoundDisplay(currentGame);

  const [commonNames, setCommonNames] = useState<string[]>([]);
  const [focusedPosition, setFocusedPosition] = useState<Position | null>(null);
  const containerRefs = useRef<Record<Position, HTMLDivElement | null>>({
    east: null, south: null, west: null, north: null,
  });

  // Load known player names from the current data file
  const loadCommonNames = useCallback(async () => {
    if (!currentUser) {
      setCommonNames([]);
      return;
    }

    const games = await db.games.where('creator_id').equals(currentUser.id).toArray();
    const gameIds = games.map((game) => game.id);

    if (gameIds.length === 0) {
      setCommonNames([]);
      return;
    }

    const nameCounts: Record<string, number> = {};

    // Collect from game_results (completed games)
    const results = await db.game_results
      .where('game_id')
      .anyOf(gameIds)
      .toArray();

    results.forEach((result) => {
      const playerName = normalizePlayerName(result.player_name);
      if (playerName) {
        nameCounts[playerName] = (nameCounts[playerName] || 0) + 1;
      }
    });

    // Also collect from players table (includes in-progress games)
    const allPlayers = await db.players
      .where('game_id')
      .anyOf(gameIds)
      .toArray();

    allPlayers.forEach((player) => {
      const playerName = normalizePlayerName(player.name, player.player_id);
      if (playerName) {
        nameCounts[playerName] = (nameCounts[playerName] || 0) + 1;
      }
    });

    const sortedNames = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    setCommonNames(sortedNames);
  }, [currentUser]);

  useEffect(() => {
    void loadCommonNames();
  }, [loadCommonNames]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const isInsideAnyContainer = Object.values(containerRefs.current).some(
        (ref) => ref && ref.contains(target)
      );
      if (!isInsideAnyContainer) {
        setFocusedPosition(null);
      }
    };

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

  const getFilteredSuggestions = (position: Position): string[] => {
    const currentInput = (tempPlayerNames?.[position] || '').trim();

    if (!currentInput || commonNames.includes(currentInput)) {
      return commonNames;
    }

    const lowerInput = currentInput.toLowerCase();
    return commonNames.filter((name) => name.toLowerCase().includes(lowerInput));
  };

  const getRotation = (currentGame: number): number => {
    const gameInRound = ((currentGame - 1) % 4) + 1;
    switch (gameInRound) {
      case 1: return 0;
      case 2: return -90;
      case 3: return 180;
      case 4: return -270;
      default: return 0;
    }
  };

  const rotation = getRotation(currentGame);

  return (
    <div className="flex flex-col items-center justify-center gap-1 min-[800px]:gap-2">
      {gameStarted && (
        <div
          className="flex flex-col items-center gap-0.5 min-[800px]:gap-1"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="text-gray-800 flex items-baseline gap-1 min-[800px]:gap-1.5">
            <span className="text-2xl min-[800px]:text-3xl font-bold">
              {t('game.roundDisplay', { wind: t(`mahjong.${roundLabelKey}`), number: gameInRound })}
            </span>
          </div>
          <div className="flex items-center gap-1 min-[800px]:gap-1.5">
            <div className="text-sm min-[800px]:text-base text-gray-600 font-medium">
              {currentGame}/{totalGames}
            </div>
            {currentGame === 16 && (
              <div className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                {t('game.lastGame')}
              </div>
            )}
          </div>
        </div>
      )}

      {!gameStarted && (
        <div className="flex flex-col items-center gap-2 min-[800px]:gap-3 bg-white p-3 min-[800px]:p-4 rounded-xl shadow-lg min-w-[240px] max-w-[280px] min-[800px]:min-w-[280px] min-[800px]:max-w-[320px]">
          <div className="text-sm min-[800px]:text-base font-medium text-gray-700">{t('game.matchSettings')}</div>
          <div className="w-full">
            <label className="text-xs min-[800px]:text-sm font-medium text-gray-600 block mb-1">{t('game.gameName')}</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => onGameNameChange(e.target.value)}
              placeholder={t('game.gameNamePlaceholder')}
              className="w-full px-2 py-1.5 min-[800px]:py-2 text-center text-xs min-[800px]:text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
          <div className="text-xs min-[800px]:text-sm font-medium text-gray-700">{t('game.playerNames')}</div>
          <div className="grid grid-cols-2 gap-2 min-[800px]:gap-2.5 w-full">
            {positions.map((position) => {
              const displayName = gameStarted
                ? players.find((p) => p.position === position)?.name || ''
                : tempPlayerNames?.[position] || '';
              const filteredSuggestions = getFilteredSuggestions(position);
              const isOpen = focusedPosition === position && filteredSuggestions.length > 0;

              return (
                <div
                  key={position}
                  className="flex flex-col gap-0.5 min-[800px]:gap-1 relative"
                  ref={(el) => { containerRefs.current[position] = el; }}
                >
                  <label className="text-xs min-[800px]:text-sm font-medium text-gray-600">
                    {t(`mahjong.${position}`)}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => onNameChange(position, e.target.value)}
                      onFocus={() => setFocusedPosition(position)}
                      placeholder={t('common.namePlaceholder')}
                      className={`w-full px-2 py-1.5 min-[800px]:py-2 text-center text-xs min-[800px]:text-sm border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${
                        isOpen ? 'border-blue-500 rounded-b-none' : 'border-gray-300'
                      }`}
                    />
                    {commonNames.length > 0 && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFocusedPosition(focusedPosition === position ? null : position);
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
                        aria-label={t('game.expandPlayerList')}
                      >
                        <svg
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
                      className="absolute top-full left-0 right-0 bg-white rounded-b-lg shadow-2xl border-2 border-t-0 border-blue-500 z-50 max-h-40 overflow-y-auto"
                      style={{ marginTop: '-2px' }}
                    >
                      <div className="py-0.5">
                        {filteredSuggestions.map((name, idx) => (
                            <button
                              key={idx}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(position, name);
                              }}
                              className="w-full text-left px-2 py-1.5 transition-colors font-medium text-xs flex items-center gap-1.5 hover:bg-blue-50 active:bg-blue-100 text-gray-800"
                            >
                              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-[10px] font-bold text-blue-600 flex-shrink-0">
                                {name.charAt(0)}
                              </span>
                              {name}
                            </button>
                        ))}
                        {filteredSuggestions.length === 0 && (
                          <div className="px-2 py-2 text-xs text-gray-400 text-center">
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
          <button
            onClick={onStartGame}
            className="mt-1 px-6 py-2 min-[800px]:px-8 min-[800px]:py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-base min-[800px]:text-lg font-bold rounded-lg transition-colors shadow-lg"
          >
            {t('game.startGame')}
          </button>
        </div>
      )}
    </div>
  );
}
