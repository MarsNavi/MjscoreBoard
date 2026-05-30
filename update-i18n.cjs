const fs = require('fs');
const files = {
  zh: 'src/i18n/locales/zh.json',
  en: 'src/i18n/locales/en.json',
  ja: 'src/i18n/locales/ja.json'
};

const additions = {
  zh: {
    game: {
      createFailed: "创建比赛失败",
      startFirst: "请先开始比赛。",
      drawConfirm: "记录荒庄？本盘四家均记 0 分。",
      drawFailed: "记录荒庄失败:",
      deleteConfirm: "删除这场比赛？此操作无法恢复。",
      noUndo: "没有可撤销的记录。",
      scoreFailed: "记录分数失败:",
      returnHomeConfirm: "返回开局页？当前比赛会自动保存。",
      returnHome: "返回开局页",
      earlyEndGame: "提前结束比赛",
      earlyEndGameDesc: "已完成的盘数会保存，可在历史中查看。",
      gameEnded: "比赛已结束",
      viewStatsOrHistory: "查看本场成绩，或从历史继续回看。",
      viewStats: "查看成绩"
    },
    files: {
      switchConfirm: "当前档案有未完成比赛。切换后可在历史中继续，是否切换？",
      notFound: "未找到档案。",
      createConfirm: "当前有未完成比赛。新建档案后，可回到原档案继续，是否新建？",
      newFileName: "新档案名称：",
      newFile: "新档案",
      fileNamePrompt: "档案名称：",
      keepOne: "至少保留一个档案。",
      deleteConfirm: "删除「{{name}}」？此档案内的比赛和统计会一并删除，无法恢复。",
      opening: "正在打开当前档案…"
    }
  },
  en: {
    game: {
      createFailed: "Failed to create game",
      startFirst: "Please start a game first.",
      drawConfirm: "Record a draw? All 4 players get 0 points.",
      drawFailed: "Failed to record draw:",
      deleteConfirm: "Delete this game? This cannot be undone.",
      noUndo: "No records to undo.",
      scoreFailed: "Failed to record score:",
      returnHomeConfirm: "Return to home page? The current game will be saved automatically.",
      returnHome: "Return Home",
      earlyEndGame: "End Game Early",
      earlyEndGameDesc: "Completed rounds are saved and can be viewed in history.",
      gameEnded: "Game Over",
      viewStatsOrHistory: "View stats or check history.",
      viewStats: "View Stats"
    },
    files: {
      switchConfirm: "The current archive has an unfinished game. Switch anyway?",
      notFound: "Archive not found.",
      createConfirm: "Unfinished game exists. Create a new archive?",
      newFileName: "New Archive Name:",
      newFile: "New Archive",
      fileNamePrompt: "Archive Name:",
      keepOne: "Must keep at least one archive.",
      deleteConfirm: "Delete \"{{name}}\"? All games and stats inside will be lost.",
      opening: "Opening current archive..."
    }
  },
  ja: {
    game: {
      createFailed: "対局の作成に失敗しました",
      startFirst: "先に対局を開始してください。",
      drawConfirm: "流局を記録しますか？4人とも0点になります。",
      drawFailed: "流局の記録に失敗しました:",
      deleteConfirm: "この対局を削除しますか？この操作は取り消せません。",
      noUndo: "元に戻す記録がありません。",
      scoreFailed: "点数の記録に失敗しました:",
      returnHomeConfirm: "ホームに戻りますか？現在の対局は自動的に保存されます。",
      returnHome: "ホームに戻る",
      earlyEndGame: "対局を途中で終了",
      earlyEndGameDesc: "完了した局は保存され、履歴から確認できます。",
      gameEnded: "対局終了",
      viewStatsOrHistory: "成績を見るか、履歴から確認してください。",
      viewStats: "成績を見る"
    },
    files: {
      switchConfirm: "現在のアーカイブに未完了の対局があります。切り替えますか？",
      notFound: "アーカイブが見つかりません。",
      createConfirm: "未完了の対局があります。新しいアーカイブを作成しますか？",
      newFileName: "新しいアーカイブ名:",
      newFile: "新規アーカイブ",
      fileNamePrompt: "アーカイブ名:",
      keepOne: "最低1つのアーカイブを残してください。",
      deleteConfirm: "「{{name}}」を削除しますか？アーカイブ内の対局と統計データは失われます。",
      opening: "現在のアーカイブを開いています…"
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
console.log('i18n updated');
