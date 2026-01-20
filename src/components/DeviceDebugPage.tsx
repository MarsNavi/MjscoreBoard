import { useEffect, useState, useRef } from 'react';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';
import { Position, Player, Game, DeviceDisplayState } from '../lib/supabase';
import { Scan, RefreshCw, Smartphone, Bluetooth } from 'lucide-react';

interface DeviceDebugPageProps {
  game: Game | null;
  players: Player[];
  gameStarted: boolean;
  isConfirmMode: boolean;
  onBack: () => void;
  onDeviceScoreSubmit: (winnerPosition: Position, loserPosition: Position | null, baseScore: number) => Promise<void> | void;
  huangStates: Record<Position, boolean>;
  onDeviceHuang: (position: Position) => void;
  confirmStates: Record<Position, boolean>;
  onDeviceConfirm: (position: Position) => void;
}

type BleConnectionInfo = {
  deviceId: string;
  name: string;
};

const TOTAL_GAMES = 16;
// Standard 16-bit UUIDs are often mapped to 128-bit UUIDs like this:
// 0000xxxx-0000-1000-8000-00805f9b34fb
// If your ESP32 uses 16-bit UUIDs (e.g., 0xFFF0), ensure these match.
// The previous code used full 128-bit UUIDs, so we keep them.
const BLE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const BLE_TX_CHAR_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const BLE_RX_CHAR_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

