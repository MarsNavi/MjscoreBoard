import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1284, height: 2778 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true
  });
  
  const takeScreenshotForLang = async (lang) => {
    console.log(`Taking screenshots for ${lang}...`);
    const page = await context.newPage();
    await page.goto('http://localhost:5173');
    
    // Get the generated userId and set language
    const userId = await page.evaluate((l) => {
      localStorage.setItem('mjscoreboard_lang', l);
      return localStorage.getItem('mahjong_user_id');
    }, lang);
    
    // Inject game snapshot
    await page.evaluate(({ userId, snapshot }) => {
      localStorage.setItem(`mahjong_game_snapshot_${userId}`, JSON.stringify(snapshot));
    }, {
      userId,
      snapshot: {
        game: {
          id: "game123",
          created_at: new Date().toISOString(),
          current_round: 1,
          current_game: 1,
          status: "active"
        },
        players: [
          { id: "p1", game_id: "game123", position: "east", player_id: "A", name: "Player 1", score: 100, created_at: new Date().toISOString() },
          { id: "p2", game_id: "game123", position: "south", player_id: "B", name: "Player 2", score: 0, created_at: new Date().toISOString() },
          { id: "p3", game_id: "game123", position: "west", player_id: "C", name: "Player 3", score: -50, created_at: new Date().toISOString() },
          { id: "p4", game_id: "game123", position: "north", player_id: "D", name: "Player 4", score: -50, created_at: new Date().toISOString() }
        ],
        isConfirmMode: false
      }
    });

    // Reload to apply snapshot and language
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Screenshot 1: Scoreboard
    await page.screenshot({ path: `screenshots/${lang}_1.png` });
    
    await page.close();
  };

  await takeScreenshotForLang('en-US');
  await takeScreenshotForLang('ja');
  await browser.close();
  console.log('Screenshots done!');
})();
