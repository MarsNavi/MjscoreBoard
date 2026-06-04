import { useEffect, useState, useMemo, useRef } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { useTranslation } from 'react-i18next';
import { X, ShieldAlert, User, MapPin } from 'lucide-react';
import { deviceModeBle } from '../lib/deviceModeBle';
import { Position, Player } from '../lib/types';
import ScoreModal from './ScoreModal';

interface DeviceModePageProps {
  onExit: () => void;
}

type DeviceStatus = 'WAITING' | 'PLAY' | 'CONFIRM';
type ViewMode = 'follow_player' | 'fixed_position';

interface PlayState {
  scores: Record<Position, string>;
  names: Record<Position, string>;
  actives: Record<Position, boolean>;
}

const POSITIONS: Position[] = ['east', 'south', 'west', 'north'];

export default function DeviceModePage({ onExit }: DeviceModePageProps) {
  const [deviceId, setDeviceId] = useState<string>('');
  const [status, setStatus] = useState<DeviceStatus>('WAITING');
  const [playState, setPlayState] = useState<PlayState | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showHuangConfirm, setShowHuangConfirm] = useState(false);
  const { t } = useTranslation();
  
  const POS_LABELS: Record<Position, string> = { 
    east: t('mahjong.east'), 
    south: t('mahjong.south'), 
    west: t('mahjong.west'), 
    north: t('mahjong.north') 
  };
  const [confirmMsg, setConfirmMsg] = useState('');
  
  // View mode: follow_player = screen rotates with player, fixed_position = like ESP32
  const [viewMode, setViewMode] = useState<ViewMode>('follow_player');
  const viewModeRef = useRef<ViewMode>('follow_player');
  
  // 当前绑定的初始物理座位索引
  const [initialSetupIndex, setInitialSetupIndex] = useState<number | null>(null);
  const initialSetupIndexRef = useRef<number | null>(null);
  // 当前跟随的玩家姓名（手机模式特有逻辑：机器跟着人走）
  const [followName, setFollowName] = useState<string | null>(null);
  const [showFollowSelector, setShowFollowSelector] = useState(false);
  
  // 当前手机的视角基准座位
  const [myPosition, setMyPosition] = useState<Position>('east');
  
  useEffect(() => {
    let active = true;
    
    const initDevice = async () => {
      try {
        await KeepAwake.keepAwake();
        await ScreenOrientation.lock({ orientation: 'landscape' });
      } catch (e) {
        console.warn('KeepAwake/Orientation error', e);
      }
      
      try {
        const { BluetoothLowEnergy } = await import('@capgo/capacitor-bluetooth-low-energy');
        await BluetoothLowEnergy.requestPermissions();
        await BluetoothLowEnergy.initialize();
      } catch (e) {
        console.warn('Bluetooth permissions check failed:', e);
      }

      let storedId = localStorage.getItem('deviceModeId');
      if (!storedId) {
        storedId = 'MJ-PHONE-' + Math.random().toString(16).substring(2, 6).toUpperCase();
        localStorage.setItem('deviceModeId', storedId);
      }
      if (active) setDeviceId(storedId);
      
      deviceModeBle.setMessageHandler((msg: string) => {
        const trimmed = msg.trim();
        
        // Handle SETUP command (position assignment)
        if (trimmed.startsWith('SETUP:')) {
            const index = parseInt(trimmed.substring(6).trim(), 10);
            if (index >= 0 && index < 4) {
                setInitialSetupIndex(index);
                initialSetupIndexRef.current = index;
                setMyPosition(POSITIONS[index]);
            }
            return;
        }
        
        // Handle all STATE: messages
        // Unified format: STATE:<mode>:<eScore>:<sScore>:<wScore>:<nScore>:<eName>:<sName>:<wName>:<nName>:<eActive>:<sActive>:<wActive>:<nActive>
        if (trimmed.startsWith('STATE:')) {
            const parts = trimmed.split(':');
            const mode = parts[1];
            
            // IDLE / WAITING — reset to waiting screen
            if (mode === 'IDLE' || mode === 'WAITING') {
                setStatus('WAITING');
                // If 14-field format, still extract names for later use
                if (parts.length >= 14) {
                    const newNames = { east: parts[6], south: parts[7], west: parts[8], north: parts[9] };
                    setPlayState({
                        scores: { east: '0', south: '0', west: '0', north: '0' },
                        names: newNames,
                        actives: { east: false, south: false, west: false, north: false }
                    });
                } else {
                    setPlayState(null);
                }
                return;
            }
            
            // GAMEOVER — show final scores  
            if (mode === 'GAMEOVER') {
                if (parts.length >= 14) {
                    const newNames = { east: parts[6], south: parts[7], west: parts[8], north: parts[9] };
                    setPlayState({
                        scores: { east: parts[2], south: parts[3], west: parts[4], north: parts[5] },
                        names: newNames,
                        actives: { east: false, south: false, west: false, north: false }
                    });
                } else if (parts.length >= 6) {
                    // Fallback: STATE:GAMEOVER:e:s:w:n (no names)
                    setPlayState(prev => ({
                        scores: { east: parts[2], south: parts[3], west: parts[4], north: parts[5] },
                        names: prev?.names || { east: '', south: '', west: '', north: '' },
                        actives: { east: false, south: false, west: false, north: false }
                    }));
                }
                setStatus('PLAY'); // Show scores in play view
                return;
            }
            
            // PLAY / CONFIRM — main game states (14 fields, phone format)
            if ((mode === 'PLAY' || mode === 'CONFIRM') && parts.length >= 14) {
                const newNames = { east: parts[6], south: parts[7], west: parts[8], north: parts[9] };
                setPlayState({
                    scores: { east: parts[2], south: parts[3], west: parts[4], north: parts[5] },
                    names: newNames,
                    actives: { east: parts[10] === '1', south: parts[11] === '1', west: parts[12] === '1', north: parts[13] === '1' }
                });
                
                if (mode === 'CONFIRM') {
                    setConfirmMsg(t('device.confirmResult'));
                    setStatus('CONFIRM');
                } else {
                    setStatus('PLAY');
                }
                
                // Auto follow logic: only in follow_player mode
                if (viewModeRef.current === 'follow_player') {
                    setFollowName(currentFollow => {
                        let targetName = currentFollow;
                        if (!targetName && initialSetupIndexRef.current !== null) {
                            targetName = newNames[POSITIONS[initialSetupIndexRef.current]];
                        }
                        
                        if (targetName) {
                            if (targetName === newNames.east) setMyPosition('east');
                            else if (targetName === newNames.south) setMyPosition('south');
                            else if (targetName === newNames.west) setMyPosition('west');
                            else if (targetName === newNames.north) setMyPosition('north');
                        }
                        return targetName;
                    });
                }
                // In fixed_position mode, myPosition stays locked to initialSetupIndex
                return;
            }
            
            // Fallback: ESP32 format STATE:PLAY:round:gameNum:e:s:w:n (8 fields)
            // Handles the case where a phone is misidentified as ESP32
            if ((mode === 'PLAY' || mode === 'CONFIRM') && parts.length >= 8 && parts.length < 14) {
                setPlayState(prev => ({
                    scores: { east: parts[4], south: parts[5], west: parts[6], north: parts[7] },
                    names: prev?.names || { east: '', south: '', west: '', north: '' },
                    actives: prev?.actives || { east: false, south: false, west: false, north: false }
                }));
                if (mode === 'CONFIRM') {
                    setConfirmMsg(t('device.confirmResult'));
                    setStatus('CONFIRM');
                } else {
                    setStatus('PLAY');
                }
                return;
            }
        }
        
        // Handle NAME: command (ESP32 format fallback)
        if (trimmed.startsWith('NAME:')) {
            const nameParts = trimmed.split(':');
            if (nameParts.length >= 3) {
                const posIdx = parseInt(nameParts[1], 10);
                const name = nameParts.slice(2).join(':'); // rejoin in case name contains ':'
                if (posIdx >= 0 && posIdx < 4) {
                    setPlayState(prev => {
                        if (!prev) return prev;
                        const newNames = { ...prev.names };
                        newNames[POSITIONS[posIdx]] = name;
                        return { ...prev, names: newNames };
                    });
                }
            }
            return;
        }
        
        // LANG: command — silently accept (phone handles language from its own settings)
        if (trimmed.startsWith('LANG:')) {
            return;
        }
      });

      await deviceModeBle.startAdvertising(storedId);
    };
    initDevice();
    
    return () => {
      active = false;
      deviceModeBle.stopAdvertising();
      KeepAwake.allowSleep().catch(() => {});
      ScreenOrientation.unlock().catch(() => {});
    };
  }, []);

  const handleAction = (action: string) => {
    deviceModeBle.notifyCentral(action);
  };

  // 根据当前持有者方位，计算屏幕四边的对应真实方位
  const relPositions = useMemo(() => {
      const idx = POSITIONS.indexOf(myPosition);
      return {
          bottom: myPosition,                         // 自家
          right: POSITIONS[(idx + 1) % 4],            // 下家
          top: POSITIONS[(idx + 2) % 4],              // 对家
          left: POSITIONS[(idx + 3) % 4]              // 上家
      };
  }, [myPosition]);

  const renderPlayerBox = (pos: Position, placement: 'bottom'|'top'|'left'|'right') => {
      if (!playState) return null;
      const isActive = playState.actives[pos];
      const isSelf = placement === 'bottom';
      
      return (
          <div className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-xl border-2 transition-all ${
              isActive 
                ? 'border-orange-500 bg-slate-800 shadow-[0_0_15px_rgba(249,115,22,0.3)] scale-105 z-10' 
                : 'border-slate-700 bg-slate-800/50'
          }`}>
             <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
                <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold ${
                    isSelf ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-400'
                }`}>
                    {POS_LABELS[pos]}
                </span>
                <span className="text-slate-300 font-bold text-xs sm:text-sm truncate max-w-[60px] sm:max-w-[80px]">
                    {playState.names[pos] || t('device.notSet')}
                </span>
             </div>
             <div className={`text-2xl sm:text-4xl font-black font-mono tracking-tighter ${
                 isActive ? 'text-white' : 'text-slate-300'
             }`}>
                 {playState.scores[pos] || '0'}
             </div>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center p-2 sm:p-6 overflow-hidden select-none">
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 z-50">
        <button 
          onClick={onExit}
          className="p-3 bg-slate-800/80 hover:bg-slate-700 rounded-full text-slate-300 transition-colors backdrop-blur"
        >
          <X size={20} />
        </button>
      </div>
      
      {status === 'WAITING' && (
        <div className="text-center w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400"></div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-200 mb-8 tracking-widest">{t('device.mahjongScoreboard')}</h1>
          
          <div className="space-y-6">
            <div className="inline-block text-xl sm:text-3xl font-mono text-emerald-400 bg-slate-800/80 px-8 py-4 rounded-2xl border border-emerald-900/50">
              {t('device.deviceId', { id: deviceId || t('common.loading') })}
            </div>
            
            {/* View Mode Selector */}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => { setViewMode('follow_player'); viewModeRef.current = 'follow_player'; }}
                className={`flex-1 max-w-[200px] p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                  viewMode === 'follow_player'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <User size={24} />
                <span className="font-bold text-sm">{t('device.followPlayerMode')}</span>
                <span className="text-[10px] opacity-60">{t('device.followPlayerModeDesc')}</span>
              </button>
              <button
                onClick={() => { setViewMode('fixed_position'); viewModeRef.current = 'fixed_position'; }}
                className={`flex-1 max-w-[200px] p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                  viewMode === 'fixed_position'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <MapPin size={24} />
                <span className="font-bold text-sm">{t('device.fixedPositionMode')}</span>
                <span className="text-[10px] opacity-60">{t('device.fixedPositionModeDesc')}</span>
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-3 text-slate-400 text-lg sm:text-xl animate-pulse mt-4">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              {t('device.waitingHost')}
            </div>
          </div>
        </div>
      )}

      {(status === 'PLAY' || status === 'CONFIRM') && playState && (
        <div className="w-full h-full max-h-none sm:max-h-[90vh] bg-slate-900 sm:rounded-[2rem] border-0 sm:border border-slate-800 shadow-2xl flex flex-col landscape:flex-row overflow-hidden relative">
           
           {/* 顶部视角/模式提示 */}
           <div className="absolute top-4 right-4 z-20 flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700 backdrop-blur">
              {viewMode === 'follow_player' ? (
                <>
                  <User size={14} className="text-orange-400" />
                  <span className="text-xs sm:text-sm text-slate-400">{t('device.followView')} <strong className="text-orange-400">{playState.names[myPosition]} ({t('device.posSeat', { pos: POS_LABELS[myPosition] })})</strong></span>
                  <button 
                    onClick={() => setShowFollowSelector(true)}
                    className="text-[10px] sm:text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors"
                  >
                    {t('device.switch')}
                  </button>
                </>
              ) : (
                <>
                  <MapPin size={14} className="text-cyan-400" />
                  <span className="text-xs sm:text-sm text-slate-400">{t('device.fixedView')} <strong className="text-cyan-400">{t('device.posSeat', { pos: POS_LABELS[myPosition] })}</strong></span>
                </>
              )}
           </div>

           {/* 左侧/中部 分数聚拢区 */}
           <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900">
               <div className="grid grid-cols-3 grid-rows-3 gap-2 sm:gap-4 w-full max-w-[min(100%,_75vh)] aspect-square">
                   <div />
                   {renderPlayerBox(relPositions.top, 'top')}
                   <div />
                   
                   {renderPlayerBox(relPositions.left, 'left')}
                   <div className="flex items-center justify-center">
                       <div className="w-12 h-12 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center text-slate-600 font-black opacity-50">
                           {POS_LABELS[playState.actives.east ? 'east' : playState.actives.south ? 'south' : playState.actives.west ? 'west' : 'north']}
                       </div>
                   </div>
                   {renderPlayerBox(relPositions.right, 'right')}
                   
                   <div />
                   {renderPlayerBox(relPositions.bottom, 'bottom')}
                   <div />
               </div>
           </div>

           {/* 底部/右侧 功能栏 */}
           <div className="w-full landscape:w-24 sm:landscape:w-36 bg-slate-800/50 border-t landscape:border-t-0 landscape:border-l border-slate-800 flex flex-row landscape:flex-col items-center justify-center gap-3 sm:gap-6 p-3 sm:p-4 shrink-0 z-10">
               <button 
                 onClick={() => setShowHuangConfirm(true)} 
                 className="flex-1 landscape:w-full landscape:flex-none landscape:aspect-square h-16 sm:h-20 landscape:h-auto bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-row landscape:flex-col items-center justify-center gap-2 border border-slate-600/50"
               >
                  <span className="text-xl sm:text-2xl opacity-50">💨</span>
                  <span className="text-sm sm:text-base">{t('mahjong.draw')}</span>
               </button>
               
               <button 
                 onClick={() => setShowScoreModal(true)} 
                 className="flex-1 landscape:w-full landscape:flex-none landscape:aspect-square h-16 sm:h-20 landscape:h-auto bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white rounded-2xl font-black shadow-[0_0_20px_rgba(225,29,72,0.4)] active:scale-95 transition-all flex flex-row landscape:flex-col items-center justify-center gap-2"
               >
                  <span className="text-2xl sm:text-3xl drop-shadow">🀄️</span>
                  <span className="text-base sm:text-lg tracking-widest">{t('device.win')}</span>
               </button>
           </div>
        </div>
      )}

      {status === 'CONFIRM' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="text-center w-full max-w-2xl px-6 py-10 bg-slate-800 rounded-[2.5rem] border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="text-rose-400 mb-6 flex justify-center">
                <ShieldAlert size={64} />
             </div>
             
             <h2 className="text-2xl sm:text-4xl font-black text-white mb-10 leading-relaxed whitespace-pre-line">
                 {confirmMsg}
             </h2>
             
             <div className="flex gap-4 sm:gap-6 justify-center">
                 <button 
                    onClick={() => { handleAction('BTN:CANCEL'); setStatus('PLAY'); }}
                    className="flex-1 max-w-[160px] py-4 sm:py-5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl font-bold text-lg sm:text-xl active:scale-95 transition-all"
                 >
                     {t('common.cancel')}
                 </button>
                 <button 
                    onClick={() => { handleAction('BTN:CONFIRM'); setStatus('PLAY'); }}
                    className="flex-1 max-w-[200px] py-4 sm:py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg sm:text-xl active:scale-95 transition-all shadow-[0_0_20px_rgba(5,150,105,0.4)]"
                 >
                     {t('common.confirm')}
                 </button>
             </div>
          </div>
        </div>
      )}

      {/* 视角跟随选择器弹窗 */}
      {showFollowSelector && playState && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-800 rounded-3xl border border-slate-700 p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 text-center">{t('device.selectFollowPlayer')}</h3>
            <p className="text-sm text-slate-400 mb-6 text-center">{t('device.followPlayerDesc')}</p>
            <div className="space-y-3">
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  onClick={() => {
                    setFollowName(playState.names[pos]);
                    setMyPosition(pos);
                    setShowFollowSelector(false);
                  }}
                  className={`w-full p-4 rounded-xl font-bold flex items-center justify-between transition-colors ${
                    followName === playState.names[pos] 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  }`}
                >
                  <span>{playState.names[pos]}</span>
                  <span className="text-sm opacity-60">{t('device.posSeat', { pos: POS_LABELS[pos] })}</span>
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowFollowSelector(false)}
              className="w-full mt-6 p-4 bg-slate-900 hover:bg-black text-slate-400 rounded-xl font-bold transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {showScoreModal && playState && (
        <ScoreModal
          winnerPosition={myPosition}
          players={POSITIONS.map(pos => ({
            id: '',
            game_id: '',
            player_id: '',
            position: pos,
            score: parseInt(playState.scores[pos] || '0', 10),
            name: playState.names[pos] || '',
            is_riichi: false,
            is_active: playState.actives[pos] || false
          })) as Player[]}
          onClose={() => setShowScoreModal(false)}
          isDeviceMode={true}
          onSubmit={(loserPosition, baseScore) => {
              if (loserPosition === null) {
                 handleAction(`HE:ZIMO:${baseScore}`);
              } else {
                 let rel = 'OPPOSITE';
                 if (loserPosition === relPositions.left) rel = 'LEFT';
                 else if (loserPosition === relPositions.right) rel = 'RIGHT';
                 handleAction(`HE:RON:${rel}:${baseScore}`);
              }
              setShowScoreModal(false);
          }}
        />
      )}

      {showHuangConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[85%] max-w-sm flex flex-col items-center">
            <ShieldAlert size={48} className="text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">{t('game.confirmDraw')}</h2>
            <p className="text-sm text-gray-600 text-center mb-6">{t('game.confirmDrawDesc')}</p>
            <div className="flex gap-4 w-full">
              <button
                onClick={() => setShowHuangConfirm(false)}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  handleAction('BTN:HUANG');
                  setShowHuangConfirm(false);
                }}
                className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-bold transition-colors"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
