#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include "LGFX_SC01Plus.hpp"
#include <lvgl.h>

LV_FONT_DECLARE(lv_font_sh_bold_40);
LV_FONT_DECLARE(lv_font_wqy_20);

// --- Colors (Tailwind Match) ---
#define C_SLATE_950 lv_color_hex(0x000000)
#define C_SLATE_900 lv_color_hex(0x000000)
#define C_SLATE_800 lv_color_hex(0x1E293B)
#define C_SLATE_700 lv_color_hex(0x334155)
#define C_SLATE_600 lv_color_hex(0x475569)
#define C_SLATE_500 lv_color_hex(0x64748B)
#define C_SLATE_400 lv_color_hex(0x94A3B8)
#define C_SLATE_300 lv_color_hex(0xCBD5E1)
#define C_SLATE_200 lv_color_hex(0xE2E8F0)
#define C_SLATE_100 lv_color_hex(0xF1F5F9)

#define C_EMERALD_600 lv_color_hex(0x059669)
#define C_EMERALD_500 lv_color_hex(0x10B981)
#define C_EMERALD_400 lv_color_hex(0x34D399)

#define C_RED_500 lv_color_hex(0xEF4444)
#define C_GREEN_500 lv_color_hex(0x22C55E)
#define C_AMBER_500 lv_color_hex(0xF59E0B)
#define C_AMBER_300 lv_color_hex(0xFCD34D)
#define C_SKY_500 lv_color_hex(0x0EA5E9)

// --- Configuration ---
static const char* SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
static const char* TX_CHAR_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";
static const char* RX_CHAR_UUID = "0000fff2-0000-1000-8000-00805f9b34fb";

#include <vector>

// --- Global Objects ---
LGFX tft;
BLEServer* bleServer = nullptr;
BLECharacteristic* txChar = nullptr;
BLECharacteristic* rxChar = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;
std::vector<String> commandQueue;
bool hasNewCommand = false;
SemaphoreHandle_t queueMutex = NULL;
String deviceName = "";

enum AppLanguage { LANG_ZH, LANG_EN, LANG_JA };
AppLanguage currentLang = LANG_ZH;

const char* t(const char* key) {
    if (strcmp(key, "WAITING_HOST") == 0) {
        if (currentLang == LANG_EN) return "Waiting for host...";
        if (currentLang == LANG_JA) return "ホスト接続待ち...";
        return "等待主机连接...";
    }
    if (strcmp(key, "BLUETOOTH_CONN") == 0) {
        if (currentLang == LANG_EN) return "Bluetooth Connected";
        if (currentLang == LANG_JA) return "Bluetooth接続済み";
        return "蓝牙已连接";
    }
    if (strcmp(key, "WAITING_START") == 0) {
        if (currentLang == LANG_EN) return "Waiting to start...";
        if (currentLang == LANG_JA) return "対局開始待ち...";
        return "等待开局...";
    }
    if (strcmp(key, "MAHJONG_BOARD") == 0) {
        if (currentLang == LANG_EN) return "Mahjong Scoreboard";
        if (currentLang == LANG_JA) return "麻雀スコアボード";
        return "麻将计分板";
    }
    if (strcmp(key, "WIN") == 0) {
        if (currentLang == LANG_EN) return "Win";
        if (currentLang == LANG_JA) return "和了";
        return "和";
    }
    if (strcmp(key, "GAMEOVER") == 0) {
        if (currentLang == LANG_EN) return "Game\nOver";
        if (currentLang == LANG_JA) return "対局\n終了";
        return "比赛\n结束";
    }
    if (strcmp(key, "DRAW") == 0) {
        if (currentLang == LANG_EN) return "Draw";
        if (currentLang == LANG_JA) return "流局";
        return "荒";
    }
    if (strcmp(key, "DIFF") == 0) {
        if (currentLang == LANG_EN) return "Diff";
        if (currentLang == LANG_JA) return "差";
        return "差";
    }
    if (strcmp(key, "TSUMO") == 0) {
        if (currentLang == LANG_EN) return "Tsumo";
        if (currentLang == LANG_JA) return "ツモ";
        return "自摸";
    }
    if (strcmp(key, "NOT_ALLOCATED") == 0) {
        if (currentLang == LANG_EN) return "Unallocated";
        if (currentLang == LANG_JA) return "未割り当て";
        return "未分配";
    }
    if (strcmp(key, "CONFIRMED") == 0) {
        if (currentLang == LANG_EN) return "Confirmed";
        if (currentLang == LANG_JA) return "確認済み";
        return "已确认";
    }
    if (strcmp(key, "CONFIRM_SCORE") == 0) {
        if (currentLang == LANG_EN) return "Confirm Score";
        if (currentLang == LANG_JA) return "成績確認";
        return "确认成绩";
    }
    if (strcmp(key, "CONFIRM_CALC") == 0) {
        if (currentLang == LANG_EN) return "Confirm Calc";
        if (currentLang == LANG_JA) return "点数確認";
        return "确认计分";
    }
    if (strcmp(key, "SUBMITTING") == 0) {
        if (currentLang == LANG_EN) return "Submitting...";
        if (currentLang == LANG_JA) return "送信中...";
        return "提交中...";
    }
    if (strcmp(key, "UNSTARTED") == 0) {
        if (currentLang == LANG_EN) return "Unstarted";
        if (currentLang == LANG_JA) return "未開始";
        return "未开局";
    }
    if (strcmp(key, "WIN_TITLE_SUFFIX") == 0) {
        if (currentLang == LANG_EN) return "Wins";
        if (currentLang == LANG_JA) return "の和了";
        return "和牌";
    }
    if (strcmp(key, "DEVICE_PREFIX") == 0) {
        if (currentLang == LANG_EN) return "Device:";
        if (currentLang == LANG_JA) return "デバイス:";
        return "设备:";
    }
    if (strcmp(key, "HU_SETTLEMENT") == 0) {
        if (currentLang == LANG_EN) return "Win Settlement";
        if (currentLang == LANG_JA) return "和了決済";
        return "和牌结算";
    }
    if (strcmp(key, "BTN_CONFIRM") == 0) {
        if (currentLang == LANG_EN) return "Confirm";
        if (currentLang == LANG_JA) return "確認";
        return "确认";
    }
    if (strcmp(key, "BTN_CANCEL") == 0) {
        if (currentLang == LANG_EN) return "Cancel";
        if (currentLang == LANG_JA) return "キャンセル";
        return "取消";
    }
    if (strcmp(key, "LEFT_DEAL") == 0) {
        if (currentLang == LANG_EN) return "Left Deal";
        if (currentLang == LANG_JA) return "上家放銃";
        return "上家点";
    }
    if (strcmp(key, "OPP_DEAL") == 0) {
        if (currentLang == LANG_EN) return "Opp Deal";
        if (currentLang == LANG_JA) return "対面放銃";
        return "对家点";
    }
    if (strcmp(key, "RIGHT_DEAL") == 0) {
        if (currentLang == LANG_EN) return "Right Deal";
        if (currentLang == LANG_JA) return "下家放銃";
        return "下家点";
    }
    if (strcmp(key, "DRAW_CONFIRM_TITLE") == 0) {
        if (currentLang == LANG_EN) return "Confirm Draw";
        if (currentLang == LANG_JA) return "流局確認";
        return "荒庄确认";
    }
    if (strcmp(key, "DRAW_CONFIRM_TEXT") == 0) {
        if (currentLang == LANG_EN) return "Record as Draw?";
        if (currentLang == LANG_JA) return "流局として記録しますか?";
        return "记录为荒庄?";
    }
    return key;
}

