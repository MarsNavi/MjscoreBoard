import { GameResult, Penalty, Player, PlayerId, Position, ScoreRecord } from './types';

const STANDARD_SCORES = [4, 2, 1, 0];

export const getPositionForPlayerInRound = (playerId: PlayerId, roundIndex: number): Position => {
  const rotations: Record<PlayerId, Position[]> = {
    A: ['east', 'south', 'north', 'west'],
    B: ['south', 'east', 'west', 'north'],
    C: ['west', 'north', 'east', 'south'],
    D: ['north', 'west', 'south', 'east'],
  };
  return rotations[playerId][roundIndex % 4];
};

export const calculatePlayerScoresById = (
  players: Player[],
  scores: ScoreRecord[],
  penalty?: Penalty | null
): Record<string, number> => {
  const sortedScores = [...scores].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const playerScores: Record<string, number> = {};
  players.forEach((player) => {
    playerScores[player.id] = 0;
  });

  sortedScores.forEach((score) => {
    const scoreChanges = score.score_changes as Record<Position, number>;
    const scoreRoundIndex = Math.floor((score.game_number - 1) / 4);

    players.forEach((player) => {
      const positionAtScoreTime = getPositionForPlayerInRound(player.player_id, scoreRoundIndex);
      const change = scoreChanges[positionAtScoreTime] || 0;
      playerScores[player.id] += change;
    });
  });

  if (penalty) {
    const penaltyChanges = penalty.penalty_changes as Record<Position, number>;
    players.forEach((player) => {
      const change = penaltyChanges[player.position] || 0;
      playerScores[player.id] += change;
    });
  }

  return playerScores;
};

export const buildPlayersWithCalculatedScores = (
  players: Player[],
  scores: ScoreRecord[],
  penalty?: Penalty | null
): Player[] => {
  const playerScores = calculatePlayerScoresById(players, scores, penalty);
  return players.map((player) => ({
    ...player,
    score: playerScores[player.id],
  }));
};

export const buildGameResults = (
  gameId: string,
  playersWithScores: Player[]
): GameResult[] => {
  const sortedPlayers = [...playersWithScores].sort((a, b) => b.score - a.score);
  const ranks: number[] = [];
  let currentRank = 1;

  for (let i = 0; i < sortedPlayers.length; i++) {
    if (i > 0 && sortedPlayers[i].score === sortedPlayers[i - 1].score) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(currentRank);
    }
    currentRank++;
  }

  return sortedPlayers.map((player, index) => {
    const rank = ranks[index];
    const sameRankCount = ranks.filter((r) => r === rank).length;

    let standardScore: number;
    if (sameRankCount === 1) {
      standardScore = STANDARD_SCORES[rank - 1] ?? 0;
    } else {
      const startIndex = rank - 1;
      const endIndex = startIndex + sameRankCount - 1;
      const totalScore = STANDARD_SCORES.slice(startIndex, endIndex + 1).reduce((a, b) => a + b, 0);
      standardScore = totalScore / sameRankCount;
    }

    return {
      id: crypto.randomUUID(),
      game_id: gameId,
      player_id: player.player_id,
      player_name: player.name,
      final_score: player.score,
      rank,
      standard_score: standardScore,
      created_at: new Date().toISOString(),
    };
  });
};
