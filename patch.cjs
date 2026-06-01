const fs = require('fs');
const path = require('path');
const p = path.resolve('node_modules/cordova-plugin-ble-peripheral/src/android/BLEPeripheralPlugin.java');
let code = fs.readFileSync(p, 'utf8');

// Replace startAdvertising with a try/catch
code = code.replace(
  /bluetoothLeAdvertiser\.startAdvertising\(advertiseSettings, advertisementData, advertiseCallback\);\s*advertisingStartedCallback = callbackContext;/g,
  `try {
                bluetoothLeAdvertiser.startAdvertising(advertiseSettings, advertisementData, advertiseCallback);
                advertisingStartedCallback = callbackContext;
            } catch (SecurityException e) {
                LOG.e(TAG, "SecurityException: Missing Bluetooth Advertise permission", e);
                callbackContext.error("Missing Bluetooth Advertise permission");
            } catch (Exception e) {
                LOG.e(TAG, "Exception starting advertising", e);
                callbackContext.error("Failed to start advertising");
            }`
);

fs.writeFileSync(p, code);
