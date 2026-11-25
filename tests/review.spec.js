// Review chapters: after each new-letter chapter (from the 2nd one) a review of all keys learned up to then.
const { test, expect } = require("@playwright/test");
const { player, openApp, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** A new player (saved with the review chapters) with 1 star on the first `n` chapters. */
function fresh(n, extra = {}) {
  const q = {};
  for (let i = 0; i < n; i++) q[i] = { stars: 1, wpm: 12, acc: 92 };
  return player(Object.assign({ lessons: { qwerty: q, azerty: {} }, flags: { rev: 1 } }, extra));
}

test("a review after each new-letter chapter from the 2nd one, none before a words chapter or in Numbers", async ({ page }) => {
  await openApp(page, fresh(0));
  const r = await page.evaluate(() => ({ q: lessonsFlat("qwerty").map((l) => l.keys), a: lessonsFlat("azerty").length }));
  expect(r.q.slice(0, 11)).toEqual(["fj", "dk", "*review", "sl", "*review", "a;", "*review", "gh", "*words", "ei", "*review"]);
  expect(r.q.length).toBe(38);
  expect(r.a).toBe(38);
  r.q.forEach((k, i) => { if (k === "*review") expect(r.q[i + 1]).not.toBe("*words"); });
  expect(r.q.slice(32, 35)).toEqual(["12345", "67890", "*numbers"]);
});

test("old progress keeps its place: chapters move to the new numbers, earlier reviews are open", async ({ page }) => {
  const q = {};
  for (let i = 0; i < 7; i++) q[i] = { stars: 2, wpm: 14, acc: 95 };   // old chapters 1..7 = up to E and I
  await openApp(page, player({ lessons: { qwerty: q, azerty: {} } }));
  const r = await page.evaluate(() => ({
    keys: Object.keys(state.lessons.qwerty).map(Number).sort((a, b) => a - b),
    cur: currentLessonIdx(), curKeys: lessonsFlat()[currentLessonIdx()].keys,
    open: [2, 4, 6, 10, 11].map(isUnlocked), flag: state.flags.rev,
  }));
  expect(r.keys).toEqual([0, 1, 3, 5, 7, 8, 9]);
  expect(r.cur).toBe(10);                // the review after E and I
  expect(r.curKeys).toBe("*review");
  expect(r.open).toEqual([true, true, true, true, false]);
  expect(r.flag).toBe(1);
  await expect(page.locator("#map .lesson.review")).toHaveCount(11);
  await expect(page.locator("#map .lesson.current")).toHaveAttribute("data-i", "10");
});

test("migration runs once: a saved state with the flag is not moved again", async ({ page }) => {
  await openApp(page, fresh(3));
  expect(await page.evaluate(() => Object.keys(state.lessons.qwerty).join(","))).toBe("0,1,2");
});

test("a new player must pass the review to go on", async ({ page }) => {
  await openApp(page, fresh(2));
  expect(await page.evaluate(() => [currentLessonIdx(), isUnlocked(2), isUnlocked(3)])).toEqual([2, true, false]);
  await page.click('#map .lesson[data-i="2"]');
  await expect(page.locator("#tTitle")).toHaveText("3. Review");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  expect(await page.evaluate(() => isUnlocked(3))).toBe(true);
});

test("review text: only learned keys, every learned letter, more weight on the newest keys", async ({ page }) => {
  await openApp(page, fresh(6));
  const r = await page.evaluate(() => {
    const L = lessonsFlat()[6], allowed = allowedUpTo(6), runs = [];
    for (let i = 0; i < 20; i++) runs.push(genForLesson(L));
    const letters = [...allowed].filter((c) => c !== " ");
    return {
      recent: reviewRecent(L).join(""),
      ok: runs.every((t) => [...t].every((c) => allowed.has(c))),
      all: runs.every((t) => letters.every((c) => t.includes(c))),
      words: Math.min(...runs.map((t) => t.split(" ").length)),
    };
  });
  expect(r.recent).toBe("a;sl");
  expect(r.ok).toBe(true);
  expect(r.all).toBe(true);
  expect(r.words).toBeGreaterThanOrEqual(45);
});

test("chapters are longer: 1.5 times the old drill and words length", async ({ page }) => {
  await openApp(page, fresh(9));
  const r = await page.evaluate(() => {
    const L = lessonsFlat();
    return { drill: genForLesson(L[9]).split(" ").length, words: genForLesson(L[8]).split(" ").length, f: CH_LEN };
  });
  expect(r.f).toBe(1.5);
  expect(r.words).toBe(36);
  expect(r.drill).toBeGreaterThanOrEqual(8 + 18);
});

test("review chapters do not block the stage badge", async ({ page }) => {
  const q = {};
  [0, 1, 3, 5, 7, 8].forEach((i) => { q[i] = { stars: 1, wpm: 12, acc: 92 }; });
  await openApp(page, player({ lessons: { qwerty: q, azerty: {} }, flags: { rev: 1 } }));
  expect(await page.evaluate(() => [stageDone(0), stageProg(0).slice(0, 2)])).toEqual([true, [6, 6]]);
});

test("review title and intro in all four languages", async ({ page }) => {
  await openApp(page, fresh(2));
  const r = await page.evaluate(() => ["nl", "en", "fr", "it"].map((l) => { state.lang = l; return [lessonsFlat()[2].title, t("intro*review")]; }));
  expect(r.map((x) => x[0])).toEqual(["Herhaling", "Review", "Révision", "Ripasso"]);
  r.forEach((x) => expect(x[1]).not.toBe("intro*review"));
});

test("map with review chapters fits a 1366x657 screen", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, fresh(4));
  const tile = page.locator('#map .lesson[data-i="4"]');
  await tile.scrollIntoViewIfNeeded();
  await expect(tile).toHaveClass(/review/);
  await expect(tile).toContainText("🔁");
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(1366);
});

test("chapter tiles in one row line up: titles at the same height, stars at the same height", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, fresh(20));
  const rows = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll("#map .lesson").forEach((e) => {
      const top = Math.round(e.getBoundingClientRect().top), y = (s) => Math.round(e.querySelector(s).getBoundingClientRect().top) - top;
      (out[top] = out[top] || new Set()).add(y(".t") + "/" + y(".s"));
    });
    return Object.values(out).map((s) => s.size);
  });
  rows.forEach((n) => expect(n).toBe(1));
});
