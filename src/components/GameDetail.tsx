import { useEffect, useState } from 'react';
import { Player, ScoreRecord, Position, Game, Penalty } from '../lib/types';
import { db } from '../lib/db';
import { ArrowLeft } from 'lucide-react';
import { buildPlayersWithCalculatedScores, getPositionForPlayerInRound } from '../lib/gameScoring';

interface GameDetailProps {
  gameId: string;
  onBack: () => void;
}

export default function GameDetail({ gameId, onBack }: GameDetailProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [penalty, setPenalty] = useState<Penalty | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const loadGameDetail = async () => {
      const gameData = await db.games.get(gameId);
      const playersData = await db.players.where('game_id').equals(gameId).toArray();
      const scoresData = await db.scores.where('game_id').equals(gameId).toArray();
      scoresData.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const penaltyData = await db.penalties.where('game_id').equals(gameId).first();

      if (gameData) setGame(gameData);
      if (scoresData) setScores(scoresData);
      if (penaltyData) setPenalty(penaltyData);

      if (playersData && scoresData) {
        const updatedPlayers = buildPlayersWithCalculatedScores(playersData, scoresData, penaltyData);
        setPlayers(updatedPlayers);
      } else if (playersData) {
        setPlayers(playersData);
      }
    };

    void loadGameDetail();
  }, [gameId]);

  const formatScore = (score: number): string => {
    return score >= 0 ? `+${score}` : `${score}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
              <span className="text-lg font-semibold">返回</span>
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {game?.game_name || '比赛详情'}
              </h2>
              {game?.game_name && (
                <div className="text-sm text-gray-500 mt-1">比赛详情</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">当前分数</h3>
            <div className="grid grid-cols-4 gap-4">
              {players
                .sort((a, b) => a.player_id.localeCompare(b.player_id))
                .map((player) => (
                  <div
                    key={player.id}
                    className="bg-white border-2 border-orange-200 p-4 rounded-xl shadow-sm"
                  >
                    <div className="text-center">
                      <div className="font-bold text-lg text-gray-800 mb-2">
                        {player.name || player.player_id}
                      </div>
                      <div className="text-2xl font-bold text-orange-600">
                        {player.score}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-700">计分明细</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-center">盘数</th>
                    {[...players].sort((a, b) => a.player_id.localeCompare(b.player_id)).map((player) => (
                      <th
                        key={player.id}
                        className="border border-gray-300 px-4 py-2 text-center"
                      >
                        {player.name || player.player_id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score) => {
                    const scoreChanges = score.score_changes as Record<Position, number>;
                    const scoreRoundIndex = Math.floor((score.game_number - 1) / 4);

                    return (
                      <tr key={score.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {score.game_number}
                        </td>
                        {[...players].sort((a, b) => a.player_id.localeCompare(b.player_id)).map((player) => {
                          const playerPositionAtScoreTime = getPositionForPlayerInRound(player.player_id, scoreRoundIndex);
                          const change = scoreChanges[playerPositionAtScoreTime];
                          let textColor = 'text-gray-800';

                          if (player.player_id === score.winner_player_id) {
                            textColor = 'text-red-600';
                          } else if (player.player_id === score.loser_player_id) {
                            textColor = 'text-purple-600';
                          }

                          return (
                            <td
                              key={player.id}
                              className={`border border-gray-300 px-4 py-2 text-center font-semibold ${textColor}`}
                            >
                              {formatScore(change)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {penalty && (
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 text-center text-gray-400">
                        判罚
                      </td>
                      {[...players].sort((a, b) => a.player_id.localeCompare(b.player_id)).map((player) => {
                        const penaltyChanges = penalty.penalty_changes as Record<Position, number>;
                        const change = penaltyChanges[player.position] || 0;

                        return (
                          <td
                            key={player.id}
                            className="border border-gray-300 px-4 py-2 text-center text-gray-400"
                          >
                            {change === 0 ? '0' : formatScore(change)}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
