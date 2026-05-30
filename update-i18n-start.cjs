const fs = require('fs');
const files = {
  zh: 'src/i18n/locales/zh.json',
  en: 'src/i18n/locales/en.json',
  ja: 'src/i18n/locales/ja.json'
};

const additions = {
  zh: { common: { start: "开局", endGame: "结束" } },
  en: { common: { start: "Start", endGame: "End" } },
  ja: { common: { start: "開始", endGame: "終了" } }
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
console.log('i18n start/endGame updated');
