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
  MODE_CONNECTING,
  MODE_WAITING_SETUP,
  MODE_WAITING_GAME,
  MODE_GAME_PLAY,
  MODE_GAME_CONFIRM
};

struct GameState {
  String mode; // PLAY, CONFIRM, IDLE
  String round; // e.g., "east"
  int gameNumber; // 1-16
  int scores[4]; // 0:East, 1:South, 2:West, 3:North
  int prevScores[4];
};

AppMode currentMode = MODE_CONNECTING;
GameState gameState;
int myPositionIndex = -1; // 0:East, 1:South, 2:West, 3:North
bool needRedraw = true;

// Feature Flags & Local State
bool diffMode = false;       // "差" mode
bool inHuMenu = false;       // "和" menu open
int huBaseScore = 8;         // Base score for Hu
int huLoserRelPos = -1;      // -1: None, 0: Left, 1: Opposite, 2: Right, 3: Zimo (Self)

// --- Buttons Helper ---
struct Button {
  int x, y, w, h;
  String label;
  uint16_t bgColor;
  uint16_t textColor;
  bool visible;
  
  bool contains(int tx, int ty) {
    return visible && tx >= x && tx < x + w && ty >= y && ty < y + h;
  }
  
  void draw(LGFX* gfx, bool active = false) {
    if (!visible) return;
    // Draw shadow/border
    uint16_t fill = active ? TFT_WHITE : bgColor;
    uint16_t text = active ? TFT_BLACK : textColor;
    
    // 绘制圆角矩形背景
    gfx->fillRoundRect(x, y, w, h, 10, fill);
    gfx->drawRoundRect(x, y, w, h, 10, TFT_WHITE);
    
    // 绘制文字
    gfx->setTextColor(text);
    gfx->setTextDatum(middle_center);
    // 自动调整字号：如果文字较长，缩小字号
    if (label.length() > 6) gfx->setTextSize(1);
    else gfx->setTextSize(1.5); // 使用稍大的字体
    
    gfx->drawString(label, x + w / 2, y + h / 2);
  }
};

// --- Function Prototypes ---
void setupBle();
void sendText(String payload);
void drawConnecting();
void drawWaitingSetup();
void drawWaitingGame();
void drawGame();
void drawHuMenu();
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
      int parts[8]; 
      int lastIdx = 6;
      String newModeStr = "";
      
      for (int i = 0; i < 7; i++) {
        int nextIdx = msg.indexOf(':', lastIdx);
        if (nextIdx == -1) nextIdx = msg.length();
        String part = msg.substring(lastIdx, nextIdx);
        
        if (i == 0) newModeStr = part;
        else if (i == 1) gameState.round = part;
        else if (i == 2) gameState.gameNumber = part.toInt();
        else if (i >= 3 && i <= 6) {
          gameState.prevScores[i - 3] = gameState.scores[i - 3];
          gameState.scores[i - 3] = part.toInt();
        }
        lastIdx = nextIdx + 1;
      }
      
      gameState.mode = newModeStr;

      if (myPositionIndex != -1) {
        if (gameState.mode == "CONFIRM") {
          currentMode = MODE_GAME_CONFIRM;
          inHuMenu = false; // Force close menu on state change
        } else if (gameState.mode == "IDLE") {
          currentMode = MODE_WAITING_GAME;
          inHuMenu = false;
        } else {
          currentMode = MODE_GAME_PLAY;
        }
      }
      needRedraw = true;
      
    } else if (msg.startsWith("SETUP:")) {
      String pos = msg.substring(6);
      pos.trim();
      if (pos == "EAST") myPositionIndex = 0;
      else if (pos == "SOUTH") myPositionIndex = 1;
      else if (pos == "WEST") myPositionIndex = 2;
      else if (pos == "NORTH") myPositionIndex = 3;
      
      currentMode = MODE_WAITING_GAME;
      needRedraw = true;
    }
  }
};

// --- Setup ---
void setup() {
  Serial.begin(115200);
  tft.init();
  tft.setRotation(1); 
  tft.setBrightness(200); // 提高亮度
  tft.fillScreen(TFT_BLACK);
  
  // 设置中文字体
  // 注意：需要确保 LovyanGFX 库已启用中文字体支持
  // 如果无法显示中文，请检查平台配置或使用 print 替代
  tft.setFont(&fonts::efontCN_24); 
  tft.setTextSize(1);
  
  gameState.mode = "IDLE";
  setupBle();
}

