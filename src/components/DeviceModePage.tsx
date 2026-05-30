import { useEffect, useState, useMemo } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { X, Play, ShieldAlert, BadgeCheck } from 'lucide-react';
import { deviceModeBle } from '../lib/deviceModeBle';
import { Position } from '../lib/types';

interface DeviceModePageProps {
  onExit: () => void;
}

type DeviceStatus = 'WAITING' | 'PLAY' | 'CONFIRM' | 'HU' | 'HUANG';

interface PlayState {
  scores: Record<Position, string>;
  names: Record<Position, string>;
  actives: Record<Position, boolean>;
}

const POSITIONS: Position[] = ['east', 'south', 'west', 'north'];
const POS_LABELS: Record<Position, string> = { east: '东', south: '南', west: '西', north: '北' };

export default function DeviceModePage({ onExit }: DeviceModePageProps) {
  const [deviceId, setDeviceId] = useState<string>('');
  const [status, setStatus] = useState<DeviceStatus>('WAITING');
  const [playState, setPlayState] = useState<PlayState | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  
  // 当前绑定的初始物理座位索引
  const [initialSetupIndex, setInitialSetupIndex] = useState<number | null>(null);
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
      } catch (e) {
        console.warn('KeepAwake error', e);
      }
      
      let storedId = localStorage.getItem('deviceModeId');
      if (!storedId) {
        storedId = 'MJ-PHONE-' + Math.random().toString(16).substring(2, 6).toUpperCase();
        localStorage.setItem('deviceModeId', storedId);
      }
      if (active) setDeviceId(storedId);
      
      deviceModeBle.setMessageHandler((msg: string) => {
        if (msg.startsWith('STATE:PLAY:')) {
            const parts = msg.split(':');
            if (parts.length >= 14) {
                const newNames = { east: parts[6], south: parts[7], west: parts[8], north: parts[9] };
                setPlayState({
                    scores: { east: parts[2], south: parts[3], west: parts[4], north: parts[5] },
                    names: newNames,
                    actives: { east: parts[10] === '1', south: parts[11] === '1', west: parts[12] === '1', north: parts[13] === '1' }
                });
                setStatus('PLAY');
                
                // 自动视角跟随逻辑：手机跟着选手走
                setFollowName(currentFollow => {
                    let targetName = currentFollow;
                    // 如果尚未确定跟随谁，且我们收到了 SETUP 绑定的初始座位
                    if (!targetName && initialSetupIndex !== null) {
                        targetName = newNames[POSITIONS[initialSetupIndex]];
                    }
                    
                    if (targetName) {
                        // 寻找该玩家当前坐在哪个方位
                        if (targetName === newNames.east) setMyPosition('east');
                        else if (targetName === newNames.south) setMyPosition('south');
                        else if (targetName === newNames.west) setMyPosition('west');
                        else if (targetName === newNames.north) setMyPosition('north');
                    }
                    return targetName;
                });
            }
        } else if (msg.startsWith('STATE:CONFIRM:')) {
            setConfirmMsg(msg.substring(14));
            setStatus('CONFIRM');
        } else if (msg.startsWith('STATE:HU:')) {
            setConfirmMsg(msg.substring(9));
            setStatus('HU');
        } else if (msg === 'STATE:HUANG') {
            setStatus('HUANG');
        } else if (msg.startsWith('STATE:IDLE')) {
            setStatus('WAITING');
            setPlayState(null);
            setFollowName(null);
        } else if (msg.startsWith('SETUP:')) {
            const index = parseInt(msg.substring(6).trim(), 10);
            if (index >= 0 && index < 4) {
                setInitialSetupIndex(index);
                setMyPosition(POSITIONS[index]);
            }
        }
      });

      await deviceModeBle.startAdvertising(storedId);
    };
    initDevice();
    
    return () => {
      active = false;
      KeepAwake.allowSleep().catch(() => {});
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
                    {playState.names[pos] || '未设置'}
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
      <div className="absolute top-4 left-4 z-50">
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
          <h1 className="text-3xl sm:text-5xl font-black text-slate-200 mb-8 tracking-widest">麻将计分板</h1>
          
          <div className="space-y-6">
            <div className="inline-block text-xl sm:text-3xl font-mono text-emerald-400 bg-slate-800/80 px-8 py-4 rounded-2xl border border-emerald-900/50">
              设备号: {deviceId || '加载中...'}
            </div>
            
            <div className="flex items-center justify-center gap-3 text-slate-400 text-lg sm:text-xl animate-pulse mt-4">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              等待主机连接...
            </div>
          </div>
        </div>
      )}

      {status === 'PLAY' && playState && (
        <div className="w-full max-w-5xl aspect-video sm:aspect-auto sm:h-full max-h-[90vh] bg-slate-900 rounded-[2rem] border border-slate-800 shadow-2xl flex flex-row overflow-hidden relative">
           
           {/* 顶部视角切换提示 */}
           <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700 backdrop-blur">
              <span className="text-xs sm:text-sm text-slate-400">视角跟随: <strong className="text-orange-400">{playState.names[myPosition]} ({POS_LABELS[myPosition]}位)</strong></span>
              <button 
                onClick={() => setShowFollowSelector(true)}
                className="text-[10px] sm:text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors"
              >
                切换
              </button>
           </div>

           {/* 左侧/中部 分数聚拢区 */}
           <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900">
               <div className="grid grid-cols-3 grid-rows-3 gap-2 sm:gap-4 w-full max-w-md aspect-square">
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

           {/* 右侧 功能栏 */}
           <div className="w-24 sm:w-36 bg-slate-800/50 border-l border-slate-800 flex flex-col items-center justify-center gap-4 sm:gap-8 p-3 sm:p-4 shrink-0 z-10">
               <button 
                 onClick={() => handleAction('BTN:HUANG')} 
                 className="w-full aspect-square bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center gap-2 border border-slate-600/50"
               >
                  <span className="text-lg sm:text-2xl opacity-50">💨</span>
                  <span className="text-sm sm:text-base">荒庄</span>
               </button>
               
               <button 
                 onClick={() => handleAction('BTN:RON')} 
                 className="w-full aspect-square bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white rounded-2xl font-black shadow-[0_0_20px_rgba(225,29,72,0.4)] active:scale-95 transition-all flex flex-col items-center justify-center gap-2"
               >
                  <span className="text-xl sm:text-3xl drop-shadow">🀄️</span>
                  <span className="text-base sm:text-lg tracking-widest">和牌</span>
               </button>
           </div>
        </div>
      )}

      {(status === 'CONFIRM' || status === 'HU' || status === 'HUANG') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="text-center w-full max-w-2xl px-6 py-10 bg-slate-800 rounded-[2.5rem] border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="text-rose-400 mb-6 flex justify-center">
                {status === 'CONFIRM' ? <ShieldAlert size={64} /> : status === 'HU' ? <BadgeCheck size={64} /> : <Play size={64} />}
             </div>
             
             <h2 className="text-2xl sm:text-4xl font-black text-white mb-10 leading-relaxed whitespace-pre-line">
                 {status === 'HUANG' ? '本局荒庄' : confirmMsg}
             </h2>
             
             <div className="flex gap-4 sm:gap-6 justify-center">
                 <button 
                    onClick={() => handleAction('BTN:CANCEL')} 
                    className="flex-1 max-w-[160px] py-4 sm:py-5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl font-bold text-lg sm:text-xl active:scale-95 transition-all"
                 >
                     取消
                 </button>
                 <button 
                    onClick={() => handleAction('BTN:CONFIRM')} 
                    className="flex-1 max-w-[200px] py-4 sm:py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg sm:text-xl active:scale-95 transition-all shadow-[0_0_20px_rgba(5,150,105,0.4)]"
                 >
                     确认
                 </button>
             </div>
          </div>
        </div>
      )}

      {/* 视角跟随选择器弹窗 */}
      {showFollowSelector && playState && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-800 rounded-3xl border border-slate-700 p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 text-center">选择你要跟随的选手</h3>
            <p className="text-sm text-slate-400 mb-6 text-center">手机屏幕会自动旋转，确保该选手始终在正下方</p>
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
                  <span className="text-sm opacity-60">{POS_LABELS[pos]}位</span>
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowFollowSelector(false)}
              className="w-full mt-6 p-4 bg-slate-900 hover:bg-black text-slate-400 rounded-xl font-bold transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
