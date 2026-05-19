import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9333);
const phoneOutputDir = path.resolve('ios/App/AppStoreScreenshots/zh-Hans');
const ipadOutputDir = path.resolve('ios/App/AppStoreScreenshots/zh-Hans-iPad13');
const rawOutputDir = path.resolve('/tmp/mjscoreboard-appstore-raw');
const userDataDir = path.resolve('/tmp/mjscoreboard-appstore-chrome-profile');
const demoImportPath = path.resolve('/tmp/mjscoreboard-demo-import.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const devices = [
  {
    key: 'phone',
    width: 428,
    height: 926,
    scale: 3,
    outputWidth: 1284,
    outputHeight: 2778,
    outputDir: phoneOutputDir,
    frameWidth: 1042,
    frameY: 430,
    radius: 58,
    titleSize: 82,
    subtitleSize: 38,
  },
  {
    key: 'ipad',
    width: 1024,
    height: 1366,
    scale: 2,
    outputWidth: 2048,
    outputHeight: 2732,
    outputDir: ipadOutputDir,
    frameWidth: 1718,
    frameY: 355,
    radius: 54,
    titleSize: 86,
    subtitleSize: 36,
  },
];

const slides = [
  {
    id: '01-quick-start',
    filenamePhone: '01-quick-start-1284x2778.png',
    filenameIpad: '01-quick-start-2048x2732.png',
    tag: '快速开局',
    title: '填好名字，直接开打',
    subtitle: '16 盘制、座位轮换、常用选手，一张开局页处理清楚。',
    accent: '#f97316',
    route: '',
    prepare: async (client) => {
      await waitFor(client, "document.body.innerText.includes('快速开局')");
      await setTextInputs(client, ['今晚决赛桌', '林一', '赵晴', '阿杰', '小周']);
    },
  },
  {
    id: '02-live-scoreboard',
    filenamePhone: '02-live-scoreboard-1284x2778.png',
    filenameIpad: '02-live-scoreboard-2048x2732.png',
    tag: '实时计分',
    title: '东南西北，一屏看清',
    subtitle: '手机作为中控，比分计算、座位轮换和计分牌同步都在这里。',
    accent: '#0ea5e9',
    route: 'game',
    prepare: async (client) => {
      await ensureGameStarted(client);
    },
  },
  {
    id: '03-score-entry',
    filenamePhone: '03-score-entry-1284x2778.png',
    filenameIpad: '03-score-entry-2048x2732.png',
    tag: '录分',
    title: '自摸点炮，少点几次',
    subtitle: '选和牌方、点炮方和番数，本盘分数自动算好。',
    accent: '#22c55e',
    route: 'score',
    prepare: async (client) => {
      await ensureGameStarted(client);
      await evaluate(client, `
        (() => {
          const buttons = [...document.querySelectorAll('button')];
          const winButtons = buttons.filter((button) => button.textContent.trim() === '和');
          winButtons[winButtons.length - 1]?.click();
          return true;
        })()
      `);
      await waitFor(client, "document.body.innerText.includes('家和牌') && document.body.innerText.includes('自摸')");
      await evaluate(client, `
        [...document.querySelectorAll('button')]
          .find((button) => button.textContent.trim() === '自摸')
          ?.click()
      `);
      await sleep(350);
    },
  },
  {
    id: '04-stats',
    filenamePhone: '04-stats-1284x2778.png',
    filenameIpad: '04-stats-2048x2732.png',
    tag: '成绩统计',
    title: '谁赢得稳定，一眼看出',
    subtitle: '标准分、和牌率、放铳率和最大番，打完就能复盘。',
    accent: '#e11d48',
    route: '/stats',
    prepare: async (client) => {
      await navigateHash(client, '/stats');
      await waitFor(client, "document.body.innerText.includes('成绩统计') && document.body.innerText.includes('战绩一览')");
      await evaluate(client, `window.scrollTo({ top: 0, left: 0, behavior: 'auto' })`);
      await sleep(400);
    },
  },
  {
    id: '05-data-files',
    filenamePhone: '05-data-files-1284x2778.png',
    filenameIpad: '05-data-files-2048x2732.png',
    tag: '档案分享',
    title: '不同牌友圈，分开保存',
    subtitle: '档案可分享、合并或另存，重复比赛自动跳过。',
    accent: '#7c3aed',
    route: '/data',
    prepare: async (client) => {
      await navigateHash(client, '/data');
      await waitFor(client, "document.body.innerText.includes('牌局档案') && document.body.innerText.includes('分享当前档案')");
      await showImportModal(client);
      await sleep(500);
    },
  },
];

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.json();
}

