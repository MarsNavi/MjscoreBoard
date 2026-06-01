import { createContext, useState, useRef, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { BluetoothLowEnergy, BleDevice } from '@capgo/capacitor-bluetooth-low-energy';
import { PluginListenerHandle } from '@capacitor/core';
import { Position } from '../lib/types';
import i18n from '../i18n';

export type { Position };

export type BleConnectionInfo = {
  deviceId: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting';
};

interface BleContextType {
  bleDevices: Record<Position, BleConnectionInfo | null>;
  isScanning: boolean;
  scannedDevices: BleDevice[];
  bleError: string | null;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connectToDevice: (position: Position, deviceId: string, deviceName: string) => Promise<void>;
  disconnectBleForPosition: (position: Position) => Promise<void>;
  writeData: (deviceId: string, data: DataView) => Promise<void>;
  setBleError: (error: string | null) => void;
  setMessageHandler: (handler: (position: Position, message: string) => void) => void;
}

export const BleContext = createContext<BleContextType | undefined>(undefined);

// Constants
const BLE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const BLE_TX_CHAR_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const BLE_RX_CHAR_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';
const RECONNECT_INTERVAL = 2000; // 2 seconds
const getPositionLabel = (pos: Position): string => i18n.t(`mahjong.${pos}`);

export function BleProvider({ children }: { children: ReactNode }) {
  const [bleDevices, setBleDevices] = useState<Record<Position, BleConnectionInfo | null>>({
    east: null,
    south: null,
    west: null,
    north: null,
  });
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<BleDevice[]>([]);
  const scannedDevicesRef = useRef<BleDevice[]>([]);
  const [bleError, setBleError] = useState<string | null>(null);
  
  const messageHandlerRef = useRef<((position: Position, message: string) => void) | null>(null);
  const scanListenerRef = useRef<PluginListenerHandle | null>(null);
  const disconnectListenerRef = useRef<PluginListenerHandle | null>(null);
  const notifyListenerRef = useRef<PluginListenerHandle | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initBle = async () => {
      try {
        try {
          await BluetoothLowEnergy.requestPermissions();
        } catch (err) {
          console.warn('Bluetooth permissions request failed:', err);
        }

        try {
          const { enabled } = await BluetoothLowEnergy.isEnabled();
          if (!enabled) {
            if (window.confirm(i18n.t('ble.enableBluetoothPrompt'))) {
              await BluetoothLowEnergy.openBluetoothSettings();
            }
          }
        } catch (err) {
          console.warn('Bluetooth enabled check failed:', err);
        }

        await BluetoothLowEnergy.initialize();
        setIsInitialized(true);
        
        disconnectListenerRef.current = await BluetoothLowEnergy.addListener('deviceDisconnected', (event) => {

            setBleDevices((prev) => {
                let updated = { ...prev };
                let changed = false;
                const positions: Position[] = ['east', 'south', 'west', 'north'];
                for (const pos of positions) {
                    const current = prev[pos];
                    if (current && current.deviceId === event.deviceId && current.status !== 'disconnected') {
                        updated[pos] = { ...current, status: 'disconnected' };
                        changed = true;
                    }
                }
                return changed ? updated : prev;
            });
        });

        notifyListenerRef.current = await BluetoothLowEnergy.addListener('characteristicChanged', (event) => {
            if (event.service.toLowerCase() !== BLE_SERVICE_UUID.toLowerCase() || 
                event.characteristic.toLowerCase() !== BLE_TX_CHAR_UUID.toLowerCase()) {
                return;
            }
            const text = new TextDecoder().decode(new Uint8Array(event.value));
            
            if (messageHandlerRef.current) {
                setBleDevices((prev) => {
                    const positions: Position[] = ['east', 'south', 'west', 'north'];
                    for (const pos of positions) {
                        if (prev[pos]?.deviceId === event.deviceId) {
                            messageHandlerRef.current!(pos, text);
                            break;
                        }
                    }
                    return prev;
                });
            }
        });

        const savedDevices = localStorage.getItem('bleDevices');
        if (savedDevices) {
          try {
            const parsed = JSON.parse(savedDevices) as Record<Position, BleConnectionInfo | null>;
            const validPositions: Position[] = ['east', 'south', 'west', 'north'];
            const validatedDevices: Record<Position, BleConnectionInfo | null> = {
              east: null, south: null, west: null, north: null,
            };

            validPositions.forEach(pos => {
              if (parsed[pos] && typeof parsed[pos] === 'object') {
                validatedDevices[pos] = {
                  ...parsed[pos]!,
                  status: 'disconnected' 
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
        setBleError(i18n.t('ble.bluetoothUnavailable'));
      }
    };
    initBle();

    return () => {
        scanListenerRef.current?.remove();
        disconnectListenerRef.current?.remove();
        notifyListenerRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('bleDevices', JSON.stringify(bleDevices));
  }, [bleDevices]);

  useEffect(() => {
    if (!isInitialized) return;

    const intervalId = setInterval(async () => {
      const positions: Position[] = ['east', 'south', 'west', 'north'];
      
      for (const pos of positions) {
        const device = bleDevices[pos];
        if (device && device.deviceId && device.status === 'disconnected') {

           
           try {
             await BluetoothLowEnergy.connect({ deviceId: device.deviceId });
             
             await BluetoothLowEnergy.startCharacteristicNotifications({
                deviceId: device.deviceId,
                service: BLE_SERVICE_UUID,
                characteristic: BLE_TX_CHAR_UUID,
             });
             
             setBleDevices((prev) => ({
                ...prev,
                [pos]: { ...prev[pos]!, status: 'connected' }
             }));
             
           } catch (err) {
             // Reconnect attempt failed silently — will retry on next interval
           }
        }
      }
    }, RECONNECT_INTERVAL);

    return () => clearInterval(intervalId);
  }, [bleDevices, isInitialized]); 

  const stopScan = useCallback(async () => {
    try {
      if (scanListenerRef.current) {
          await scanListenerRef.current.remove();
          scanListenerRef.current = null;
      }
      await BluetoothLowEnergy.stopScan();
      setIsScanning(false);
    } catch (error) {
      console.error('Failed to stop scan:', error);
    }
  }, []);

  const startScan = useCallback(async () => {
    try {
      await stopScan();
      setScannedDevices([]);
      scannedDevicesRef.current = [];
      setIsScanning(true);
      setBleError(null);

      scanListenerRef.current = await BluetoothLowEnergy.addListener('deviceScanned', (event) => {
          const device = event.device;
          if (!device.name) return;
          const existingIndex = scannedDevicesRef.current.findIndex(d => d.deviceId === device.deviceId);
          if (existingIndex === -1) {
            scannedDevicesRef.current = [...scannedDevicesRef.current, device];
            setScannedDevices([...scannedDevicesRef.current]);
          }
      });

      await BluetoothLowEnergy.startScan({
         services: [BLE_SERVICE_UUID],
      });
      
      setTimeout(() => {
        void stopScan();
      }, 10000);

    } catch (error) {
      console.error('Failed to start scan:', error);
      setBleError(i18n.t('ble.scanError'));
      setIsScanning(false);
    }
  }, [stopScan]);

  const connectToDevice = useCallback(async (position: Position, deviceId: string, deviceName: string) => {
    try {
        const positions: Position[] = ['east', 'south', 'west', 'north'];
        for (const pos of positions) {
            if (bleDevices[pos]?.deviceId === deviceId) {
                setBleError(i18n.t('ble.alreadyBound', { name: deviceName, pos: getPositionLabel(pos) + i18n.t('mahjong.playerSuffix') }));
                return;
            }
        }

        setBleError(null);
        await stopScan();

        await BluetoothLowEnergy.connect({ deviceId });

        await BluetoothLowEnergy.startCharacteristicNotifications({
            deviceId,
            service: BLE_SERVICE_UUID,
            characteristic: BLE_TX_CHAR_UUID,
        });

        const connection: BleConnectionInfo = {
            deviceId: deviceId,
            name: deviceName || i18n.t('ble.unnamedDevice'),
            status: 'connected',
        };

        setBleDevices((prev) => ({
            ...prev,
            [position]: connection,
        }));
        
        setScannedDevices(prev => prev.filter(d => d.deviceId !== deviceId));
        scannedDevicesRef.current = scannedDevicesRef.current.filter(d => d.deviceId !== deviceId);

    } catch (error) {
        if (error instanceof Error) {
            setBleError(error.message);
        } else if (typeof error === 'string') {
            setBleError(error);
        } else {
            setBleError(i18n.t('ble.connectFailed'));
        }
        throw error; 
    }
  }, [bleDevices, stopScan]);

  const disconnectBleForPosition = useCallback(async (position: Position) => {
    const current = bleDevices[position];
    if (current && current.deviceId) {
      try {
        await BluetoothLowEnergy.disconnect({ deviceId: current.deviceId });
      } catch (error) {
        console.error(error);
      }
    }
    setBleDevices((prev) => ({
      ...prev,
      [position]: null,
    }));
  }, [bleDevices]);

  const writeData = useCallback(async (deviceId: string, data: DataView) => {
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      await BluetoothLowEnergy.writeCharacteristic({
          deviceId,
          service: BLE_SERVICE_UUID,
          characteristic: BLE_RX_CHAR_UUID,
          value: Array.from(bytes)
      });
  }, []);

  const setMessageHandler = useCallback((handler: (position: Position, message: string) => void) => {
      messageHandlerRef.current = handler;
  }, []);

  const contextValue = useMemo(
    () => ({
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
      setMessageHandler,
    }),
    [
      bleDevices,
      isScanning,
      scannedDevices,
      bleError,
      startScan,
      stopScan,
      connectToDevice,
      disconnectBleForPosition,
      writeData,
      setMessageHandler,
    ]
  );

  return (
    <BleContext.Provider value={contextValue}>
      {children}
    </BleContext.Provider>
  );
}