// --- Loop ---
void loop() {
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    tft.fillScreen(TFT_BLACK);
    bleServer->startAdvertising(); 
    oldDeviceConnected = deviceConnected;
    currentMode = MODE_CONNECTING;
    myPositionIndex = -1;
    needRedraw = true;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    currentMode = MODE_WAITING_SETUP;
    needRedraw = true;
  }

  handleTouch();

  if (needRedraw) {
    switch (currentMode) {
      case MODE_CONNECTING: drawConnecting(); break;
      case MODE_WAITING_SETUP: drawWaitingSetup(); break;
      case MODE_WAITING_GAME: drawWaitingGame(); break;
      case MODE_GAME_PLAY:
      case MODE_GAME_CONFIRM:
        if (inHuMenu) drawHuMenu();
        else drawGame(); 
        break;
    }
    needRedraw = false;
  }
  delay(20);
}

// --- Logic ---
void setupBle() {
  uint64_t chipid = ESP.getEfuseMac();
  String devName = "MJ-BOARD-" + String((uint32_t)chipid, HEX);
  
  BLEDevice::init(devName.c_str());
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

// --- Drawing ---
void drawConnecting() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextDatum(middle_center);
  tft.setTextColor(TFT_CYAN);
  tft.setTextSize(1.5); // 基于 24px 字体放大
  tft.drawString("麻将计分板", tft.width()/2, tft.height()/2 - 50);
  
  tft.setTextSize(1);
  tft.setTextColor(TFT_WHITE);
  tft.drawString("正在等待蓝牙连接...", tft.width()/2, tft.height()/2 + 20);
  
  uint64_t chipid = ESP.getEfuseMac();
  String devName = "设备ID: " + String((uint32_t)chipid, HEX);
  tft.setTextColor(TFT_DARKGREY);
  tft.drawString(devName, tft.width()/2, tft.height() - 30);
}

void drawWaitingSetup() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextDatum(middle_center);
  tft.setTextSize(1.5);
  tft.setTextColor(TFT_GREEN);
  tft.drawString("蓝牙已连接!", tft.width()/2, tft.height()/2 - 20);
  
  tft.setTextSize(1);
  tft.setTextColor(TFT_WHITE);
  tft.drawString("等待中控分配位置...", tft.width()/2, tft.height()/2 + 40);
}

void drawWaitingGame() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextDatum(middle_center);
  tft.setTextSize(3); // 大字体显示方位
  
  String posName = "未知";
  uint16_t posColor = TFT_WHITE;
  if (myPositionIndex == 0) { posName = "东"; posColor = TFT_RED; }
  else if (myPositionIndex == 1) { posName = "南"; posColor = TFT_GREEN; }
  else if (myPositionIndex == 2) { posName = "西"; posColor = TFT_BLUE; }
  else if (myPositionIndex == 3) { posName = "北"; posColor = TFT_YELLOW; }
  
  tft.setTextColor(posColor);
  tft.drawString(posName, tft.width()/2, tft.height()/2 - 40);
  
  tft.setTextSize(1);
  tft.setTextColor(TFT_WHITE);
  tft.drawString("等待开局...", tft.width()/2, tft.height()/2 + 40);
}

// --- Game UI Buttons ---
// Screen: 480 x 320
// 调整按钮布局以适应中文和更好的触摸体验
Button btnHuang = {20, 230, 80, 70, "荒", TFT_ORANGE, TFT_BLACK, true};
Button btnHu = {120, 220, 120, 80, "胡", TFT_RED, TFT_WHITE, true};
Button btnDiff = {260, 230, 80, 70, "分差", TFT_BLUE, TFT_WHITE, true};
Button btnConfirm = {350, 230, 110, 70, "确认", TFT_GREEN, TFT_BLACK, true};