async function isAppReachable() {
  try {
    const response = await fetch(appUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApp() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await isAppReachable()) return;
    await sleep(350);
  }
  throw new Error(`App did not become reachable: ${appUrl}`);
}

async function waitForChrome() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
      if (targets.webSocketDebuggerUrl) return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Chrome remote debugging endpoint did not become ready.');
}

function connect(wsUrl) {
  let nextId = 1;
  const pending = new Map();
  const socket = new WebSocket(wsUrl);

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message));
    } else {
      resolve(message.result);
    }
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveMessage, rejectMessage) => {
            pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
          });
        },
        close() {
          socket.close();
        },
      });
    });
    socket.addEventListener('error', reject);
  });
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed.');
  }
  return result.result.value;
}

async function waitFor(client, expression, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function setTextInputs(client, values) {
  await evaluate(client, `
    (() => {
      const setInput = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const inputs = [...document.querySelectorAll('input[type="text"]')];
      ${JSON.stringify(values)}.forEach((value, index) => {
        if (inputs[index]) setInput(inputs[index], value);
      });
      return true;
    })()
  `);
  await sleep(400);
}

async function navigateHash(client, hash) {
  await evaluate(client, `
    (() => {
      window.location.hash = ${JSON.stringify(hash)};
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return true;
    })()
  `);
  await sleep(550);
}

async function ensureGameStarted(client) {
  if (await evaluate(client, "document.body.innerText.includes('荒庄') && document.body.innerText.includes('撤销')")) {
    return;
  }
  await navigateHash(client, '');
  await waitFor(client, "document.body.innerText.includes('快速开局')");
  await setTextInputs(client, ['今晚决赛桌', '林一', '赵晴', '阿杰', '小周']);
  await evaluate(client, `
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('开始比赛'))
      ?.click()
  `);
  await waitFor(client, "document.body.innerText.includes('1/16') && document.body.innerText.includes('荒庄')");
  await sleep(500);
}

async function captureRaw(client, filePath) {
  const image = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  await writeFile(filePath, Buffer.from(image.data, 'base64'));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function backgroundSvg({ width, height, slide, device }) {
  const titleY = device.key === 'phone' ? 156 : 136;
  const subtitleY = titleY + (device.key === 'phone' ? 86 : 88);
  const tagY = device.key === 'phone' ? 94 : 82;
  const tagX = device.key === 'phone' ? 112 : 154;
  const titleX = tagX;
  const subtitleX = tagX;
  const pillWidth = device.key === 'phone' ? 230 : 220;
  const pillHeight = device.key === 'phone' ? 54 : 50;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff7ed"/>
          <stop offset="0.48" stop-color="#fff1f2"/>
          <stop offset="1" stop-color="#f8fafc"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="${slide.accent}" stop-opacity="0.28"/>
          <stop offset="1" stop-color="${slide.accent}" stop-opacity="0"/>
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="34" stdDeviation="34" flood-color="#111827" flood-opacity="0.22"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <circle cx="${width - width * 0.08}" cy="${height * 0.08}" r="${width * 0.32}" fill="url(#glow)"/>
      <circle cx="${width * 0.08}" cy="${height * 0.92}" r="${width * 0.34}" fill="${slide.accent}" opacity="0.08"/>
      <path d="M ${width * 0.06} ${height * 0.19} C ${width * 0.3} ${height * 0.12}, ${width * 0.58} ${height * 0.24}, ${width * 0.94} ${height * 0.15}" fill="none" stroke="${slide.accent}" stroke-opacity="0.18" stroke-width="6" stroke-linecap="round"/>
      <rect x="${tagX}" y="${tagY - 38}" width="${pillWidth}" height="${pillHeight}" rx="${pillHeight / 2}" fill="${slide.accent}" opacity="0.12"/>
      <text x="${tagX + 30}" y="${tagY}" font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="${device.key === 'phone' ? 31 : 30}" font-weight="800" fill="${slide.accent}" letter-spacing="5">${escapeXml(slide.tag)}</text>
      <text x="${titleX}" y="${titleY}" font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="${device.titleSize}" font-weight="900" fill="#111827">${escapeXml(slide.title)}</text>
      <text x="${subtitleX}" y="${subtitleY}" font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="${device.subtitleSize}" font-weight="650" fill="#4b5563">${escapeXml(slide.subtitle)}</text>
    </svg>
  `;
}

async function roundedImage(input, width, radius) {
  const resized = await sharp(input).resize({ width }).png().toBuffer();
  const meta = await sharp(resized).metadata();
  const mask = Buffer.from(`
    <svg width="${meta.width}" height="${meta.height}" viewBox="0 0 ${meta.width} ${meta.height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${meta.width}" height="${meta.height}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>
  `);
  return {
    buffer: await sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(),
    width: meta.width,
    height: meta.height,
  };
}

async function composeMarketingScreenshot(rawPath, outputPath, slide, device) {
  const app = await roundedImage(rawPath, device.frameWidth, device.radius);
  const x = Math.round((device.outputWidth - app.width) / 2);
  const y = device.frameY;
  const shadow = Buffer.from(`
    <svg width="${device.outputWidth}" height="${device.outputHeight}" viewBox="0 0 ${device.outputWidth} ${device.outputHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="36" stdDeviation="42" flood-color="#0f172a" flood-opacity="0.25"/>
        </filter>
      </defs>
      <rect x="${x}" y="${y}" width="${app.width}" height="${app.height}" rx="${device.radius}" fill="#ffffff" filter="url(#s)"/>
      <rect x="${x - 2}" y="${y - 2}" width="${app.width + 4}" height="${app.height + 4}" rx="${device.radius + 2}" fill="none" stroke="${slide.accent}" stroke-opacity="0.18" stroke-width="4"/>
    </svg>
  `);

  await sharp(Buffer.from(backgroundSvg({
    width: device.outputWidth,
    height: device.outputHeight,
    slide,
    device,
  })))
    .composite([
      { input: shadow, top: 0, left: 0 },
      { input: app.buffer, top: y, left: x },
    ])
    .png()
    .toFile(outputPath);
}

async function seedDemoData(client) {
  await writeFile(demoImportPath, JSON.stringify({
    exported_at: new Date().toISOString(),
    app_version: '1.5',
    data_file: { id: 'demo-shared', name: '上海出差局' },
    users: [{ id: 'demo-shared', code: '上海出差局', created_at: new Date().toISOString(), last_login_at: new Date().toISOString() }],
    games: [
      { id: 'shared-game-1', created_at: new Date().toISOString(), current_round: 4, current_game: 16, status: 'finished', game_name: '客场交流赛', is_completed: true, creator_id: 'demo-shared' },
    ],
    players: [],
    scores: [],
    penalties: [],
    game_results: [],
  }, null, 2));

  await evaluate(client, `
    (async () => {
      const { db } = await import('/src/lib/db.ts');
      const { buildPlayersWithCalculatedScores, buildGameResults, getPositionForPlayerInRound } = await import('/src/lib/gameScoring.ts');

      const now = new Date('2026-05-19T12:00:00+08:00');
      const isoAt = (daysAgo, minutes = 0) => new Date(now.getTime() - daysAgo * 86400000 + minutes * 60000).toISOString();
      const defaultUser = { id: 'default-data-file', code: '雀友会 · 周赛', created_at: isoAt(18), last_login_at: isoAt(0) };
      const users = [
        defaultUser,
        { id: 'travel-file', code: '上海出差局', created_at: isoAt(5), last_login_at: isoAt(2) },
        { id: 'training-file', code: '老同学训练局', created_at: isoAt(30), last_login_at: isoAt(10) },
      ];

      const positions = ['east', 'south', 'west', 'north'];
      const playerIds = ['A', 'B', 'C', 'D'];
      const names = ['林一', '赵晴', '阿杰', '小周'];
      const patterns = [
        [['A', null, 16], ['C', 'D', 8], ['B', 'A', 24], ['D', null, 12], ['A', 'B', 32], ['A', null, 8], ['C', 'B', 16], ['B', 'D', 8], ['D', null, 48], ['A', 'C', 12], ['C', null, 8], ['B', 'A', 16], ['A', null, 24], ['D', 'C', 8], ['A', 'D', 64], ['B', null, 8]],
        [['B', null, 8], ['A', 'D', 16], ['A', null, 32], ['C', 'B', 8], ['D', 'A', 24], ['A', null, 12], ['B', 'C', 16], ['A', 'B', 8], ['C', null, 32], ['D', 'C', 12], ['A', 'D', 8], ['B', null, 24], ['A', 'C', 48], ['C', 'A', 8], ['D', null, 16], ['A', 'B', 8]],
        [['C', 'A', 12], ['C', null, 16], ['A', 'B', 8], ['D', null, 24], ['B', 'D', 32], ['C', 'B', 8], ['A', null, 16], ['D', 'C', 8], ['C', null, 64], ['B', 'A', 12], ['A', 'D', 8], ['C', 'B', 24], ['D', null, 8], ['C', 'A', 16], ['B', null, 12], ['C', 'D', 8]],
        [['D', null, 24], ['A', 'C', 8], ['B', null, 16], ['D', 'A', 32], ['C', 'B', 8], ['D', null, 12], ['A', 'D', 16], ['B', 'C', 8], ['D', null, 48], ['C', 'A', 16], ['A', null, 8], ['D', 'B', 24], ['B', 'D', 12], ['D', null, 64], ['C', 'B', 8], ['A', 'C', 16]],
        [['A', 'B', 8], ['D', null, 16], ['D', 'C', 24], ['B', 'A', 8], ['A', null, 32], ['C', 'D', 8], ['D', 'A', 16], ['B', null, 12], ['A', 'C', 24], ['D', null, 8], ['C', 'B', 16], ['A', 'D', 8], ['B', null, 48], ['A', 'C', 12], ['D', 'B', 8], ['A', null, 16]],
        [['B', 'C', 16], ['B', null, 24], ['D', 'A', 8], ['A', null, 12], ['C', 'B', 32], ['B', 'D', 8], ['A', 'C', 16], ['B', null, 8], ['D', 'A', 24], ['C', null, 16], ['B', 'C', 8], ['A', 'D', 32], ['B', null, 64], ['D', 'B', 8], ['A', null, 12], ['C', 'A', 8]],
        [['C', null, 32], ['A', 'D', 8], ['C', 'B', 16], ['D', null, 8], ['A', 'C', 24], ['C', null, 16], ['B', 'A', 12], ['C', 'D', 8], ['A', null, 48], ['D', 'B', 8], ['C', 'A', 24], ['B', null, 16], ['C', 'D', 8], ['A', 'B', 12], ['D', null, 32], ['C', null, 8]],
        [['A', null, 16], ['B', 'D', 8], ['D', null, 24], ['A', 'C', 12], ['A', null, 8], ['C', 'B', 32], ['B', null, 16], ['D', 'A', 8], ['A', 'D', 64], ['C', null, 12], ['A', 'B', 16], ['B', 'C', 8], ['D', null, 24], ['A', 'C', 8], ['C', 'D', 16], ['A', null, 12]],
      ];

      const calcChanges = (winner, loser, base) => {
        const changes = { east: 0, south: 0, west: 0, north: 0 };
        if (!loser) {
          changes[winner] = base * 3 + 24;
          positions.forEach((pos) => { if (pos !== winner) changes[pos] = -base - 8; });
        } else {
          changes[winner] = base + 24;
          changes[loser] = -base - 8;
          positions.forEach((pos) => { if (pos !== winner && pos !== loser) changes[pos] = -8; });
        }
        return changes;
      };

      const games = [];
      const players = [];
      const scores = [];
      const penalties = [];
      const results = [];

      const makeGame = (index, userId, gameName, daysAgo, pattern) => {
        const gameId = 'demo-game-' + index;
        const createdAt = isoAt(daysAgo, index * 27);
        const game = {
          id: gameId,
          created_at: createdAt,
          current_round: 4,
          current_game: 16,
          status: 'finished',
          game_name: gameName,
          is_completed: true,
          completed_at: isoAt(daysAgo, index * 27 + 120),
          creator_id: userId,
        };
        games.push(game);

        const gamePlayers = playerIds.map((playerId, idx) => ({
          id: gameId + '-player-' + playerId,
          game_id: gameId,
          position: getPositionForPlayerInRound(playerId, 3),
          player_id: playerId,
          name: names[idx],
          score: 0,
          created_at: createdAt,
        }));
        players.push(...gamePlayers);
        penalties.push({ id: gameId + '-penalty', game_id: gameId, penalty_changes: { east: 0, south: 0, west: 0, north: 0 }, created_at: createdAt });

        pattern.forEach(([winnerId, loserId, baseScore], scoreIndex) => {
          const gameNumber = scoreIndex + 1;
          const roundIndex = Math.floor((gameNumber - 1) / 4);
          const winnerPosition = getPositionForPlayerInRound(winnerId, roundIndex);
          const loserPosition = loserId ? getPositionForPlayerInRound(loserId, roundIndex) : null;
          scores.push({
            id: gameId + '-score-' + gameNumber,
            game_id: gameId,
            round: roundIndex + 1,
            game_number: gameNumber,
            winner_position: winnerPosition,
            loser_position: loserPosition,
            winner_player_id: winnerId,
            loser_player_id: loserId,
            base_score: baseScore,
            score_changes: calcChanges(winnerPosition, loserPosition, baseScore),
            created_at: isoAt(daysAgo, index * 27 + gameNumber * 5),
          });
        });
      };

      patterns.forEach((pattern, index) => {
        makeGame(index + 1, defaultUser.id, ['周赛第一桌', '周赛第二桌', '练习赛 A 组', '训练赛晚场', '月赛预热', '积分赛第六轮', '复盘局', '决赛桌'][index], index < 2 ? 0 : index + 1, pattern);
      });
      makeGame(21, 'travel-file', '上海交流赛', 4, patterns[1]);
      makeGame(22, 'training-file', '老同学训练赛', 12, patterns[2]);

      for (const game of games) {
        const gamePlayers = players.filter((player) => player.game_id === game.id);
        const gameScores = scores.filter((score) => score.game_id === game.id);
        const calculatedPlayers = buildPlayersWithCalculatedScores(gamePlayers, gameScores, null);
        calculatedPlayers.forEach((player) => {
          const index = players.findIndex((item) => item.id === player.id);
          if (index >= 0) players[index] = player;
        });
        results.push(...buildGameResults(game.id, calculatedPlayers));
      }

      await db.transaction('rw', [db.users, db.games, db.players, db.scores, db.penalties, db.game_results], async () => {
        await db.game_results.clear();
        await db.scores.clear();
        await db.penalties.clear();
        await db.players.clear();
        await db.games.clear();
        await db.users.clear();
        await db.users.bulkAdd(users);
        await db.games.bulkAdd(games);
        await db.players.bulkAdd(players);
        await db.scores.bulkAdd(scores);
        await db.penalties.bulkAdd(penalties);
        await db.game_results.bulkAdd(results);
      });

      localStorage.setItem('mahjong_user_id', defaultUser.id);
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('mahjong_game_snapshot_')) localStorage.removeItem(key);
      });
      return true;
    })()
  `);
}

async function showImportModal(client) {
  await client.send('DOM.enable');
  const doc = await client.send('DOM.getDocument');
  const input = await client.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: 'input[type="file"]',
  });
  if (!input.nodeId) throw new Error('File input not found.');
  await client.send('DOM.setFileInputFiles', {
    nodeId: input.nodeId,
    files: [demoImportPath],
  });
  await waitFor(client, "document.body.innerText.includes('选择导入方式') && document.body.innerText.includes('合并到当前档案')");
}

async function createTarget(appUrlForDevice) {
  const target = await fetchJson(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(appUrlForDevice)}`,
    { method: 'PUT' },
  );
  return connect(target.webSocketDebuggerUrl);
}

