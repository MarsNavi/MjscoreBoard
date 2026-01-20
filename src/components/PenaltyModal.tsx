import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Player } from '../lib/supabase';

interface PenaltyModalProps {
  players: Player[];
  onClose: () => void;
  onSubmit: (penalties: Record<string, number>) => void;
  currentPenalties?: Record<string, number>;
}

export default function PenaltyModal({
  players,
  onClose,
  onSubmit,
  currentPenalties
}: PenaltyModalProps) {
  const [penalties, setPenalties] = useState<Record<string, number>>({
    east: 0,
    south: 0,
    west: 0,
    north: 0,
  });

  useEffect(() => {
    if (currentPenalties) {
      setPenalties(currentPenalties);
    }
  }, [currentPenalties]);

  const handleChange = (position: string, value: string) => {
    const numValue = value === '' || value === '-' ? 0 : parseInt(value);
    if (!isNaN(numValue)) {
      setPenalties(prev => ({
        ...prev,
        [position]: numValue
      }));
    }
  };

  const handleSubmit = () => {
    onSubmit(penalties);
  };

  const getPlayerByPosition = (position: string) => {
    return players.find(p => p.position === position);
  };

  const positionNames = {
    east: '东',
    south: '南',
    west: '西',
    north: '北',
  };

  const totalPenalty = Object.values(penalties).reduce((sum, val) => sum + val, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={24} />
            <h2 className="text-2xl font-bold text-gray-800">判罚</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            输入每位玩家的判罚分数（正数为加分，负数为减分）
          </p>

          {(['east', 'south', 'west', 'north'] as const).map((position) => {
            const player = getPlayerByPosition(position);
            return (
              <div key={position} className="flex items-center gap-3">
                <div className="w-20 font-medium text-gray-700">
                  {positionNames[position]} - {player?.name || 'N/A'}
                </div>
                <input
                  type="number"
                  value={penalties[position] === 0 ? '' : penalties[position]}
                  onChange={(e) => handleChange(position, e.target.value)}
                  placeholder="0"
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none transition-colors text-center text-lg font-semibold"
                />
              </div>
            );
          })}

          {totalPenalty !== 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                注意：判罚总和为 <span className="font-bold">{totalPenalty}</span> 分，
                通常判罚应该总和为0（有人加分就有人减分）
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors shadow-lg"
          >
            提交
          </button>
        </div>
      </div>
    </div>
  );
}
