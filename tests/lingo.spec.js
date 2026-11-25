// Lingo (GAME-4): guess the 5-letter word, first letter given, 5 tries, colour per letter, 3 lives.
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

test("locked for a new player; the toast tells the chapter", async ({ page }) => {
  await openApp(page, player());
  await expect(page.locator("#mLingo")).toHaveClass(/locked/);
  await expect(page.locator("#mLingoText")).toHaveText(/^Locked: pass chapter \d+ first$/);
  await page.click("#mLingo");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#toast")).toContainText("Lingo opens after chapter");
});

test("every language has enough words, and hidden words use only learned keys", async ({ page }) => {
  await openApp(page, player());
  const r = await page.evaluate(() => {
    const out = {};
    for (const layout of ["qwerty", "azerty"]) {
      state.layout = layout;
      for (const lang of ["en", "nl", "fr", "it"]) {
        const c = lingoOpensAfter(lang), n = lessonsFlat().length;
        const all = LINGO_WORDS[lang].split(/\s+/);
        const pool = lingoPool(lang, c), allowed = allowedUpTo(c);
        out[layout + "/" + lang] = {
          opens: c < n, total: all.length >= 100, five: all.every((w) => /^[a-z]{5}$/.test(w)),
          fit: pool.length >= LINGO_MIN && pool.every((w) => fits(w, allowed)),
        };
      }
    }
    return out;
  });
  for (const [k, v] of Object.entries(r)) expect(v, k).toEqual({ opens: true, total: true, five: true, fit: true });
});

test("colour marks: right place, other place, and repeated letters count once", async ({ page }) => {
  await openApp(page, player());
  const r = await page.evaluate(() => [lingoMark("shall", "salad"), lingoMark("sssss", "salad"), lingoMark("salad", "salad")]);
  expect(r[0]).toEqual(["ok", "no", "near", "near", "no"]);   // s ok, h no, a near, l near, second l no
  expect(r[1]).toEqual(["ok", "no", "no", "no", "no"]);
  expect(r[2]).toEqual(["ok", "ok", "ok", "ok", "ok"]);
});

test("a full run: solve a word, miss words until the lives are gone, record and XP are saved", async ({ page }) => {
  await openApp(page, withChapters(18));
  await expect(page.locator("#mLingo")).not.toHaveClass(/locked/);
  await page.click("#mLingo");
  await expect(page.locator("#lingo")).toBeVisible();
  const word = await page.evaluate(() => LG.word);
  // first letter is given
  await expect(page.locator("#lgGrid .lrow.cur .lc").first()).toHaveText(word[0]);
  // Enter with too few letters does nothing
  await page.keyboard.press("Enter");
  await expect(page.locator("#lgGrid .lc.ok")).toHaveCount(0);
  // solve it in one try
  await page.keyboard.type(word.slice(1));
  await page.keyboard.press("Enter");
  await expect(page.locator("#lgGrid .lrow").first().locator(".lc.ok")).toHaveCount(5);
  await expect(page.locator("#lgScore")).toHaveText("1");
  await page.keyboard.press("Enter");                     // skip the wait: next word
  // miss 3 words: 5 wrong tries each
  for (let w = 0; w < 3; w++) {
    const cur = await page.evaluate(() => LG.word);
    const wrong = cur[0] + (cur.slice(1) === "zzzz" ? "qqqq" : "zzzz");
    for (let i = 0; i < 5; i++) { await page.keyboard.type(wrong.slice(1)); await page.keyboard.press("Enter"); }
    await expect(page.locator("#lgMsg")).toContainText(cur.toUpperCase());
    await page.keyboard.press("Enter");
  }
  await expect(page.locator("#lingoOver")).toBeVisible();
  await expect(page.locator("#lingoTxt")).toContainText("1 word found");
  const s = await saved(page);
  expect(s.lingo).toEqual({ best: 1, played: 1, words: 1 });
  expect(s.xp).toBe(10);                                  // 50 points for a first-try word, XP = points / 5
  await page.keyboard.press("Escape");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#mLingoText")).toHaveText("Record: 1 word");
});

test("Backspace never erases the given first letter; Esc with no guess goes back to the map", async ({ page }) => {
  await openApp(page, withChapters(18));
  await page.click("#mLingo");
  const word = await page.evaluate(() => LG.word);
  await page.keyboard.type("ab");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
  expect(await page.evaluate(() => LG.cur)).toBe(word[0]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#lingoOver")).toBeHidden();
});

test("fits at 1366x657: the whole grid and the hint are on screen", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, withChapters(18));
  await page.click("#mLingo");
  await expect(page.locator("#lgGrid .lrow").last()).toBeInViewport({ ratio: 1 });
  await expect(page.locator("#lingo p.muted")).toBeInViewport({ ratio: 1 });
});