async function captureDevice(device) {
  await mkdir(device.outputDir, { recursive: true });
  const client = await createTarget(appUrl);

  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: device.width,
      height: device.height,
      deviceScaleFactor: device.scale,
      mobile: true,
      screenOrientation: { type: 'portraitPrimary', angle: 0 },
    });
    await client.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    });

    await client.send('Page.navigate', { url: appUrl });
    await waitFor(client, "document.readyState === 'complete' && document.body.innerText.length > 0");
    await seedDemoData(client);
    await client.send('Page.navigate', { url: appUrl });
    await waitFor(client, "document.readyState === 'complete' && document.body.innerText.includes('快速开局')");
    await sleep(750);

    for (const slide of slides) {
      if (slide.route === '/stats' || slide.route === '/data') {
        await client.send('Page.navigate', { url: appUrl + '#' + slide.route });
        await waitFor(client, "document.readyState === 'complete'");
      } else if (slide.route === '') {
        await navigateHash(client, '');
      }

      await slide.prepare(client);
      await sleep(300);

      const rawPath = path.join(rawOutputDir, `${device.key}-${slide.id}.png`);
      const outputPath = path.join(device.outputDir, device.key === 'phone' ? slide.filenamePhone : slide.filenameIpad);
      await captureRaw(client, rawPath);
      await composeMarketingScreenshot(rawPath, outputPath, slide, device);
      console.log(`生成 ${outputPath}`);
    }
  } finally {
    client.close();
    await sleep(250);
  }
}

async function main() {
  await rm(userDataDir, { recursive: true, force: true });
  await rm(rawOutputDir, { recursive: true, force: true });
  await mkdir(rawOutputDir, { recursive: true });
  await mkdir(phoneOutputDir, { recursive: true });
  await mkdir(ipadOutputDir, { recursive: true });

  let devServer = null;
  if (!(await isAppReachable())) {
    devServer = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
      stdio: 'ignore',
      env: { ...process.env, BROWSER: 'none' },
    });
    await waitForApp();
  }

  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], {
    stdio: 'ignore',
  });

  try {
    await waitForChrome();
    for (const device of devices) {
      await captureDevice(device);
    }
  } finally {
    chrome.kill('SIGTERM');
    if (devServer) devServer.kill('SIGTERM');
    await sleep(500);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
