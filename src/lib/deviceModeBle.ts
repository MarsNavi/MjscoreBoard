import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';
import { Capacitor } from '@capacitor/core';

declare var blePeripheral: any;

const BLE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const BLE_TX_CHAR_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const BLE_RX_CHAR_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

export type DeviceStateCallback = (message: string) => void;

class DeviceModeBleManager {
  private onMessageCallback: DeviceStateCallback | null = null;
  private isAdvertising = false;
  private platform: string = Capacitor.getPlatform();

  public setMessageHandler(callback: DeviceStateCallback) {
    this.onMessageCallback = callback;
  }

  /**
   * Dispatch received BLE data, splitting by newline since the host
   * may pack multiple commands into a single BLE write.
   */
  private _dispatchMessage(text: string) {
    if (!this.onMessageCallback) return;
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        this.onMessageCallback(trimmed);
      }
    }
  }

  public async startAdvertising(deviceId: string): Promise<void> {
    if (this.platform === 'web') {
      console.warn('[DeviceMode] BLE not available on web');
      return;
    }

    try {
      if (this.platform === 'android') {
        await this._startAndroidAdvertising(deviceId);
      } else if (this.platform === 'ios') {
        await this._startIosAdvertising(deviceId);
      }
      this.isAdvertising = true;
    } catch (e) {
      console.error('[DeviceMode] Failed to start advertising:', e);
    }
  }

  /**
   * Android: use cordova-plugin-ble-peripheral (has GATT server support for receiving writes)
   */
  private async _startAndroidAdvertising(deviceId: string): Promise<void> {
    if (typeof blePeripheral === 'undefined') {
      console.warn('[DeviceMode] blePeripheral plugin not available on Android');
      return;
    }

    // Listen for writes from central (host device)
    blePeripheral.onWriteRequest((json: any) => {
      if (
        json.service.toLowerCase() === BLE_SERVICE_UUID &&
        json.characteristic.toLowerCase() === BLE_RX_CHAR_UUID
      ) {
        const buffer = json.value as ArrayBuffer;
        const text = new TextDecoder().decode(buffer);
        this._dispatchMessage(text);
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
    // The patched Java plugin will temporarily set the adapter name to deviceId
    await blePeripheral.startAdvertising(BLE_SERVICE_UUID, deviceId);
  }

  /**
   * iOS: use cordova-plugin-ble-peripheral which has a proper CBPeripheralManager implementation
   */
  private async _startIosAdvertising(deviceId: string): Promise<void> {
    if (typeof blePeripheral === 'undefined') {
      console.warn('[DeviceMode] blePeripheral plugin not available on iOS');
      return;
    }

    // Listen for writes from central (host device)
    // iOS CoreBluetooth may return UUIDs in short form ("FFF0") or long form ("0000fff0-...")
    blePeripheral.onWriteRequest((json: any) => {
      const svc = (json.service || '').toLowerCase();
      const chr = (json.characteristic || '').toLowerCase();
      const svcMatch = svc === BLE_SERVICE_UUID || svc === 'fff0';
      const chrMatch = chr === BLE_RX_CHAR_UUID || chr === 'fff2';
      if (svcMatch && chrMatch) {
        const buffer = json.value as ArrayBuffer;
        const text = new TextDecoder().decode(buffer);
        this._dispatchMessage(text);
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
    // iOS CBPeripheralManager correctly sets CBAdvertisementDataLocalNameKey
    await blePeripheral.startAdvertising(BLE_SERVICE_UUID, deviceId);
  }

  public async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising) return;
    try {
      if (typeof blePeripheral !== 'undefined') {
        await blePeripheral.stopAdvertising();
      }
      this.isAdvertising = false;
    } catch (e) {
      console.warn('[DeviceMode] Failed to stop advertising:', e);
      this.isAdvertising = false;
    }
  }

  /**
   * Send data from peripheral (device/phone) back to the central (host).
   * Uses NOTIFY on the TX characteristic.
   */
  public async notifyCentral(message: string): Promise<void> {
    if (!this.isAdvertising) return;

    try {
      if (typeof blePeripheral !== 'undefined') {
        const buffer = new TextEncoder().encode(message).buffer;
        await blePeripheral.setCharacteristicValue(BLE_SERVICE_UUID, BLE_TX_CHAR_UUID, buffer);
      }
    } catch (e) {
      console.error('[DeviceMode] Failed to notify central:', e);
    }
  }
}

export const deviceModeBle = new DeviceModeBleManager();
