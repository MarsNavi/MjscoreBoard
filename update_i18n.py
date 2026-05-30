import json
import os

locales_path = 'src/i18n/locales'
locales = ['zh', 'en', 'ja']

new_keys = {
  "history": {
    "recent24h": { "zh": "近 24 小时小计", "en": "Last 24 Hours", "ja": "直近24時間" },
    "statsByCreateTime": { "zh": "按比赛创建时间统计", "en": "By game creation time", "ja": "対局作成時間による統計" },
    "noGames": { "zh": "还没有比赛记录", "en": "No game records yet", "ja": "対局記録はまだありません" },
    "completed": { "zh": "已完成", "en": "Completed", "ja": "完了" },
    "ended": { "zh": "已结束", "en": "Ended", "ja": "終了" },
    "inProgress": { "zh": "进行中 {{current}}/16", "en": "In Progress {{current}}/16", "ja": "進行中 {{current}}/16" },
    "deleteGame": { "zh": "删除比赛", "en": "Delete Game", "ja": "対局を削除" },
    "deleting": { "zh": "正在删除…", "en": "Deleting...", "ja": "削除中..." }
  },
  "game": {
    "matchDetail": { "zh": "比赛详情", "en": "Match Detail", "ja": "試合詳細" },
    "shareGameDetail": { "zh": "分享对局明细", "en": "Share Game Details", "ja": "対局詳細を共有" },
    "currentScore": { "zh": "当前分数", "en": "Current Score", "ja": "現在のスコア" },
    "scoreDetail": { "zh": "计分明细", "en": "Score Details", "ja": "スコア詳細" },
    "roundCount": { "zh": "盘数", "en": "Round", "ja": "局" },
    "shareDetailTitle": { "zh": "国标麻将对局明细 - {{name}}", "en": "Mahjong Game Details - {{name}}", "ja": "麻雀対局詳細 - {{name}}" },
    "shareDetailText": { "zh": "对局明细长图", "en": "Game detail image", "ja": "対局詳細画像" },
    "shareDetailFailed": { "zh": "分享对局明细失败，请稍后重试。", "en": "Failed to share game details, please try again later.", "ja": "対局詳細の共有に失敗しました。後でもう一度お試しください。" }
  },
  "stats": {
    "shareImage": { "zh": "分享长图", "en": "Share Image", "ja": "画像を共有" },
    "noStats": { "zh": "完成比赛后，这里会显示统计。", "en": "Statistics will be shown here after completing games.", "ja": "対局を完了すると、ここに統計が表示されます。" },
    "player": { "zh": "选手", "en": "Player", "ja": "プレイヤー" },
    "totalStandardScore": { "zh": "总标准分", "en": "Total Standard Pts", "ja": "合計標準点" },
    "avgStandardScore": { "zh": "平均标准分", "en": "Avg Standard Pts", "ja": "平均標準点" },
    "totalRounds": { "zh": "总盘数", "en": "Total Rounds", "ja": "総局数" },
    "winRounds": { "zh": "和牌盘数", "en": "Win Rounds", "ja": "和了局数" },
    "selfDrawRounds": { "zh": "自摸盘数", "en": "Tsumo Rounds", "ja": "ツモ局数" },
    "loserRounds": { "zh": "放铳盘数", "en": "Deal-in Rounds", "ja": "放銃局数" },
    "avgLoserFan": { "zh": "放铳平均番", "en": "Avg Deal-in Fan", "ja": "平均放銃翻数" },
    "totalWinRounds": { "zh": "和牌总盘数", "en": "Total Win Rounds", "ja": "総和了局数" },
    "fan8to15": { "zh": "8-15番", "en": "8-15 Fan", "ja": "8-15翻" },
    "fan16to30": { "zh": "16-30番", "en": "16-30 Fan", "ja": "16-30翻" },
    "fan31to63": { "zh": "31-63番", "en": "31-63 Fan", "ja": "31-63翻" },
    "fan64plus": { "zh": "64番+", "en": "64+ Fan", "ja": "64翻以上" },
    "maxFanRong": { "zh": "点和最大番", "en": "Max Ron Fan", "ja": "最大ロン翻数" },
    "shareTitle": { "zh": "国标麻将成绩统计", "en": "Mahjong Statistics", "ja": "麻雀成績統計" },
    "shareText": { "zh": "成绩统计长图", "en": "Statistics image", "ja": "成績統計画像" },
    "shareFailed": { "zh": "分享失败，请稍后重试。", "en": "Failed to share, please try again later.", "ja": "共有に失敗しました。後でもう一度お試しください。" }
  },
  "files": {
    "manageGame": { "zh": "牌局管理", "en": "Game Management", "ja": "対局管理" },
    "dataFilesDesc": { "zh": "每个牌友圈单独保存，历史与统计互不混淆。", "en": "Saved separately for each circle, history and stats are isolated.", "ja": "各グループごとに個別に保存され、履歴と統計は混ざりません。" },
    "currentFile": { "zh": "当前档案", "en": "Current Archive", "ja": "現在のアーカイブ" },
    "switch": { "zh": "切换", "en": "Switch", "ja": "切り替え" },
    "games": { "zh": "比赛", "en": "Games", "ja": "対局" },
    "finished": { "zh": "完成", "en": "Finished", "ja": "完了" },
    "recent": { "zh": "最近", "en": "Recent", "ja": "最近" },
    "totalFiles": { "zh": "共 {{count}} 个", "en": "Total: {{count}}", "ja": "全{{count}}件" },
    "new": { "zh": "新建", "en": "New", "ja": "新規" },
    "rename": { "zh": "改名", "en": "Rename", "ja": "名前変更" },
    "backup": { "zh": "备份", "en": "Backup", "ja": "バックアップ" },
    "shareAndImport": { "zh": "分享与导入", "en": "Share & Import", "ja": "共有とインポート" },
    "shareAndImportDesc": { "zh": "把当前档案发给别人，也可以接收别人发来的档案。", "en": "Share current archive with others, or import from others.", "ja": "現在のアーカイブを共有するか、他の人からアーカイブを受信します。" },
    "preparingShare": { "zh": "正在准备分享", "en": "Preparing share...", "ja": "共有の準備中..." },
    "shareDesc": { "zh": "对方可查看，也可合并。", "en": "Others can view or merge.", "ja": "相手は閲覧したり統合したりできます。" },
    "importArchive": { "zh": "导入档案", "en": "Import Archive", "ja": "アーカイブをインポート" },
    "importDesc": { "zh": "导入后再选择合并或另存。", "en": "Choose to merge or save as new after importing.", "ja": "インポート後、統合するか新規保存するかを選択します。" },
    "chooseImportMethod": { "zh": "选择导入方式", "en": "Choose Import Method", "ja": "インポート方法を選択" },
    "importMethodDesc": { "zh": "如果是同一圈牌友的新记录，建议合并；只是想单独查看，就另存为新档案。", "en": "Merge for new records from the same circle; save as new to view separately.", "ja": "同じグループの新しい記録なら統合を推奨します。単独で見たい場合は新規として保存してください。" },
    "importSummary": { "zh": "{{games}} 场比赛 · {{players}} 条选手记录", "en": "{{games}} games · {{players}} player records", "ja": "{{games}}戦 · {{players}}件のプレイヤー記録" },
    "mergeDesc": { "zh": "适合接收同一圈牌友的新记录，重复比赛会自动跳过。", "en": "Suitable for new records from the same circle. Duplicates are skipped automatically.", "ja": "同じグループの新しい記録に適しています。重複する対局は自動的にスキップされます。" },
    "saveAsNewDesc": { "zh": "保留为独立档案，不影响当前档案。", "en": "Keep as a separate archive without affecting the current one.", "ja": "独立したアーカイブとして保持し、現在のものには影響を与えません。" },
    "switchFile": { "zh": "切换档案", "en": "Switch Archive", "ja": "アーカイブを切り替え" },
    "switchFileDesc": { "zh": "切换后，历史和统计只显示该档案的记录。", "en": "History and stats will only show records from this archive.", "ja": "切り替え後、履歴と統計はこのアーカイブの記録のみを表示します。" },
    "fileStats": { "zh": "{{games}} 场比赛 · 最近 {{date}}", "en": "{{games}} games · Recent: {{date}}", "ja": "{{games}}戦 · 最近: {{date}}" },
    "current": { "zh": "当前", "en": "Current", "ja": "現在" },
    "importFailedMsg": { "zh": "导入失败。请选择本应用分享或备份的牌局档案。", "en": "Import failed. Please choose an archive shared or backed up by this app.", "ja": "インポートに失敗しました。このアプリで共有またはバックアップされたアーカイブを選択してください。" },
    "mergeNoNewGamesMsg": { "zh": "没有新增比赛。\n\n已跳过 {{skipped}} 场重复比赛。", "en": "No new games.\n\nSkipped {{skipped}} duplicate games.", "ja": "新しい対局はありません。\n\n{{skipped}}件の重複対局をスキップしました。" },
    "mergeSuccessMsg": { "zh": "合并完成。\n\n新增比赛：{{games}} 场\n跳过重复：{{skipped}} 场\n新增选手记录：{{players}} 条", "en": "Merge complete.\n\nNew games: {{games}}\nSkipped: {{skipped}}\nNew player records: {{players}}", "ja": "統合完了。\n\n新規対局：{{games}}戦\nスキップ：{{skipped}}戦\n新規プレイヤー記録：{{players}}件" },
    "mergeFailedMsg": { "zh": "合并失败，请稍后重试。", "en": "Merge failed, please try again later.", "ja": "統合に失敗しました。後でもう一度お試しください。" },
    "newFileNamePrompt": { "zh": "新档案名称：", "en": "New archive name:", "ja": "新しいアーカイブ名：" },
    "importSuccessMsg": { "zh": "已创建「{{name}}」。\n\n导入比赛：{{games}} 场\n导入选手记录：{{players}} 条", "en": "Created '{{name}}'.\n\nImported games: {{games}}\nImported player records: {{players}}", "ja": "「{{name}}」を作成しました。\n\nインポート対局：{{games}}戦\nインポートプレイヤー記録：{{players}}件" },
    "importNewFailedMsg": { "zh": "新建档案失败，请稍后重试。", "en": "Failed to create new archive, please try again later.", "ja": "新しいアーカイブの作成に失敗しました。後でもう一度お試しください。" },
    "backupSavedMsg": { "zh": "备份已保存。\n\n位置：Documents/{{fileName}}", "en": "Backup saved.\n\nLocation: Documents/{{fileName}}", "ja": "バックアップを保存しました。\n\n場所：Documents/{{fileName}}" },
    "backupFailedPermissionMsg": { "zh": "备份失败，请检查存储权限。", "en": "Backup failed, please check storage permissions.", "ja": "バックアップに失敗しました。ストレージの権限を確認してください。" },
    "archiveBackedUpMsg": { "zh": "档案已备份。", "en": "Archive backed up.", "ja": "アーカイブをバックアップしました。" },
    "backupFailedMsg": { "zh": "备份失败。", "en": "Backup failed.", "ja": "バックアップに失敗しました。" },
    "shareTitle": { "zh": "{{name}} · 牌局档案", "en": "{{name}} · Game Archive", "ja": "{{name}} · アーカイブ" },
    "shareText": { "zh": "这是一份国标麻将计分档案。接收后可选择合并或另存；合并时会自动跳过重复比赛。", "en": "This is a Mahjong score archive. You can choose to merge or save as new; duplicates are automatically skipped when merging.", "ja": "これは麻雀のスコアアーカイブです。受信後、統合するか新規保存するかを選択できます。統合時、重複する対局は自動的にスキップされます。" },
    "shareDialogTitle": { "zh": "分享牌局档案", "en": "Share Game Archive", "ja": "アーカイブを共有" },
    "shareNotSupportedMsg": { "zh": "当前浏览器不支持直接分享，已下载备份文件。", "en": "Direct sharing is not supported by current browser, backup file downloaded.", "ja": "現在のブラウザは直接の共有をサポートしていません。バックアップファイルをダウンロードしました。" },
    "shareFailedMsg": { "zh": "分享档案失败，请稍后重试。", "en": "Failed to share archive, please try again later.", "ja": "アーカイブの共有に失敗しました。後でもう一度お試しください。" },
    "noRecord": { "zh": "暂无记录", "en": "No record", "ja": "記録なし" }
  },
  "device": {
    "notSet": { "zh": "未设置", "en": "Not set", "ja": "未設定" },
    "mahjongScoreboard": { "zh": "麻将计分板", "en": "Mahjong Scoreboard", "ja": "麻雀スコアボード" },
    "deviceId": { "zh": "设备号: {{id}}", "en": "Device ID: {{id}}", "ja": "デバイスID: {{id}}" },
    "followView": { "zh": "视角跟随: ", "en": "Follow View: ", "ja": "視点追従: " },
    "position": { "zh": "位", "en": "Seat", "ja": "家" },
    "switch": { "zh": "切换", "en": "Switch", "ja": "切り替え" },
    "win": { "zh": "和牌", "en": "Win", "ja": "和了" },
    "roundDraw": { "zh": "本局荒庄", "en": "Round Draw", "ja": "流局" },
    "selectFollowPlayer": { "zh": "选择你要跟随的选手", "en": "Select player to follow", "ja": "追従するプレイヤーを選択" },
    "followPlayerDesc": { "zh": "手机屏幕会自动旋转，确保该选手始终在正下方", "en": "Screen will automatically rotate to keep this player at the bottom", "ja": "画面は自動的に回転し、このプレイヤーが常に下部に表示されるようにします" },
    "posSeat": { "zh": "{{pos}}位", "en": "Seat {{pos}}", "ja": "{{pos}}家" }
  },
  "common": {
    "generating": { "zh": "生成中…", "en": "Generating...", "ja": "生成中..." },
    "update": { "zh": "更新", "en": "Update", "ja": "更新" }
  }
}

for lang in locales:
    file_path = os.path.join(locales_path, f"{lang}.json")
    with open(file_path, 'r', encoding='utf-8') as f:
        # Load parsing out trailing commas etc if possible, but python json strict
        # The file might have syntax errors in json because of trailing commas, let's just strip them
        content_str = f.read()
        import re
        content_str = re.sub(r',\s*}', '}', content_str)
        content_str = re.sub(r',\s*]', ']', content_str)
        content = json.loads(content_str)
        
    for group, keys in new_keys.items():
        if group not in content:
            content[group] = {}
        for key, vals in keys.items():
            content[group][key] = vals[lang]
            
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(content, f, ensure_ascii=False, indent=2)

