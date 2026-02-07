import { Position, Player } from '../lib/types';

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
}

const positionLabels: Record<Position, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

const roundLabels = ['东', '南', '西', '北'];

const getRoundDisplay = (currentGame: number) => {
  const roundIndex = Math.floor((currentGame - 1) / 4);
  const gameInRound = ((currentGame - 1) % 4) + 1;
  const roundLabel = roundLabels[roundIndex] || '东';
  const gameLabel = ['一', '二', '三', '四'][gameInRound - 1];

  return { roundLabel, gameLabel };
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
}: GameCenterProps) {
  const positions: Position[] = ['east', 'south', 'west', 'north'];
  const { roundLabel, gameLabel } = getRoundDisplay(currentGame);

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
            <span className="text-2xl min-[800px]:text-3xl font-bold">{roundLabel}</span>
            <span className="text-base min-[800px]:text-lg font-bold">{gameLabel}局</span>
          </div>
          <div className="flex items-center gap-1 min-[800px]:gap-1.5">
            <div className="text-sm min-[800px]:text-base text-gray-600 font-medium">
              {currentGame}/{totalGames}
            </div>
            {currentGame === 16 && (
              <div className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                最后一局
              </div>
            )}
          </div>
        </div>
      )}

      {!gameStarted && (
        <div className="flex flex-col items-center gap-2 min-[800px]:gap-3 bg-white p-3 min-[800px]:p-4 rounded-xl shadow-lg min-w-[240px] max-w-[280px] min-[800px]:min-w-[280px] min-[800px]:max-w-[320px]">
          <div className="text-sm min-[800px]:text-base font-medium text-gray-700">请输入比赛信息</div>
          <div className="w-full">
            <label className="text-xs min-[800px]:text-sm font-medium text-gray-600 block mb-1">比赛名称</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => onGameNameChange(e.target.value)}
              placeholder="输入比赛名称(选填)"
              className="w-full px-2 py-1.5 min-[800px]:py-2 text-center text-xs min-[800px]:text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
          <div className="text-xs min-[800px]:text-sm font-medium text-gray-700">选手姓名</div>
          <div className="grid grid-cols-2 gap-2 min-[800px]:gap-2.5 w-full">
            {positions.map((position) => {
              const displayName = gameStarted
                ? players.find((p) => p.position === position)?.name || ''
                : tempPlayerNames?.[position] || '';
              return (
                <div key={position} className="flex flex-col gap-0.5 min-[800px]:gap-1">
                  <label className="text-xs min-[800px]:text-sm font-medium text-gray-600">
                    {positionLabels[position]}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => onNameChange(position, e.target.value)}
                    placeholder="输入姓名"
                    className="px-2 py-1.5 min-[800px]:py-2 text-center text-xs min-[800px]:text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              );
            })}
          </div>
          <button
            onClick={onStartGame}
            className="mt-1 px-6 py-2 min-[800px]:px-8 min-[800px]:py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-base min-[800px]:text-lg font-bold rounded-lg transition-colors shadow-lg"
          >
            开局
          </button>
        </div>
      )}
    </div>
  );
}
