import { useEffect, useState, useRef } from 'react';
import { Position, Player, Game, PlayerId, User } from './lib/supabase';
import { db } from './lib/db';
import PlayerScore from './components/PlayerScore';
import GameCenter from './components/GameCenter';
import ScoreModal from './components/ScoreModal';
import GameHistoryList from './components/GameHistoryList';
import GameDetail from './components/GameDetail';
import PenaltyModal from './components/PenaltyModal';
import HomePage from './components/HomePage';
import GameHistoryPage from './components/GameHistoryPage';
import PlayerStatsPage from './components/PlayerStatsPage';
import HelpPage from './components/HelpPage';
import { AdminPage } from './components/AdminPage';
import { RotateCcw, Undo, History, Ban, AlertTriangle, Home, Bluetooth } from 'lucide-react';
import { loadLocalGameSnapshot, saveLocalGameSnapshot, clearLocalGameSnapshot } from './lib/localStore';
import { useBle } from './contexts/BleContext';
import BleConnectionManager from './components/BleConnectionManager';
import { DeviceDisplayState } from './lib/supabase';

const TOTAL_GAMES = 16;
const BLE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const BLE_RX_CHAR_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

type PageView = 'home' | 'game' | 'history' | 'stats' | 'gameDetail' | 'help' | 'admin';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<PageView>('home');
  const [showBleModal, setShowBleModal] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [winnerPosition, setWinnerPosition] = useState<Position | null>(null);
  const [showGameHistory, setShowGameHistory] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameName, setGameName] = useState('');
  const [tempPlayerNames, setTempPlayerNames] = useState<Record<Position, string>>({
    east: '',
    south: '',
    west: '',
    north: '',
  });
  const [isConfirmMode, setIsConfirmMode] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [currentPenalties, setCurrentPenalties] = useState<Record<string, number> | undefined>(undefined);
  const [deviceHuangStates, setDeviceHuangStates] = useState<Record<Position, boolean>>({
    east: false,
    south: false,
    west: false,
    north: false,
  });
  const [deviceConfirmStates, setDeviceConfirmStates] = useState<Record<Position, boolean>>({
    east: false,
    south: false,
    west: false,
    north: false,
  });

  const { bleDevices, writeData, setMessageHandler } = useBle();

  // Helper to build state for device
  const buildDeviceDisplayState = (position: Position): DeviceDisplayState | null => {
    if (!game || !gameStarted) return null;

    const allScores: Record<Position, number> = {
      east: 0,
      south: 0,
      west: 0,
      north: 0,
    };

    players.forEach((player) => {
      allScores[player.position as Position] = player.score;
    });

    const selfScore = allScores[position];

    return {
      game_id: game.id,
      position,
      round: game.current_round,
      game_number: game.current_game,
      self_score: selfScore,
      all_scores: allScores,
    };
  };

  const getRelativePositions = (winner: Position): Position[] => {
    const order: Position[] = ['east', 'south', 'west', 'north'];
    const winnerIndex = order.indexOf(winner);

    const left = order[(winnerIndex + 3) % 4];
    const opposite = order[(winnerIndex + 2) % 4];
    const right = order[(winnerIndex + 1) % 4];

    return [left, opposite, right];
  };

  const restoreLocalGameSnapshot = (userId: string) => {
    const snapshot = loadLocalGameSnapshot(userId);
    if (!snapshot) return;
    setGame(snapshot.game);
    setPlayers(snapshot.players);
    setGameStarted(true);
    setIsConfirmMode(snapshot.isConfirmMode);
    if (snapshot.currentPenalties) {
      setCurrentPenalties(snapshot.currentPenalties);
    } else {
      setCurrentPenalties(undefined);
    }
    if (snapshot.game.game_name) {
      setGameName(snapshot.game.game_name);
    }
  };

  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);

  useEffect(() => {
    const initLocalUser = async () => {
      let targetUser = await db.users.where('code').equals('micken').first();

      if (!targetUser) {
        const storedUserId = localStorage.getItem('mahjong_user_id');
        if (storedUserId) {
          const storedUser = await db.users.get(storedUserId);
          if (storedUser) {
            targetUser = storedUser;
          }
        }
      }

      if (!targetUser) {
        const newUser: User = {
          id: crypto.randomUUID(),
          code: 'local',
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        };
        await db.users.add(newUser);
        targetUser = newUser;
      }

      const allUsers = await db.users.toArray();
      const otherUsers = allUsers.filter((u) => u.id !== targetUser!.id);

      if (otherUsers.length > 0) {
        const otherUserIds = otherUsers.map((u) => u.id);
        const otherGames = await db.games.where('creator_id').anyOf(otherUserIds).toArray();
        const otherGameIds = otherGames.map((g) => g.id);

        if (otherGameIds.length > 0) {
          await db.scores.where('game_id').anyOf(otherGameIds).delete();
          await db.penalties.where('game_id').anyOf(otherGameIds).delete();
          await db.players.where('game_id').anyOf(otherGameIds).delete();
          await db.game_results.where('game_id').anyOf(otherGameIds).delete();
          await db.games.where('id').anyOf(otherGameIds).delete();
        }

        await db.users.where('id').anyOf(otherUserIds).delete();
      }

      setCurrentUser(targetUser);
      localStorage.setItem('mahjong_user_id', targetUser.id);
      restoreLocalGameSnapshot(targetUser.id);
    };

    initLocalUser();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === '/admin') {
        setCurrentPage('admin');
      } else if (hash === '/history') {
        setCurrentPage('history');
      } else if (hash === '/stats') {
        setCurrentPage('stats');
      } else if (hash === '/help') {
        setCurrentPage('help');
      } else if (hash.startsWith('/game/')) {
        const gameId = hash.split('/')[2];
        if (gameId) {
          setSelectedGameId(gameId);
          setCurrentPage('gameDetail');
        }
      } else {
        setCurrentPage('home');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (!game || players.length === 0) {
      clearLocalGameSnapshot(currentUser.id);
      return;
    }
    const snapshot = {
      game,
      players,
      isConfirmMode,
      currentPenalties,
    };
    saveLocalGameSnapshot(currentUser.id, snapshot);
  }, [currentUser, game, players, isConfirmMode, currentPenalties]);

  const navigateTo = (path: string) => {
    window.location.hash = path;
  };

  const createNewGame = async () => {
    if (!currentUser) return;

    const gameId = crypto.randomUUID();
    const gameData: Game = {
      id: gameId,
      current_round: 1,
      current_game: 1,
      status: 'active',
      game_name: gameName || undefined,
      creator_id: currentUser.id,
      created_at: new Date().toISOString()
    };

    try {
      await db.games.add(gameData);
    } catch (gameError) {
      console.error('创建游戏失败:', gameError);
      return;
    }

    const playerIds: PlayerId[] = ['A', 'B', 'C', 'D'];
    const initialMapping: Record<PlayerId, Position> = {
      A: 'east',
      B: 'south',
      C: 'west',
      D: 'north',
    };

    const createdPlayers: Player[] = [];
    
    for (const playerId of playerIds) {
      const position = initialMapping[playerId];
      const playerName = tempPlayerNames[position] || playerId;
      const player: Player = {
        id: crypto.randomUUID(),
        game_id: gameId,
        position: position,
        player_id: playerId,
        name: playerName,
        score: 0,
        created_at: new Date().toISOString()
      };
      await db.players.add(player);
      createdPlayers.push(player);
    }

    const zeroPenaltyChanges = {
      east: 0,
      south: 0,
      west: 0,
      north: 0,
    };

    await db.penalties.add({
      id: crypto.randomUUID(),
      game_id: gameData.id,
      penalty_changes: zeroPenaltyChanges,
      created_at: new Date().toISOString()
    });

    setGame(gameData);
    setPlayers(createdPlayers);
    setGameStarted(true);
    setCurrentPage('game');
  };

  const handleStartGame = async () => {
    await createNewGame();
  };

  const handleStartNewGameFromHome = async () => {
    await createNewGame();
  };

  const handleWin = (position: Position) => {
    if (!gameStarted) {
      alert('请先开局');
      return;
    }

    if (isConfirmMode) {
      handleConfirmResult(position);
    } else {
      setWinnerPosition(position);
      setShowScoreModal(true);
    }
  };

  const handleConfirmResult = async (position: Position) => {
    if (!game) return;

    const player = players.find((p) => p.position === position);
    if (!player || player.confirmed_result) return;

    await db.players.update(player.id, {
      confirmed_result: true,
      confirmed_at: new Date().toISOString(),
    });

    await recalculateAndRefreshPlayers();

    const allPlayers = await db.players.where('game_id').equals(game.id).toArray();

    if (allPlayers && allPlayers.every((p) => p.confirmed_result)) {
      await saveGameResults();

      setGameStarted(false);
      setIsConfirmMode(false);
      navigateTo(`/game/${game.id}`);
    }
  };

  const handleConfirmEndGame = async () => {
    if (game) {
      await db.games.update(game.id, { early_ended: true });

      await saveGameResults();
      
      setGameStarted(false);
      setIsConfirmMode(false);
      setShowEndGameConfirm(false);
      
      await recalculateAndRefreshPlayers();
      
      navigateTo(`/game/${game.id}`);
    }
  };

  const handleNameChange = (position: Position, name: string) => {
    setTempPlayerNames((prev) => ({
      ...prev,
      [position]: name,
    }));
  };

  const calculateStandardScore = (rank: number): number => {
    const scores = [4, 2, 1, 0];
    return scores[rank - 1];
  };

  const saveGameResults = async () => {
    if (!game) return;

    const existingResults = await db.game_results.where('game_id').equals(game.id).first();

    if (existingResults) {
      return;
    }

    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

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

    const results = sortedPlayers.map((player, index) => {
      const rank = ranks[index];
      const sameRankCount = ranks.filter(r => r === rank).length;

      let standardScore: number;
      if (sameRankCount === 1) {
        standardScore = calculateStandardScore(rank);
      } else {
        const startIndex = rank - 1;
        const endIndex = startIndex + sameRankCount - 1;
        const totalScore = [4, 2, 1, 0].slice(startIndex, endIndex + 1).reduce((a, b) => a + b, 0);
        standardScore = totalScore / sameRankCount;
      }

      return {
        id: crypto.randomUUID(),
        game_id: game.id,
        player_id: player.player_id,
        player_name: player.name,
        final_score: player.score,
        rank: rank,
        standard_score: standardScore,
        created_at: new Date().toISOString()
      };
    });

    await db.game_results.bulkAdd(results);

    await db.games.update(game.id, {
        is_completed: true,
        completed_at: new Date().toISOString()
    });
  };

  const resetDeviceHuangStates = () => {
    setDeviceHuangStates({
      east: false,
      south: false,
      west: false,
      north: false,
    });
  };

  const resetDeviceConfirmStates = () => {
    setDeviceConfirmStates({
      east: false,
      south: false,
      west: false,
      north: false,
    });
  };

  const handleRestart = async () => {
    setShowEndGameConfirm(true);
  };

  const handleHuangzhuang = async (fromDevices = false) => {
    if (!game) return;

    if (!fromDevices) {
      if (!confirm('确定要记录荒庄吗？本局四家都将记0分。')) return;
    }

    const scoreChanges = {
      east: 0,
      south: 0,
      west: 0,
      north: 0,
    };

    try {
      await db.scores.add({
        id: crypto.randomUUID(),
        game_id: game.id,
        round: game.current_round,
        game_number: game.current_game,
        winner_position: null,
        loser_position: null,
        winner_player_id: undefined,
        loser_player_id: null,
        base_score: 0,
        score_changes: scoreChanges,
        created_at: new Date().toISOString()
      });
    } catch (scoreError) {
      console.error('记录荒庄失败:', scoreError);
      return;
    }

    const nextGame = game.current_game + 1;
    if (nextGame <= TOTAL_GAMES) {
      await db.games.update(game.id, { current_game: nextGame });
      setGame({ ...game, current_game: nextGame });

      if (nextGame % 4 === 1 && nextGame > 1) {
        await rotatePlayersForNewRound(nextGame);
      }
      await recalculateAndRefreshPlayers();
    } else {
      await saveGameResults();
      setGameStarted(false);
      setIsConfirmMode(false);
      await recalculateAndRefreshPlayers();
      navigateTo(`/game/${game.id}`);
    }

    resetDeviceHuangStates();
  };

  const handleOpenPenalty = async () => {
    if (!game) return;

    const penalty = await db.penalties.where('game_id').equals(game.id).first();

    if (penalty) {
      setCurrentPenalties(penalty.penalty_changes as Record<string, number>);
    }

    setShowPenaltyModal(true);
  };

  const handlePenaltySubmit = async (penalties: Record<string, number>) => {
    if (!game) return;

    await db.penalties.where('game_id').equals(game.id).modify({
      penalty_changes: penalties,
    });

    await recalculateAndRefreshPlayers();
    setShowPenaltyModal(false);
    setCurrentPenalties(undefined);
  };

  const handleContinueGame = async (gameId: string) => {
    const gameData = await db.games.get(gameId);

    if (!gameData) return;

    const playersData = await db.players.where('game_id').equals(gameId).toArray();

    if (playersData && gameData) {
      setGame(gameData);
      setGameStarted(true);
      setShowGameHistory(false);
      setSelectedGameId(null);
      setCurrentPage('game');

      if (gameData.game_name) {
        setGameName(gameData.game_name);
      }

      const allScores = await db.scores.where('game_id').equals(gameId).toArray();
      allScores.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const penalty = await db.penalties.where('game_id').equals(gameId).first();

      const playerScores: Record<string, number> = {};
      playersData.forEach((player) => {
        playerScores[player.id] = 0;
      });

      if (allScores && allScores.length > 0) {
        allScores.forEach((score) => {
          const scoreChanges = score.score_changes as Record<Position, number>;
          const scoreRoundIndex = Math.floor((score.game_number - 1) / 4);

          playersData.forEach((player) => {
            const playerPositionAtScoreTime = getPositionForPlayerInRound(player.player_id as PlayerId, scoreRoundIndex);
            const change = scoreChanges[playerPositionAtScoreTime] || 0;
            playerScores[player.id] += change;
          });
        });
      }

      if (penalty) {
        const penaltyChanges = penalty.penalty_changes as Record<Position, number>;
        playersData.forEach((player) => {
          const change = penaltyChanges[player.position] || 0;
          playerScores[player.id] += change;
        });
      }

      const updatedPlayers = playersData.map((player) => ({
        ...player,
        score: playerScores[player.id],
      }));

      setPlayers(updatedPlayers);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('确定要删除这场比赛吗？此操作不可恢复！')) return;

    const isCurrentGame = game?.id === gameId;

    await db.scores.where('game_id').equals(gameId).delete();
    await db.penalties.where('game_id').equals(gameId).delete();
    await db.players.where('game_id').equals(gameId).delete();
    await db.games.delete(gameId);
    await db.game_results.where('game_id').equals(gameId).delete();

    if (selectedGameId === gameId) {
      setSelectedGameId(null);
    }

    if (isCurrentGame) {
      setGame(null);
      setPlayers([]);
      setGameStarted(false);
      setGameName('');
      setIsConfirmMode(false);
      setShowGameHistory(false);
      setTempPlayerNames({
        east: '',
        south: '',
        west: '',
        north: '',
      });
    }
  };

  const handleUndoLastScore = async () => {
    if (!game) return;

    const scores = await db.scores.where('game_id').equals(game.id).toArray();
    scores.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastScore = scores[0];

    if (!lastScore) {
      alert('没有可撤销的记录!');
      return;
    }

    if (!confirm('确定要撤销上一盘的记录吗?')) return;

    await db.scores.delete(lastScore.id);

    const allScores = await db.scores.where('game_id').equals(game.id).toArray();

    const allPlayers = await db.players.where('game_id').equals(game.id).toArray();

    if (!allPlayers || allPlayers.length === 0) return;

    let maxGameNumber = 0;
    if (allScores && allScores.length > 0) {
      allScores.forEach((score) => {
        maxGameNumber = Math.max(maxGameNumber, score.game_number);
      });
    }

    const newCurrentGame = maxGameNumber === 0 ? 1 : maxGameNumber + 1;
    const newRound = Math.floor((newCurrentGame - 1) / 4) + 1;
    const newRoundIndex = Math.floor((newCurrentGame - 1) / 4);

    const positionUpdatePromises = allPlayers.map((player) => {
      const newPosition = getPositionForPlayerInRound(player.player_id, newRoundIndex);
      return db.players.update(player.id, { position: newPosition });
    });
    await Promise.all(positionUpdatePromises);

    await db.games.update(game.id, {
        current_game: newCurrentGame,
        current_round: newRound
    });

    setGame({
      ...game,
      current_game: newCurrentGame,
      current_round: newRound
    });

    await recalculateAndRefreshPlayers();
  };

  const recalculateAndRefreshPlayers = async () => {
    if (!game) return;

    const allPlayers = await db.players.where('game_id').equals(game.id).toArray();

    const allScores = await db.scores.where('game_id').equals(game.id).toArray();
    allScores.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const penalty = await db.penalties.where('game_id').equals(game.id).first();

    if (!allPlayers || allPlayers.length === 0) return;

    const playerScores: Record<string, number> = {};
    allPlayers.forEach((player) => {
      playerScores[player.id] = 0;
    });

    if (allScores && allScores.length > 0) {
      allScores.forEach((score) => {
        const scoreChanges = score.score_changes as Record<Position, number>;
        const scoreRoundIndex = Math.floor((score.game_number - 1) / 4);

        allPlayers.forEach((player) => {
          const playerPositionAtScoreTime = getPositionForPlayerInRound(player.player_id, scoreRoundIndex);
          const change = scoreChanges[playerPositionAtScoreTime] || 0;
          playerScores[player.id] += change;
        });
      });
    }

    if (penalty) {
      const penaltyChanges = penalty.penalty_changes as Record<Position, number>;

      allPlayers.forEach((player) => {
        const change = penaltyChanges[player.position] || 0;
        playerScores[player.id] += change;
      });
    }

    const updatedPlayers = allPlayers.map((player) => ({
      ...player,
      score: playerScores[player.id],
    }));

    // Update DB with calculated scores so syncToDevices can read from DB
    await db.players.bulkPut(updatedPlayers);

    setPlayers(updatedPlayers);
  };

  const getPositionForPlayerInRound = (playerId: PlayerId, roundIndex: number): Position => {
    const rotations: Record<PlayerId, Position[]> = {
      A: ['east', 'south', 'north', 'west'],
      B: ['south', 'east', 'west', 'north'],
      C: ['west', 'north', 'east', 'south'],
      D: ['north', 'west', 'south', 'east'],
    };
    return rotations[playerId][roundIndex % 4];
  };

  const rotatePlayersForNewRound = async (currentGame: number) => {
    if (!game) return;

    const roundIndex = Math.floor((currentGame - 1) / 4);

    const updatePromises = players.map((player) => {
      const newPosition = getPositionForPlayerInRound(player.player_id, roundIndex);
      return db.players.update(player.id, { position: newPosition });
    });

    await Promise.all(updatePromises);

    const refreshedPlayers = await db.players.where('game_id').equals(game.id).toArray();

    if (refreshedPlayers) {
      setPlayers(refreshedPlayers);
    }
  };

  const calculateScoreChanges = (
    winner: Position,
    loser: Position | null,
    baseScore: number
  ): Record<Position, number> => {
    const changes: Record<Position, number> = {
      east: 0,
      south: 0,
      west: 0,
      north: 0,
    };

    if (loser === null) {
      changes[winner] = baseScore * 3 + 24;
      const positions: Position[] = ['east', 'south', 'west', 'north'];
      positions.forEach((pos) => {
        if (pos !== winner) {
          changes[pos] = -baseScore - 8;
        }
      });
    } else {
      changes[winner] = baseScore + 24;
      changes[loser] = -baseScore - 8;
      const positions: Position[] = ['east', 'south', 'west', 'north'];
      positions.forEach((pos) => {
        if (pos !== winner && pos !== loser) {
          changes[pos] = -8;
        }
      });
    }

    return changes;
  };

  const submitScoreForWinner = async (winner: Position, loserPosition: Position | null, baseScore: number) => {
    if (!game) return;

    resetDeviceHuangStates();
    resetDeviceConfirmStates();

    const scoreChanges = calculateScoreChanges(winner, loserPosition, baseScore);

    const dbPlayers = await db.players.where('game_id').equals(game.id).toArray();
    const winnerPlayer = dbPlayers.find(p => p.position === winner);
    const loserPlayer = loserPosition ? dbPlayers.find(p => p.position === loserPosition) : null;

    try {
      await db.scores.add({
        id: crypto.randomUUID(),
        game_id: game.id,
        round: game.current_round,
        game_number: game.current_game,
        winner_position: winner,
        loser_position: loserPosition,
        winner_player_id: winnerPlayer?.player_id,
        loser_player_id: loserPlayer?.player_id,
        base_score: baseScore,
        score_changes: scoreChanges,
        created_at: new Date().toISOString()
      });
    } catch (scoreError) {
      console.error('记录分数失败:', scoreError);
      return;
    }

    const nextGame = game.current_game + 1;
    if (nextGame <= TOTAL_GAMES) {
      await db.games.update(game.id, { current_game: nextGame });
      setGame({ ...game, current_game: nextGame });

      if (nextGame % 4 === 1 && nextGame > 1) {
        await rotatePlayersForNewRound(nextGame);
      }
      await recalculateAndRefreshPlayers();

      if (nextGame === TOTAL_GAMES + 1) {
        await saveGameResults();
        setGameStarted(false);
        setIsConfirmMode(false);
        navigateTo(`/game/${game.id}`);
      }
    } else {
      await saveGameResults();
      setGameStarted(false);
      setIsConfirmMode(false);
      await recalculateAndRefreshPlayers();
      navigateTo(`/game/${game.id}`);
    }
  };

  const handleScoreSubmit = async (loserPosition: Position | null, baseScore: number) => {
    if (!winnerPosition) return;
    await submitScoreForWinner(winnerPosition, loserPosition, baseScore);
    setShowScoreModal(false);
    setWinnerPosition(null);
  };

  const handleDeviceScoreSubmit = async (winner: Position, loserPosition: Position | null, baseScore: number) => {
    await submitScoreForWinner(winner, loserPosition, baseScore);
  };

  const handleDeviceHuang = (position: Position) => {
    if (!gameStarted || !game) return;

    // Immediately trigger Huangzhuang logic without waiting for others
    // Since only East device has the button, this action is authoritative
    void handleHuangzhuang(true);
  };

  const completeGameFromDeviceConfirm = async () => {
    if (!game) return;

    await db.players.where('game_id').equals(game.id).modify({
      confirmed_result: true,
      confirmed_at: new Date().toISOString(),
    });

    await saveGameResults();

    setGameStarted(false);
    setIsConfirmMode(false);
    resetDeviceConfirmStates();
    resetDeviceHuangStates();

    navigateTo(`/game/${game.id}`);
  };

  const handleDeviceConfirm = (position: Position) => {
    if (!game) return;

    setDeviceConfirmStates((prev) => {
      if (prev[position]) {
        return prev;
      }

      const next: Record<Position, boolean> = {
        ...prev,
        [position]: true,
      };

      const allConfirmed = next.east && next.south && next.west && next.north;

      if (allConfirmed) {
        void completeGameFromDeviceConfirm();
      }

      return next;
    });
  };

  // Sync State Effect
  const isSyncingRef = useRef(false);
  const needsSyncRef = useRef(false);

  useEffect(() => {
    const triggerSync = async () => {
       // Mark that we need a sync
       needsSyncRef.current = true;
       
       // If already syncing, the loop will pick it up. If not, start the loop.
       if (isSyncingRef.current) return;
       
       isSyncingRef.current = true;
       
       try {
         // Keep syncing as long as there are pending updates
         while (needsSyncRef.current) {
           needsSyncRef.current = false; // Clear flag before starting
           
           if (!game) break;

           // Fetch latest data from DB
           const dbGame = await db.games.get(game.id);
           const dbPlayers = await db.players.where('game_id').equals(game.id).toArray();
           
           if (!dbGame) break;

           const positions: Position[] = ['east', 'south', 'west', 'north'];
           for (const position of positions) {
              const connection = bleDevices[position];
              if (!connection || connection.status !== 'connected') continue;

              // 1. Send Names
              const pList = [
                { pos: 0, name: dbPlayers.find(p => p.position === 'east')?.name || '' },
                { pos: 1, name: dbPlayers.find(p => p.position === 'south')?.name || '' },
                { pos: 2, name: dbPlayers.find(p => p.position === 'west')?.name || '' },
                { pos: 3, name: dbPlayers.find(p => p.position === 'north')?.name || '' },
              ];
              for (const item of pList) {
                const cmd = `NAME:${item.pos}:${item.name}\n`;
                const encoder = new TextEncoder();
                const data = encoder.encode(cmd);
                try {
                   await writeData(connection.deviceId, new DataView(data.buffer));
                   await new Promise(resolve => setTimeout(resolve, 50)); 
                } catch (e) {
                   console.error('Sync name error', e);
                }
              }

              // 2. Send Game State
              let payload = 'STATE:IDLE';
              
              if (game.is_completed || game.status === 'finished' || game.early_ended) {
                  payload = 'STATE:GAMEOVER';
              } else if (gameStarted) {
                 const allScores: Record<Position, number> = {
                    east: 0, south: 0, west: 0, north: 0,
                 };
                 dbPlayers.forEach((player) => {
                    allScores[player.position as Position] = player.score;
                 });
                 
                 const mode = isConfirmMode ? 'CONFIRM' : 'PLAY';
                 const e = allScores.east ?? 0;
                 const s = allScores.south ?? 0;
                 const w = allScores.west ?? 0;
                 const n = allScores.north ?? 0;
                 
                 payload = `STATE:${mode}:${dbGame.current_round}:${dbGame.current_game}:${e}:${s}:${w}:${n}`;
              }
              
              const encoder = new TextEncoder();
              const data = encoder.encode(payload + '\n');
              try {
                 await writeData(connection.deviceId, new DataView(data.buffer));
              } catch (e) {
                 console.error('Sync state error', e);
              }
           }
           
           // Small delay to prevent tight loops if updates are super fast
           await new Promise(resolve => setTimeout(resolve, 100));
         }
       } catch (error) {
         console.error('Sync loop error:', error);
       } finally {
         isSyncingRef.current = false;
       }
    };

    // Debounce the trigger slightly to batch rapid updates
    const timer = setTimeout(() => {
      void triggerSync();
    }, 500); // Increased debounce to 500ms to avoid conflict with incoming messages

    return () => clearTimeout(timer);
  }, [game, players, gameStarted, isConfirmMode, bleDevices]); // Sync whenever game state or connection changes

  // Message Handler Effect
  useEffect(() => {
     setMessageHandler((position, raw) => {
        const msg = raw.trim();
        if (!msg) return;
        if (msg === 'BTN:HUANG') {
           handleDeviceHuang(position);
           return;
        }
        if (msg === 'BTN:CONFIRM') {
           handleDeviceConfirm(position);
           return;
        }
        const parts = msg.split(':');
        if (parts[0] === 'HE') {
           const kind = parts[1];
           if (kind === 'ZIMO') {
              const base = parseInt(parts[2] || '8', 10);
              if (Number.isNaN(base)) return;
              handleDeviceScoreSubmit(position, null, base);
              return;
           }
           if (kind === 'RON') {
              const rel = parts[2];
              const base = parseInt(parts[3] || '8', 10);
              if (Number.isNaN(base)) return;
              const [left, opposite, right] = getRelativePositions(position);
              let loser: Position | null = null;
              if (rel === 'LEFT') loser = left;
              else if (rel === 'RIGHT') loser = right;
              else if (rel === 'OPPOSITE') loser = opposite;
              
              if (loser) {
                 handleDeviceScoreSubmit(position, loser, base);
              }
           }
        }
     });
  }, [game, players, gameStarted, isConfirmMode]); // Re-register when closure vars change

  const getPlayerByPosition = (position: Position): Player | undefined => {
    return players.find((p) => p.position === position);
  };

  const northPlayer = getPlayerByPosition('north');
  const southPlayer = getPlayerByPosition('south');
  const westPlayer = getPlayerByPosition('west');
  const eastPlayer = getPlayerByPosition('east');

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50">
        <div className="text-gray-600 text-sm">正在准备本地数据...</div>
      </div>
    );
  }

  // Always render BleConnectionManager to ensure connection stability
  const bleManager = (
    <BleConnectionManager 
      isOpen={showBleModal} 
      onClose={() => setShowBleModal(false)} 
    />
  );

  if (currentPage === 'home') {
    return (
      <>
        {bleManager}
        <HomePage
          user={currentUser}
          onStartNewGame={handleStartNewGameFromHome}
          onViewHistory={() => navigateTo('/history')}
          onViewStats={() => navigateTo('/stats')}
          onViewHelp={() => navigateTo('/help')}
          gameName={gameName}
          onGameNameChange={setGameName}
          tempPlayerNames={tempPlayerNames}
          onNameChange={handleNameChange}
        />
      </>
    );
  }

  if (currentPage === 'admin') {
    return (
      <>
        {bleManager}
        <AdminPage
          onBack={() => navigateTo('')}
          currentUserId={currentUser.id}
        />
      </>
    );
  }

  if (currentPage === 'help') {
    return (
      <>
        {bleManager}
        <HelpPage user={currentUser} onBack={() => navigateTo('')} />
      </>
    );
  }

  if (currentPage === 'history') {
    return (
      <>
        {bleManager}
        <GameHistoryPage
          user={currentUser}
          onBack={() => navigateTo('')}
          onSelectGame={(gameId) => navigateTo(`/game/${gameId}`)}
          onContinueGame={handleContinueGame}
          onDeleteGame={handleDeleteGame}
        />
      </>
    );
  }

  if (currentPage === 'stats') {
    return (
      <>
        {bleManager}
        <PlayerStatsPage
          user={currentUser}
          onBack={() => navigateTo('')}
        />
      </>
    );
  }

  if (currentPage === 'gameDetail' && selectedGameId) {
    return (
      <>
        {bleManager}
        <GameDetail
          gameId={selectedGameId}
          onBack={() => {
            setSelectedGameId(null);
            setGame(null);
            setPlayers([]);
            setGameStarted(false);
            setIsConfirmMode(false);
            navigateTo('');
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-blue-50 to-green-50 relative flex flex-col overflow-x-hidden">
      {bleManager}
      <button
        onClick={() => {
          if (confirm('确定返回主界面吗？当前比赛进度会保存。')) {
            setCurrentPage('home');
          }
        }}
        className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-2 p-2 bg-white/80 hover:bg-white rounded-lg shadow-md transition-all z-20 flex items-center gap-1 text-gray-600 hover:text-gray-800"
        title="返回主界面"
      >
        <Home size={20} />
      </button>

      <button
        onClick={() => setShowBleModal(true)}
        className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-14 p-2 bg-white/80 hover:bg-white rounded-lg shadow-md transition-all z-20 flex items-center gap-1 text-blue-600 hover:text-blue-800"
        title="蓝牙设备管理"
      >
        <Bluetooth size={20} />
      </button>

      <BleConnectionManager 
        isOpen={showBleModal} 
        onClose={() => setShowBleModal(false)} 
      />

      {/* End Game Confirmation Modal */}
      {showEndGameConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">结束游戏确认</h3>
              <p className="text-gray-600 mb-6">确定要提前结束游戏吗？<br/>已完成的局数将被保存。</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowEndGameConfirm(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmEndGame}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  确认结束
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-4 pt-14 pb-6">
        <div className="relative flex-shrink-0 w-[min(calc(100vw-32px),380px)] h-[min(calc(100vw-32px),380px)] max-[799px]:portrait:w-[min(calc(100vw-32px),min(calc(100vh-260px),380px))] max-[799px]:portrait:h-[min(calc(100vw-32px),min(calc(100vh-260px),380px))] max-[799px]:landscape:w-[min(calc(100vw-160px),min(calc(100vh-180px),300px))] max-[799px]:landscape:h-[min(calc(100vw-160px),min(calc(100vh-180px),300px))] min-[800px]:w-[600px] min-[800px]:h-[600px]">
          <div className="w-full h-full grid grid-rows-[1fr_auto_1fr] grid-cols-[1fr_auto_1fr]">
            <div className="col-start-2 row-start-1 flex items-start justify-center pt-4">
              {westPlayer && (
                <PlayerScore
                  player={westPlayer}
                  position="west"
                  onWin={() => handleWin('west')}
                  gameStarted={gameStarted}
                  isConfirmMode={isConfirmMode}
                />
              )}
            </div>

            <div className="col-start-1 row-start-2 flex items-center justify-start pl-4">
              {northPlayer && (
                <PlayerScore
                  player={northPlayer}
                  position="north"
                  onWin={() => handleWin('north')}
                  gameStarted={gameStarted}
                  isConfirmMode={isConfirmMode}
                />
              )}
            </div>

            <div className="col-start-2 row-start-2 flex items-center justify-center">
              <GameCenter
                currentGame={game?.current_game || 1}
                totalGames={TOTAL_GAMES}
                onStartGame={handleStartGame}
                gameStarted={gameStarted}
                players={players}
                onNameChange={handleNameChange}
                gameName={gameName}
                onGameNameChange={setGameName}
                tempPlayerNames={tempPlayerNames}
              />
            </div>

            <div className="col-start-3 row-start-2 flex items-center justify-end pr-4">
              {southPlayer && (
                <PlayerScore
                  player={southPlayer}
                  position="south"
                  onWin={() => handleWin('south')}
                  gameStarted={gameStarted}
                  isConfirmMode={isConfirmMode}
                />
              )}
            </div>

            <div className="col-start-2 row-start-3 flex items-end justify-center pb-4">
              {eastPlayer && (
                <PlayerScore
                  player={eastPlayer}
                  position="east"
                  onWin={() => handleWin('east')}
                  gameStarted={gameStarted}
                  isConfirmMode={isConfirmMode}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="w-full flex justify-center pb-4 pt-20 max-[1023px]:portrait:pb-6 max-[1023px]:landscape:pb-2 min-[1024px]:fixed min-[1024px]:bottom-6 min-[1024px]:right-6 min-[1024px]:w-auto min-[1024px]:pb-0 min-[1024px]:pt-0 z-50"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className="grid grid-cols-6 gap-2 w-[min(calc(100vw-32px),360px)] max-[1023px]:landscape:w-[min(calc(100vw-32px),320px)] min-[1024px]:w-auto min-[1024px]:gap-3">
          {/* Row 1: Huang, History (2 buttons, col-span-2 each, right aligned) */}
          <button
            onClick={() => handleHuangzhuang()}
            disabled={!gameStarted || isConfirmMode}
            className="col-start-3 col-span-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 max-[1023px]:landscape:py-1.5 min-[1024px]:px-4 min-[1024px]:py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 max-[1023px]:landscape:gap-1 text-sm max-[1023px]:landscape:text-xs font-medium justify-center"
          >
            <Ban size={18} className="max-[1023px]:landscape:w-4 max-[1023px]:landscape:h-4" />
            <span className="min-[800px]:hidden">荒</span>
            <span className="hidden min-[800px]:inline">荒庄</span>
          </button>
          
          <button
            onClick={() => {
              if (game) {
                setSelectedGameId(game.id);
              }
            }}
            disabled={!gameStarted}
            className="col-span-2 bg-white hover:bg-gray-50 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-700 px-3 py-2.5 max-[1023px]:landscape:py-1.5 min-[1024px]:px-4 min-[1024px]:py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 max-[1023px]:landscape:gap-1 text-sm max-[1023px]:landscape:text-xs font-medium justify-center"
          >
            <History size={18} className="max-[1023px]:landscape:w-4 max-[1023px]:landscape:h-4" />
            <span className="min-[800px]:hidden">查</span>
            <span className="hidden min-[800px]:inline">明细</span>
          </button>

          {/* Row 2: Undo, Penalty, Restart (3 buttons, col-span-2) */}
          <button
            onClick={handleUndoLastScore}
            disabled={!gameStarted || game?.current_game === 1}
            className="col-span-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 max-[1023px]:landscape:py-1.5 min-[1024px]:px-4 min-[1024px]:py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 max-[1023px]:landscape:gap-1 text-sm max-[1023px]:landscape:text-xs font-medium justify-center"
          >
            <Undo size={18} className="max-[1023px]:landscape:w-4 max-[1023px]:landscape:h-4" />
            <span className="min-[800px]:hidden">改</span>
            <span className="hidden min-[800px]:inline">修改</span>
          </button>

          <button
            onClick={handleOpenPenalty}
            disabled={!gameStarted || isConfirmMode}
            className="col-span-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 max-[1023px]:landscape:py-1.5 min-[1024px]:px-4 min-[1024px]:py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 max-[1023px]:landscape:gap-1 text-sm max-[1023px]:landscape:text-xs font-medium justify-center"
          >
            <AlertTriangle size={18} className="max-[1023px]:landscape:w-4 max-[1023px]:landscape:h-4" />
            <span className="min-[800px]:hidden">罚</span>
            <span className="hidden min-[800px]:inline">判罚</span>
          </button>

          <button
            onClick={handleRestart}
            className="col-span-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 max-[1023px]:landscape:py-1.5 min-[1024px]:px-4 min-[1024px]:py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 max-[1023px]:landscape:gap-1 text-sm max-[1023px]:landscape:text-xs font-medium justify-center"
          >
            <RotateCcw size={18} className="max-[1023px]:landscape:w-4 max-[1023px]:landscape:h-4" />
            <span className="min-[800px]:hidden">完</span>
            <span className="hidden min-[800px]:inline">结束</span>
          </button>
        </div>
      </div>

      {showScoreModal && winnerPosition && (
        <ScoreModal
          winnerPosition={winnerPosition}
          players={players}
          onClose={() => {
            setShowScoreModal(false);
            setWinnerPosition(null);
          }}
          onSubmit={handleScoreSubmit}
          isConfirmMode={isConfirmMode}
          onConfirm={() => handleConfirmResult(winnerPosition)}
        />
      )}

      {showGameHistory && !selectedGameId && currentUser && (
        <GameHistoryList
          onClose={() => setShowGameHistory(false)}
          onSelectGame={(gameId) => setSelectedGameId(gameId)}
          onContinueGame={handleContinueGame}
          onDeleteGame={handleDeleteGame}
          creatorId={currentUser.id}
          currentGameId={game?.id}
        />
      )}

      {selectedGameId && (
        <GameDetail
          gameId={selectedGameId}
          onBack={() => {
            setShowGameHistory(false);
            setSelectedGameId(null);
          }}
        />
      )}

      {showPenaltyModal && (
        <PenaltyModal
          players={players}
          onClose={() => {
            setShowPenaltyModal(false);
            setCurrentPenalties(undefined);
          }}
          onSubmit={handlePenaltySubmit}
          currentPenalties={currentPenalties}
        />
      )}
    </div>
  );
}

export default App;