const char* t_wind(int windIndex) {
    if (windIndex < 0 || windIndex > 3) return "?";
    if (currentLang == LANG_EN) {
        const char* w[] = {"E", "S", "W", "N"};
        return w[windIndex];
    } else if (currentLang == LANG_JA) {
        const char* w[] = {"東", "南", "西", "北"};
        return w[windIndex];
    } else {
        const char* w[] = {"东", "南", "西", "北"};
        return w[windIndex];
    }
}

// --- Game State ---
struct GameState {
  String mode; // PLAY, CONFIRM, IDLE
  String round; // e.g., "east"
  int gameNumber; // 1-16
  int scores[4]; // 0:East, 1:South, 2:West, 3:North
  String names[4];
};

GameState gameState;
int myPositionIndex = -1; // 0:East, 1:South, 2:West, 3:North
bool diffMode = false;
int huBaseScore = 8;
int huLoserRelPos = -1; // -1:None, 0:Left, 1:Opp, 2:Right, 3:Zimo
bool isConfirmed = false;

// --- LVGL UI Objects ---
static lv_obj_t* scr_connect;
static lv_obj_t* scr_waiting;
static lv_obj_t* scr_game;
static lv_obj_t* scr_hu; // Popup style

// Game UI Elements
static lv_obj_t* lbl_game_info; // Pill in sidebar
static lv_obj_t* lbl_scores[4]; // Indices based on relative position: 0:Self, 1:Right, 2:Opp, 3:Left
static lv_obj_t* lbl_names[4];
static lv_obj_t* cont_players[4]; // 0:Self, 1:Right, 2:Opp, 3:Left
static lv_obj_t* btn_player_confirm; // Button at bottom left

static lv_obj_t* lbl_device_id; // Device ID (Top Left)

static lv_obj_t* btn_hu;
static lv_obj_t* btn_huang;
static lv_obj_t* btn_diff;
static lv_obj_t* btn_gameover;

// Hu Menu Elements
static lv_obj_t* lbl_hu_title;
static lv_obj_t* lbl_hu_score;
static lv_obj_t* btn_hu_opts[4]; // Left, Opp, Right, Zimo
static lv_obj_t* btn_hu_submit;
static lv_obj_t* lbl_hu_submit;

// --- Prototypes ---
void setupBle();
void sendText(String payload);
void init_ui();
void update_game_ui();
void show_screen(lv_obj_t* scr);
void create_connect_screen();
void create_waiting_screen();
void create_game_screen();
void create_hu_menu();
void processCommand(String cmd);

// --- Display Flushing ---
void my_disp_flush(lv_disp_drv_t *disp, const lv_area_t *area, lv_color_t *color_p) {
    uint32_t w = (area->x2 - area->x1 + 1);
    uint32_t h = (area->y2 - area->y1 + 1);

    tft.startWrite();
    tft.setAddrWindow(area->x1, area->y1, w, h);
    tft.writePixels((uint16_t *)&color_p->full, w * h);
    tft.endWrite();

    lv_disp_flush_ready(disp);
}

// --- Touch Reading ---
void my_touch_read(lv_indev_drv_t *indev_driver, lv_indev_data_t *data) {
    uint16_t touchX, touchY;
    bool touched = tft.getTouch(&touchX, &touchY);

    if (!touched) {
        data->state = LV_INDEV_STATE_REL;
    } else {
        data->state = LV_INDEV_STATE_PR;
        data->point.x = touchX;
        data->point.y = touchY;
    }
}

// --- Setup ---
void setup() {
    Serial.begin(115200);
    Serial.println("System Starting...");

    queueMutex = xSemaphoreCreateMutex();

    tft.init();
    // Manual Backlight Control (After init to override LGFX default)
    pinMode(45, OUTPUT);
    digitalWrite(45, HIGH); 

    tft.setRotation(1); // Landscape Mode
    // tft.setBrightness(255); // Handled manually above
    tft.fillScreen(TFT_BLACK);

    // LVGL Init
    lv_init();
    static lv_disp_draw_buf_t draw_buf;
    static lv_color_t buf[320 * 40]; 
    lv_disp_draw_buf_init(&draw_buf, buf, NULL, 320 * 40);

    static lv_disp_drv_t disp_drv;
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = tft.width();
    disp_drv.ver_res = tft.height();
    disp_drv.flush_cb = my_disp_flush;
    disp_drv.draw_buf = &draw_buf;
    lv_disp_drv_register(&disp_drv);

    static lv_indev_drv_t indev_drv;
    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb = my_touch_read;
    lv_indev_drv_register(&indev_drv);

    // Get Device ID early
    uint64_t chipid = ESP.getEfuseMac();
    deviceName = "MJ-BOARD-" + String((uint32_t)chipid, HEX);
    deviceName.toUpperCase();

    // Create UI
    init_ui();

    // Initial State
    gameState.mode = "IDLE";
    gameState.names[0] = "";
    gameState.names[1] = "";
    gameState.names[2] = "";
    gameState.names[3] = "";
    setupBle();
}

// --- Loop ---
void loop() {
    lv_timer_handler(); // Handle LVGL tasks

    // Process Commands in Main Loop (Safe for UI updates)
    if (hasNewCommand) {
        std::vector<String> processingQueue;
        
        if (xSemaphoreTake(queueMutex, 10)) {
            if (!commandQueue.empty()) {
                processingQueue = commandQueue;
                commandQueue.clear();
            }
            hasNewCommand = false;
            xSemaphoreGive(queueMutex);
        }

        for (const String& cmd : processingQueue) {
            processCommand(cmd);
        }
    }

    if (!deviceConnected && oldDeviceConnected) {
        delay(500);
        bleServer->startAdvertising();
        oldDeviceConnected = deviceConnected;
        myPositionIndex = -1;
        show_screen(scr_connect);
    }
    if (deviceConnected && !oldDeviceConnected) {
        oldDeviceConnected = deviceConnected;
        show_screen(scr_waiting);
    }

    delay(5);
}

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
        String fullMsg = String(value.c_str());
        
        // Handle sticky packets by splitting by newline
        int start = 0;
        while (start < fullMsg.length()) {
            int end = fullMsg.indexOf('\n', start);
            if (end == -1) end = fullMsg.length();
            
            String line = fullMsg.substring(start, end);
            line.trim();
            if (line.length() > 0) {
                // Push to queue thread-safely
                if (queueMutex && xSemaphoreTake(queueMutex, portMAX_DELAY)) {
                    commandQueue.push_back(line);
                    hasNewCommand = true;
                    xSemaphoreGive(queueMutex);
                }
            }
            start = end + 1;
        }
    }
};

void setupBle() {
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
    BLEDevice::startAdvertising();
}

