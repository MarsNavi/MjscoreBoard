import { useCallback, useEffect, useState, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Position, Player, Game, PlayerId, User } from './lib/types';
import { db } from './lib/db';
import PlayerScore from './components/PlayerScore';
import GameCenter from './components/GameCenter';
import ScoreModal from './components/ScoreModal';
import GameDetail from './components/GameDetail';
import PenaltyModal from './components/PenaltyModal';
import HomePage from './components/HomePage';
import DataFilesPage from './components/DataFilesPage';
import GameHistoryPage from './components/GameHistoryPage';
import PlayerStatsPage from './components/PlayerStatsPage';
import HelpPage from './components/HelpPage';
import DeviceModePage from './components/DeviceModePage';
import { RotateCcw, Undo, History, Ban, AlertTriangle, Home, Bluetooth, BarChart3, Database } from 'lucide-react';
import { loadLocalGameSnapshot, saveLocalGameSnapshot, clearLocalGameSnapshot } from './lib/localStore';
import { useBle } from './contexts/useBle';
import BleConnectionManager from './components/BleConnectionManager';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { App as CapApp } from '@capacitor/app';
import {
  buildGameResults,
  buildPlayersWithCalculatedScores,
  getPositionForPlayerInRound,
} from './lib/gameScoring';
import { normalizePlayerName } from './lib/playerNames';
import {
  createBlankDataFile,
  DataFileSummary,
  deleteDataFile,
  getDataFileName,
  loadDataFileSummaries,
  renameDataFile,
} from './lib/dataFiles';

const TOTAL_GAMES = 16;
const DEFAULT_DATA_FILE_ID = 'default-data-file';

type PageView = 'home' | 'game' | 'history' | 'stats' | 'data' | 'gameDetail' | 'help' | 'deviceMode';

