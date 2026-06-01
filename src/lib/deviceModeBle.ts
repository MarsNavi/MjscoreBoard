declare var blePeripheral: any;

const BLE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const BLE_TX_CHAR_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const BLE_RX_CHAR_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

export type DeviceStateCallback = (message: string) => void;

class DeviceModeBleManager {
  private onMessageCallback: DeviceStateCallback | null = null;
  private isAdvertising = false;

  public setMessageHandler(callback: DeviceStateCallback) {
    this.onMessageCallback = callback;
  }

  public async startAdvertising(deviceId: string): Promise<void> {
    if (typeof blePeripheral === 'undefined') {
      console.warn('blePeripheral plugin is not available. Are you running on a device?');
      return;
    }

    try {
      // Listen for writes from central
      blePeripheral.onWriteRequest((json: any) => {
        if (json.service.toLowerCase() === BLE_SERVICE_UUID && json.characteristic.toLowerCase() === BLE_RX_CHAR_UUID) {
          const buffer = json.value as ArrayBuffer;
          const text = new TextDecoder().decode(buffer);

          if (this.onMessageCallback) {
            this.onMessageCallback(text);
          }
        }
      });

      const serviceDef = {
        uuid: BLE_SERVICE_UUID,
        characteristics: [
          {
            uuid: BLE_TX_CHAR_UUID,
            properties: blePeripheral.properties.NOTIFY | blePeripheral.properties.READ,
            permissions: blePeripheral.permissions.READABLE,
            descriptors: []
          },
          {
            uuid: BLE_RX_CHAR_UUID,
            properties: blePeripheral.properties.WRITE | blePeripheral.properties.WRITE_NO_RESPONSE,
            permissions: blePeripheral.permissions.WRITEABLE,
            descriptors: []
          }
        ]
      };

      await blePeripheral.createServiceFromJSON(serviceDef);
      await blePeripheral.startAdvertising(BLE_SERVICE_UUID, deviceId);
      this.isAdvertising = true;

    } catch (e) {
      console.error('[DeviceMode] Failed to start advertising:', e);
    }
  }

  public async stopAdvertising(): Promise<void> {
    if (typeof blePeripheral === 'undefined' || !this.isAdvertising) return;
    try {
      await blePeripheral.stopAdvertising();
      this.isAdvertising = false;
    } catch (e) {
      console.warn('[DeviceMode] Failed to stop advertising:', e);
    }
  }

  public async notifyCentral(message: string): Promise<void> {
    if (typeof blePeripheral === 'undefined' || !this.isAdvertising) return;
    
    try {
      const buffer = new TextEncoder().encode(message).buffer;
      await blePeripheral.setCharacteristicValue(BLE_SERVICE_UUID, BLE_TX_CHAR_UUID, buffer);

    } catch (e) {
      console.error('[DeviceMode] Failed to notify central:', e);
    }
  }
}

export const deviceModeBle = new DeviceModeBleManager();
