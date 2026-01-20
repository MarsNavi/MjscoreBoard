import { Position, Player } from '../lib/supabase';

interface PlayerScoreProps {
  player: Player;
  position: Position;
  onWin: () => void;
  gameStarted: boolean;
  isConfirmMode?: boolean;
}

const positionLabels: Record<Position, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

const rotationClasses: Record<Position, string> = {
  east: '',
  north: 'rotate-90',
  west: 'rotate-180',
  south: '-rotate-90',
};

export default function PlayerScore({ player, position, onWin, gameStarted, isConfirmMode = false }: PlayerScoreProps) {
  const label = positionLabels[position];
  const rotation = rotationClasses[position];
  const buttonLabel = isConfirmMode ? '确认成绩' : '和';
  const isConfirmed = player.confirmed_result;

  const getScoreColor = (score: number) => {
    if (score > 0) return 'text-red-600';
    if (score < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className={`flex flex-col items-center justify-center ${rotation}`}>
      <div className="flex flex-col items-center gap-1 min-[800px]:gap-1.5 min-w-[80px] min-[800px]:min-w-[140px]">
        {gameStarted ? (
          <div className="flex items-center gap-1 min-[800px]:gap-1.5 min-h-[20px] min-[800px]:min-h-[28px]">
            <span className="text-sm min-[800px]:text-base font-bold text-gray-600">{label}</span>
            <span className="text-base min-[800px]:text-xl font-bold text-gray-800">{player.name || ''}</span>
          </div>
        ) : (
          <div className="text-lg min-[800px]:text-2xl font-bold text-gray-800">{label}</div>
        )}

        <div className={`text-6xl min-[800px]:text-7xl font-bold ${getScoreColor(player.score)} my-1 min-[800px]:my-1.5 tracking-tight leading-none`}>{player.score}</div>

        <button
          onClick={onWin}
          disabled={isConfirmMode && isConfirmed}
          className={`px-6 py-2.5 min-[800px]:px-10 min-[800px]:py-3 text-white text-xl min-[800px]:text-2xl font-bold rounded-xl transition-colors shadow-lg hover:shadow-xl ${
            isConfirmMode && isConfirmed
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
          }`}
        >
          {isConfirmed && isConfirmMode ? '已确认' : buttonLabel}
        </button>
      </div>
    </div>
  );
}
