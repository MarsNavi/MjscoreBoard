import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9333);
const outputDir = path.resolve('ios/App/AppStoreScreenshots/zh-Hans');
const userDataDir = path.resolve('/tmp/mjscoreboard-appstore-chrome-profile');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.json();
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

async function screenshot(client, filename) {
  const image = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  await writeFile(path.join(outputDir, filename), Buffer.from(image.data, 'base64'));
}

async function main() {
  await rm(userDataDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

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

    const target = await fetchJson(
      `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(appUrl)}`,
      { method: 'PUT' },
    );
    const client = await connect(target.webSocketDebuggerUrl);

    try {
      await client.send('Page.enable');
      await client.send('Runtime.enable');
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: 428,
        height: 926,
        deviceScaleFactor: 3,
        mobile: true,
        screenOrientation: { type: 'portraitPrimary', angle: 0 },
      });
      await client.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      });
      await client.send('Page.navigate', { url: appUrl });

      await waitFor(client, "document.readyState === 'complete' && document.body.innerText.includes('快速开局')");

      await evaluate(client, `
        (() => {
          const setInput = (input, value) => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          };
          const inputs = [...document.querySelectorAll('input[type="text"]')];
          ['成都练习赛', '东风', '南山', '西岭', '北辰'].forEach((value, index) => {
            setInput(inputs[index], value);
          });
          return true;
        })()
      `);
      await sleep(750);
      await screenshot(client, '01-home-quick-start-1284x2778.png');

      await evaluate(client, `
        [...document.querySelectorAll('button')]
          .find((button) => button.textContent.includes('开始比赛'))
          .click()
      `);
      await waitFor(client, "document.body.innerText.includes('1/16') && document.body.innerText.includes('荒')");
      await sleep(750);
      await screenshot(client, '02-live-scoreboard-1284x2778.png');

      await evaluate(client, `
        (() => {
          const winButtons = [...document.querySelectorAll('button')]
            .filter((button) => button.textContent.trim() === '和');
          winButtons[winButtons.length - 1].click();
          return true;
        })()
      `);
      await waitFor(client, "document.body.innerText.includes('和牌') && document.body.innerText.includes('自摸')");
      await evaluate(client, `
        [...document.querySelectorAll('button')]
          .find((button) => button.textContent.includes('自摸'))
          .click()
      `);
      await sleep(750);
      await screenshot(client, '03-score-entry-1284x2778.png');

      client.close();
    } finally {
      await sleep(250);
    }
  } finally {
    chrome.kill('SIGTERM');
    await sleep(500);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