void drawGame() {
  tft.fillScreen(TFT_BLACK);
  
  int w = tft.width();
  
  // 1. Info Header
  tft.setTextDatum(top_center);
  tft.setTextSize(1);
  tft.setTextColor(TFT_LIGHTGREY);
  
  String roundName = gameState.round;
  if (gameState.round == "east") roundName = "东风圈";
  else if (gameState.round == "south") roundName = "南风圈";
  else if (gameState.round == "west") roundName = "西风圈";
  else if (gameState.round == "north") roundName = "北风圈";
  
  String info = roundName + "  第 " + String(gameState.gameNumber) + " 局";
  tft.drawString(info, w/2, 10);
  
  // 2. Layout Logic (Cross layout)
  int self = myPositionIndex;
  int right = (self + 1) % 4;
  int opp = (self + 2) % 4;
  int left = (self + 3) % 4;
  
  auto drawPlayer = [&](int posIdx, int cx, int cy, String relName) {
    uint16_t color = (posIdx == self) ? TFT_GREEN : TFT_WHITE;
    
    // Draw Name (Relative Position)
    tft.setTextDatum(bottom_center);
    tft.setTextSize(1);
    tft.setTextColor(color);
    tft.drawString(relName, cx, cy - 25);
    
    // Calculate Score to display
    int displayScore = gameState.scores[posIdx];
    uint16_t scoreColor = TFT_WHITE;
    
    if (diffMode) {
      if (posIdx == self) {
        displayScore = 0;
        scoreColor = TFT_LIGHTGREY;
      } else {
        displayScore = gameState.scores[posIdx] - gameState.scores[self];
        if (displayScore > 0) scoreColor = TFT_RED;
        else if (displayScore < 0) scoreColor = TFT_GREEN;
      }
    } else {
      // Normal mode: highlight score changes if we had animation, but for now static
      // If negative, use green, positive red? No, absolute score is usually white or by player color
      if (displayScore < 0) scoreColor = TFT_GREEN; // Debt?
    }
    
    // Draw Score
    tft.setTextDatum(top_center);
    tft.setTextSize(2); // Score uses larger font
    tft.setTextColor(scoreColor);
    
    String scoreStr = String(displayScore);
    if (diffMode && displayScore > 0) scoreStr = "+" + scoreStr;
    
    tft.drawString(scoreStr, cx, cy);
  };
  
  // Layout positions
  // Top (Opposite)
  drawPlayer(opp, w/2, 60, "对家");
  // Left
  drawPlayer(left, 80, 140, "上家");
  // Right
  drawPlayer(right, w-80, 140, "下家");
  // Bottom (Self)
  drawPlayer(self, w/2, 180, "本家");
  
  // 3. Buttons
  if (currentMode == MODE_GAME_CONFIRM) {
    btnConfirm.visible = true;
    btnConfirm.draw(&tft);
    btnHuang.visible = false;
    btnHu.visible = false;
    btnDiff.visible = true; // Allow diff check during confirm
    btnDiff.draw(&tft, diffMode);
  } else {
    btnConfirm.visible = false;
    btnHuang.visible = true;
    btnHu.visible = true;
    btnDiff.visible = true;
    
    btnHuang.draw(&tft);
    btnHu.draw(&tft);
    btnDiff.draw(&tft, diffMode);
  }
}

// --- Hu Menu UI ---
// Buttons for Hu Menu
Button btnHuLeft = {20, 60, 100, 60, "上家", TFT_DARKGREY, TFT_WHITE, true};
Button btnHuOpp = {130, 60, 100, 60, "对家", TFT_DARKGREY, TFT_WHITE, true};
Button btnHuRight = {240, 60, 100, 60, "下家", TFT_DARKGREY, TFT_WHITE, true};
Button btnHuZimo = {350, 60, 100, 60, "自摸", TFT_DARKGREY, TFT_WHITE, true};

Button btnScoreM5 = {20, 150, 60, 60, "-5", TFT_BLUE, TFT_WHITE, true};
Button btnScoreM1 = {90, 150, 60, 60, "-1", TFT_BLUE, TFT_WHITE, true};
// Score Display in middle: 160, 140, 80, 50
Button btnScoreP1 = {250, 150, 60, 60, "+1", TFT_RED, TFT_WHITE, true};
Button btnScoreP5 = {320, 150, 60, 60, "+5", TFT_RED, TFT_WHITE, true};

