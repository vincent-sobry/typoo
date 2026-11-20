// Game levels: Fun / Normal / Super Challenge for the paced games (UX-1).
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** 1 star on the first 18 chapters (Longest Word is open), and this run history (WPM values). */
function withRuns(wpms, extra = {}) {
  const q = {};
  for (let i = 0; i < 18; i++) q[i] = { stars: 1, wpm: 12, acc: 92 };
  const history = wpms.map((w) => ({ d: "2026-11-19", wpm: w, acc: 95 }));
  return player(Object.assign({ lessons: { qwerty: q, azerty: {} }, history, bestWpm: Math.max(0, ...wpms) }, extra));
}

test("formula: steps from the spread of the last 10 runs, 5% to 25%, fixed 10% below 5 runs", async ({ page }) => {
  await openApp(page, withRuns([]));
  const r = await page.evaluate(() => {
    const f = (h) => { state.history = h.map((w) => ({ d: "x", wpm: w, acc: 95 })); return [levelWpm(avgWpm(), "fun"), avgWpm(), levelWpm(avgWpm(), "challenge")]; };
    return {
      few: f([30, 40, 50, 20]),                         // 4 runs: fixed -10% / +10%
      spread: f([20, 30, 30, 30, 30, 30, 30, 30, 30, 40]), // avg 30, worst 20, best 40: -5 / +5 = 16.7%
      steady: f([30, 30, 30, 30, 30, 30]),             // no spread: minimum 5%
      wild: f([5, 40, 40, 40, 40, 40, 40, 40, 40, 75]),  // big spread: maximum 25%
      last10: f([90, 90, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]), // 2 old runs drop out
    };
  });
  expect(r.few).toEqual([32, 35, 39]);
  expect(r.spread).toEqual([25, 30, 35]);
  expect(r.steady).toEqual([29, 30, 32]);
  expect(r.wild).toEqual([30, 40, 50]);
  expect(r.last10).toEqual([29, 30, 32]);
});

test("Longest Word: the lobby shows 3 levels with the WPM, Fun makes Keebo slower", async ({ page }) => {
  await openApp(page, withRuns([20, 30, 30, 30, 30, 30, 30, 30, 30, 40]));
  await page.click("#mLadder");
  await expect(page.locator("#levelLobby")).toBeVisible();
  await expect(page.locator("#lvChoices .choice")).toHaveCount(3);
  await expect(page.locator("#lvChoices .lv-fun")).toContainText("Fun");
  await expect(page.locator("#lvChoices .lv-fun")).toContainText("25 WPM");
  await expect(page.locator("#lvChoices .lv-normal")).toContainText("30 WPM");
  await expect(page.locator("#lvChoices .lv-challenge")).toContainText("Super Challenge");
  await expect(page.locator("#lvChoices .lv-challenge")).toContainText("35 WPM");
  await expect(page.locator("#lvChoices .lv-normal")).toBeFocused();    // first time: Normal
  await page.keyboard.press("1");                                       // key 1 = Fun
  await expect(page.locator("#type")).toBeVisible();
  expect(await page.evaluate("LW.best")).toBe(25);
  await expect(page.locator("#rBotLbl")).toContainText(`Keebo · 20 WPM`);  // 80% of 25
  await expect(page.locator("#tTitle")).toContainText("😎");
  expect((await saved(page)).gameLv).toEqual({ ladder: "fun" });
});

test("the last choice is kept per game, Enter starts it", async ({ page }) => {
  await openApp(page, withRuns([30, 30, 30, 30, 30], { gameLv: { ladder: "challenge" } }));
  await page.click("#mMarathon");
  await expect(page.locator("#lvChoices .lv-normal")).toBeFocused();    // Marathon has its own choice
  await page.keyboard.press("Escape");
  await expect(page.locator("#levelLobby")).toBeHidden();
  await page.click("#mLadder");
  await expect(page.locator("#lvChoices .lv-challenge")).toBeFocused();
  await expect(page.locator("#lvChoices .lv-challenge")).toHaveClass(/on/);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => LW && LW.level === "challenge");
  expect(await page.evaluate("LW.best")).toBe(32);                       // 30 + 5%
});

