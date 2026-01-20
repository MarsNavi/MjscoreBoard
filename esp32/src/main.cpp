#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include "LGFX_SC01Plus.hpp"

// --- Configuration ---
static const char* SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
static const char* TX_CHAR_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";
static const char* RX_CHAR_UUID = "0000fff2-0000-1000-8000-00805f9b34fb";

// --- Global Objects ---
LGFX tft;
BLEServer* bleServer = nullptr;
BLECharacteristic* txChar = nullptr;
BLECharacteristic* rxChar = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// --- State ---
enum AppMode {
  MODE_SELECT_POS,
  MODE_ADVERTISING,
  MODE_WAITING_GAME,
  MODE_GAME_PLAY,
  MODE_GAME_CONFIRM
};

struct GameState {
  String mode; // PLAY, CONFIRM, IDLE
  String round; // e.g., "east"
  int gameNumber; // 1-16
  int scores[4]; // 0:East, 1:South, 2:West, 3:North
};

AppMode currentMode = MODE_SELECT_POS;
GameState gameState;
int myPositionIndex = -1; // 0:East, 1:South, 2:West, 3:North
String myPositionName = ""; // "MJ-E", "MJ-S", ...
bool needRedraw = true;

// --- Buttons ---
struct Button {
  int x, y, w, h;
  String label;
  uint16_t color;
  bool pressed;
  
  bool contains(int tx, int ty) {
    return tx >= x && tx < x + w && ty >= y && ty < y + h;
  }
  
  void draw(LGFX* gfx) {
    gfx->fillRoundRect(x, y, w, h, 8, pressed ? TFT_DARKGREY : color);
    gfx->drawRoundRect(x, y, w, h, 8, TFT_WHITE);
    gfx->setTextColor(TFT_WHITE);
    gfx->setTextDatum(middle_center);
    gfx->drawString(label, x + w / 2, y + h / 2);
  }
};

// --- Function Prototypes ---
void setupBle(String deviceName);
void sendText(String payload);
void drawSelectPos();
void drawAdvertising();
void drawGame();
void handleTouch();

// --- BLE Callbacks ---
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
    String msg = String(value.c_str());
    msg.trim();
    if (msg.startsWith("STATE:")) {
      // Parse: STATE:MODE:ROUND:GAME:E:S:W:N
      // e.g., STATE:PLAY:east:1:0:0:0:0
      int parts[8]; // indices
      int pCount = 0;
      int lastIdx = 6;
      for (int i = 0; i < 7; i++) {
        int nextIdx = msg.indexOf(':', lastIdx);
        if (nextIdx == -1) nextIdx = msg.length();
        String part = msg.substring(lastIdx, nextIdx);
        
        if (i == 0) gameState.mode = part;
        else if (i == 1) gameState.round = part;
        else if (i == 2) gameState.gameNumber = part.toInt();
        else if (i >= 3 && i <= 6) gameState.scores[i - 3] = part.toInt();
        
        lastIdx = nextIdx + 1;
      }
      
      if (gameState.mode == "CONFIRM") {
        currentMode = MODE_GAME_CONFIRM;
      } else if (gameState.mode == "IDLE") {
        currentMode = MODE_WAITING_GAME;
      } else {
        currentMode = MODE_GAME_PLAY;
      }
      needRedraw = true;
    } else if (msg.startsWith("SETUP:")) {
      String pos = msg.substring(6);
      pos.trim();
      if (pos == "EAST") myPositionIndex = 0;
      else if (pos == "SOUTH") myPositionIndex = 1;
      else if (pos == "WEST") myPositionIndex = 2;
      else if (pos == "NORTH") myPositionIndex = 3;
      needRedraw = true;
    }
  }
};

// --- Setup ---
void setup() {
  Serial.begin(115200);
  
  // Init Display
  tft.init();
  tft.setRotation(1); // Landscape
  tft.setBrightness(128);
  tft.fillScreen(TFT_BLACK);
  tft.setTextSize(2);
  
  // Init State
  gameState.mode = "IDLE";
  for(int i=0; i<4; i++) gameState.scores[i] = 0;

  // Start BLE immediately
  setupBle("MJ-SCOREBOARD");
  currentMode = MODE_ADVERTISING;
}

// --- Loop ---
void loop() {
  // Connection handling
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // Give stack time
    tft.fillScreen(TFT_BLACK);
    tft.setCursor(10, 10);
    tft.print("Disconnected");
    bleServer->startAdvertising(); // Restart advertising
    oldDeviceConnected = deviceConnected;
    currentMode = MODE_ADVERTISING;
    needRedraw = true;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    currentMode = MODE_WAITING_GAME;
    needRedraw = true;
  }

  // Touch handling
  handleTouch();

  // Drawing
  if (needRedraw) {
    switch (currentMode) {
      case MODE_SELECT_POS: drawSelectPos(); break;
      case MODE_ADVERTISING: drawAdvertising(); break;
      case MODE_WAITING_GAME: 
        tft.fillScreen(TFT_BLACK);
        tft.setTextDatum(middle_center);
        tft.setTextColor(TFT_GREEN);
        tft.drawString("Connected!", tft.width()/2, tft.height()/2 - 20);
        tft.setTextColor(TFT_WHITE);
        tft.drawString("Waiting for game data...", tft.width()/2, tft.height()/2 + 20);
        break;
      case MODE_GAME_PLAY:
      case MODE_GAME_CONFIRM:
        drawGame(); 
        break;
    }
    needRedraw = false;
  }
  
  delay(20);
}

