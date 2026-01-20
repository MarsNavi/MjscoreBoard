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

  // Load from LocalStorage on mount
  useEffect(() => {
    const initBle = async () => {
      try {
        await BleClient.initialize();
        
        const savedDevices = localStorage.getItem('bleDevices');
        if (savedDevices) {
          const parsed = JSON.parse(savedDevices) as Record<Position, BleConnectionInfo | null>;
          // Reset status to disconnected on load, as actual connection is lost on reload
          const resetStatus: Record<Position, BleConnectionInfo | null> = { ...parsed };
          (Object.keys(resetStatus) as Position[]).forEach(pos => {
             if (resetStatus[pos]) {
                resetStatus[pos] = { ...resetStatus[pos]!, status: 'disconnected' };
             }
          });
          setBleDevices(resetStatus);
        }
      } catch (error) {
        console.log('BLE initialize info:', error);
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
    const intervalId = setInterval(async () => {
      const positions: Position[] = ['east', 'south', 'west', 'north'];
      
      for (const pos of positions) {
        const device = bleDevices[pos];
        if (device && device.status === 'disconnected' && device.deviceId) {
           console.log(`Attempting auto-reconnect for ${pos} (${device.name})...`);
           try {
             // We use a simplified connect flow here to avoid setting 'connecting' state which might cause render loop
             // or we can set it if we want UI feedback.
             // For now, let's try to connect directly.
             await BleClient.connect(device.deviceId, (disconnectedDeviceId) => {
                console.log('device disconnected', disconnectedDeviceId);
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
             
             console.log(`Auto-reconnect successful for ${pos}`);
             
             // Re-send setup command if needed? 
             // Ideally the device state is persistent or the app syncs it.
             // We can trigger a sync if we had access to the logic, but BleContext is low level.
             
           } catch (err) {
             console.log(`Auto-reconnect failed for ${pos}:`, err);
             // Keep status as disconnected, will retry next interval
           }
        }
      }
    }, RECONNECT_INTERVAL);

    return () => clearInterval(intervalId);
  }, [bleDevices]); 

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