Button btnHuCancel = {20, 240, 120, 60, "取消", TFT_LIGHTGREY, TFT_BLACK, true};
Button btnHuSubmit = {300, 240, 160, 60, "提交", TFT_GREEN, TFT_BLACK, true};

void drawHuMenu() {
  // Overlay background
  tft.fillScreen(TFT_BLACK); 
  tft.drawRect(0, 0, 480, 320, TFT_RED); // Red border
  
  tft.setTextDatum(top_center);
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(1.5);
  tft.drawString("请选择胡牌详情", 240, 15);
  
  // 1. Loser Selection
  // Highlight selected
  btnHuLeft.draw(&tft, huLoserRelPos == 0);
  btnHuOpp.draw(&tft, huLoserRelPos == 1);
  btnHuRight.draw(&tft, huLoserRelPos == 2);
  btnHuZimo.draw(&tft, huLoserRelPos == 3);
  
  // 2. Base Score
  btnScoreM5.draw(&tft);
  btnScoreM1.draw(&tft);
  
  // Score Value
  tft.setTextDatum(middle_center);
  tft.setTextColor(TFT_YELLOW);
  tft.setTextSize(2.5);
  tft.drawString(String(huBaseScore), 200, 180);
  
  btnScoreP1.draw(&tft);
  btnScoreP5.draw(&tft);
  
  // 3. Actions
  btnHuCancel.draw(&tft);
  btnHuSubmit.draw(&tft);
}

void handleTouch() {
  int32_t x, y;
  if (!tft.getTouch(&x, &y)) return;
  
  if (inHuMenu) {
    if (btnHuLeft.contains(x, y)) { huLoserRelPos = 0; needRedraw = true; }
    else if (btnHuOpp.contains(x, y)) { huLoserRelPos = 1; needRedraw = true; }
    else if (btnHuRight.contains(x, y)) { huLoserRelPos = 2; needRedraw = true; }
    else if (btnHuZimo.contains(x, y)) { huLoserRelPos = 3; needRedraw = true; }
    
    else if (btnScoreM5.contains(x, y)) { huBaseScore = max(1, huBaseScore - 5); needRedraw = true; }
    else if (btnScoreM1.contains(x, y)) { huBaseScore = max(1, huBaseScore - 1); needRedraw = true; }
    else if (btnScoreP1.contains(x, y)) { huBaseScore += 1; needRedraw = true; }
    else if (btnScoreP5.contains(x, y)) { huBaseScore += 5; needRedraw = true; }
    
    else if (btnHuCancel.contains(x, y)) {
      inHuMenu = false;
      needRedraw = true;
    }
    else if (btnHuSubmit.contains(x, y)) {
      if (huLoserRelPos == -1) return; // Must select target
      
      String cmd = "";
      if (huLoserRelPos == 3) { // Zimo
        cmd = "HE:ZIMO:" + String(huBaseScore);
      } else { // Ron
        String rel = "";
        if (huLoserRelPos == 0) rel = "LEFT";
        if (huLoserRelPos == 1) rel = "OPPOSITE";
        if (huLoserRelPos == 2) rel = "RIGHT";
        cmd = "HE:RON:" + rel + ":" + String(huBaseScore);
      }
      sendText(cmd);
      inHuMenu = false;
      needRedraw = true;
    }
    delay(200); // Debounce
    return;
  }

  // Main Game Screen Touches
  if (currentMode == MODE_GAME_PLAY) {
    if (btnHu.contains(x, y)) {
      inHuMenu = true;
      huBaseScore = 8;
      huLoserRelPos = -1;
      needRedraw = true;
      delay(200);
    }
    else if (btnHuang.contains(x, y)) {
      sendText("BTN:HUANG");
      delay(200);
    }
    else if (btnDiff.contains(x, y)) {
      diffMode = !diffMode;
      needRedraw = true;
      delay(200);
    }
  }
  else if (currentMode == MODE_GAME_CONFIRM) {
    if (btnConfirm.contains(x, y)) {
      sendText("BTN:CONFIRM");
      delay(200);
    }
    else if (btnDiff.contains(x, y)) {
      diffMode = !diffMode;
      needRedraw = true;
      delay(200);
    }
  }
}