void sendText(String payload) {
    if (deviceConnected && txChar) {
        txChar->setValue((uint8_t*)payload.c_str(), payload.length());
        txChar->notify();
    }
}

// --- UI Creation ---

// --- Helpers ---
String getFirst3Chars(String str) {
    int count = 0;
    int len = str.length();
    int i = 0;
    while (i < len && count < 3) {
        unsigned char c = str[i];
        if (c < 0x80) i += 1;
        else if ((c & 0xE0) == 0xC0) i += 2;
        else if ((c & 0xF0) == 0xE0) i += 3;
        else if ((c & 0xF8) == 0xF0) i += 4;
        else i += 1; // Fallback
        count++;
    }
    return str.substring(0, i);
}

static void msgbox_huang_event_cb(lv_event_t * e) {
    lv_obj_t * mbox = lv_event_get_current_target(e);
    const char* btn_txt = lv_msgbox_get_active_btn_text(mbox);
    if(btn_txt && (strcmp(btn_txt, t("BTN_CONFIRM")) == 0 || strcmp(btn_txt, "确认") == 0 || strcmp(btn_txt, "Confirm") == 0 || strcmp(btn_txt, "確認") == 0)) {
        sendText("BTN:HUANG\n");
    }
    lv_msgbox_close(mbox);
}

static void event_handler_game_btn(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t * obj = lv_event_get_target(e);
    if(code == LV_EVENT_CLICKED) {
        if (obj == btn_huang) {
            // Confirmation for Huangzhuang
            int windIndex = (gameState.gameNumber - 1) / 4;
            int juIndex = ((gameState.gameNumber - 1) % 4) + 1;
            char buf[64];
            if (currentLang == LANG_EN) {
                snprintf(buf, sizeof(buf), "%s%d %d/16\n%s", 
                        t_wind(windIndex), juIndex, gameState.gameNumber, t("DRAW_CONFIRM_TEXT"));
            } else {
                snprintf(buf, sizeof(buf), "%s%d局 %d/16\n%s", 
                        t_wind(windIndex), juIndex, gameState.gameNumber, t("DRAW_CONFIRM_TEXT"));
            }
            
            static const char * btns[3];
            btns[0] = t("BTN_CONFIRM");
            btns[1] = t("BTN_CANCEL");
            btns[2] = "";
            lv_obj_t * mbox = lv_msgbox_create(lv_layer_top(), t("DRAW_CONFIRM_TITLE"), buf, btns, true);
            lv_obj_add_event_cb(mbox, msgbox_huang_event_cb, LV_EVENT_VALUE_CHANGED, NULL);
            lv_obj_center(mbox);
            
            // Style the message box
            lv_obj_set_style_bg_color(mbox, C_SLATE_800, 0);
            lv_obj_set_style_text_color(mbox, C_SLATE_100, 0);
            lv_obj_set_style_text_font(mbox, &lv_font_wqy_20, 0);
            lv_obj_set_style_border_color(mbox, C_SLATE_600, 0);
            lv_obj_set_style_border_width(mbox, 2, 0);
            lv_obj_set_style_shadow_width(mbox, 20, 0);
            lv_obj_set_style_shadow_color(mbox, lv_color_black(), 0);
            lv_obj_set_style_shadow_opa(mbox, LV_OPA_50, 0);

            // Style the buttons
            lv_obj_t * btns_obj = lv_msgbox_get_btns(mbox);
            lv_obj_set_style_height(btns_obj, 50, 0); // Taller buttons
            lv_obj_set_style_bg_color(btns_obj, C_SLATE_600, LV_PART_ITEMS);
            lv_obj_set_style_text_color(btns_obj, lv_color_white(), LV_PART_ITEMS);
            lv_obj_set_style_text_font(btns_obj, &lv_font_wqy_20, 0);
            
        } else if (obj == btn_player_confirm) {
            sendText("BTN:CONFIRM\n");
            isConfirmed = !isConfirmed;
            update_game_ui();
        } else if (obj == btn_diff) {
            diffMode = !diffMode;
            update_game_ui();
        } else if (obj == btn_hu) {
            huBaseScore = 8;
            huLoserRelPos = -1;
            // Reset button styles
             for (int i=0; i<4; i++) {
                 lv_obj_set_style_bg_color(btn_hu_opts[i], C_SLATE_700, 0);
                 lv_obj_set_style_text_color(btn_hu_opts[i], C_SLATE_100, 0);
             }
            lv_label_set_text_fmt(lbl_hu_score, "%d", huBaseScore);
            
            // Set Title & Labels
            if (myPositionIndex >= 0 && myPositionIndex <= 3) {
                 lv_label_set_text_fmt(lbl_hu_title, "%s %s", gameState.names[myPositionIndex].c_str(), t("WIN_TITLE_SUFFIX"));
                 
                 // Dynamic Labels: Left, Opp, Right
                 int leftIdx = (myPositionIndex + 3) % 4;
                 int oppIdx = (myPositionIndex + 2) % 4;
                 int rightIdx = (myPositionIndex + 1) % 4;
                 
                 // Update Name Label (Child 1)
                 lv_obj_t* l_left = lv_obj_get_child(btn_hu_opts[0], 1);
                 lv_obj_t* l_opp = lv_obj_get_child(btn_hu_opts[1], 1);
                 lv_obj_t* l_right = lv_obj_get_child(btn_hu_opts[2], 1);

                 if (l_left) lv_label_set_text(l_left, getFirst3Chars(gameState.names[leftIdx]).c_str());
                 if (l_opp) lv_label_set_text(l_opp, getFirst3Chars(gameState.names[oppIdx]).c_str());
                 if (l_right) lv_label_set_text(l_right, getFirst3Chars(gameState.names[rightIdx]).c_str());
                 
            } else {
                 lv_label_set_text(lbl_hu_title, t("HU_SETTLEMENT"));
                 // Clear names if not in game
                 lv_obj_t* l_left = lv_obj_get_child(btn_hu_opts[0], 1);
                 lv_obj_t* l_opp = lv_obj_get_child(btn_hu_opts[1], 1);
                 lv_obj_t* l_right = lv_obj_get_child(btn_hu_opts[2], 1);

                 if (l_left) lv_label_set_text(l_left, "--");
                 if (l_opp) lv_label_set_text(l_opp, "--");
                 if (l_right) lv_label_set_text(l_right, "--");
            }
            
            lv_obj_clear_flag(scr_hu, LV_OBJ_FLAG_HIDDEN);
        } else if (obj == btn_gameover) {
            // Go to standby
            gameState.mode = "IDLE";
            update_game_ui();
            show_screen(scr_waiting);
            sendText("BTN:GAMEOVER\n");
        }
    }
}

