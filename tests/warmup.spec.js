// Daily warm-up: shows one time per day, easy words with the learned keys, no score.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** A player with 1 star on the first `n` chapters (QWERTY). */
function withChapters(n, extra = {}) {
  const q = {};
  for (let i = 0; i < n; i++) q[i] = { stars: 1, wpm: 15, acc: 95 };
  return player(Object.assign({ lessons: { qwerty: q, azerty: {} } }, extra));
}
const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

test("locked for a new player who did not pass chapter 1", async ({ page }) => {
  await openApp(page, player());
  await expect(page.locator("#mWarm")).toBeVisible();
  await expect(page.locator("#mWarm")).toHaveClass(/locked/);
  await expect(page.locator("#mWarmText")).toContainText("chapter 1");
  await page.click("#mWarm");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#toast")).toContainText("after chapter 1");
});

test("locked when the warm-up is done today: it says it unlocks tomorrow", async ({ page }) => {
  await openApp(page, withChapters(4, { warmup: { last: today(), count: 3 } }));
  await expect(page.locator("#mWarm")).toBeVisible();
  await expect(page.locator("#mWarm")).toHaveClass(/locked/);
  await expect(page.locator("#mWarmText")).toHaveText("Done today ✓ · unlocks again tomorrow");
  await page.click("#mWarm");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#toast")).toContainText("tomorrow");
});

test("shows on a new day and Keebo suggests it", async ({ page }) => {
  await openApp(page, withChapters(4, { warmup: { last: "2020-01-01", count: 1 } }));
  await expect(page.locator("#mWarm")).not.toHaveClass(/locked/);
  await expect(page.locator("#homeBubble")).toContainText("warm-up");
});

test("text: short words with only the learned keys; length follows the pace", async ({ page }) => {
  const slow = Array.from({ length: 10 }, () => ({ d: "2026-01-01", wpm: 10, acc: 95 }));
  await openApp(page, withChapters(18, { history: slow }));
  const r = await page.evaluate(() => {
    const allowed = learnedSet();
    const runs = Array.from({ length: 20 }, () => genWarmup());
    const words = runs.flatMap((t) => t.split(" "));
    const n10 = runs[0].split(" ").length;
    state.history = state.history.map((h) => ({ ...h, wpm: 40 }));
    const n40 = genWarmup().split(" ").length;
    return { ok: words.every((w) => w.length >= 2 && w.length <= 5 && [...w].every((c) => allowed.has(c))), n10, n40 };
  });
  expect(r.ok).toBe(true);
  expect(r.n10).toBe(12);
  expect(r.n40).toBe(40);
});

test("early chapters: the text uses only the keys met so far", async ({ page }) => {
  await openApp(page, withChapters(1));
  const ok = await page.evaluate(() => {
    const allowed = learnedSet();
    return [...genWarmup()].every((c) => allowed.has(c));
  });
  expect(ok).toBe(true);
});

test("a run: no live score, no stars, no change to top WPM or history; then it hides", async ({ page }) => {
  const hist = [{ d: "2026-01-01", wpm: 20, acc: 95 }];
  await openApp(page, withChapters(6, { bestWpm: 22, history: hist, warmup: { last: "2020-01-01", count: 1 } }));
  await page.click("#mWarm");
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#tTitle")).toContainText("warm-up");
  await expect(page.locator("#type .live")).toBeHidden();
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rTitle")).toContainText("Warm-up done");
  await expect(page.locator("#rStars")).toBeHidden();
  await expect(page.locator("#rNext")).toHaveText("Chapter 7 →");
  const st = await saved(page);
  expect(st.warmup).toEqual({ last: today(), count: 2 });
  expect(st.bestWpm).toBe(22);
  expect(st.history).toEqual(hist);
  expect(st.today.secs).toBeGreaterThan(0);
  expect(st.days, "a short warm-up does not reach the goal, so it is no streak day").not.toContain(today());
  expect(st.xp).toBeGreaterThan(0);
  await page.click("#rMap");
  await expect(page.locator("#mWarm")).toHaveClass(/locked/);
});

test("Next on the result opens the current chapter; live score is back", async ({ page }) => {
  await openApp(page, withChapters(3));
  await page.click("#mWarm");
  await typeAll(page);
  await page.click("#rNext");
  await expect(page.locator("#tTitle")).toHaveText(await page.evaluate("`4. ${lessonsFlat()[3].title}`"));
  await expect(page.locator("#type .live")).toBeVisible();
});

test("Escape stops the warm-up; it stays on the home screen", async ({ page }) => {
  await openApp(page, withChapters(3));
  await page.click("#mWarm");
  await page.keyboard.press("Escape");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#mWarm")).not.toHaveClass(/locked/);
  expect((await saved(page))?.warmup?.last || "").toBe("");
});

test("the run stops after 1 minute, also with words left", async ({ page }) => {
  await openApp(page, withChapters(3));
  await page.click("#mWarm");
  await page.keyboard.type((await page.evaluate("S.text")).slice(0, 6), { delay: 5 });
  await page.evaluate("S.start = performance.now() - 61000");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rTitle")).toContainText("Warm-up done");
  const st = await saved(page);
  expect(st.warmup.count).toBe(1);
  expect(st.flags.perfect, "a few letters do not give the Flawless badge").toBeFalsy();
});

test("test tool 'new day': dates move back 1 day, the warm-up shows again, the streak goes on", async ({ page }) => {
  const d = today();
  await openApp(page, withChapters(3, { warmup: { last: d, count: 1 }, today: { date: d, secs: 300 }, streak: { count: 4, last: d } }));
  await expect(page.locator("#mWarm")).toHaveClass(/locked/);
  await page.click("#hSettings");
  await expect(page.locator("#setNewDay"), "only on the dev preview").toBeHidden();
  const r = await page.evaluate(() => { newDay(); goHome(); return { st: state, streak: streakNow(), y: dayBefore(todayStr()), tile: !$("#mWarm").classList.contains("locked") }; });
  expect(r.st.warmup.last).toBe(r.y);
  expect(r.st.today.date).toBe(r.y);
  expect(r.st.streak.last).toBe(r.y);
  expect(r.streak).toBe(4);
  expect(r.tile).toBe(true);
  await expect(page.locator("#gTxt")).toHaveText("0 / 10 min");
});
