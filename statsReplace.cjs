const fs = require('fs');
let content = fs.readFileSync('src/lib/statsShareImage.ts', 'utf8');

content = "import i18n from '../i18n';\n" + content;

content = content.replace(/'国标麻将成绩统计'/g, "i18n.t('shareImage.statsTitle')");
content = content.replace(/`生成时间：\$\{formatDate\(generatedAt\)\}`/g, "i18n.t('shareImage.generatedAt', { time: formatDate(generatedAt) })");
content = content.replace(/'赛后长图 · 可保存分享'/g, "i18n.t('shareImage.statsSubtitle')");
content = content.replace(/'选手数'/g, "i18n.t('shareImage.playerCount')");
content = content.replace(/'完成比赛'/g, "i18n.t('shareImage.completedGames')");
content = content.replace(/'当前领先'/g, "i18n.t('shareImage.currentLeader')");
content = content.replace(/'领先标准分'/g, "i18n.t('shareImage.leaderScore')");

content = content.replace(/'战绩一览'/g, "i18n.t('stats.overview')");
content = content.replace(/'选手'/g, "i18n.t('game.playerName')");
content = content.replace(/'场次'/g, "i18n.t('stats.totalGames')");
content = content.replace(/'总标准分'/g, "i18n.t('shareImage.totalStandardScore')");
content = content.replace(/'平均标准分'/g, "i18n.t('shareImage.averageStandardScore')");
content = content.replace(/'总比赛分'/g, "i18n.t('game.totalScore')");

content = content.replace(/'攻守数据'/g, "i18n.t('stats.attackDefense')");
content = content.replace(/'总盘数'/g, "i18n.t('shareImage.totalRounds')");
content = content.replace(/'和牌盘数'/g, "i18n.t('shareImage.winRounds')");
content = content.replace(/'和牌率'/g, "i18n.t('stats.winRate')");
content = content.replace(/'和牌平均番'/g, "i18n.t('stats.avgWinFan')");
content = content.replace(/'自摸盘数'/g, "i18n.t('shareImage.selfDrawRounds')");
content = content.replace(/'自摸率'/g, "i18n.t('stats.selfDrawRate')");
content = content.replace(/'放铳盘数'/g, "i18n.t('shareImage.loserRounds')");
content = content.replace(/'放铳率'/g, "i18n.t('stats.loserRate')");
content = content.replace(/'放铳平均番'/g, "i18n.t('shareImage.avgLoserFan')");

content = content.replace(/'和牌数据'/g, "i18n.t('stats.winData')");
content = content.replace(/'和牌总盘数'/g, "i18n.t('shareImage.totalWinRounds')");
content = content.replace(/'8-15番'/g, "i18n.t('shareImage.fan8_15')");
content = content.replace(/'16-30番'/g, "i18n.t('shareImage.fan16_30')");
content = content.replace(/'31-63番'/g, "i18n.t('shareImage.fan31_63')");
content = content.replace(/'64番\+'/g, "i18n.t('shareImage.fan64_plus')");
content = content.replace(/'点和最大番'/g, "i18n.t('shareImage.maxFanRong')");
content = content.replace(/'自摸最大番'/g, "i18n.t('stats.maxWinFan')");

content = content.replace(/'由「国标麻将实时计分板」生成'/g, "i18n.t('shareImage.footerGenerator')");

content = content.replace(/'无法生成成绩统计图片'/g, "i18n.t('shareImage.errorGenerateStats')");
content = content.replace(/'当前设备无法创建分享图片'/g, "i18n.t('shareImage.errorDeviceStats')");
content = content.replace(/'读取图片失败'/g, "i18n.t('shareImage.errorReadImage')");

fs.writeFileSync('src/lib/statsShareImage.ts', content, 'utf8');