static void event_handler_hu_action(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    long user_data = (long)lv_event_get_user_data(e); // 0:Cancel, 1:Submit, 2-5:Pos, 10-13:Score

    if(code == LV_EVENT_CLICKED) {
        if (user_data == 0) { // Cancel
            lv_obj_add_flag(scr_hu, LV_OBJ_FLAG_HIDDEN);
        } else if (user_data == 1) { // Submit
            if (huLoserRelPos == -1) return;
            // Visual Feedback
            lv_obj_set_style_bg_color(btn_hu_submit, C_SLATE_600, 0);
            lv_label_set_text(lbl_hu_submit, t("SUBMITTING"));
            
            String cmd = "";
            if (huLoserRelPos == 3) cmd = "HE:ZIMO:" + String(huBaseScore) + "\n";
            else {
                String rel = (huLoserRelPos == 0) ? "LEFT" : (huLoserRelPos == 1 ? "OPPOSITE" : "RIGHT");
                cmd = "HE:RON:" + rel + ":" + String(huBaseScore) + "\n";
            }
            sendText(cmd);
            
            // Delay close slightly or just close
            lv_obj_add_flag(scr_hu, LV_OBJ_FLAG_HIDDEN);
            lv_obj_set_style_bg_color(btn_hu_submit, C_SKY_500, 0);
            lv_label_set_text(lbl_hu_submit, t("CONFIRM_CALC"));
            
        } else if (user_data >= 2 && user_data <= 5) { // Pos
             huLoserRelPos = user_data - 2;
             // Update Button Styles
             for (int i=0; i<4; i++) {
                 if (i == huLoserRelPos) {
                     if (i == 3) lv_obj_set_style_bg_color(btn_hu_opts[i], C_EMERALD_500, 0);
                     else lv_obj_set_style_bg_color(btn_hu_opts[i], C_RED_500, 0);
                     lv_obj_set_style_text_color(btn_hu_opts[i], lv_color_white(), 0);
                 } else {
                     lv_obj_set_style_bg_color(btn_hu_opts[i], C_SLATE_700, 0);
                     lv_obj_set_style_text_color(btn_hu_opts[i], C_SLATE_100, 0);
                 }
             }
        } else if (user_data == 10) { huBaseScore = max(1, huBaseScore-5); }
        else if (user_data == 11) { huBaseScore = max(1, huBaseScore-1); }
        else if (user_data == 12) { huBaseScore += 1; }
        else if (user_data == 13) { huBaseScore += 5; }
        
        if (user_data >= 10) {
            lv_label_set_text_fmt(lbl_hu_score, "%d", huBaseScore);
        }
    }
}

void init_ui() {
    create_connect_screen();
    create_waiting_screen();
    create_game_screen();
    create_hu_menu();
    
    show_screen(scr_connect);
}

void show_screen(lv_obj_t* scr) {
    if (scr) lv_scr_load(scr);
}

void create_connect_screen() {
    scr_connect = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(scr_connect, C_SLATE_900, 0);
    
    lv_obj_t * label = lv_label_create(scr_connect);
    String welcomeMsg = String(t("MAHJONG_BOARD")) + "\n\n" + String(t("DEVICE_PREFIX")) + " " + deviceName + "\n\n" + String(t("WAITING_HOST"));
    lv_label_set_text(label, welcomeMsg.c_str());
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(label, LV_ALIGN_CENTER, 0, -20);
    lv_obj_set_style_text_color(label, C_SLATE_200, 0);
    lv_obj_set_style_text_font(label, &lv_font_wqy_20, 0);
    
    lv_obj_t * spinner = lv_spinner_create(scr_connect, 1000, 60);
    lv_obj_set_size(spinner, 50, 50);
    lv_obj_align(spinner, LV_ALIGN_CENTER, 0, 50);
    lv_obj_set_style_arc_color(spinner, C_EMERALD_500, LV_PART_INDICATOR);

    lv_obj_t * ver = lv_label_create(scr_connect);
    lv_label_set_text(ver, "v1.6.4");
    lv_obj_align(ver, LV_ALIGN_BOTTOM_RIGHT, -10, -10);
    lv_obj_set_style_text_color(ver, C_SLATE_500, 0);
    lv_obj_set_style_text_font(ver, &lv_font_wqy_20, 0);
}

void create_waiting_screen() {
    scr_waiting = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(scr_waiting, C_SLATE_900, 0);
    
    lv_obj_t * label = lv_label_create(scr_waiting);
    lv_label_set_text(label, t("BLUETOOTH_CONN"));
    lv_obj_align(label, LV_ALIGN_CENTER, 0, -30);
    lv_obj_set_style_text_color(label, C_EMERALD_500, 0);
    lv_obj_set_style_text_font(label, &lv_font_wqy_20, 0);

    lv_obj_t * sub = lv_label_create(scr_waiting);
    lv_label_set_text(sub, t("WAITING_START"));
    lv_obj_align(sub, LV_ALIGN_CENTER, 0, 20);
    lv_obj_set_style_text_color(sub, C_SLATE_400, 0);
    lv_obj_set_style_text_font(sub, &lv_font_wqy_20, 0);

    lv_obj_t * ver = lv_label_create(scr_waiting);
    lv_label_set_text(ver, "v1.6.4");
    lv_obj_align(ver, LV_ALIGN_BOTTOM_RIGHT, -10, -10);
    lv_obj_set_style_text_color(ver, C_SLATE_500, 0);
    lv_obj_set_style_text_font(ver, &lv_font_wqy_20, 0);
}

