import { useState } from 'react';
import { Position } from '../lib/types';
import { Scan, RefreshCw, Smartphone, Bluetooth, X, Link, Trash2 } from 'lucide-react';
import { useBle } from '../contexts/useBle';

interface BleConnectionManagerProps {
  onClose: () => void;
  isOpen: boolean;
}

const positionLabels: Record<Position, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

const positions: Position[] = ['east', 'south', 'west', 'north'];

export default function BleConnectionManager({ onClose, isOpen }: BleConnectionManagerProps) {
  const { bleDevices, isScanning, scannedDevices, bleError, startScan, stopScan, connectToDevice: contextConnect, disconnectBleForPosition, writeData } = useBle();
  const [connectingPosition, setConnectingPosition] = useState<Position | null>(null);

  // Safety check to prevent crashes if context isn't fully ready
  if (!isOpen) return null;
  if (!bleDevices) return null;

  const handleConnect = async (position: Position, deviceId: string, deviceName: string) => {
    try {
      setConnectingPosition(position);
      
      await contextConnect(position, deviceId, deviceName);

      // Send Setup Command immediately
      const encoder = new TextEncoder();
      const positionMap: Record<Position, number> = {
        east: 0,
        south: 1,
        west: 2,
        north: 3,
      };
      const setupCmd = `SETUP:${positionMap[position]}\n`;
      const cmdData = encoder.encode(setupCmd);
      await writeData(deviceId, new DataView(cmdData.buffer));

      // App.tsx will detect the new connection and sync state/names automatically via its useEffect.
      
    } catch (error) {
      console.error("Connection failed", error);
    } finally {
      setConnectingPosition(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Bluetooth className="text-blue-500" size={20} />
              计分牌连接
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">为东、南、西、北绑定对应计分牌。</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Message */}
        {bleError && (
          <div className="px-6 py-2 bg-red-50 text-red-600 text-xs border-b border-red-100 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
             {bleError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
          
          {/* Connected Devices Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Link size={16} />
              已绑定
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {positions.map((position) => {
                const device = bleDevices[position];
                const isConnected = device?.status === 'connected';
                
                return (
                  <div 
                    key={position} 
                    className={`relative p-3 rounded-xl border-2 transition-all ${
                      device 
                        ? (isConnected 
                            ? 'border-green-500 bg-green-50/50' 
                            : 'border-orange-300 bg-orange-50/50')
                        : 'border-dashed border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="absolute top-3 right-3 text-xs font-bold text-gray-400 tracking-wider">
                      {positionLabels[position]}家
                    </div>
                    
                    <div className="flex flex-col h-full justify-between gap-2">
                      {device ? (
                        <>
                          <div>
                            <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                              <Smartphone size={14} className={isConnected ? "text-green-600" : "text-orange-500"} />
                              {device.name || '未命名设备'}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{device.deviceId}</div>
                            {!isConnected && (
                                <div className="mt-1 text-[10px] text-orange-600 font-medium animate-pulse">
                                    {device.status === 'connecting' ? '正在连接…' : '连接断开，正在重连…'}
                                </div>
                            )}
                          </div>
                          <button
                            onClick={() => disconnectBleForPosition(position)}
                            className="self-start px-2 py-1 bg-white border border-red-200 text-red-600 rounded text-xs hover:bg-red-50 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 size={12} />
                            解除绑定
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 text-gray-400 gap-1">
                          <Bluetooth size={24} className="opacity-20" />
                          <span className="text-xs">未绑定</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scanner Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
               <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                 <Scan size={16} />
                 发现设备 ({scannedDevices.length})
               </h3>
               <button 
                 onClick={isScanning ? stopScan : startScan}
                 className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    isScanning 
                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                 }`}
               >
                 {isScanning ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                 {isScanning ? '停止扫描' : '开始扫描'}
               </button>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto p-2">
               {scannedDevices.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                     {isScanning ? '正在搜索附近计分牌…' : '点按“开始扫描”查找附近计分牌'}
                  </div>
               ) : (
                  <div className="space-y-2">
                     {scannedDevices.map((result) => (
                        <div key={result.device.deviceId} className="bg-white hover:bg-gray-50 rounded-lg p-3 border border-gray-100 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                           <div className="flex items-start gap-3">
                              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Bluetooth size={16} />
                              </div>
                              <div>
                                 <div className="font-medium text-gray-800 text-sm">{result.device.name || '未命名设备'}</div>
                                 <div className="text-[10px] text-gray-500 font-mono flex items-center gap-2">
                                   <span>ID: {result.device.deviceId}</span>
                                   <span className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">RSSI: {result.rssi}</span>
                                 </div>
                              </div>
                           </div>
                           
                           <div className="flex items-center gap-1.5 pl-11 sm:pl-0 flex-wrap">
                              <span className="text-[10px] text-gray-400 mr-1">绑定到</span>
                              {positions.map(pos => {
                                const isBound = !!bleDevices[pos];
                                return (
                                  <button
                                     key={pos}
                                     disabled={isBound || connectingPosition !== null}
                                     onClick={() => handleConnect(pos, result.device.deviceId, result.device.name || '未命名设备')}
                                     className={`px-2 py-1 rounded text-[10px] border transition-all ${
                                       isBound 
                                         ? 'bg-gray-100 text-gray-300 border-transparent cursor-not-allowed'
                                         : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm'
                                     }`}
                                  >
                                     {positionLabels[pos]}
                                  </button>
                                );
                              })}
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
