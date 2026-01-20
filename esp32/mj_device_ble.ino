#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

static const char* DEVICE_NAME = "MJ-E";
static const char* SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
static const char* TX_CHAR_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";
static const char* RX_CHAR_UUID = "0000fff2-0000-1000-8000-00805f9b34fb";

struct CentralState {
  String mode;
  String round;
  int gameNumber;
  int scoreEast;
  int scoreSouth;
  int scoreWest;
  int scoreNorth;
};

BLEServer* bleServer = nullptr;
BLECharacteristic* txChar = nullptr;
BLECharacteristic* rxChar = nullptr;
bool deviceConnected = false;
CentralState centralState;

void handleStateMessage(const String& msg) {
  if (!msg.startsWith("STATE:")) {
    return;
  }
  int start = 6;
  String parts[7];
  int index = 0;
  int pos = start;
  while (pos >= 0 && index < 7) {
    int next = msg.indexOf(':', pos);
    if (next == -1) {
      parts[index++] = msg.substring(pos);
      break;
    } else {
      parts[index++] = msg.substring(pos, next);
      pos = next + 1;
    }
  }
  if (index < 7) {
    return;
  }
  centralState.mode = parts[0];
  centralState.round = parts[1];
  centralState.gameNumber = parts[2].toInt();
  centralState.scoreEast = parts[3].toInt();
  centralState.scoreSouth = parts[4].toInt();
  centralState.scoreWest = parts[5].toInt();
  centralState.scoreNorth = parts[6].toInt();
}

void handleCentralMessage(const std::string& value) {
  if (value.empty()) {
    return;
  }
  String msg = String(value.c_str());
  msg.trim();
  if (msg.length() == 0) {
    return;
  }
  handleStateMessage(msg);
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) override {
    deviceConnected = true;
  }

  void onDisconnect(BLEServer* server) override {
    deviceConnected = false;
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    std::string value = characteristic->getValue();
    handleCentralMessage(value);
  }
};

void sendText(const String& payload) {
  if (!deviceConnected || txChar == nullptr) {
    return;
  }
  std::string value = std::string(payload.c_str());
  txChar->setValue(value);
  txChar->notify();
}

void sendHuang() {
  sendText("BTN:HUANG");
}

void sendConfirm() {
  sendText("BTN:CONFIRM");
}

void sendHeZimo(int baseScore) {
  String payload = "HE:ZIMO:";
  payload += String(baseScore);
  sendText(payload);
}

void sendHeRon(const String& relative, int baseScore) {
  String payload = "HE:RON:";
  payload += relative;
  payload += ":";
  payload += String(baseScore);
  sendText(payload);
}

void setupBle() {
  BLEDevice::init(DEVICE_NAME);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  BLEService* service = bleServer->createService(SERVICE_UUID);

  txChar = service->createCharacteristic(
    TX_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  txChar->addDescriptor(new BLE2902());

  rxChar = service->createCharacteristic(
    RX_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  rxChar->setCallbacks(new RxCallbacks());

  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
}

void setup() {
  Serial.begin(115200);
  centralState.mode = "IDLE";
  centralState.round = "";
  centralState.gameNumber = 0;
  centralState.scoreEast = 0;
  centralState.scoreSouth = 0;
  centralState.scoreWest = 0;
  centralState.scoreNorth = 0;
  setupBle();
}

void loop() {
  delay(10);
}

