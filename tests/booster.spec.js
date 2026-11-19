// Booster: extra practice on chapters with 1 or 2 stars. A very good run gives one more star.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** A player with the given stars per chapter (QWERTY). */
function withStars(stars, extra = {}) {
  const q = {};
  stars.forEach((s, i) => { q[i] = { stars: s, wpm: 12, acc: 92 }; });
  return player(Object.assign({ lessons: { qwerty: q, azerty: {} } }, extra));
}

/** Make the run very good or not: set time so the WPM is `wpm`, with no errors. */
async function finishWith(page, wpm) {
  await page.keyboard.type((await page.evaluate("S.text")).slice(0, 1));
  await page.evaluate((w) => { S.start = performance.now() - (S.text.length / 5) / w * 60000; }, wpm);
  await page.keyboard.type((await page.evaluate("S.text")).slice(1), { delay: 0 });
  await expect(page.locator("#result")).toBeVisible();
}

test("locked without stars; the home button counts the chapters to boost", async ({ page }) => {
  await openApp(page, withStars([]));
  await expect(page.locator("#mBoost")).toHaveClass(/locked/);
  await expect(page.locator("#mBoostText")).toContainText("Locked");
  await page.click("#mBoost");
  await expect(page.locator("#boostLobby")).toBeHidden();
  await expect(page.locator("#toast")).toContainText("1 star");
});

test("all chapters with 3 stars: no lobby", async ({ page }) => {
  await openApp(page, withStars([3, 3]));
  await expect(page.locator("#mBoostText")).toContainText("★★★");
  await page.click("#mBoost");
  await expect(page.locator("#boostLobby")).toBeHidden();
});

test("lobby lists chapters with 1 or 2 stars, fewest stars first", async ({ page }) => {
  await openApp(page, withStars([3, 2, 1, 3, 1]));
  await expect(page.locator("#mBoostText")).toHaveText("3 chapters can get more stars");
  await page.click("#mBoost");
  const c = page.locator("#boostChoices .choice");
  await expect(c).toHaveCount(3);
  expect(await c.evaluateAll((b) => b.map((x) => +x.dataset.i))).toEqual([2, 4, 1]);
  await expect(c.first()).toContainText("Next star: 94% accuracy");
  await page.keyboard.press("Escape");
  await expect(page.locator("#boostLobby")).toBeHidden();
});

test("text uses only learned keys and drills the chapter keys", async ({ page }) => {
  await openApp(page, withStars([2, 2, 1]));
  const r = await page.evaluate(() => {
    const L = lessonsFlat()[2], allowed = allowedUpTo(2), out = [];
    for (let i = 0; i < 20; i++) out.push(genBoost(L));
    return { keys: L.keys, ok: out.every((o) => [...o.text].every((c) => allowed.has(c))), focus: out[0].focus, len: out[0].text.split(" ").length };
  });
  expect(r.ok).toBe(true);
  expect(r.focus.join("")).toContain(r.keys);
  expect(r.len).toBeGreaterThanOrEqual(20);
});

test("weakest learned keys join the focus keys", async ({ page }) => {
  const keys = { d: { h: 5, m: 5 }, f: { h: 20, m: 0 }, k: { h: 8, m: 2 }, j: { h: 2, m: 2 } }; // j: too few hits to count
  await openApp(page, withStars([2, 1, 1], { keys }));
  const focus = await page.evaluate("genBoost(lessonsFlat()[2]).focus");
  expect(await page.evaluate("lessonsFlat()[2].keys")).toBe("sl");
  expect(focus).toEqual(["s", "l", "d", "k"]);
});

test("a very good run gives exactly one more star", async ({ page }) => {
  await openApp(page, withStars([1, 1]));
  await page.click("#mBoost");
  await page.click("#boostChoices .choice[data-i='0']");
  await expect(page.locator("#tTitle")).toContainText("Booster");
  await finishWith(page, 200);                       // good enough for 3 stars, but only +1
  const st = await saved(page);
  expect(st.lessons.qwerty[0].stars).toBe(2);
  expect(st.boost).toEqual({ played: 1, ups: 1 });
  await expect(page.locator("#rBubble")).toContainText("BOOST");
  await expect(page.locator("#rNeed")).toContainText("For ★★★");
});

test("a slow run keeps the stars", async ({ page }) => {
  await openApp(page, withStars([2, 1]));
  await page.click("#mBoost");
  await page.click("#boostChoices .choice[data-i='0']");
  await finishWith(page, 5);
  const st = await saved(page);
  expect(st.lessons.qwerty[0].stars).toBe(2);
  expect(st.boost).toEqual({ played: 1, ups: 0 });
});

test("third star: chapter leaves the list; Enter opens the lobby for the next one", async ({ page }) => {
  await openApp(page, withStars([2, 1]));
  await page.click("#mBoost");
  await page.click("#boostChoices .choice[data-i='0']");
  await finishWith(page, 200);
  expect((await saved(page)).lessons.qwerty[0].stars).toBe(3);
  await expect(page.locator("#rNeed")).toContainText("complete");
  await page.keyboard.press("Enter");
  await expect(page.locator("#boostLobby")).toBeVisible();
  await expect(page.locator("#boostChoices .choice")).toHaveCount(1);
});