export default function DeviceDebugPage({ game, players, gameStarted, isConfirmMode, onBack, onDeviceScoreSubmit, huangStates, onDeviceHuang, confirmStates, onDeviceConfirm }: DeviceDebugPageProps) {
  const [diffModePosition, setDiffModePosition] = useState<Position | null>(null);
  const [activeWinner, setActiveWinner] = useState<Position | null>(null);
  const [selectedLoser, setSelectedLoser] = useState<Position | null>(null);
  const [deviceBaseScore, setDeviceBaseScore] = useState<number>(8);
  const [isSubmittingDeviceScore, setIsSubmittingDeviceScore] = useState(false);
  const [bleDevices, setBleDevices] = useState<Record<Position, BleConnectionInfo | null>>({
    east: null,
    south: null,
    west: null,
    north: null,
  });
  const [connectingPosition, setConnectingPosition] = useState<Position | null>(null);
  const [bleError, setBleError] = useState<string | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScanResult[]>([]);
  const scannedDevicesRef = useRef<ScanResult[]>([]);

  // Initialize Bluetooth Low Energy on mount
  useEffect(() => {
    const initBle = async () => {
      try {
        await BleClient.initialize();
        // Start scanning automatically
        startScan();
      } catch (error) {
        console.error('Failed to initialize BLE:', error);
        setBleError('蓝牙初始化失败，请检查权限和蓝牙开关');
      }
    };
    initBle();

    return () => {
      stopScan();
    };
  }, []);

  const startScan = async () => {
    try {
      if (isScanning) return;
      
      setScannedDevices([]);
      scannedDevicesRef.current = [];
      setIsScanning(true);
      setBleError(null);

      await BleClient.requestLEScan(
        {
           services: [BLE_SERVICE_UUID],
           // filters: [{ namePrefix: 'MJ-SCOREBOARD' }], // Optional: filter by name prefix
        },
        (result) => {
          if (!result.device.name) return; // Ignore unnamed devices
          
          // Check if device is already in list
          const existingIndex = scannedDevicesRef.current.findIndex(d => d.device.deviceId === result.device.deviceId);
          if (existingIndex === -1) {
            scannedDevicesRef.current = [...scannedDevicesRef.current, result];
            setScannedDevices([...scannedDevicesRef.current]);
          } else {
             // Update RSSI if needed, but for now just ignore duplicates
          }
        }
      );
      
      // Stop scanning after 10 seconds to save battery
      setTimeout(() => {
        stopScan();
      }, 10000);

    } catch (error) {
      console.error('Failed to start scan:', error);
      setBleError('无法开始扫描，请检查定位和蓝牙权限');
      setIsScanning(false);
    }
  };

  const stopScan = async () => {
    try {
      await BleClient.stopLEScan();
      setIsScanning(false);
    } catch (error) {
      console.error('Failed to stop scan:', error);
    }
  };

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

  const getScoreColor = (score: number) => {
    if (score > 0) return 'text-red-500';
    if (score < 0) return 'text-green-500';
    return 'text-slate-200';
  };

  const positionLabels: Record<Position, string> = {
    east: '东',
    south: '南',
    west: '西',
    north: '北',
  };

  const getGameProgressLabel = (): string => {
    if (!game || !gameStarted) return '未开局';
    const winds = ['东', '南', '西', '北'];
    const windIndex = Math.floor((game.current_game - 1) / 4);
    const juIndex = ((game.current_game - 1) % 4) + 1;
    const wind = winds[windIndex] || '';
    return `${wind}${juIndex}局  ${game.current_game}/${TOTAL_GAMES}`;
  };

  const getPlayerByPosition = (position: Position): Player | undefined => {
    return players.find((p) => p.position === position);
  };

  const positions: Position[] = ['east', 'south', 'west', 'north'];

  const getRelativePositions = (winner: Position): Position[] => {
    const order: Position[] = ['east', 'south', 'west', 'north'];
    const winnerIndex = order.indexOf(winner);

    const left = order[(winnerIndex + 3) % 4];
    const opposite = order[(winnerIndex + 2) % 4];
    const right = order[(winnerIndex + 1) % 4];

    return [left, opposite, right];
  };

  const getRelativeLayout = (self: Position) => {
    if (self === 'east') {
      return { bottom: 'east' as Position, top: 'west' as Position, left: 'north' as Position, right: 'south' as Position };
    }
    if (self === 'south') {
      return { bottom: 'south' as Position, top: 'north' as Position, left: 'east' as Position, right: 'west' as Position };
    }
    if (self === 'west') {
      return { bottom: 'west' as Position, top: 'east' as Position, left: 'south' as Position, right: 'north' as Position };
    }
    return { bottom: 'north' as Position, top: 'south' as Position, left: 'west' as Position, right: 'east' as Position };
  };

  const handleBleMessage = (position: Position, raw: string) => {
    const msg = raw.trim();
    if (!msg) return;
    if (msg === 'BTN:HUANG') {
      onDeviceHuang(position);
      return;
    }
    if (msg === 'BTN:CONFIRM') {
      onDeviceConfirm(position);
      return;
    }
    const parts = msg.split(':');
    if (parts[0] === 'HE') {
      const kind = parts[1];
      if (kind === 'ZIMO') {
        const base = parseInt(parts[2] || '8', 10);
        if (Number.isNaN(base)) return;
        onDeviceScoreSubmit(position, null, base);
        return;
      }
      if (kind === 'RON') {
        const rel = parts[2];
        const base = parseInt(parts[3] || '8', 10);
        if (Number.isNaN(base)) return;
        const [left, opposite, right] = getRelativePositions(position);
        let loser: Position | null = null;
        if (rel === 'LEFT') {
          loser = left;
        } else if (rel === 'RIGHT') {
          loser = right;
        } else if (rel === 'OPPOSITE') {
          loser = opposite;
        }
        if (loser) {
          onDeviceScoreSubmit(position, loser, base);
        }
      }
    }
  };

  const buildStatePayload = (position: Position): string => {
    const deviceState = buildDeviceDisplayState(position);
    if (!deviceState) {
      return 'STATE:IDLE';
    }
    const mode = isConfirmMode ? 'CONFIRM' : 'PLAY';
    const e = deviceState.all_scores.east ?? 0;
    const s = deviceState.all_scores.south ?? 0;
    const w = deviceState.all_scores.west ?? 0;
    const n = deviceState.all_scores.north ?? 0;
    return `STATE:${mode}:${deviceState.round}:${deviceState.game_number}:${e}:${s}:${w}:${n}`;
  };

  const sendStateToConnection = async (position: Position, connection: BleConnectionInfo) => {
    const payload = buildStatePayload(position);
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    // Convert Uint8Array to DataView for Capacitor BLE
    const dataView = new DataView(data.buffer);
    try {
      await BleClient.write(connection.deviceId, BLE_SERVICE_UUID, BLE_RX_CHAR_UUID, dataView);
    } catch (error) {
      console.error(`Failed to write to device ${connection.deviceId}:`, error);
    }
  };

  const connectToDevice = async (position: Position, deviceId: string, deviceName: string) => {
    try {
      // Check if device is already connected to another position
      for (const pos of positions) {
         if (bleDevices[pos]?.deviceId === deviceId) {
             setBleError(`设备 ${deviceName} 已经绑定到 ${positionLabels[pos]}`);
             return;
         }
      }

      setBleError(null);
      setConnectingPosition(position);
      
      // Stop scanning before connecting
      await stopScan();

      await BleClient.connect(deviceId, (disconnectedDeviceId) => {
          console.log('device disconnected', disconnectedDeviceId);
          setBleDevices((prev) => ({
             ...prev,
             [position]: null
          }));
      });
      
      // Start Notifications on TX Characteristic (ESP32 sends to Phone)
      await BleClient.startNotifications(
        deviceId,
        BLE_SERVICE_UUID,
        BLE_TX_CHAR_UUID,
        (value) => {
            const text = new TextDecoder().decode(value.buffer);
            handleBleMessage(position, text);
        }
      );

      const connection: BleConnectionInfo = {
        deviceId: deviceId,
        name: deviceName || 'Unknown Device',
      };

      setBleDevices((prev) => ({
        ...prev,
        [position]: connection,
      }));

      // Send Setup Command
      const encoder = new TextEncoder();
      const setupCmd = `SETUP:${position.toUpperCase()}`;
      const cmdData = encoder.encode(setupCmd);
      await BleClient.write(deviceId, BLE_SERVICE_UUID, BLE_RX_CHAR_UUID, new DataView(cmdData.buffer));

      await sendStateToConnection(position, connection);
      
      // Remove from scanned list
      setScannedDevices(prev => prev.filter(d => d.device.deviceId !== deviceId));
      scannedDevicesRef.current = scannedDevicesRef.current.filter(d => d.device.deviceId !== deviceId);

    } catch (error) {
      if (error instanceof Error) {
        setBleError(error.message);
      } else if (typeof error === 'string') {
        setBleError(error);
      } else {
        setBleError('蓝牙连接失败');
      }
    } finally {
      setConnectingPosition(null);
    }
  };

  const disconnectBleForPosition = async (position: Position) => {
    const current = bleDevices[position];
    if (current && current.deviceId) {
      try {
        await BleClient.disconnect(current.deviceId);
      } catch (error) {
        console.error(error);
      }
    }
    setBleDevices((prev) => ({
      ...prev,
      [position]: null,
    }));
  };

  useEffect(() => {
    positions.forEach((position) => {
      const connection = bleDevices[position];
      if (!connection) return;
      void sendStateToConnection(position, connection);
    });
  }, [game, players, gameStarted, isConfirmMode]);


  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
        >
          返回主页
        </button>
        <div className="text-sm font-semibold text-slate-200">
          设备连接管理
        </div>
        <div className="text-xs text-slate-500">
          搜索并绑定设备
        </div>
      </div>

      {bleError && (
        <div className="px-4 py-2 text-xs text-red-300 bg-red-900/40 border-b border-red-700">
          {bleError}
        </div>
      )}

      <div className="flex-1 p-4 max-w-6xl mx-auto w-full flex flex-col gap-6">
        {/* Scanned Devices Section */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                 <Scan size={16} />
                 发现的设备 ({scannedDevices.length})
              </h3>
              <button 
                 onClick={isScanning ? stopScan : startScan}
                 className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    isScanning 
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' 
                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                 }`}
              >
                 {isScanning ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                 {isScanning ? '扫描中...' : '重新扫描'}
              </button>
           </div>
           
           {scannedDevices.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                 {isScanning ? '正在搜寻附近的设备...' : '点击重新扫描以查找设备'}
              </div>
           ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                 {scannedDevices.map((result) => (
                    <div key={result.device.deviceId} className="bg-slate-900 rounded-xl p-3 border border-slate-700 flex flex-col gap-2">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <Smartphone size={16} className="text-slate-400" />
                             <span className="font-semibold text-sm text-slate-200">{result.device.name || 'Unknown'}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">RSSI: {result.rssi}</span>
                       </div>
                       <div className="text-[10px] text-slate-500 font-mono truncate mb-1">{result.device.deviceId}</div>
                       <div className="flex items-center gap-1 mt-auto">
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">绑定为:</span>
                          <div className="flex-1 flex gap-1 justify-end">
                             {positions.map(pos => (
                                <button
                                   key={pos}
                                   disabled={!!bleDevices[pos] || connectingPosition !== null}
                                   onClick={() => connectToDevice(pos, result.device.deviceId, result.device.name || 'Unknown')}
                                   className="px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600 disabled:opacity-30 disabled:hover:bg-slate-800 text-[10px] text-slate-300 transition-colors border border-slate-700"
                                >
                                   {positionLabels[pos]}
                                </button>
                             ))}
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           )}
        </div>

        {/* Bound Devices Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {positions.map((position) => {
          const deviceState = buildDeviceDisplayState(position);
          const player = getPlayerByPosition(position);
          const layout = getRelativeLayout(position);
          const isConnected = !!bleDevices[position];

          return (
            <div
              key={position}
              className={`rounded-2xl border shadow-xl flex flex-col items-center justify-center py-4 transition-colors ${
                 isConnected 
                 ? 'bg-slate-950/60 border-slate-800' 
                 : 'bg-slate-900/30 border-slate-800/50'
              }`}
            >
              <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-2">
                <span>{player ? player.name : '未绑定选手'}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono">{positionLabels[position]}家</span>
              </div>
              
              <div className="mb-2 flex items-center justify-center gap-2 text-[10px] text-slate-400 h-6">
                {isConnected ? (
                   <>
                     <span className="text-emerald-400 flex items-center gap-1">
                        <Bluetooth size={10} />
                        已连接: {bleDevices[position]?.name}
                     </span>
                     <button
                       type="button"
                       onClick={() => disconnectBleForPosition(position)}
                       className="px-2 py-0.5 rounded-full border border-slate-600 text-[10px] hover:bg-slate-700 text-slate-400"
                     >
                       断开
                     </button>
                   </>
                ) : (
                   <span className="text-slate-600 flex items-center gap-1">
                      <Scan size={10} />
                      等待绑定...
                   </span>
                )}
              </div>
              
              <div className="w-full flex items-center justify-center">
                {!isConnected ? (
                  <div className="w-[240px] h-[160px] sm:w-[288px] sm:h-[192px] md:w-[360px] md:h-[240px] bg-slate-900/50 rounded-xl border border-dashed border-slate-700/50 relative overflow-hidden flex flex-col items-center justify-center gap-2">
                     <Smartphone size={32} className="text-slate-700" />
                     <div className="text-slate-600 text-xs">请在上方列表中选择设备绑定</div>
                  </div>
                ) : (
                <div className="w-[240px] h-[160px] sm:w-[288px] sm:h-[192px] md:w-[360px] md:h-[240px] bg-slate-900 rounded-xl border border-slate-700 relative overflow-hidden flex">

                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/90 text-[10px] font-mono text-slate-400">
                    {position.toUpperCase()}
                  </div>
                  {deviceState ? (
                    <>
                      <div className="flex-1 flex flex-col">
                        <div className="flex-1 grid grid-rows-3 grid-cols-3">
                          <div className="row-start-1 col-start-2 flex items-center justify-center text-xs">
                            <div className="px-2 py-1 rounded bg-slate-800/80 flex flex-col items-center">
                              <span className="text-[10px] mb-0.5">
                                {getPlayerByPosition(layout.top)?.name || layout.top.toUpperCase()}
                              </span>
                              <span className={`font-mono text-lg ${getScoreColor(
                                diffModePosition === position
                                  ? deviceState.all_scores[layout.top] - deviceState.all_scores[position]
                                  : deviceState.all_scores[layout.top]
                              )}`}>
                                {diffModePosition === position
                                  ? deviceState.all_scores[layout.top] - deviceState.all_scores[position]
                                  : deviceState.all_scores[layout.top]}
                              </span>
                            </div>
                          </div>
                          <div className="row-start-2 col-start-1 flex items-center justify-center text-xs">
                            <div className="px-2 py-1 rounded bg-slate-800/80 flex flex-col items-center">
                              <span className="text-[10px] mb-0.5">
                                {getPlayerByPosition(layout.left)?.name || layout.left.toUpperCase()}
                              </span>
                              <span className={`font-mono text-lg ${getScoreColor(
                                diffModePosition === position
                                  ? deviceState.all_scores[layout.left] - deviceState.all_scores[position]
                                  : deviceState.all_scores[layout.left]
                              )}`}>
                                {diffModePosition === position
                                  ? deviceState.all_scores[layout.left] - deviceState.all_scores[position]
                                  : deviceState.all_scores[layout.left]}
                              </span>
                            </div>
                          </div>
                          <div className="row-start-2 col-start-2" />
                          <div className="row-start-2 col-start-3 flex items-center justify-center text-xs">
                            <div className="px-2 py-1 rounded bg-slate-800/80 flex flex-col items-center">
                              <span className="text-[10px] mb-0.5">
                                {getPlayerByPosition(layout.right)?.name || layout.right.toUpperCase()}
                              </span>
                              <span className={`font-mono text-lg ${getScoreColor(
                                diffModePosition === position
                                  ? deviceState.all_scores[layout.right] - deviceState.all_scores[position]
                                  : deviceState.all_scores[layout.right]
                              )}`}>
                                {diffModePosition === position
                                  ? deviceState.all_scores[layout.right] - deviceState.all_scores[position]
                                  : deviceState.all_scores[layout.right]}
                              </span>
                            </div>
                          </div>
                          <div className="row-start-3 col-start-2 flex items-center justify-center text-xs">
                            <div className={`px-2 py-1 rounded flex flex-col items-center ${
                              diffModePosition === position ? 'bg-slate-700/90' : 'bg-emerald-600/80 text-white'
                            }`}>
                              <span className="text-[10px] mb-0.5">
                                {getPlayerByPosition(layout.bottom)?.name || layout.bottom.toUpperCase()}
                              </span>
                              <span className={`font-mono text-lg ${
                                diffModePosition === position
                                  ? 'text-slate-200'
                                  : getScoreColor(deviceState.all_scores[layout.bottom])
                              }`}>
                                {diffModePosition === position
                                  ? 0
                                  : deviceState.all_scores[layout.bottom]}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="h-7 flex items-end justify-start pl-2 pb-1">
                          <button
                            type="button"
                            onClick={() => onDeviceConfirm(position)}
                            className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold shadow-md transition-colors ${
                              confirmStates[position]
                                ? 'bg-slate-500 text-slate-100'
                                : 'bg-amber-300/80 hover:bg-amber-300 text-slate-900'
                            }`}
                          >
                            确认成绩
                          </button>
                        </div>
                      </div>
                      <div className="w-20 sm:w-24 md:w-28 border-l border-slate-800 flex flex-col items-center py-3 relative bg-slate-900/50">
                        <div className="absolute top-2 w-full text-center">
                          <div className="inline-block px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-medium tracking-wide">
                            {getGameProgressLabel()}
                          </div>
                        </div>
                        
                        <div className="flex-1 w-full flex flex-col justify-between pt-6 pb-2">
                          <div className="flex items-center justify-center mt-2">
                            <button
                              type="button"
                              onClick={() => {

                                setActiveWinner((prev) => (prev === position ? null : position));
                                setSelectedLoser(null);
                                setDeviceBaseScore(8);
                              }}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 text-lg sm:text-xl font-bold text-white shadow-lg shadow-emerald-900/50 hover:scale-105 active:scale-95 active:shadow-inner transition-all flex items-center justify-center border border-emerald-400/20"
                            >
                              和
                            </button>
                          </div>
                          <div className="flex items-center justify-center gap-3 w-full px-1 mb-1">
                            <button
                              type="button"
                              onClick={() => onDeviceHuang(position)}
                              className={`w-8 h-8 rounded-full text-[10px] sm:text-xs font-medium shadow-lg flex items-center justify-center transition-all ${
                                huangStates[position]
                                  ? 'bg-amber-300 text-slate-900'
                                  : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white'
                              }`}
                            >
                              荒
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDiffModePosition((prev) => (prev === position ? null : position))
                              }
                              className={`w-8 h-8 rounded-full text-[10px] sm:text-xs font-medium shadow-lg flex items-center justify-center transition-all ${
                                diffModePosition === position
                                  ? 'bg-sky-500 text-white'
                                  : 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-300'
                              }`}
                            >
                              差
                            </button>
                          </div>
                        </div>
                      </div>
                      {activeWinner === position && (
                        <div className="absolute inset-0 z-20 bg-slate-950/95 flex flex-col px-3 py-2 text-[10px] text-slate-100">
                          <div className="flex items-center mb-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveWinner(null);
                                setSelectedLoser(null);
                                setDeviceBaseScore(8);
                              }}
                              className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-[12px]"
                            >
                              ←
                            </button>
                            <div className="ml-2">
                              <div className="text-xs font-bold">
                                {positionLabels[position]} 和牌
                              </div>
                              {player && (
                                <div className="text-[10px] text-slate-300 mt-0.5">
                                  玩家: {player.name || player.player_id}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col justify-between mt-1">
                            <div className="space-y-1.5">
                              <div className="flex gap-1.5">
                                {getRelativePositions(position).map((pos) => {
                                  const loserPlayer = getPlayerByPosition(pos);
                                  return (
                                    <button
                                      key={pos}
                                      type="button"
                                      onClick={() => setSelectedLoser(pos)}
                                      className={`flex-1 py-1.5 rounded text-[10px] font-semibold transition-all ${
                                        selectedLoser === pos
                                          ? 'bg-red-500 text-white'
                                          : 'bg-slate-700 text-slate-100'
                                      }`}
                                    >
                                      <div>{positionLabels[pos]} 点</div>
                                      {loserPlayer && (
                                        <div className="text-[9px] font-normal mt-0.5 truncate">
                                          {loserPlayer.name || loserPlayer.player_id}
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              <button
                                type="button"
                                onClick={() => setSelectedLoser(position)}
                                className={`w-full mt-1.5 py-1.5 rounded text-[10px] font-semibold transition-all ${
                                  selectedLoser === position
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-700 text-slate-100'
                                }`}
                              >
                                自摸
                              </button>
                            </div>

                            <div className="mt-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="text-[10px]">基本分数</div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeviceBaseScore((prev) => Math.max(1, prev - 5))
                                    }
                                    className="min-w-[40px] h-8 px-2 rounded-lg bg-slate-700 text-[11px] font-semibold flex items-center justify-center"
                                  >
                                    -5
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeviceBaseScore((prev) => Math.max(1, prev - 1))
                                    }
                                    className="min-w-[40px] h-8 px-2 rounded-lg bg-slate-700 text-[11px] font-semibold flex items-center justify-center"
                                  >
                                    -1
                                  </button>
                                  <div className="min-w-[48px] h-8 px-2 rounded-lg bg-slate-800 text-center text-xs font-bold text-amber-300 flex items-center justify-center">
                                    {deviceBaseScore}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setDeviceBaseScore((prev) => prev + 1)}
                                    className="min-w-[40px] h-8 px-2 rounded-lg bg-slate-700 text-[11px] font-semibold flex items-center justify-center"
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeviceBaseScore((prev) => prev + 5)}
                                    className="min-w-[40px] h-8 px-2 rounded-lg bg-slate-700 text-[11px] font-semibold flex items-center justify-center"
                                  >
                                    +5
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isSubmittingDeviceScore}
                                onClick={async () => {
                                  if (!selectedLoser) {
                                    alert('请选择点炮者或自摸');
                                    return;
                                  }
                                  if (!gameStarted || !game) {
                                    alert('当前未开局');
                                    return;
                                  }
                                  if (!players || players.length === 0) {
                                    return;
                                  }
                                  try {
                                    setIsSubmittingDeviceScore(true);
                                    const loserPosition =
                                      selectedLoser === position ? null : selectedLoser;
                                    if (typeof onDeviceScoreSubmit === 'function') {
                                      await onDeviceScoreSubmit(position, loserPosition, deviceBaseScore);
                                    }
                                    setActiveWinner(null);
                                    setSelectedLoser(null);
                                    setDeviceBaseScore(8);
                                  } finally {
                                    setIsSubmittingDeviceScore(false);
                                  }
                                }}
                                className={`w-full mt-1.5 py-1.5 rounded text-[11px] font-bold transition-colors ${
                                  isSubmittingDeviceScore
                                    ? 'bg-slate-600 text-slate-300'
                                    : 'bg-sky-500 text-white'
                                }`}
                              >
                                {isSubmittingDeviceScore ? '提交中...' : '确认并发送到中控'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                      等待开局...
                    </div>
                  )}
                </div>
                )}
              </div>
              {game && gameStarted && (
                <div className="mt-2 text-[10px] text-slate-500">
                  局 {game.current_round} · 盘 {game.current_game}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
