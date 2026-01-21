import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';

// Re-export types if needed, or import from central types
// Assuming Position is 'east' | 'south' | 'west' | 'north'
export type Position = 'east' | 'south' | 'west' | 'north';

export type BleConnectionInfo = {
  deviceId: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting';
};

interface BleContextType {
  bleDevices: Record<Position, BleConnectionInfo | null>;
  isScanning: boolean;
  scannedDevices: ScanResult[];
  bleError: string | null;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connectToDevice: (position: Position, deviceId: string, deviceName: string) => Promise<void>;
  disconnectBleForPosition: (position: Position) => Promise<void>;
  writeData: (deviceId: string, data: DataView) => Promise<void>;
  setBleError: (error: string | null) => void;
  setMessageHandler: (handler: (position: Position, message: string) => void) => void;
}

const BleContext = createContext<BleContextType | undefined>(undefined);

// Constants
const BLE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const BLE_TX_CHAR_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const BLE_RX_CHAR_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';
const RECONNECT_INTERVAL = 2000; // 2 seconds

export function BleProvider({ children }: { children: ReactNode }) {
  const [bleDevices, setBleDevices] = useState<Record<Position, BleConnectionInfo | null>>({
    east: null,
    south: null,
    west: null,
    north: null,
  });
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScanResult[]>([]);
  const scannedDevicesRef = useRef<ScanResult[]>([]);
  const [bleError, setBleError] = useState<string | null>(null);
  
  // Ref for the message handler to avoid stale closures in callbacks
  const messageHandlerRef = useRef<((position: Position, message: string) => void) | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  // Load from LocalStorage on mount
  useEffect(() => {
    const initBle = async () => {
      try {
        await BleClient.initialize();
        setIsInitialized(true);
        
        const savedDevices = localStorage.getItem('bleDevices');
        if (savedDevices) {
          try {
            const parsed = JSON.parse(savedDevices) as Record<Position, BleConnectionInfo | null>;
            // Validate structure and reset status
            const validPositions: Position[] = ['east', 'south', 'west', 'north'];
            const validatedDevices: Record<Position, BleConnectionInfo | null> = {
              east: null,
              south: null,
              west: null,
              north: null,
            };

            validPositions.forEach(pos => {
              if (parsed[pos] && typeof parsed[pos] === 'object') {
                validatedDevices[pos] = {
                  ...parsed[pos]!,
                  status: 'disconnected' // Always start as disconnected until auto-reconnect kicks in
                };
              }
            });
            
            setBleDevices(validatedDevices);
          } catch (e) {
            console.error('Failed to parse saved devices:', e);
            localStorage.removeItem('bleDevices');
          }
        }
      } catch (error) {
        console.error('BLE initialize failed:', error);
        setBleError('蓝牙初始化失败，请检查设备支持情况');
      }
    };
    initBle();
  }, []);

  // Save to LocalStorage whenever bleDevices changes
  useEffect(() => {
    localStorage.setItem('bleDevices', JSON.stringify(bleDevices));
  }, [bleDevices]);

  // Auto-reconnect loop
  useEffect(() => {
    if (!isInitialized) return;

    const intervalId = setInterval(async () => {
      const positions: Position[] = ['east', 'south', 'west', 'north'];
      
      for (const pos of positions) {
        const device = bleDevices[pos];
        // Only try to reconnect if we have a device ID and it's currently disconnected
        // We don't want to interrupt 'connecting' state or 'connected' state
        if (device && device.deviceId && device.status === 'disconnected') {
           console.log(`[Auto-Reconnect] Attempting to connect to ${pos} (${device.name})...`);
           
           try {
             // Set status to connecting to give UI feedback (optional, but good for "don't disconnect" feeling)
             // However, doing this inside the loop might cause rapid state updates if it fails quickly.
             // Let's just try to connect.
             
             await BleClient.connect(device.deviceId, (disconnectedDeviceId) => {
                console.log('device disconnected callback', disconnectedDeviceId);
                setBleDevices((prev) => {
                   const current = prev[pos];
                   if (current && current.deviceId === disconnectedDeviceId) {
                       return {
                           ...prev,
                           [pos]: { ...current, status: 'disconnected' }
                       };
                   }
                   return prev;
                });
             });

             // Re-subscribe to notifications
             await BleClient.startNotifications(
                device.deviceId,
                BLE_SERVICE_UUID,
                BLE_TX_CHAR_UUID,
                (value) => {
                    const text = new TextDecoder().decode(value.buffer);
                    if (messageHandlerRef.current) {
                        messageHandlerRef.current(pos, text);
                    }
                }
             );
             
             // Update status to connected
             setBleDevices((prev) => ({
                ...prev,
                [pos]: { ...prev[pos]!, status: 'connected' }
             }));
             
             console.log(`[Auto-Reconnect] Success for ${pos}`);
             
           } catch (err) {
             console.log(`[Auto-Reconnect] Failed for ${pos}:`, err);
             // Verify if it's already connected?
             // Sometimes connect throws if already connected.
             // We can try to read RSSI or something to check?
             // For now, just leave it as disconnected, will retry next loop.
           }
        }
      }
    }, RECONNECT_INTERVAL);

    return () => clearInterval(intervalId);
  }, [bleDevices, isInitialized]); 

  const startScan = async () => {
    try {
      await BleClient.stopLEScan().catch(() => {});
      setScannedDevices([]);
      scannedDevicesRef.current = [];
      setIsScanning(true);
      setBleError(null);

      await BleClient.requestLEScan(
        {
           services: [BLE_SERVICE_UUID],
        },
        (result) => {
          if (!result.device.name) return;
          const existingIndex = scannedDevicesRef.current.findIndex(d => d.device.deviceId === result.device.deviceId);
          if (existingIndex === -1) {
            scannedDevicesRef.current = [...scannedDevicesRef.current, result];
            setScannedDevices([...scannedDevicesRef.current]);
          }
        }
      );
      
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

  const connectToDevice = async (position: Position, deviceId: string, deviceName: string) => {
    try {
        // Check if device is already connected to another position
        const positions: Position[] = ['east', 'south', 'west', 'north'];
        for (const pos of positions) {
            if (bleDevices[pos]?.deviceId === deviceId) {
                setBleError(`设备 ${deviceName} 已经绑定到 ${pos}家`);
                return;
            }
        }

        setBleError(null);
        await stopScan();

        await BleClient.connect(deviceId, (disconnectedDeviceId) => {
            console.log('device disconnected', disconnectedDeviceId);
            setBleDevices((prev) => {
                const current = prev[position];
                // Only update if it's the same device and we haven't already unbound it
                if (current && current.deviceId === disconnectedDeviceId) {
                    return {
                        ...prev,
                        [position]: { ...current, status: 'disconnected' }
                    };
                }
                return prev;
            });
        });

        await BleClient.startNotifications(
            deviceId,
            BLE_SERVICE_UUID,
            BLE_TX_CHAR_UUID,
            (value) => {
                const text = new TextDecoder().decode(value.buffer);
                if (messageHandlerRef.current) {
                    messageHandlerRef.current(position, text);
                }
            }
        );

        const connection: BleConnectionInfo = {
            deviceId: deviceId,
            name: deviceName || 'Unknown Device',
            status: 'connected',
        };

        setBleDevices((prev) => ({
            ...prev,
            [position]: connection,
        }));
        
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
        throw error; // Re-throw to let caller handle if needed
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

  const writeData = async (deviceId: string, data: DataView) => {
      await BleClient.write(deviceId, BLE_SERVICE_UUID, BLE_RX_CHAR_UUID, data);
  };

  const setMessageHandler = (handler: (position: Position, message: string) => void) => {
      messageHandlerRef.current = handler;
  };

  return (
    <BleContext.Provider value={{
      bleDevices,
      isScanning,
      scannedDevices,
      bleError,
      startScan,
      stopScan,
      connectToDevice,
      disconnectBleForPosition,
      writeData,
      setBleError,
      setMessageHandler
    }}>
      {children}
    </BleContext.Provider>
  );
}

export function useBle() {
  const context = useContext(BleContext);
  if (context === undefined) {
    throw new Error('useBle must be used within a BleProvider');
  }
  return context;
}
