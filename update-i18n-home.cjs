const fs = require('fs');
const files = {
  zh: 'src/i18n/locales/zh.json',
  en: 'src/i18n/locales/en.json',
  ja: 'src/i18n/locales/ja.json'
};

const additions = {
  zh: {
    game: {
      quickStart: "快速开局",
      gameNamePlaceholder: "周末友谊赛",
      expandPlayerList: "展开选手列表",
      commonPlayers: "常用选手 · 点击选择",
      noMatch: "无匹配选手"
    },
    mahjong: {
      playerSuffix: "家"
    },
    device: {
      displayMode: "作为显示屏 (模拟计分板)"
    }
  },
  en: {
    game: {
      quickStart: "Quick Start",
      gameNamePlaceholder: "Weekend Friendly",
      expandPlayerList: "Expand Player List",
      commonPlayers: "Common Players · Click to Select",
      noMatch: "No Match"
    },
    mahjong: {
      playerSuffix: ""
    },
    device: {
      displayMode: "Use as Display (Scoreboard Mode)"
    }
  },
  ja: {
    game: {
      quickStart: "クイックスタート",
      gameNamePlaceholder: "週末の親善試合",
      expandPlayerList: "プレイヤーリストを展開",
      commonPlayers: "よく使うプレイヤー · クリックで選択",
      noMatch: "一致なし"
    },
    mahjong: {
      playerSuffix: "家"
    },
    device: {
      displayMode: "ディスプレイとして使用 (スコアボードモード)"
    }
  }
};

for (const lang of ['zh', 'en', 'ja']) {
  const content = JSON.parse(fs.readFileSync(files[lang], 'utf8'));
  for (const category in additions[lang]) {
    if (!content[category]) content[category] = {};
    for (const key in additions[lang][category]) {
      content[category][key] = additions[lang][category][key];
    }
  }
  fs.writeFileSync(files[lang], JSON.stringify(content, null, 2) + '\n');
}
console.log('i18n home updated');
