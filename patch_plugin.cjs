const fs = require('fs');
const path = require('path');
const p = path.resolve('node_modules/cordova-plugin-ble-peripheral/src/android/BLEPeripheralPlugin.java');
let code = fs.readFileSync(p, 'utf8');

// 1. Patch openGattServer with try/catch
code = code.replace(
  /gattServer = bluetoothManager\.openGattServer\(cordova\.getContext\(\), gattServerCallback\);/g,
  `try {
                gattServer = bluetoothManager.openGattServer(cordova.getContext(), gattServerCallback);
            } catch (SecurityException e) {
                LOG.e(TAG, "SecurityException: Missing Bluetooth Connect permission", e);
                callbackContext.error("Missing Bluetooth Connect permission");
                return false;
            }`
);

// 2. Clear existing service before adding a new one in createServiceFromJSON
code = code.replace(
  /UUID serviceUUID = uuidFromString\(json\.getString\("uuid"\)\);/g,
  `UUID serviceUUID = uuidFromString(json.getString("uuid"));
                BluetoothGattService existingService = services.get(serviceUUID);
                if (existingService != null && gattServer != null) {
                    gattServer.removeService(existingService);
                    services.remove(serviceUUID);
                }`
);

fs.writeFileSync(p, code);
