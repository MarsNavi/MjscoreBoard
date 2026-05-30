const fs = require('fs');
let content = fs.readFileSync('src/lib/gameDetailShareImage.ts', 'utf8');

content = "import i18n from '../i18n';\n" + content;

content = content.replace(/'国标麻将对局明细'/g, "i18n.t('shareImage.gameDetailTitle')");
content = content.replace(/game\.game_name \? \`比赛名称：\$\{game\.game_name\}\` : '标准 16 盘比赛对局'/g, "game.game_name ? `${i18n.t('shareImage.gameNamePrefix')}${game.game_name}` : i18n.t('shareImage.standard16Games')");
content = content.replace(/`生成时间：\$\{formatDate\(generatedAt\)\}  \|  局数：\$\{scores.length\}\/16`/g, "`${i18n.t('shareImage.generatedAt', { time: formatDate(generatedAt) })}  |  ${i18n.t('shareImage.roundCount', { count: scores.length })}`");
content = content.replace(/'第一名'/g, "i18n.t('shareImage.rank1')");
content = content.replace(/'第二名'/g, "i18n.t('shareImage.rank2')");
content = content.replace(/'第三名'/g, "i18n.t('shareImage.rank3')");
content = content.replace(/'第四名'/g, "i18n.t('shareImage.rank4')");

content = content.replace(/`标准分 \$\{result\.standard_score\.toFixed\(1\)\}`/g, "i18n.t('shareImage.standardScore', { score: result.standard_score.toFixed(1) })");

content = content.replace(/`🔥 和牌最多 \(\$\{winCounts\[result\.player_id\]\}局\)`/g, "i18n.t('shareImage.mostWins', { count: winCounts[result.player_id] })");
content = content.replace(/`🎯 点炮最多 \(\$\{discardCounts\[result\.player_id\]\}局\)`/g, "i18n.t('shareImage.mostDiscards', { count: discardCounts[result.player_id] })");
content = content.replace(/`👑 斩获大番 \(\$\{maxSingleFan\}番\)`/g, "i18n.t('shareImage.maxFan', { fan: maxSingleFan })");

content = content.replace(/'对局明细'/g, "i18n.t('game.gameDetail')");
content = content.replace(/'局数'/g, "i18n.t('shareImage.roundStr')");

content = content.replace(/`第 \$\{score\.game_number\} 局`/g, "i18n.t('shareImage.roundNumber', { number: score.game_number })");

content = content.replace(/`💥 爆自摸 \$\{fanCount\}番`/g, "i18n.t('shareImage.explosiveSelfDraw', { fan: fanCount })");
content = content.replace(/`👑 狂轰 \$\{fanCount\}番`/g, "i18n.t('shareImage.massiveWin', { fan: fanCount })");
content = content.replace(/`🔥 大牌 \$\{fanCount\}番`/g, "i18n.t('shareImage.bigWin', { fan: fanCount })");
content = content.replace(/`💀 痛击点炮 \$\{fanCount\}番`/g, "i18n.t('shareImage.painfulDiscard', { fan: fanCount })");
content = content.replace(/`🎯 放铳 \$\{fanCount\}番`/g, "i18n.t('shareImage.discardFan', { fan: fanCount })");

content = content.replace(/'裁判判罚'/g, "i18n.t('shareImage.refereePenalty')");

content = content.replace(/'牌局趣闻'/g, "i18n.t('shareImage.funFactsTitle')");

// We should be careful about replacing strings that are part of expressions
content = content.replace(/ : '均无和牌'/g, " : i18n.t('shareImage.noWins')");
content = content.replace(/ : '无人点炮'/g, " : i18n.t('shareImage.noDiscards')");
content = content.replace(/ : '无大牌出现'/g, " : i18n.t('shareImage.noBigWins')");
// wait, maxFanPlayer ? p.name || '无'
content = content.replace(/\|\| '无'/g, "|| i18n.t('shareImage.none')");
content = content.replace(/ : '无'/g, " : i18n.t('shareImage.none')");

content = content.replace(/`斩获 \$\{maxWins\} 局 \/ 胜率 \$\{\(maxWins \/ \(scores\.length \|\| 1\) \* 100\)\.toFixed\(0\)\}%`/g, "i18n.t('shareImage.winStats', { count: maxWins, rate: (maxWins / (scores.length || 1) * 100).toFixed(0) })");
content = content.replace(/`接炮 \$\{maxDiscards\} 局 \/ 点炮率 \$\{\(maxDiscards \/ \(scores\.length \|\| 1\) \* 100\)\.toFixed\(0\)\}%`/g, "i18n.t('shareImage.discardStats', { count: maxDiscards, rate: (maxDiscards / (scores.length || 1) * 100).toFixed(0) })");
content = content.replace(/`单盘极意砍下 \$\{maxSingleFan\} 番！`/g, "i18n.t('shareImage.singleMaxFanStats', { fan: maxSingleFan })");

content = content.replace(/`共对决 \$\{scores\.length\} 局`/g, "i18n.t('shareImage.totalRoundsStats', { count: scores.length })");
content = content.replace(/`自摸 \$\{selfDrawCount\} 局 · 荒庄 \$\{drawCount\} 局`/g, "i18n.t('shareImage.drawStats', { selfDraw: selfDrawCount, draw: drawCount })");

content = content.replace(/'🏆 和牌之王'/g, "i18n.t('shareImage.kingOfWins')");
content = content.replace(/'🎯 点炮大师'/g, "i18n.t('shareImage.masterOfDiscards')");
content = content.replace(/'👑 单局至尊'/g, "i18n.t('shareImage.supremeSingleRound')");
content = content.replace(/'📊 战局风云'/g, "i18n.t('shareImage.battleStats')");

content = content.replace(/'由「国标麻将实时计分板」生成  ·  四川熊猫国标俱乐部赞助'/g, "i18n.t('shareImage.footerSponsor')");

content = content.replace(/'无法生成对局明细图片'/g, "i18n.t('shareImage.errorGenerateDetail')");
content = content.replace(/'当前设备无法创建对局明细分享图片'/g, "i18n.t('shareImage.errorDeviceDetail')");

fs.writeFileSync('src/lib/gameDetailShareImage.ts', content, 'utf8');