function App() {
  const { t, i18n } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dataFiles, setDataFiles] = useState<DataFileSummary[]>([]);
  const [currentPage, setCurrentPage] = useState<PageView>('home');
  const [showBleModal, setShowBleModal] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [winnerPosition, setWinnerPosition] = useState<Position | null>(null);
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

  const stateRef = useRef({ currentPage, showScoreModal, showPenaltyModal, showBleModal });
  useEffect(() => {
    stateRef.current = { currentPage, showScoreModal, showPenaltyModal, showBleModal };
  }, [currentPage, showScoreModal, showPenaltyModal, showBleModal]);

  useEffect(() => {
    const initNativeOptimizations = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setOverlaysWebView({ overlay: true });
        await Keyboard.setResizeMode({ mode: KeyboardResize.None });
      } catch (e) {
        // Ignored on web
      }
    };
    initNativeOptimizations();

    const backButtonListener = CapApp.addListener('backButton', () => {
      const state = stateRef.current;
      if (state.showScoreModal) setShowScoreModal(false);
      else if (state.showPenaltyModal) setShowPenaltyModal(false);
      else if (state.showBleModal) setShowBleModal(false);
      else if (state.currentPage !== 'home' && state.currentPage !== 'game') setCurrentPage('home');
      else if (state.currentPage === 'home') CapApp.exitApp();
    });

    return () => {
      backButtonListener.then(l => l.remove());
    };
  }, []);

  const { bleDevices, writeData, setMessageHandler } = useBle();

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
    setPlayers(snapshot.players.map((player) => ({
      ...player,
      name: normalizePlayerName(player.name, player.player_id),
    })));
    setGameStarted(true);
    setIsConfirmMode(snapshot.isConfirmMode);
    if (snapshot.currentPenalties) {
      setCurrentPenalties(snapshot.currentPenalties);
    } else {
      setCurrentPenalties(undefined);
    }
    if (snapshot.game.game_name) {
      setGameName(snapshot.game.game_name.trim());
    }
  };

  const normalizeStoredPlayerNames = async () => {
    const allPlayers = await db.players.toArray();
    const changedPlayers = allPlayers
      .map((player) => ({
        ...player,
        name: normalizePlayerName(player.name, player.player_id),
      }))
      .filter((player, index) => player.name !== allPlayers[index].name);

    const allResults = await db.game_results.toArray();
    const changedResults = allResults
      .map((result) => ({
        ...result,
        player_name: normalizePlayerName(result.player_name, result.player_id),
      }))
      .filter((result, index) => result.player_name !== allResults[index].player_name);

    if (changedPlayers.length > 0) {
      await db.players.bulkPut(changedPlayers);
    }
    if (changedResults.length > 0) {
      await db.game_results.bulkPut(changedResults);
    }
  };

  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);

  useEffect(() => {
    // 保持屏幕常亮
    const keepAwake = async () => {
      try {
        await KeepAwake.keepAwake();
      } catch (err) {
        console.error('KeepAwake error:', err);
      }
    };
    keepAwake();

    const initLocalUser = async () => {
      const storedUserId = localStorage.getItem('mahjong_user_id');
      let allUsers = await db.users.toArray();

      if (allUsers.length === 0) {
        const newUser: User = {
          id: DEFAULT_DATA_FILE_ID,
          code: i18n.t('dataFile.defaultName'),
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        };
        try {
          await db.users.add(newUser);
          allUsers = [newUser];
        } catch {
          allUsers = await db.users.toArray();
        }
      }

      if (allUsers.length === 1 && ['local', 'micken', '默认数据'].includes(allUsers[0].code)) {
        await db.users.update(allUsers[0].id, { code: i18n.t('dataFile.defaultName') });
        allUsers = [{ ...allUsers[0], code: i18n.t('dataFile.defaultName') }];
      }

      let targetUser: User | undefined;
      if (storedUserId) {
        targetUser = allUsers.find((user) => user.id === storedUserId);
        if (!targetUser) {
          const storedUser = await db.users.get(storedUserId);
          if (storedUser) targetUser = storedUser;
        }
      }

      if (!targetUser) {
        targetUser =
          allUsers.find((user) => ['默认档案', '默认数据', 'micken', 'local'].includes(user.code)) ||
          allUsers.sort((a, b) => new Date(b.last_login_at || b.created_at).getTime() - new Date(a.last_login_at || a.created_at).getTime())[0];
      }

      await normalizeStoredPlayerNames();

      const summaries = await loadDataFileSummaries();
      setDataFiles(summaries);
      setCurrentUser(targetUser);
      localStorage.setItem('mahjong_user_id', targetUser.id);
      restoreLocalGameSnapshot(targetUser.id);
    };

    initLocalUser();
  }, []);

  const applyRoute = useCallback((hash: string) => {
    if (hash === '/history') {
      setSelectedGameId(null);
      setCurrentPage('history');
    } else if (hash === '/stats') {
      setSelectedGameId(null);
      setCurrentPage('stats');
    } else if (hash === '/data') {
      setSelectedGameId(null);
      setCurrentPage('data');
    } else if (hash === '/help') {
      setSelectedGameId(null);
      setCurrentPage('help');
    } else if (hash === 'deviceMode' || hash === '/deviceMode') {
      setSelectedGameId(null);
      setCurrentPage('deviceMode');
    } else if (hash.startsWith('/game/')) {
      const gameId = hash.split('/')[2];
      if (gameId) {
        setSelectedGameId(gameId);
        setCurrentPage('gameDetail');
      }
    } else {
      setSelectedGameId(null);
      setCurrentPage('home');
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      applyRoute(window.location.hash.slice(1));
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [applyRoute]);

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

  const navigateTo = useCallback((path: string) => {
    const currentHash = window.location.hash.slice(1);
    if (currentHash === path) {
      applyRoute(path);
    } else {
      window.location.hash = path;
    }
    window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 0);
  }, [applyRoute]);

  const createNewGame = async () => {
    if (!currentUser) return;

    const gameId = crypto.randomUUID();
    const gameData: Game = {
      id: gameId,
      current_round: 1,
      current_game: 1,
      status: 'active',
      game_name: gameName.trim() || undefined,
      creator_id: currentUser.id,
      created_at: new Date().toISOString()
    };

    try {
      await db.games.add(gameData);
    } catch (gameError) {
      console.error(t('game.createFailed'), gameError);
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
      const playerName = normalizePlayerName(tempPlayerNames[position], playerId);
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
      alert(t('game.startFirst'));
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

  const handleFinalizeGame = () => {
    // Navigate to game detail or home after finalizing
    // Reset hardware displays to waiting, then let the user view stats or start a new game.
    // We can go to GameDetail
    if (game) {
       navigateTo(`/game/${game.id}`);
    } else {
       navigateTo('');
    }
    
    resetActiveGameState();
  };

  const handleConfirmEndGame = async () => {
    if (game) {
      await db.games.update(game.id, { early_ended: true });

      await saveGameResults();
      
      setGameStarted(false);
      setIsConfirmMode(false);
      setShowEndGameConfirm(false);
      
      await recalculateAndRefreshPlayers();
      
      setGame(prev => prev ? { ...prev, is_completed: true, status: 'finished' } : null);
    }
  };

  const handleNameChange = useCallback((position: Position, name: string) => {
    setTempPlayerNames((prev) => ({
      ...prev,
      [position]: name,
    }));
  }, []);

  const resetActiveGameState = useCallback(() => {
    setGame(null);
    setPlayers([]);
    setGameStarted(false);
    setGameName('');
    setIsConfirmMode(false);
    setTempPlayerNames({
      east: '',
      south: '',
      west: '',
      north: '',
    });
  }, []);

  const refreshDataFiles = useCallback(async () => {
    const summaries = await loadDataFileSummaries();
    setDataFiles(summaries);
    return summaries;
  }, []);

  const activateDataFile = useCallback(async (userId: string, skipActiveGameConfirm = false) => {
    if (currentUser?.id === userId) {
      await refreshDataFiles();
      return;
    }

    if (!skipActiveGameConfirm && gameStarted) {
      const confirmed = window.confirm(t('files.switchConfirm'));
      if (!confirmed) return;
    }

    const targetUser = await db.users.get(userId);
    if (!targetUser) {
      alert(t('files.notFound'));
      return;
    }

    const updatedUser = {
      ...targetUser,
      last_login_at: new Date().toISOString(),
    };
    await db.users.update(updatedUser.id, { last_login_at: updatedUser.last_login_at });

    resetActiveGameState();
    setSelectedGameId(null);
    setCurrentUser(updatedUser);
    localStorage.setItem('mahjong_user_id', updatedUser.id);
    restoreLocalGameSnapshot(updatedUser.id);
    await refreshDataFiles();
  }, [currentUser?.id, gameStarted, refreshDataFiles, resetActiveGameState]);

  const handleCreateDataFile = useCallback(async () => {
    if (gameStarted) {
      const confirmed = window.confirm(t('files.createConfirm'));
      if (!confirmed) return;
    }

    const name = window.prompt(t('files.newFileName'), t('files.newFile'));
    if (name === null) return;

    const user = await createBlankDataFile(name);
    await activateDataFile(user.id, true);
  }, [activateDataFile, gameStarted]);

  const handleRenameDataFile = useCallback(async () => {
    if (!currentUser) return;

    const name = window.prompt(t('files.fileNamePrompt'), getDataFileName(currentUser));
    if (name === null) return;

    await renameDataFile(currentUser.id, name);
    const refreshedUser = await db.users.get(currentUser.id);
    if (refreshedUser) {
      setCurrentUser(refreshedUser);
    }
    await refreshDataFiles();
  }, [currentUser, refreshDataFiles]);

  const handleDeleteDataFile = useCallback(async () => {
    if (!currentUser) return;
    if (dataFiles.length <= 1) {
      alert(t('files.keepOne'));
      return;
    }

    const confirmed = window.confirm(t('files.deleteConfirm', { name: getDataFileName(currentUser) }));
    if (!confirmed) return;

    await deleteDataFile(currentUser.id);
    clearLocalGameSnapshot(currentUser.id);

    const summaries = await refreshDataFiles();
    const nextFile = summaries.find((file) => file.id !== currentUser.id) || summaries[0];
    if (nextFile) {
      await activateDataFile(nextFile.id, true);
    }
  }, [activateDataFile, currentUser, dataFiles.length, refreshDataFiles]);

  const handleDataFileChanged = useCallback(async (userId?: string) => {
    await normalizeStoredPlayerNames();
    await refreshDataFiles();
    if (userId) {
      await activateDataFile(userId, true);
    }
  }, [activateDataFile, refreshDataFiles]);

  const saveGameResults = useCallback(async () => {
    if (!game) return;

    // 每次保存前先删除旧的 result（如果有），确保重新计算
    await db.game_results.where('game_id').equals(game.id).delete();

    // 1. 获取该局所有选手
    const dbPlayers = await db.players.where('game_id').equals(game.id).toArray();
    if (!dbPlayers || dbPlayers.length === 0) return;

    // 2. 获取该局所有分数记录
    const dbScores = await db.scores.where('game_id').equals(game.id).toArray();
    dbScores.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 3. 获取罚分记录
    const dbPenalty = await db.penalties.where('game_id').equals(game.id).first();

    // 4. 重新计算最终得分（Source of Truth）
    const calculatedPlayers = buildPlayersWithCalculatedScores(dbPlayers, dbScores, dbPenalty);

    // 5. 排序并计算标准分
    const results = buildGameResults(game.id, calculatedPlayers);

    await db.transaction('rw', db.game_results, db.games, async () => {
      // Prevent duplicates by deleting existing results for this game first
      await db.game_results.where('game_id').equals(game.id).delete();
      await db.game_results.bulkAdd(results);
      
      await db.games.update(game.id, {
          is_completed: true,
          completed_at: new Date().toISOString()
      });
    });
  }, [game]);

  const handleRestart = async () => {
    setShowEndGameConfirm(true);
  };

  const handleHuangzhuang = async (fromDevices = false) => {
    if (!game) return;

    if (!fromDevices) {
      if (!confirm(t('game.drawConfirm'))) return;
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
      console.error(t('game.drawFailed'), scoreError);
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
      setSelectedGameId(null);
      setCurrentPage('game');

      if (gameData.game_name) {
        setGameName(gameData.game_name);
      }

      const allScores = await db.scores.where('game_id').equals(gameId).toArray();
      const penalty = await db.penalties.where('game_id').equals(gameId).first();
      const updatedPlayers = buildPlayersWithCalculatedScores(playersData, allScores, penalty);
      setPlayers(updatedPlayers);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm(t('game.deleteConfirm'))) return;

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
      resetActiveGameState();
    }
  };

  const handleUndoLastScore = async () => {
    if (!game) return;

    const scores = await db.scores.where('game_id').equals(game.id).toArray();
    scores.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastScore = scores[0];

    if (!lastScore) {
      alert(t('game.noUndo'));
      return;
    }

    if (!confirm(t('game.revokeRound'))) return;

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

  const recalculateAndRefreshPlayers = useCallback(async () => {
    if (!game) return;

    const allPlayers = await db.players.where('game_id').equals(game.id).toArray();
    const allScores = await db.scores.where('game_id').equals(game.id).toArray();
    const penalty = await db.penalties.where('game_id').equals(game.id).first();

    if (!allPlayers || allPlayers.length === 0) return;

    const updatedPlayers = buildPlayersWithCalculatedScores(allPlayers, allScores, penalty);

    // Update DB with calculated scores so syncToDevices can read from DB
    await db.players.bulkPut(updatedPlayers);

    setPlayers(updatedPlayers);
  }, [game]);

  const rotatePlayersForNewRound = useCallback(async (currentGame: number) => {
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
  }, [game, players]);

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
      console.error(t('game.scoreFailed'), scoreError);
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
      setGame(prev => prev ? { ...prev, is_completed: true, status: 'finished' } : null);
    }
  };

  const handleScoreSubmit = async (loserPosition: Position | null, baseScore: number) => {
    if (!winnerPosition) return;
    await submitScoreForWinner(winnerPosition, loserPosition, baseScore);
    setShowScoreModal(false);
    setWinnerPosition(null);
  };



  // Sync State Effect
  const isSyncingRef = useRef(false);
  const needsSyncRef = useRef(false);
  const handleHuangzhuangRef = useRef(handleHuangzhuang);
  const submitScoreForWinnerRef = useRef(submitScoreForWinner);

  handleHuangzhuangRef.current = handleHuangzhuang;
  submitScoreForWinnerRef.current = submitScoreForWinner;

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
            
            const positions: Position[] = ['east', 'south', 'west', 'north'];

            if (!game) {
               // If no game is active, send WAITING state to all connected devices
               for (const position of positions) {
                  const connection = bleDevices[position];
                  if (!connection || connection.status !== 'connected') continue;
                  
                  const encoder = new TextEncoder();
                  const payload = `LANG:${i18n.language}\nSTATE:WAITING\n`;
                  const data = encoder.encode(payload);
                  try {
                     await writeData(connection.deviceId, new DataView(data.buffer));
                  } catch (e) {
                     console.error('Sync waiting state error', e);
                  }
               }
               break; 
            }

            // Fetch latest data from DB
            const dbGame = await db.games.get(game.id);
            const dbPlayers = await db.players.where('game_id').equals(game.id).toArray();
            
            if (!dbGame) break;

            for (const position of positions) {
               const connection = bleDevices[position];
              if (!connection || connection.status !== 'connected') continue;

              const isPhoneDevice = connection.name?.startsWith('MJ-PHONE-') ?? false;

              const nameE = dbPlayers.find(p => p.position === 'east')?.name || '';
              const nameS = dbPlayers.find(p => p.position === 'south')?.name || '';
              const nameW = dbPlayers.find(p => p.position === 'west')?.name || '';
              const nameN = dbPlayers.find(p => p.position === 'north')?.name || '';

              const allScores: Record<Position, number> = {
                 east: 0, south: 0, west: 0, north: 0,
              };
              dbPlayers.forEach((player) => {
                 allScores[player.position as Position] = player.score;
              });

              const eScore = allScores.east ?? 0;
              const sScore = allScores.south ?? 0;
              const wScore = allScores.west ?? 0;
              const nScore = allScores.north ?? 0;

              // Determine which position is the active dealer
              // current_game tells us which seat is the dealer (1-based, cycles through 4 positions)
              const dealerIdx = ((dbGame.current_game - 1) % 4);
              const activeE = dealerIdx === 0 ? 1 : 0;
              const activeS = dealerIdx === 1 ? 1 : 0;
              const activeW = dealerIdx === 2 ? 1 : 0;
              const activeN = dealerIdx === 3 ? 1 : 0;

              if (isPhoneDevice) {
                // Phone devices: send a single unified message with all info
                // Format: STATE:<mode>:<eScore>:<sScore>:<wScore>:<nScore>:<eName>:<sName>:<wName>:<nName>:<eActive>:<sActive>:<wActive>:<nActive>
                let payload: string;
                if (game && (game.is_completed || game.status === 'finished' || game.early_ended)) {
                    payload = `STATE:GAMEOVER:${eScore}:${sScore}:${wScore}:${nScore}:${nameE}:${nameS}:${nameW}:${nameN}:0:0:0:0`;
                } else if (game && gameStarted) {
                    const mode = isConfirmMode ? 'CONFIRM' : 'PLAY';
                    payload = `STATE:${mode}:${eScore}:${sScore}:${wScore}:${nScore}:${nameE}:${nameS}:${nameW}:${nameN}:${activeE}:${activeS}:${activeW}:${activeN}`;
                } else {
                    payload = `STATE:IDLE:0:0:0:0:${nameE}:${nameS}:${nameW}:${nameN}:0:0:0:0`;
                }
                try {
                   await writeData(connection.deviceId, new DataView(new TextEncoder().encode(payload + '\n').buffer));
                } catch (e) {
                   console.error('Sync phone state error', e);
                }
              } else {
                // ESP32 devices: send multi-packet format (LANG, NAME x4, STATE)
                // 0. Send Language
                const langCmd = `LANG:${i18n.language}\n`;
                try {
                    await writeData(connection.deviceId, new DataView(new TextEncoder().encode(langCmd).buffer));
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (e) {
                    console.error('Sync lang error', e);
                }

                // 1. Send Names
                const pList = [
                  { pos: 0, name: nameE },
                  { pos: 1, name: nameS },
                  { pos: 2, name: nameW },
                  { pos: 3, name: nameN },
                ];
                for (const item of pList) {
                  const cmd = `NAME:${item.pos}:${item.name}\n`;
                  try {
                     await writeData(connection.deviceId, new DataView(new TextEncoder().encode(cmd).buffer));
                     await new Promise(resolve => setTimeout(resolve, 50));
                  } catch (e) {
                     console.error('Sync name error', e);
                  }
                }

                // 2. Send Game State
                let payload = 'STATE:IDLE';
                if (game && (game.is_completed || game.status === 'finished' || game.early_ended)) {
                    payload = `STATE:GAMEOVER:${eScore}:${sScore}:${wScore}:${nScore}`;
                } else if (game && gameStarted) {
                    const mode = isConfirmMode ? 'CONFIRM' : 'PLAY';
                    payload = `STATE:${mode}:${dbGame.current_round}:${dbGame.current_game}:${eScore}:${sScore}:${wScore}:${nScore}`;
                }
                try {
                   await writeData(connection.deviceId, new DataView(new TextEncoder().encode(payload + '\n').buffer));
                } catch (e) {
                   console.error('Sync state error', e);
                }
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
  }, [game, players, gameStarted, isConfirmMode, bleDevices, writeData, i18n.language]); // Sync whenever game state or connection changes

  // Message Handler Effect
  useEffect(() => {
     setMessageHandler((position, raw) => {
        const msg = raw.trim();
        if (!msg) return;
        if (msg === 'BTN:HUANG') {
           if (!gameStarted || !game) return;
           void handleHuangzhuangRef.current(true);
           return;
        }
        if (msg === 'BTN:RON') {
           // Phone scoreboard tapped the "Win" button — open the score modal for that position
           if (!gameStarted || !game) return;
           if (isConfirmMode) {
              // In confirm mode, this acts as confirming result for that position
              void handleConfirmResult(position);
           } else {
              setWinnerPosition(position);
              setShowScoreModal(true);
           }
           return;
        }
        if (msg === 'BTN:CONFIRM') {
           // Phone confirmed a pending action — treat as confirming the result for that position
           if (!gameStarted || !game) return;
           if (isConfirmMode) {
              void handleConfirmResult(position);
           }
           return;
        }
        if (msg === 'BTN:CANCEL') {
           // Phone cancelled — no specific host action needed (state will re-sync)
           return;
        }

        const parts = msg.split(':');
        if (parts[0] === 'HE') {
           const kind = parts[1];
           if (kind === 'ZIMO') {
              const base = parseInt(parts[2] || '8', 10);
              if (Number.isNaN(base)) return;
              void submitScoreForWinnerRef.current(position, null, base);
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
                 void submitScoreForWinnerRef.current(position, loser, base);
              }
           }
        }
     });
  }, [game, players, gameStarted, isConfirmMode, setMessageHandler]); // Re-register when closure vars change

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
        <div className="text-gray-600 text-sm">{t('files.opening')}</div>
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

  const mainTabs = [
    { page: 'home' as const, path: '', label: t('common.start', '开局'), Icon: Home },
    { page: 'history' as const, path: '/history', label: t('common.history'), Icon: History },
    { page: 'stats' as const, path: '/stats', label: t('common.stats'), Icon: BarChart3 },
    { page: 'data' as const, path: '/data', label: t('files.manageFiles'), Icon: Database },
  ];

  const mainNavigation = (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-3 bg-gradient-to-t from-white via-white/95 to-white/0"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1 rounded-3xl border border-orange-100 bg-white/95 p-1.5 shadow-2xl backdrop-blur">
        {mainTabs.map(({ page, path, label, Icon }) => {
          const active = currentPage === page;
          return (
            <button
              key={page}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => navigateTo(path)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-xs font-black transition-all ${
                active
                  ? 'bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-lg'
                  : 'text-gray-500 hover:bg-orange-50 hover:text-orange-700'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  const renderMainPage = (content: ReactNode) => (
    <>
      {bleManager}
      <div className="pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]">
        {content}
      </div>
      {mainNavigation}
    </>
  );

  if (currentPage === 'home') {
    return renderMainPage(
        <HomePage
          user={currentUser}
          onStartNewGame={handleStartNewGameFromHome}
          gameName={gameName}
          onGameNameChange={setGameName}
          tempPlayerNames={tempPlayerNames}
          onNameChange={handleNameChange}
        />
    );
  }



  if (currentPage === 'deviceMode') {
    return <DeviceModePage onExit={() => navigateTo('/data')} />;
  }

  if (currentPage === 'help') {
    return (
      <>
        {bleManager}
        <HelpPage user={currentUser} onBack={() => navigateTo('/data')} />
      </>
    );
  }

  if (currentPage === 'history') {
    return renderMainPage(
        <GameHistoryPage
          user={currentUser}
          onBack={() => navigateTo('')}
          onSelectGame={(gameId) => navigateTo(`/game/${gameId}`)}
          onContinueGame={handleContinueGame}
          onDeleteGame={handleDeleteGame}
          showBack={false}
        />
    );
  }

  if (currentPage === 'stats') {
    return renderMainPage(
        <PlayerStatsPage
          user={currentUser}
          onBack={() => navigateTo('')}
          showBack={false}
        />
    );
  }

  if (currentPage === 'data') {
    return renderMainPage(
      <DataFilesPage
        user={currentUser}
        dataFiles={dataFiles}
        onSwitchDataFile={activateDataFile}
        onCreateDataFile={handleCreateDataFile}
        onRenameDataFile={handleRenameDataFile}
        onDeleteDataFile={handleDeleteDataFile}
        onDataFileChanged={handleDataFileChanged}
        onViewHelp={() => navigateTo('/help')}
        onOpenBle={() => setShowBleModal(true)}
        onDeviceMode={() => navigateTo('deviceMode')}
      />
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
            navigateTo('/history');
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
          if (confirm(t('game.returnHomeConfirm'))) {
            navigateTo('');
          }
        }}
        className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-2 p-2 bg-white/80 hover:bg-white rounded-lg shadow-md transition-all z-20 flex items-center gap-1 text-gray-600 hover:text-gray-800"
        title={t('game.returnHome')}
      >
        <Home size={20} />
      </button>

      <button
        onClick={() => setShowBleModal(true)}
        className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-14 p-2 bg-white/80 hover:bg-white rounded-lg shadow-md transition-all z-20 flex items-center gap-1 text-blue-600 hover:text-blue-800"
        title={t('device.connectDevice')}
      >
        <Bluetooth size={20} />
      </button>

      {/* End Game Confirmation Modal */}
      {showEndGameConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('game.earlyEndGame')}</h3>
              <p className="text-gray-600 mb-6">{t('game.earlyEndGameDesc')}</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowEndGameConfirm(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleConfirmEndGame}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  {t('game.endGame')}
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
              {game?.is_completed || game?.status === 'finished' ? (
                 <div className="flex flex-col items-center justify-center gap-4 bg-white/90 p-6 rounded-xl shadow-xl backdrop-blur-sm z-10 animate-in fade-in zoom-in duration-300">
                    <div className="text-2xl font-black text-gray-800">{t('game.gameEnded')}</div>
                    <div className="text-sm text-gray-500 font-medium">{t('game.viewStatsOrHistory')}</div>
                    <button 
                      onClick={handleFinalizeGame}
                      className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                    >
                      {t('game.viewStats')}
                    </button>
                 </div>
              ) : (
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
              )}
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
            <span>{t('mahjong.draw')}</span>
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
            <span>{t('game.gameDetail')}</span>
          </button>

          {/* Row 2: Undo, Penalty, Restart (3 buttons, col-span-2) */}
          <button
            onClick={handleUndoLastScore}
            disabled={!gameStarted || game?.current_game === 1}
            className="col-span-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 max-[1023px]:landscape:py-1.5 min-[1024px]:px-4 min-[1024px]:py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 max-[1023px]:landscape:gap-1 text-sm max-[1023px]:landscape:text-xs font-medium justify-center"
          >
            <Undo size={18} className="max-[1023px]:landscape:w-4 max-[1023px]:landscape:h-4" />
            <span>{t('game.undo')}</span>
          </button>

          <button
            onClick={handleOpenPenalty}
            disabled={!gameStarted || isConfirmMode}
            className="col-span-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 max-[1023px]:landscape:py-1.5 min-[1024px]:px-4 min-[1024px]:py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 max-[1023px]:landscape:gap-1 text-sm max-[1023px]:landscape:text-xs font-medium justify-center"
          >
            <AlertTriangle size={18} className="max-[1023px]:landscape:w-4 max-[1023px]:landscape:h-4" />
            <span>{t('mahjong.penalty')}</span>
          </button>

          <button
            onClick={handleRestart}
            className="col-span-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 max-[1023px]:landscape:py-1.5 min-[1024px]:px-4 min-[1024px]:py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 max-[1023px]:landscape:gap-1 text-sm max-[1023px]:landscape:text-xs font-medium justify-center"
          >
            <RotateCcw size={18} className="max-[1023px]:landscape:w-4 max-[1023px]:landscape:h-4" />
            <span>{t('common.endGame')}</span>
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

      {selectedGameId && (
        <GameDetail
          gameId={selectedGameId}
          onBack={() => {
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
