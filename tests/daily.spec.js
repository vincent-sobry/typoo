// Daily sentence: one new sentence each day, with the learned keys. One scored run per day.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

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

test("locked until 3 sentences fit the learned keys; the chapter shows in the tile and the toast", async ({ page }) => {
  await openApp(page, player());
  await expect(page.locator("#mDaily")).toHaveClass(/locked/);
  await expect(page.locator("#mDailyText")).toHaveText("Locked: pass chapter 13 first");
  await page.click("#mDaily");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#toast")).toContainText("after chapter 13");
});

test("still locked after chapter 12, open after chapter 13 (QWERTY, EN)", async ({ page }) => {
  await openApp(page, withChapters(12));
  await expect(page.locator("#mDaily")).toHaveClass(/locked/);
  expect(await page.evaluate(() => genDaily())).toBe("");
  await page.evaluate(() => { state.lessons.qwerty[12] = { stars: 1 }; goHome(); });
  await expect(page.locator("#mDaily")).not.toHaveClass(/locked/);
});

test("the unlock chapter differs per language and keyboard", async ({ page }) => {
  await openApp(page, player());
  const r = await page.evaluate(() => {
    const out = {};
    for (const layout of ["qwerty", "azerty"]) {
      state.layout = layout;
      for (const lang of ["en", "nl", "fr", "it"]) out[layout + "/" + lang] = dailyOpensAfter(lang);
    }
    return out;
  });
  expect(r).toEqual({ "qwerty/en": 13, "qwerty/nl": 14, "qwerty/fr": 14, "qwerty/it": 14,
                      "azerty/en": 14, "azerty/nl": 14, "azerty/fr": 13, "azerty/it": 13 });
});

test("an extra game: the tile is just below Continue, not with the warm-up", async ({ page }) => {
  await openApp(page, withChapters(14));
  const ids = await page.$$eval("#home .modes .mode", (b) => b.map((e) => e.id));
  expect(ids.indexOf("mDaily")).toBe(ids.indexOf("mContinue") + 1);
});

test("locked when done today: shows the score and 'back tomorrow'", async ({ page }) => {
  await openApp(page, withChapters(14, { daily: { last: today(), count: 2, best: 30, wpm: 27, acc: 98 } }));
  await expect(page.locator("#mDaily")).toHaveClass(/locked/);
  await expect(page.locator("#mDailyText")).toHaveText("Done today ✓ · 27 WPM · back tomorrow");
  await page.click("#mDaily");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#toast")).toContainText("tomorrow");
});

test("same sentence all day; another day can give another sentence", async ({ page }) => {
  await openApp(page, withChapters(18));
  const r = await page.evaluate(() => {
    const a = genDaily("2026-11-19"), b = genDaily("2026-11-19");
    const days = new Set(Array.from({ length: 10 }, (_, i) => genDaily(`2026-12-${10 + i}`)));
    return { a, b, n: days.size };
  });
  expect(r.a).toBe(r.b);
  expect(r.n).toBeGreaterThan(3);
});

test("text uses only the learned keys, for every stage, in EN, NL, FR and IT", async ({ page }) => {
  await openApp(page, withChapters(1));
  const bad = await page.evaluate(() => {
    const out = [];
    for (const lang of ["en", "nl", "fr", "it"]) {
      for (let n = 1; n <= 18; n++) {
        state.lessons.qwerty = {};
        for (let i = 0; i < n; i++) state.lessons.qwerty[i] = { stars: 1, wpm: 15, acc: 95 };
        const allowed = learnedSet(), caps = hasCaps(), open = dailyPool(lang).length >= 3;
        for (let d = 1; d <= 15; d++) {
          const t = genDaily(`2026-01-${String(d).padStart(2, "0")}`, lang);
          if (!open) { if (t !== "") out.push(`${lang} ${n}: text while locked`); continue; }
          const ok = t.length > 5 && (caps || [...t].every((c) => allowed.has(fold(c))));   // an accent letter is typed with its base key
          if (!ok) out.push(`${lang} ${n}: ${t}`);
        }
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test("after the Capitals chapter: a real sentence with a capital and a full stop", async ({ page }) => {
  await openApp(page, withChapters(20, { lang: "nl" }));
  const t = await page.evaluate(() => genDaily("2026-11-19"));
  expect(t).toMatch(/^[A-Z].*\.$/);
  const pool = await page.evaluate(() => DAILY_SENTENCES.nl.map((s) => s[0].toUpperCase() + s.slice(1) + "."));
  expect(pool).toContain(t);
});

test("a run counts one time: score saved, tile locked; a retry does not change the score", async ({ page }) => {
  const hist = [{ d: "2026-01-01", wpm: 20, acc: 95 }];
  await openApp(page, withChapters(18, { bestWpm: 22, history: hist, daily: { last: "2020-01-01", count: 1, best: 5 } }));
  await expect(page.locator("#mDaily")).not.toHaveClass(/locked/);
  await page.click("#mDaily");
  await expect(page.locator("#tTitle")).toHaveText("📜 Daily sentence");
  const text = await page.evaluate("S.text");
  await page.keyboard.type(text, { delay: 50 });
  await expect(page.locator("#rTitle")).toContainText("Daily sentence done");
  await expect(page.locator("#rStars")).toBeHidden();
  const st = await saved(page);
  expect(st.daily.last).toBe(today());
  expect(st.daily.count).toBe(2);
  expect(st.daily.acc).toBe(100);
  expect(st.daily.text).toBe(text);
  expect(st.daily.wpm).toBeGreaterThan(5);
  expect(st.daily.best).toBe(st.daily.wpm);
  expect(st.bestWpm, "the top WPM does not change").toBe(22);
  expect(st.history).toEqual(hist);
  expect(st.xp).toBeGreaterThan(0);
  // retry = practice with the same sentence
  await page.click("#rRetry");
  await expect(page.locator("#tTitle")).toContainText("practice");
  expect(await page.evaluate("S.text")).toBe(text);
  await page.keyboard.type(text, { delay: 50 });
  await expect(page.locator("#rTitle")).toContainText("practice");
  const st2 = await saved(page);
  expect(st2.daily).toEqual(st.daily);
  expect(st2.xp).toBe(st.xp);
  await page.click("#rMap");
  await expect(page.locator("#mDaily")).toHaveClass(/locked/);
  await expect(page.locator("#mDailyText")).toContainText("back tomorrow");
});

test("Escape stops the run; it does not count", async ({ page }) => {
  await openApp(page, withChapters(14));
  await page.click("#mDaily");
  await page.keyboard.press("Escape");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#mDaily")).not.toHaveClass(/locked/);
  expect((await saved(page))?.daily?.last || "").toBe("");
});

test("test tool 'new day' opens the daily sentence again", async ({ page }) => {
  const d = today();
  await openApp(page, withChapters(14, { daily: { last: d, count: 1, best: 10, wpm: 10, acc: 95 } }));
  await expect(page.locator("#mDaily")).toHaveClass(/locked/);
  const r = await page.evaluate(() => { newDay(); goHome(); return { last: state.daily.last, y: dayBefore(todayStr()), open: !$("#mDaily").classList.contains("locked") }; });
  expect(r.last).toBe(r.y);
  expect(r.open).toBe(true);
});