void create_game_screen() {
    scr_game = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(scr_game, C_SLATE_900, 0);
    lv_obj_clear_flag(scr_game, LV_OBJ_FLAG_SCROLLABLE);

    // --- Main Flex Container (Full Screen) ---
    lv_obj_t* root_flex = lv_obj_create(scr_game);
    lv_obj_set_size(root_flex, 480, 320);
    lv_obj_center(root_flex);
    lv_obj_set_flex_flow(root_flex, LV_FLEX_FLOW_ROW);
    lv_obj_set_style_pad_all(root_flex, 0, 0);
    lv_obj_set_style_border_width(root_flex, 0, 0);
    lv_obj_set_style_bg_opa(root_flex, LV_OPA_TRANSP, 0);
    lv_obj_set_style_pad_column(root_flex, 0, 0); // No gap between board and sidebar

    // --- Left Side: Board Area (Flex Grow) ---
    lv_obj_t* cont_board = lv_obj_create(root_flex);
    lv_obj_set_flex_grow(cont_board, 1);
    lv_obj_set_height(cont_board, LV_PCT(100));
    lv_obj_set_style_bg_opa(cont_board, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(cont_board, 0, 0);
    lv_obj_set_style_pad_all(cont_board, 0, 0);
    
    // Position Label (Top Left) - e.g. "EAST"
    // Using lbl_device_id variable for this purpose to reuse existing pointer
    lbl_device_id = lv_label_create(cont_board);
    lv_label_set_text_fmt(lbl_device_id, "%s --", t("DEVICE_PREFIX"));
    lv_obj_align(lbl_device_id, LV_ALIGN_TOP_LEFT, 15, 15);
    lv_obj_set_style_bg_color(lbl_device_id, C_SLATE_900, 0);
    lv_obj_set_style_bg_opa(lbl_device_id, LV_OPA_90, 0);
    lv_obj_set_style_text_color(lbl_device_id, C_SLATE_400, 0);
    lv_obj_set_style_text_font(lbl_device_id, &lv_font_wqy_20, 0);
    lv_obj_set_style_pad_all(lbl_device_id, 4, 0);
    lv_obj_set_style_radius(lbl_device_id, 4, 0);

    // Players Grid Layout
    // 0:Self(Bottom), 1:Right, 2:Opp(Top), 3:Left
    // Card Size: 110x74
    
    static const int CARD_W = 110;
    static const int CARD_H = 90;
    
    struct { int align; int x; int y; bool is_self; } pos_cfg[] = {
        {LV_ALIGN_BOTTOM_MID, 0, -30, true},   // Self (Bottom)
        {LV_ALIGN_RIGHT_MID, -20, 0, false},   // Right
        {LV_ALIGN_TOP_MID, 0, 30, false},      // Opp (Top)
        {LV_ALIGN_LEFT_MID, 20, 0, false}      // Left
    };

    for (int i = 0; i < 4; i++) {
        cont_players[i] = lv_obj_create(cont_board);
        lv_obj_set_size(cont_players[i], CARD_W, CARD_H);
        lv_obj_align(cont_players[i], pos_cfg[i].align, pos_cfg[i].x, pos_cfg[i].y);
        
        lv_obj_set_style_radius(cont_players[i], 8, 0);
        lv_obj_set_style_border_width(cont_players[i], 0, 0);
        
        if (pos_cfg[i].is_self) {
             lv_obj_set_style_bg_color(cont_players[i], C_EMERALD_600, 0);
             lv_obj_set_style_bg_opa(cont_players[i], LV_OPA_80, 0);
        } else {
             lv_obj_set_style_bg_color(cont_players[i], C_SLATE_800, 0);
             lv_obj_set_style_bg_opa(cont_players[i], LV_OPA_80, 0);
        }
        
        lv_obj_set_flex_flow(cont_players[i], LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(cont_players[i], LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_all(cont_players[i], 0, 0);
        lv_obj_set_style_pad_gap(cont_players[i], 8, 0);
        lv_obj_clear_flag(cont_players[i], LV_OBJ_FLAG_SCROLLABLE);

        // Name Label
        lbl_names[i] = lv_label_create(cont_players[i]);
        lv_label_set_text(lbl_names[i], "");
        lv_obj_set_style_text_font(lbl_names[i], &lv_font_wqy_20, 0);
        if (pos_cfg[i].is_self) {
            lv_obj_set_style_text_color(lbl_names[i], lv_color_white(), 0);
        } else {
            lv_obj_set_style_text_color(lbl_names[i], C_SLATE_300, 0);
        }

        // Score Label
        lbl_scores[i] = lv_label_create(cont_players[i]);
        lv_label_set_text(lbl_scores[i], "0");
        lv_obj_set_style_text_font(lbl_scores[i], &lv_font_sh_bold_40, 0);
        if (pos_cfg[i].is_self) {
             lv_obj_set_style_text_color(lbl_scores[i], lv_color_white(), 0);
        } else {
             lv_obj_set_style_text_color(lbl_scores[i], C_SLATE_200, 0);
        }
    }
    
    // Confirm Button (Bottom Left of Board Area)
    btn_player_confirm = lv_btn_create(cont_board);
    lv_obj_set_size(btn_player_confirm, 110, 36);
    lv_obj_align(btn_player_confirm, LV_ALIGN_BOTTOM_LEFT, 10, -10);
    lv_obj_set_style_bg_color(btn_player_confirm, C_AMBER_300, 0);
    lv_obj_set_style_bg_opa(btn_player_confirm, LV_OPA_80, 0); // React has amber-300/80
    lv_obj_set_style_radius(btn_player_confirm, 18, 0);
    lv_obj_set_style_shadow_width(btn_player_confirm, 2, 0);
    lv_obj_set_style_shadow_color(btn_player_confirm, C_SLATE_900, 0);
    lv_obj_set_style_text_color(btn_player_confirm, C_SLATE_900, 0);
    lv_obj_add_event_cb(btn_player_confirm, event_handler_game_btn, LV_EVENT_CLICKED, NULL);
    
    lv_obj_t* l_conf = lv_label_create(btn_player_confirm);
    lv_label_set_text(l_conf, t("CONFIRM_SCORE"));
    lv_obj_center(l_conf);
    lv_obj_set_style_text_font(l_conf, &lv_font_wqy_20, 0);
    lv_obj_set_style_text_color(l_conf, C_SLATE_900, 0);
    
    lv_obj_add_flag(btn_player_confirm, LV_OBJ_FLAG_HIDDEN);

    // --- Right Side: Sidebar (Fixed Width) ---
    lv_obj_t* cont_sidebar = lv_obj_create(root_flex);
    lv_obj_set_width(cont_sidebar, 130);
    lv_obj_set_height(cont_sidebar, LV_PCT(100));
    lv_obj_set_style_bg_color(cont_sidebar, C_SLATE_900, 0);
    lv_obj_set_style_bg_opa(cont_sidebar, LV_OPA_50, 0);
    lv_obj_set_style_border_side(cont_sidebar, LV_BORDER_SIDE_LEFT, 0);
    lv_obj_set_style_border_width(cont_sidebar, 1, 0);
    lv_obj_set_style_border_color(cont_sidebar, C_SLATE_800, 0);
    lv_obj_set_style_radius(cont_sidebar, 0, 0);
    lv_obj_clear_flag(cont_sidebar, LV_OBJ_FLAG_SCROLLABLE);

    // Sidebar Layout: Flex Column Space-Between
    lv_obj_set_flex_flow(cont_sidebar, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(cont_sidebar, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_ver(cont_sidebar, 15, 0);

    // 1. Game Info Pill (Top)
    lv_obj_t* pill_info = lv_obj_create(cont_sidebar);
    lv_obj_set_size(pill_info, 128, 26);
    lv_obj_set_style_bg_color(pill_info, C_SLATE_800, 0);
    lv_obj_set_style_radius(pill_info, 13, 0);
    lv_obj_set_style_border_width(pill_info, 0, 0);
    
    lbl_game_info = lv_label_create(pill_info);
    lv_label_set_text(lbl_game_info, t("UNSTARTED"));
    lv_obj_center(lbl_game_info);
    lv_obj_set_style_text_color(lbl_game_info, C_SLATE_400, 0);
    lv_obj_set_style_text_font(lbl_game_info, &lv_font_wqy_20, 0);

    // 2. Center Hu Button
    btn_hu = lv_btn_create(cont_sidebar);
    lv_obj_set_size(btn_hu, 76, 76);
    lv_obj_set_style_radius(btn_hu, 38, 0);
    lv_obj_set_style_bg_color(btn_hu, C_EMERALD_500, 0);
    lv_obj_set_style_bg_grad_color(btn_hu, C_EMERALD_600, 0);
    lv_obj_set_style_bg_grad_dir(btn_hu, LV_GRAD_DIR_VER, 0);
    lv_obj_set_style_shadow_width(btn_hu, 20, 0);
    lv_obj_set_style_shadow_color(btn_hu, lv_color_hex(0x064e3b), 0); // Emerald 900
    lv_obj_set_style_shadow_opa(btn_hu, LV_OPA_50, 0);
    lv_obj_add_event_cb(btn_hu, event_handler_game_btn, LV_EVENT_CLICKED, NULL);
    
    lv_obj_t* lbl_hu = lv_label_create(btn_hu);
    lv_label_set_text(lbl_hu, t("WIN"));
    lv_obj_center(lbl_hu);
    lv_obj_set_style_text_font(lbl_hu, &lv_font_wqy_20, 0); // Full CJK font for labels
    lv_obj_set_style_text_color(lbl_hu, lv_color_white(), 0);

    // Game Over Button (Replaces Hu when game over)
    btn_gameover = lv_btn_create(cont_sidebar);
    lv_obj_set_size(btn_gameover, 80, 60);
    lv_obj_set_style_radius(btn_gameover, 12, 0);
    lv_obj_set_style_bg_color(btn_gameover, C_RED_500, 0);
    lv_obj_set_style_shadow_width(btn_gameover, 20, 0);
    lv_obj_set_style_shadow_color(btn_gameover, lv_color_hex(0x7f1d1d), 0);
    lv_obj_set_style_shadow_opa(btn_gameover, LV_OPA_50, 0);
    lv_obj_add_event_cb(btn_gameover, event_handler_game_btn, LV_EVENT_CLICKED, NULL);
    lv_obj_add_flag(btn_gameover, LV_OBJ_FLAG_HIDDEN);

    lv_obj_t* l_go = lv_label_create(btn_gameover);
    lv_label_set_text(l_go, t("GAMEOVER"));
    lv_obj_center(l_go);
    lv_obj_set_style_text_align(l_go, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_font(l_go, &lv_font_wqy_20, 0);
    lv_obj_set_style_text_color(l_go, lv_color_white(), 0);

    // 3. Bottom Buttons (Huang, Diff)
    lv_obj_t* row_btm = lv_obj_create(cont_sidebar);
    lv_obj_set_size(row_btm, 110, 44);
    lv_obj_set_style_bg_opa(row_btm, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(row_btm, 0, 0);
    lv_obj_set_flex_flow(row_btm, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(row_btm, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_all(row_btm, 0, 0);

    // Huang
    btn_huang = lv_btn_create(row_btm);
    lv_obj_set_size(btn_huang, 44, 44);
    lv_obj_set_style_radius(btn_huang, 22, 0);
    lv_obj_set_style_bg_color(btn_huang, C_AMBER_500, 0);
    lv_obj_set_style_shadow_width(btn_huang, 10, 0);
    lv_obj_set_style_shadow_color(btn_huang, lv_color_hex(0x78350f), 0); // Amber 900
    lv_obj_set_style_shadow_opa(btn_huang, LV_OPA_30, 0);
    lv_obj_add_event_cb(btn_huang, event_handler_game_btn, LV_EVENT_CLICKED, NULL);
    lv_obj_t* l_huang = lv_label_create(btn_huang);
    lv_label_set_text(l_huang, t("DRAW"));
    lv_obj_center(l_huang);
    lv_obj_set_style_text_font(l_huang, &lv_font_wqy_20, 0);
    
    // Diff
    btn_diff = lv_btn_create(row_btm);
    lv_obj_set_size(btn_diff, 44, 44);
    lv_obj_set_style_radius(btn_diff, 22, 0);
    lv_obj_set_style_bg_color(btn_diff, C_SLATE_700, 0);
    lv_obj_add_event_cb(btn_diff, event_handler_game_btn, LV_EVENT_CLICKED, NULL);
    lv_obj_t* l_diff = lv_label_create(btn_diff);
    lv_label_set_text(l_diff, t("DIFF"));
    lv_obj_center(l_diff);
    lv_obj_set_style_text_font(l_diff, &lv_font_wqy_20, 0);
}

void create_hu_menu() {
    scr_hu = lv_obj_create(lv_layer_top());
    lv_obj_set_size(scr_hu, 480, 320); // Landscape
    lv_obj_center(scr_hu);
    lv_obj_set_style_bg_color(scr_hu, C_SLATE_950, 0);
    lv_obj_set_style_bg_opa(scr_hu, LV_OPA_90, 0);
    lv_obj_set_style_border_width(scr_hu, 0, 0);
    lv_obj_set_style_radius(scr_hu, 0, 0);
    lv_obj_add_flag(scr_hu, LV_OBJ_FLAG_HIDDEN);
    
    // Top Bar
    lv_obj_t* btn_back = lv_btn_create(scr_hu);
    lv_obj_set_size(btn_back, 40, 40);
    lv_obj_align(btn_back, LV_ALIGN_TOP_LEFT, 10, 10);
    lv_obj_set_style_bg_color(btn_back, C_SLATE_800, 0);
    lv_obj_set_style_radius(btn_back, 20, 0);
    lv_obj_t* l_back = lv_label_create(btn_back);
    lv_label_set_text(l_back, "<");
    lv_obj_center(l_back);
    lv_obj_add_event_cb(btn_back, event_handler_hu_action, LV_EVENT_CLICKED, (void*)0);
    
    lbl_hu_title = lv_label_create(scr_hu);
    lv_label_set_text(lbl_hu_title, t("HU_SETTLEMENT"));
    lv_obj_align(lbl_hu_title, LV_ALIGN_TOP_MID, 0, 20);
    lv_obj_set_style_text_color(lbl_hu_title, C_SLATE_200, 0);
    lv_obj_set_style_text_font(lbl_hu_title, &lv_font_wqy_20, 0);
    
    // Content Container (Fit in 480 width)
    lv_obj_t* cont = lv_obj_create(scr_hu);
    lv_obj_set_size(cont, 400, 240); // Wider and shorter
    lv_obj_align(cont, LV_ALIGN_TOP_MID, 0, 60);
    lv_obj_set_style_bg_opa(cont, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(cont, 0, 0);
    lv_obj_set_flex_flow(cont, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(cont, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

    // Row 1: Losers (Left, Opp, Right)
    lv_obj_t* row_losers = lv_obj_create(cont);
    lv_obj_set_width(row_losers, LV_PCT(100));
    lv_obj_set_height(row_losers, LV_SIZE_CONTENT);
    lv_obj_set_style_bg_opa(row_losers, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(row_losers, 0, 0);
    lv_obj_set_flex_flow(row_losers, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(row_losers, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    
    const char* labels[] = {t("LEFT_DEAL"), t("OPP_DEAL"), t("RIGHT_DEAL")};
    for (int i = 0; i < 3; i++) {
        btn_hu_opts[i] = lv_btn_create(row_losers);
        lv_obj_set_width(btn_hu_opts[i], 120); // Wider for Landscape
        lv_obj_set_height(btn_hu_opts[i], 60); // Increased height for 2 lines
        lv_obj_set_style_bg_color(btn_hu_opts[i], C_SLATE_700, 0);
        
        // Flex Layout for Button (Column)
        lv_obj_set_flex_flow(btn_hu_opts[i], LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(btn_hu_opts[i], LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_all(btn_hu_opts[i], 0, 0);
        lv_obj_set_style_pad_row(btn_hu_opts[i], 2, 0);

        // Label 1: Position
        lv_obj_t* l = lv_label_create(btn_hu_opts[i]);
        lv_label_set_text(l, labels[i]);
        lv_obj_set_style_text_font(l, &lv_font_wqy_20, 0);
        
        // Label 2: Name
        lv_obj_t* l_name = lv_label_create(btn_hu_opts[i]);
        lv_label_set_text(l_name, "--");
        lv_obj_set_style_text_font(l_name, &lv_font_wqy_20, 0);

        lv_obj_add_event_cb(btn_hu_opts[i], event_handler_hu_action, LV_EVENT_CLICKED, (void*)(long)(i + 2));
    }

    // Row 2: Zimo
    btn_hu_opts[3] = lv_btn_create(cont);
    lv_obj_set_width(btn_hu_opts[3], LV_PCT(100));
    lv_obj_set_height(btn_hu_opts[3], 40);
    lv_obj_set_style_bg_color(btn_hu_opts[3], C_SLATE_700, 0);
    lv_obj_t* l_zimo = lv_label_create(btn_hu_opts[3]);
    lv_label_set_text(l_zimo, t("TSUMO"));
    lv_obj_center(l_zimo);
    lv_obj_set_style_text_font(l_zimo, &lv_font_wqy_20, 0);
    lv_obj_add_event_cb(btn_hu_opts[3], event_handler_hu_action, LV_EVENT_CLICKED, (void*)(long)5);

    // Row 3: Score Adjust
    lv_obj_t* row_score = lv_obj_create(cont);
    lv_obj_set_width(row_score, LV_PCT(100));
    lv_obj_set_height(row_score, 50);
    lv_obj_set_style_bg_opa(row_score, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(row_score, 0, 0);
    lv_obj_set_flex_flow(row_score, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(row_score, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    
    // -5
    lv_obj_t* b_m5 = lv_btn_create(row_score);
    lv_obj_set_size(b_m5, 60, 40);
    lv_obj_set_style_bg_color(b_m5, C_SLATE_700, 0);
    lv_obj_t* l_m5 = lv_label_create(b_m5);
    lv_label_set_text(l_m5, "-5");
    lv_obj_center(l_m5);
    lv_obj_add_event_cb(b_m5, event_handler_hu_action, LV_EVENT_CLICKED, (void*)10);
    
    // -1
    lv_obj_t* b_m1 = lv_btn_create(row_score);
    lv_obj_set_size(b_m1, 60, 40);
    lv_obj_set_style_bg_color(b_m1, C_SLATE_700, 0);
    lv_obj_t* l_m1 = lv_label_create(b_m1);
    lv_label_set_text(l_m1, "-1");
    lv_obj_center(l_m1);
    lv_obj_add_event_cb(b_m1, event_handler_hu_action, LV_EVENT_CLICKED, (void*)11);

    // Score Display
    lv_obj_t* cont_sc = lv_obj_create(row_score);
    lv_obj_set_size(cont_sc, 80, 40);
    lv_obj_set_style_bg_color(cont_sc, C_SLATE_800, 0);
    lv_obj_set_style_border_width(cont_sc, 0, 0);
    lbl_hu_score = lv_label_create(cont_sc);
    lv_label_set_text(lbl_hu_score, "8");
    lv_obj_center(lbl_hu_score);
    lv_obj_set_style_text_color(lbl_hu_score, C_AMBER_300, 0);
    lv_obj_set_style_text_font(lbl_hu_score, &lv_font_sh_bold_40, 0);

    // +1
    lv_obj_t* b_p1 = lv_btn_create(row_score);
    lv_obj_set_size(b_p1, 60, 40);
    lv_obj_set_style_bg_color(b_p1, C_SLATE_700, 0);
    lv_obj_t* l_p1 = lv_label_create(b_p1);
    lv_label_set_text(l_p1, "+1");
    lv_obj_center(l_p1);
    lv_obj_add_event_cb(b_p1, event_handler_hu_action, LV_EVENT_CLICKED, (void*)12);

    // +5
    lv_obj_t* b_p5 = lv_btn_create(row_score);
    lv_obj_set_size(b_p5, 60, 40);
    lv_obj_set_style_bg_color(b_p5, C_SLATE_700, 0);
    lv_obj_t* l_p5 = lv_label_create(b_p5);
    lv_label_set_text(l_p5, "+5");
    lv_obj_center(l_p5);
    lv_obj_add_event_cb(b_p5, event_handler_hu_action, LV_EVENT_CLICKED, (void*)13);

    // Submit Button
    btn_hu_submit = lv_btn_create(cont);
    lv_obj_set_width(btn_hu_submit, LV_PCT(100));
    lv_obj_set_height(btn_hu_submit, 40);
    lv_obj_set_style_bg_color(btn_hu_submit, C_SKY_500, 0);
    lbl_hu_submit = lv_label_create(btn_hu_submit);
    lv_label_set_text(lbl_hu_submit, t("CONFIRM_CALC"));
    lv_obj_center(lbl_hu_submit);
    lv_obj_set_style_text_font(lbl_hu_submit, &lv_font_wqy_20, 0);
    lv_obj_add_event_cb(btn_hu_submit, event_handler_hu_action, LV_EVENT_CLICKED, (void*)1);
}

void update_game_ui() {
    // Update Sidebar
    if (gameState.gameNumber > 0) {
        int windIndex = (gameState.gameNumber - 1) / 4;
        int juIndex = ((gameState.gameNumber - 1) % 4) + 1;
        if (currentLang == LANG_EN) {
            lv_label_set_text_fmt(lbl_game_info, "%s%d %d/16", 
                t_wind(windIndex), juIndex, gameState.gameNumber);
        } else {
            lv_label_set_text_fmt(lbl_game_info, "%s%d局 %d/16", 
                t_wind(windIndex), juIndex, gameState.gameNumber);
        }
    } else {
         lv_label_set_text(lbl_game_info, t("UNSTARTED"));
    }

    // Update Device ID
    if (myPositionIndex != -1) {
         lv_label_set_text_fmt(lbl_device_id, "%s %s", t("DEVICE_PREFIX"), t_wind(myPositionIndex));
    } else {
         lv_label_set_text_fmt(lbl_device_id, "%s %s", t("DEVICE_PREFIX"), t("NOT_ALLOCATED"));
    }

    // Confirm Button State
    if (gameState.mode == "CONFIRM") {
         lv_obj_clear_flag(btn_player_confirm, LV_OBJ_FLAG_HIDDEN);
         if (isConfirmed) {
             lv_obj_set_style_bg_color(btn_player_confirm, C_SLATE_500, 0);
             lv_obj_set_style_text_color(btn_player_confirm, C_SLATE_100, 0);
             lv_label_set_text(lv_obj_get_child(btn_player_confirm, 0), t("CONFIRMED"));
         } else {
             lv_obj_set_style_bg_color(btn_player_confirm, C_AMBER_300, 0);
             lv_obj_set_style_text_color(btn_player_confirm, C_SLATE_900, 0);
             lv_label_set_text(lv_obj_get_child(btn_player_confirm, 0), t("CONFIRM_SCORE"));
         }
    } else {
         lv_obj_add_flag(btn_player_confirm, LV_OBJ_FLAG_HIDDEN);
         isConfirmed = false;
    }

    // Diff Mode Button Style
    if (diffMode) {
        lv_obj_set_style_bg_color(btn_diff, C_SKY_500, 0);
        lv_obj_set_style_text_color(btn_diff, lv_color_white(), 0);
    } else {
        lv_obj_set_style_bg_color(btn_diff, C_SLATE_700, 0);
        lv_obj_set_style_text_color(btn_diff, C_SLATE_300, 0);
    }

    // Huang Button Visibility (Only East)
    if (gameState.mode == "GAMEOVER") {
        lv_obj_add_flag(btn_huang, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(btn_hu, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(btn_diff, LV_OBJ_FLAG_HIDDEN);
        lv_obj_clear_flag(btn_gameover, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_clear_flag(btn_hu, LV_OBJ_FLAG_HIDDEN);
        lv_obj_clear_flag(btn_diff, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(btn_gameover, LV_OBJ_FLAG_HIDDEN);
        
        if (myPositionIndex == 0) {
            lv_obj_clear_flag(btn_huang, LV_OBJ_FLAG_HIDDEN);
        } else {
            lv_obj_add_flag(btn_huang, LV_OBJ_FLAG_HIDDEN);
        }
    }

    // Update Players
    // Map: 0:Self, 1:Right, 2:Opp, 3:Left
    // Absolute indices: myPositionIndex (Self), +1, +2, +3 mod 4.
    
    int map[4];
    if (myPositionIndex != -1) {
        map[0] = myPositionIndex;
        map[1] = (myPositionIndex + 1) % 4;
        map[2] = (myPositionIndex + 2) % 4;
        map[3] = (myPositionIndex + 3) % 4;
    } else {
        for(int i=0; i<4; i++) map[i] = i;
    }
    
    for (int i = 0; i < 4; i++) {
        int absIndex = map[i];
        int score = gameState.scores[absIndex];
        
        // Name
        lv_label_set_text(lbl_names[i], gameState.names[absIndex].c_str());
        
        // Score & Color
        int displayScore = score;
        lv_color_t txtColor = C_SLATE_200;
        lv_color_t bgColor = C_SLATE_800;
        
        if (i == 0) { // Self
             if (!diffMode) {
                 bgColor = C_EMERALD_600; // Self Normal: Green bg
                 txtColor = lv_color_white();
             } else {
                 bgColor = C_SLATE_700; // Self Diff: Slate bg
                 txtColor = C_SLATE_200;
                 displayScore = 0;
             }
        } else { // Others
             if (diffMode) {
                 int selfScore = gameState.scores[map[0]];
                 displayScore = score - selfScore;
             }
             // Color logic
             if (displayScore > 0) txtColor = C_RED_500;
             else if (displayScore < 0) txtColor = C_GREEN_500;
             else txtColor = C_SLATE_200;
        }
        
        lv_label_set_text_fmt(lbl_scores[i], "%d", displayScore);
        lv_obj_set_style_text_color(lbl_scores[i], txtColor, 0);
        lv_obj_set_style_bg_color(cont_players[i], bgColor, 0);
    }
}

void processCommand(String cmd) {
    // Parse Command
    if (cmd.startsWith("LANG:")) {
        String langStr = cmd.substring(5);
        langStr.trim();
        if (langStr == "en") currentLang = LANG_EN;
        else if (langStr == "ja") currentLang = LANG_JA;
        else currentLang = LANG_ZH;
        
        if (lv_scr_act() == scr_game) {
            update_game_ui();
            
            // Explicitly update static labels on game screen
            lv_label_set_text(lv_obj_get_child(btn_hu, 0), t("WIN"));
            lv_label_set_text(lv_obj_get_child(btn_gameover, 0), t("GAMEOVER"));
            lv_label_set_text(lv_obj_get_child(btn_huang, 0), t("DRAW"));
            lv_label_set_text(lv_obj_get_child(btn_diff, 0), t("DIFF"));
            
            // Update hu menu labels
            lv_label_set_text(lbl_hu_title, t("HU_SETTLEMENT"));
            lv_label_set_text(lbl_hu_submit, t("CONFIRM_CALC"));
            
            lv_label_set_text(lv_obj_get_child(btn_hu_opts[0], 0), t("LEFT_DEAL"));
            lv_label_set_text(lv_obj_get_child(btn_hu_opts[1], 0), t("OPP_DEAL"));
            lv_label_set_text(lv_obj_get_child(btn_hu_opts[2], 0), t("RIGHT_DEAL"));
            lv_label_set_text(lv_obj_get_child(btn_hu_opts[3], 0), t("TSUMO"));
        } else if (lv_scr_act() == scr_waiting) {
            lv_obj_t* label = lv_obj_get_child(scr_waiting, 0);
            lv_obj_t* sub = lv_obj_get_child(scr_waiting, 1);
            if (label) lv_label_set_text(label, t("BLUETOOTH_CONN"));
            if (sub) lv_label_set_text(sub, t("WAITING_START"));
        } else if (lv_scr_act() == scr_connect) {
            lv_obj_t* label = lv_obj_get_child(scr_connect, 0);
            if (label) {
                String welcomeMsg = String(t("MAHJONG_BOARD")) + "\n\n" + String(t("DEVICE_PREFIX")) + " " + deviceName + "\n\n" + String(t("WAITING_HOST"));
                lv_label_set_text(label, welcomeMsg.c_str());
            }
        }
    } else if (cmd.startsWith("SETUP:")) {
        myPositionIndex = cmd.substring(6).toInt();
        update_game_ui();
        show_screen(scr_waiting); // Or stay on waiting until state
    } else if (cmd.startsWith("NAME:")) {
        // NAME:index:name
        int firstColon = cmd.indexOf(':');
        int secondColon = cmd.indexOf(':', firstColon + 1);
        if (secondColon != -1) {
            int idx = cmd.substring(firstColon + 1, secondColon).toInt();
            String name = cmd.substring(secondColon + 1);
            if (idx >= 0 && idx < 4) {
                gameState.names[idx] = name;
                update_game_ui();
            }
        }
    } else if (cmd.startsWith("STATE:")) {
        // STATE:mode:round:gameNum:s0:s1:s2:s3
        // Example: STATE:PLAY:east:1:0:0:0:0
        // Split command into tokens
        std::vector<String> tokens;
        int start = 0;
        while (start < cmd.length()) {
            int end = cmd.indexOf(':', start);
            if (end == -1) end = cmd.length();
            tokens.push_back(cmd.substring(start, end));
            start = end + 1;
        }
        
        if (tokens.size() >= 2 && tokens[1] == "GAMEOVER") {
             gameState.mode = "GAMEOVER";
             update_game_ui();
             show_screen(scr_game);
        } else if (tokens.size() >= 8) {
             gameState.mode = tokens[1];
             gameState.round = tokens[2];
             gameState.gameNumber = tokens[3].toInt();
             gameState.scores[0] = tokens[4].toInt();
             gameState.scores[1] = tokens[5].toInt();
             gameState.scores[2] = tokens[6].toInt();
             gameState.scores[3] = tokens[7].toInt();
             
             update_game_ui();
             show_screen(scr_game);
        }
    }
}
