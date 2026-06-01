import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Position, Player } from '../lib/types';
import { X, Plus, Minus } from 'lucide-react';

interface ScoreModalProps {
  winnerPosition: Position;
  players: Player[];
  onClose: () => void;
  onSubmit: (loserPosition: Position | null, baseScore: number) => void;
  isConfirmMode?: boolean;
  onConfirm?: () => void;
}

// Remove positionLabels

const modalPositions: Record<Position, string> = {
  east: 'bottom-20 left-1/2 -translate-x-1/2',
  south: 'right-20 top-1/2 -translate-y-1/2',
  west: 'top-20 left-1/2 -translate-x-1/2',
  north: 'left-20 top-1/2 -translate-y-1/2',
};

const modalRotations: Record<Position, string> = {
  east: '',
  south: '-rotate-90',
  west: 'rotate-180',
  north: 'rotate-90',
};

const getRelativePositions = (winner: Position): Position[] => {
  const order: Position[] = ['east', 'south', 'west', 'north'];
  const winnerIndex = order.indexOf(winner);

  const left = order[(winnerIndex + 3) % 4];
  const opposite = order[(winnerIndex + 2) % 4];
  const right = order[(winnerIndex + 1) % 4];

  return [left, opposite, right];
};

export default function ScoreModal({ winnerPosition, players, onClose, onSubmit, isConfirmMode = false, onConfirm }: ScoreModalProps) {
  const { t } = useTranslation();
  const [selectedLoser, setSelectedLoser] = useState<Position | null>(null);
  const [baseScore, setBaseScore] = useState<number>(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [tempScore, setTempScore] = useState<string>('8');

  const relativePositions = getRelativePositions(winnerPosition);

  const getPlayerByPosition = (position: Position) => {
    return players.find(p => p.position === position);
  };

  const winnerPlayer = getPlayerByPosition(winnerPosition);

  useEffect(() => {
    setBaseScore(8);
    setTempScore('8');
  }, []);

  const adjustScore = (delta: number) => {
    const newScore = Math.max(1, baseScore + delta);
    setBaseScore(newScore);
    setTempScore(newScore.toString());
  };

  const handleScoreInputBlur = () => {
    const score = parseInt(tempScore);
    if (!isNaN(score) && score > 0) {
      setBaseScore(score);
    } else {
      setTempScore(baseScore.toString());
    }
    setIsEditingScore(false);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (selectedLoser === null) {
      alert(t('game.selectLoserOrTsumo'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedLoser === winnerPosition ? null : selectedLoser, baseScore);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalPosition = modalPositions[winnerPosition];
  const modalRotation = modalRotations[winnerPosition];

  if (isConfirmMode) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
        <div className={`fixed ${modalPosition} ${modalRotation} bg-white rounded-xl shadow-2xl p-6 w-[85%] max-w-lg`}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {t('game.confirmScore')}
              </h2>
              {winnerPlayer && (
                <p className="text-base text-gray-600 mt-1">
                  {t('game.playerLabel')}{winnerPlayer.name || winnerPlayer.player_id}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-center text-lg text-gray-700">
              {t('game.confirmSaveScore')}
            </p>
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white text-lg font-bold rounded-lg transition-colors shadow-md"
            >
              {t('game.confirmScore')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
      <div className={`fixed ${modalPosition} ${modalRotation} bg-white rounded-xl shadow-2xl p-6 w-[85%] max-w-lg max-h-[85vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {t('game.winnerDisplay', { wind: t(`mahjong.${winnerPosition}`) })}
            </h2>
            {winnerPlayer && (
              <p className="text-base text-gray-600 mt-1">
                {t('game.playerLabel')}{winnerPlayer.name || winnerPlayer.player_id}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-3">
            <div className="flex gap-2 justify-between">
              {relativePositions.map((pos) => {
                const player = getPlayerByPosition(pos);
                return (
                  <button
                    key={pos}
                    onClick={() => setSelectedLoser(pos)}
                    className={`flex-1 py-3 px-2 rounded-lg font-bold transition-all text-base ${
                      selectedLoser === pos
                        ? 'bg-red-500 text-white shadow-lg scale-105'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <div>{t('game.loserDisplay', { wind: t(`mahjong.${pos}`) })}</div>
                    {player && (
                      <div className="text-xs font-normal mt-0.5">
                        ({player.name || player.player_id})
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedLoser(winnerPosition)}
              className={`w-full py-3 px-4 rounded-lg text-lg font-bold transition-all ${
                selectedLoser === winnerPosition
                  ? 'bg-green-500 text-white shadow-lg scale-105'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t('game.selfDraw')}
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-base font-medium text-gray-700">{t('mahjong.fan')}</label>

            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustScore(-10)}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                <span className="text-base font-bold">-10</span>
              </button>
              <button
                onClick={() => adjustScore(-5)}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                <span className="text-base font-bold">-5</span>
              </button>
              <button
                onClick={() => adjustScore(-1)}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                <Minus size={18} />
              </button>

              {isEditingScore ? (
                <input
                  type="number"
                  value={tempScore}
                  onChange={(e) => setTempScore(e.target.value)}
                  onBlur={handleScoreInputBlur}
                  autoFocus
                  className="flex-1 px-4 py-2.5 text-center border-2 border-blue-500 rounded-lg focus:outline-none text-xl font-bold"
                  min="1"
                />
              ) : (
                <button
                  onClick={() => setIsEditingScore(true)}
                  className="flex-1 px-4 py-2.5 text-center border-2 border-gray-300 rounded-lg hover:border-blue-500 transition-colors text-xl font-bold text-blue-600"
                >
                  {baseScore}
                </button>
              )}

              <button
                onClick={() => adjustScore(1)}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={() => adjustScore(5)}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                <span className="text-base font-bold">+5</span>
              </button>
              <button
                onClick={() => adjustScore(10)}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                <span className="text-base font-bold">+10</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full py-3 text-white text-lg font-bold rounded-lg transition-colors shadow-md ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
            }`}
          >
            {isSubmitting ? t('common.recording') : t('game.recordRound')}
          </button>
        </div>
      </div>
    </div>
  );
}
