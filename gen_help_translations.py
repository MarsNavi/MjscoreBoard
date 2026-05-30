import json

strings = {
    "版本更新": ("versionHistory", "Version History", "バージョン履歴"),
    "更新内容：": ("updateContent", "Updates:", "更新内容:"),
    "手机可作为显示设备：": ("v1_6_1_title", "Mobile as Display:", "スマホをディスプレイに:"),
    "无需硬件计分板，闲置手机即可充当计分显示屏。在首页点击「作为显示屏」进入外设模式，另一台手机扫描蓝牙即可连接。": ("v1_6_1_desc", "No hardware scoreboard needed. Use an idle phone as display. Click 'Use as Display' on homepage.", "ハードウェアスコアボードは不要です。アイドル状態のスマホをディスプレイとして使用できます。"),
    "智能视角跟随：": ("v1_6_2_title", "Smart View Follow:", "スマートビュー追従:"),
    "手机显示屏会自动跟随选手，换位后无需手动调整，始终保证自己的分数在最下方。": ("v1_6_2_desc", "The display automatically follows the player, keeping their score at the bottom without manual adjustment.", "ディスプレイは自動的にプレイヤーを追従し、手動調整なしで常に自分のスコアを一番下に保ちます。"),
    "蓝牙架构升级：": ("v1_6_3_title", "Bluetooth Architecture Upgrade:", "Bluetoothアーキテクチャのアップグレード:"),
    "底层蓝牙引擎全面升级，同时支持主控端和外设端双角色。": ("v1_6_3_desc", "Bluetooth engine upgraded, supporting both host and peripheral roles.", "Bluetoothエンジンがアップグレードされ、ホストと周辺機器の両方の役割をサポートします。"),
    "对局详情长图分享：": ("v1_5_1_title", "Game Detail Image Share:", "対局詳細画像共有:"),
    "支持一键生成精美的对局明细长图，包括名次卡片和大番牌局的趣味标记。": ("v1_5_1_desc", "One-click generation of beautiful game detail images, including rank cards and interesting marks for big wins.", "ランキングカードや大役の面白いマークを含む、美しい対局詳細画像をワンクリックで生成します。"),
    "计分板设备号显示优化：": ("v1_5_2_title", "Scoreboard Device ID Display:", "スコアボードデバイスID表示:"),
    "设备通电即可看到蓝牙设备号，方便与主机配对。": ("v1_5_2_desc", "Device ID is visible on power-up for easy pairing.", "電源を入れるとデバイスIDが表示され、ペアリングが簡単になります。"),
    "成绩统计支持长图分享：": ("v1_4_1_title", "Stats Image Share:", "成績統計画像共有:"),
    "在成绩统计页新增分享按钮，可生成包含战绩一览、攻守数据和和牌数据的长图，方便赛后保存和转发。": ("v1_4_1_desc", "Added share button in stats page to generate comprehensive stats image.", "成績ページに共有ボタンを追加し、総合的な成績画像を生成します。"),
    "新增牌局档案切换：": ("v1_4_2_title", "Archive Switching:", "アーカイブ切り替え:"),
    "支持为不同牌友圈创建独立档案，也可以把别人分享的档案另存或合并。": ("v1_4_2_desc", "Support creating independent archives for different groups.", "異なるグループのために独立したアーカイブを作成できます。"),
    "新增牌局档案分享：": ("v1_4_3_title", "Archive Sharing:", "アーカイブ共有:"),
    "可以把当前档案直接分享给其他人，对方可导入成新档案，也可以合并到自己的档案里。": ("v1_4_3_desc", "Share current archive with others directly.", "現在のアーカイブを他の人と直接共有できます。"),
    "修正同名选手统计：": ("v1_4_4_title", "Fix Same-name Stats:", "同名プレイヤー統計の修正:"),
    "自动清理名字前后的空格，避免同一个人因为输入差异被拆成多条统计记录。": ("v1_4_4_desc", "Auto-trim spaces in names to prevent duplicate stats for the same person.", "名前のスペースを自動的にトリミングし、同じ人の統計が重複するのを防ぎます。"),
    "优化硬件计分牌中文显示：": ("v1_4_5_title", "Optimize Chinese Display on Scoreboard:", "スコアボードの中国語表示最適化:"),
    "统一使用完整中文字体资源，修复部分计分牌中文字显示成方框的问题。": ("v1_4_5_desc", "Fixed Chinese character display issues on hardware scoreboards.", "ハードウェアスコアボードでの中国語文字表示の不具合を修正しました。"),
    "修复成绩统计：": ("v1_3_1_title", "Fix Stats:", "成績統計の修正:"),
    "修正标准分计算逻辑，历史数据统计更准确。": ("v1_3_1_desc", "Fixed standard score calculation for more accurate historical stats.", "より正確な履歴統計のために標準スコアの計算を修正しました。"),
    "新增和牌统计：": ("v1_3_2_title", "New Win Stats:", "新しい和了統計:"),
    "增加和牌数、番数分布、最大番等统计。": ("v1_3_2_desc", "Added stats for win count, fan distribution, max fan, etc.", "和了数、翻数分布、最大翻数などの統計を追加しました。"),
    "优化硬件计分牌：": ("v1_3_3_title", "Optimize Hardware Scoreboard:", "ハードウェアスコアボードの最適化:"),
    "改进硬件计分牌的连接与显示体验。": ("v1_3_3_desc", "Improved connection and display experience for hardware scoreboards.", "ハードウェアスコアボードの接続と表示体験を改善しました。"),
    "小屏适配优化：": ("v1_1_1_title", "Small Screen Optimization:", "小画面最適化:"),
    "优化了在小屏设备上的显示效果，确保所有功能按钮都能在屏幕内完整显示，操作更加便捷。": ("v1_1_1_desc", "Optimized display for small screens.", "小画面向けの表示を最適化しました。"),
    "流程简化：": ("v1_1_2_title", "Process Simplification:", "プロセスの簡素化:"),
    "取消了“确认成绩”环节，和牌或流局后直接生效，让比赛节奏更加流畅。": ("v1_1_2_desc", "Removed 'confirm score' step for smoother game pacing.", "ゲームのペースをスムーズにするため、「スコア確認」ステップを削除しました。"),
    "智能硬件支持：": ("v1_1_3_title", "Smart Hardware Support:", "スマートハードウェアサポート:"),
    "支持蓝牙绑定认证的自研 BLE 计分设备，实现“一人一屏”的专属显示与交互体验。": ("v1_1_3_desc", "Supported proprietary BLE scoreboards for personalized experience.", "パーソナライズされた体験のために独自のBLEスコアボードをサポートしました。"),
    "v1.0 正式发布：": ("v1_0_title", "v1.0 Official Release:", "v1.0 正式リリース:"),
    "所有记录和统计均在本地运行，不需要联网也可以使用": ("v1_0_1_desc", "All records and stats run locally, usable without internet.", "すべての記録と統計はローカルで実行され、インターネットなしで使用できます。"),
    "支持牌局档案分享、导入和备份，方便换设备或与牌友同步记录": ("v1_0_2_desc", "Support archive sharing, import, and backup.", "アーカイブの共有、インポート、バックアップをサポートします。"),
    "快速开局智能记忆：": ("v0_6_1_title", "Quick Start Memory:", "クイックスタートメモリ:"),
    "开局时自动读取上次比赛的名称和选手名单，无需重复输入。": ("v0_6_1_desc", "Auto-load previous game name and players on start.", "開始時に前回の対局名とプレイヤーを自動的に読み込みます。"),
    "选手输入优化：": ("v0_6_2_title", "Player Input Optimization:", "プレイヤー入力の最適化:"),
    "常用选手列表更稳定，开局时可快速选择历史姓名。": ("v0_6_2_desc", "More stable common players list.", "よく使うプレイヤーリストがより安定しました。"),
    "比赛历史改进：": ("v0_6_3_title", "History Improvement:", "履歴の改善:"),
    "历史页支持查看比赛结果，并提供近 24 小时小计，方便结算。": ("v0_6_3_desc", "History page shows game results and 24h summary.", "履歴ページに対局結果と24時間の概要を表示します。"),
    "成绩统计优化：": ("v0_6_4_title", "Stats Optimization:", "統計の最適化:"),
    "在成绩统计中增加攻守数据，统计和牌、自摸和放铳情况。": ("v0_6_4_desc", "Added attack/defense data in stats.", "統計に攻守データを追加しました。"),
    "主要功能：": ("mainFeatures", "Main Features:", "主な機能:"),
    "如何开局": ("howToStart", "How to Start", "開始方法"),
    "填写比赛名称（可选）": ("start_1", "Enter game name (optional)", "対局名を入力（任意）"),
    "填写四位选手姓名（东、南、西、北）": ("start_2", "Enter 4 player names", "4人のプレイヤー名を入力"),
    "点按“开始比赛”，创建 16 盘国标麻将比赛": ("start_3", "Click 'Start Game' to create a 16-round match", "「開始」をクリックして16局の対局を作成"),
    "系统自动进行座位轮换": ("start_4", "System auto-rotates seats", "システムが自動的に座席をローテーションします"),
    "如何计分": ("howToScore", "How to Score", "スコアの付け方"),
    "和牌选手点按“和”录入番数": ("score_1", "Winner clicks 'Win' to enter fan", "勝者は「和」をクリックして翻数を入力"),
    "支持自摸和点炮两种情况": ("score_2", "Supports Tsumo and Ron", "ツモとロンをサポート"),
    "系统自动计算分数变化": ("score_3", "System auto-calculates score changes", "システムが自動的にスコア変更を計算"),
    "第 16 盘结束后自动保存比赛成绩": ("score_4", "Auto-saves after 16th round", "16局終了後に自動保存"),
    "荒庄和裁判判罚": ("drawAndPenalty", "Draws and Penalties", "流局と罰符"),
    "荒庄时点按“荒庄”": ("dp_1", "Click 'Draw' for a draw", "流局時に「流局」をクリック"),
    "支持裁判判罚功能（加分/扣分）": ("dp_2", "Supports referee penalties (+/- points)", "審判の罰符機能（加点/減点）をサポート"),
    "可处理错和、诈和等违规情况": ("dp_3", "Handles Chombo and other violations", "チョンボなどの違反を処理できます"),
    "比赛历史管理": ("historyManagement", "History Management", "履歴管理"),
    "查看所有比赛记录": ("hist_1", "View all game records", "すべての対局記録を表示"),
    "继续未完成的比赛": ("hist_2", "Resume unfinished games", "未完了の対局を再開"),
    "自动恢复比赛进度和分数": ("hist_3", "Auto-restore progress and scores", "進行状況とスコアを自動的に復元"),
    "查看完整的比赛详情": ("hist_4", "View complete game details", "完全な対局詳細を表示"),
    "成绩统计功能": ("statsFunction", "Stats Function", "統計機能"),
    "查看所有已完成比赛的战绩": ("stat_1", "View stats of all completed games", "完了したすべての対局の統計を表示"),
    "选手数据统计分析": ("stat_2", "Player data analysis", "プレイヤーデータの分析"),
    "本应用由四川熊猫俱乐部赞助": ("sponsor", "Sponsored by Sichuan Panda Club", "四川パンダクラブ提供"),
    "作者 李睿": ("author", "Author: Li Rui", "著者: Li Rui"),
    "语言设置": ("languageSettings", "Language Settings", "言語設定")
}

for lang, idx in [('zh', 0), ('en', 1), ('ja', 2)]:
    with open(f'src/i18n/locales/{lang}.json', 'r') as f:
        data = json.load(f)
    if 'help' not in data:
        data['help'] = {}
    for cn, tupl in strings.items():
        key = tupl[0]
        val = tupl[idx] if idx != 0 else cn
        data['help'][key] = val
    with open(f'src/i18n/locales/{lang}.json', 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

with open('src/components/HelpPage.tsx', 'r') as f:
    content = f.read()

for cn, tupl in strings.items():
    key = tupl[0]
    content = content.replace(f">{cn}<", f">{{t('help.{key}')}}<")
    content = content.replace(f"> {cn} <", f"> {{t('help.{key}')}} <")
    content = content.replace(f"\"{cn}\"", f"{{t('help.{key}')}}")
    content = content.replace(f"> {cn}", f">{{t('help.{key}')}}")
    content = content.replace(f"{cn} <", f"{{t('help.{key}')}}<")
    content = content.replace(cn, f"{{t('help.{key}')}}")

with open('src/components/HelpPage.tsx', 'w') as f:
    f.write(content)