test("records are kept per level, Normal stays in the old place", async ({ page }) => {
  await openApp(page, withRuns([30, 30, 30, 30, 30], { ladder: { best: 4, played: 3, boss: 0 } }));
  await page.click("#mLadder");
  await expect(page.locator("#lvChoices .lv-normal")).toContainText("Record: 4 of 15");
  await expect(page.locator("#lvChoices .lv-fun")).toContainText("No record yet");
  await page.click("#lvChoices .lv-fun");
  await page.waitForFunction(() => LW && LW.sub === 1 && S && !S.locked, null, { timeout: 8000 });
  await page.keyboard.type(await page.evaluate("S.text"), { delay: 1 });  // 1 rung, then Keebo wins
  await expect(page.locator("#result")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#rNeed")).toContainText("😎 Fun");
  const s = await saved(page);
  expect(s.ladder.best).toBe(4);
  expect(s.ladder.played).toBe(3);                                      // Normal is not changed
  expect(s.ladder.lv.fun.played).toBe(1);
  expect(s.ladder.lv.fun.best).toBeGreaterThanOrEqual(1);
  // Retry keeps the level.
  await page.click("#rRetry");
  await page.waitForFunction(() => LW && LW.level === "fun");
  await page.keyboard.press("Escape");
  await expect(page.locator("#mLadderText")).toContainText("😎 Record");
});

test("Race: the level changes only Match me", async ({ page }) => {
  await openApp(page, withRuns([30, 30, 30, 30, 30]));
  await page.click("#mRace");
  await expect(page.locator("#raceLv button")).toHaveCount(3);
  const first = page.locator("#raceChoices .choice").first();
  await expect(first).toContainText("32 WPM");                          // Normal: avg + 2
  await page.click("#raceLv .lv-fun");
  await expect(first).toContainText("Match me · Fun");
  await expect(first).toContainText("31 WPM");                          // steady runs: 30 - 5% = 29, + 2
  await expect(page.locator("#raceChoices .choice").nth(1)).toContainText("12 WPM"); // Chill stays
  expect((await saved(page)).gameLv).toEqual({ race: "fun" });
  await first.click();
  await expect(page.locator("#tTitle")).toContainText("31 WPM");
});

test("Race: no level row without runs", async ({ page }) => {
  await openApp(page, withRuns([]));
  await page.click("#mRace");
  await expect(page.locator("#raceLv")).toBeHidden();
});

test("Word Rain: Fun makes the meteors slower, records per level", async ({ page }) => {
  await openApp(page, withRuns([], { rainBest: 300 }));
  await page.click("#mRain");
  await expect(page.locator("#lvChoices .lv-fun")).toContainText("Meteors 10% slower");
  await expect(page.locator("#lvChoices .lv-normal")).toContainText("Record: 300");
  await page.click("#lvChoices .lv-fun");
  await expect(page.locator("#meteor")).toBeVisible();
  expect(await page.evaluate("M.speed")).toBeCloseTo(28 * 0.9);
  await expect(page.locator("#mBest")).toHaveText("0");
  await page.evaluate(() => { M.score = 120; M.lives = 0; rainOver(); });
  const s = await saved(page);
  expect(s.rainBest).toBe(300);
  expect(s.rainLv).toEqual({ fun: 120 });
  await page.click("#rainAgain");
  expect(await page.evaluate("M.level")).toBe("fun");
});

test("Word Rain: words start hidden behind a cloud", async ({ page }) => {
  await openApp(page, withRuns([]));
  await page.click("#mRain");
  await page.click("#lvChoices .lv-normal");
  await expect(page.locator("#sky .met").first()).toBeAttached();
  const r = await page.evaluate(() => {
    M.running = false;
    const w = M.words[0], sky = document.querySelector("#sky").getBoundingClientRect();
    const fronts = [...document.querySelectorAll("#sky .cloud.front")];
    const x0 = w.x, x1 = w.x + w.el.offsetWidth;
    const under = fronts.some((c) => { const b = c.getBoundingClientRect(); return b.left - sky.left <= x0 && b.right - sky.left >= x1; });
    return { under, n: fronts.length, zm: +getComputedStyle(w.el).zIndex, zc: +getComputedStyle(fronts[0]).zIndex };
  });
  expect(r.n).toBeGreaterThan(1);           // more than one cloud, with sky between them
  expect(r.zc).toBeGreaterThan(r.zm);       // clouds are drawn over the words
  expect(r.under).toBe(true);               // a new word starts inside a front cloud
});

test("Word Rain: meteors fall at a slight slant, all the same way, and stay in the sky", async ({ page }) => {
  await openApp(page, withRuns([]));
  await page.click("#mRain");
  await page.click("#lvChoices .lv-normal");
  await expect(page.locator("#sky .met").first()).toBeAttached();
  const r = await page.evaluate(() => {
    const W = document.querySelector("#sky").clientWidth, H = document.querySelector("#sky").clientHeight - 26;
    return M.words.map((w) => ({ k: w.k, wind: M.wind, endX: w.x + w.k * H, wd: w.el.offsetWidth, W }));
  });
  for (const w of r) {
    expect(Math.abs(w.k)).toBeLessThanOrEqual(Math.tan((14 * Math.PI) / 180) + 1e-9);   // max 14 degrees
    expect(w.k * w.wind).toBeGreaterThanOrEqual(0);                                       // same way as the wind
    expect(w.endX).toBeGreaterThanOrEqual(0);
    expect(w.endX + w.wd).toBeLessThanOrEqual(w.W);
  }
});