// --- Logic Implementations ---

void setupBle(String deviceName) {
  BLEDevice::init(deviceName.c_str());
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
  
  BLEService* service = bleServer->createService(SERVICE_UUID);
  
  txChar = service->createCharacteristic(TX_CHAR_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());
  
  rxChar = service->createCharacteristic(RX_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rxChar->setCallbacks(new RxCallbacks());
  
  service->start();
  
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
}

void sendText(String payload) {
  if (deviceConnected && txChar) {
    txChar->setValue((uint8_t*)payload.c_str(), payload.length());
    txChar->notify();
  }
}

// UI Elements
Button btnEast = {20, 60, 130, 80, "EAST", TFT_RED, false};
Button btnSouth = {170, 60, 130, 80, "SOUTH", TFT_GREEN, false};
Button btnWest = {20, 160, 130, 80, "WEST", TFT_BLUE, false};
Button btnNorth = {170, 160, 130, 80, "NORTH", TFT_YELLOW, false};

// Game Buttons
Button btnZimo = {20, 240, 80, 60, "ZIMO", TFT_RED, false};
Button btnRon = {120, 240, 80, 60, "RON", TFT_ORANGE, false};
Button btnHuang = {220, 240, 80, 60, "HUANG", TFT_DARKGREY, false};
Button btnConfirm = {320, 240, 140, 60, "CONFIRM", TFT_GREEN, false};

void drawSelectPos() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextDatum(top_center);
  tft.setTextColor(TFT_WHITE);
  tft.drawString("Select Device Position", tft.width()/2, 10);
  
  btnEast.draw(&tft);
  btnSouth.draw(&tft);
  btnWest.draw(&tft);
  btnNorth.draw(&tft);
}

void drawAdvertising() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextDatum(middle_center);
  tft.setTextColor(TFT_CYAN);
  tft.drawString("Waiting for Connection", tft.width()/2, tft.height()/2);
}

void drawGame() {
  tft.fillScreen(TFT_BLACK);
  
  // Draw Scores
  // Layout: 
  //   Top: Opposite
  //   Left: Left
  //   Right: Right
  //   Bottom: Self
  
  int self = myPositionIndex;
  int right = (self + 1) % 4;
  int opp = (self + 2) % 4;
  int left = (self + 3) % 4;
  
  // Center Info
  tft.setTextDatum(middle_center);
  tft.setTextColor(TFT_WHITE);
  tft.drawString("Game " + String(gameState.gameNumber), tft.width()/2, 100);
  
  // Draw Players
  auto drawPlayer = [&](int posIdx, int x, int y) {
    String names[] = {"E", "S", "W", "N"};
    uint16_t color = (posIdx == self) ? TFT_GREEN : TFT_WHITE;
    tft.setTextColor(color);
    tft.drawString(names[posIdx], x, y - 20);
    tft.drawString(String(gameState.scores[posIdx]), x, y + 10);
  };
  
  drawPlayer(opp, tft.width()/2, 40);   // Top
  drawPlayer(left, 60, 100);            // Left
  drawPlayer(right, tft.width()-60, 100); // Right
  drawPlayer(self, tft.width()/2, 180); // Bottom
  
  // Buttons
  if (currentMode == MODE_GAME_CONFIRM) {
    btnConfirm.color = TFT_GREEN;
    btnConfirm.draw(&tft);
  } else {
    btnZimo.draw(&tft);
    btnRon.draw(&tft);
    btnHuang.draw(&tft);
    // Gray out confirm
    btnConfirm.color = TFT_DARKGREY;
    btnConfirm.draw(&tft);
  }
}

void handleTouch() {
  int32_t x, y;
  if (tft.getTouch(&x, &y)) {
    if (currentMode == MODE_SELECT_POS) {
      if (btnEast.contains(x, y)) { myPositionIndex = 0; myPositionName = "MJ-E"; }
      else if (btnSouth.contains(x, y)) { myPositionIndex = 1; myPositionName = "MJ-S"; }
      else if (btnWest.contains(x, y)) { myPositionIndex = 2; myPositionName = "MJ-W"; }
      else if (btnNorth.contains(x, y)) { myPositionIndex = 3; myPositionName = "MJ-N"; }
      
      if (myPositionIndex != -1) {
        setupBle(myPositionName);
        currentMode = MODE_ADVERTISING;
        needRedraw = true;
        delay(200); // Debounce
      }
    }
    else if (currentMode == MODE_GAME_PLAY) {
      if (btnZimo.contains(x, y)) {
        sendText("HE:ZIMO:8");
        delay(200);
      }
      else if (btnRon.contains(x, y)) {
        // Simplified: Just send RON LEFT 8 for demo
        // In real app, show dialog to pick who fired
        sendText("HE:RON:LEFT:8"); 
        delay(200);
      }
      else if (btnHuang.contains(x, y)) {
        sendText("BTN:HUANG");
        delay(200);
      }
    }
    else if (currentMode == MODE_GAME_CONFIRM) {
      if (btnConfirm.contains(x, y)) {
        sendText("BTN:CONFIRM");
        delay(200);
      }
    }
  }
}
