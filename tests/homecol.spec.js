// Home on wide screens: the top of the left column and the badges stay; the games list scrolls.
const { test, expect } = require("@playwright/test");
const { player, openApp } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

for (const [w, h] of [[1366, 780], [1440, 900], [1920, 1080]]) {
  test(`${w}x${h}: games list scrolls, stats and badges stay in the window`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openApp(page, player());
    const r = await page.evaluate(() => {
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      const m = document.querySelector("#home .modes");
      return { stats: box("#home .stats3").bottom, badges: box("#badges").bottom, modesH: m.clientHeight,
        scrolls: m.scrollHeight > m.clientHeight, page: document.documentElement.scrollHeight - innerHeight, inner: innerHeight };
    });
    expect(r.page).toBeLessThanOrEqual(1);               // the page itself does not scroll
    expect(r.badges).toBeLessThanOrEqual(r.inner);       // badges visible
    expect(r.stats).toBeLessThan(r.inner);
    expect(r.modesH).toBeGreaterThanOrEqual(170);
    expect(r.scrolls).toBe(true);
    await page.locator("#home .modes").evaluate((m) => { m.scrollTop = m.scrollHeight; });
    await expect(page.locator("#mBoost")).toBeInViewport();
  });
}

test("narrow screen: one column, the page scrolls as before", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await openApp(page, player());
  const scrolls = await page.evaluate(() => document.querySelector("#home .modes").scrollHeight > document.querySelector("#home .modes").clientHeight + 1);
  expect(scrolls).toBe(false);
});

test("short screen (under 780 px high, Chromebook): the whole page scrolls, the games list does not", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, player());
  const r = await page.evaluate(() => { const m = document.querySelector("#home .modes");
    return { list: m.scrollHeight > m.clientHeight + 1, page: document.documentElement.scrollHeight > innerHeight }; });
  expect(r.list).toBe(false);
  expect(r.page).toBe(true);
});

test("badges: 20 badges in a full grid of 4 rows of 5", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openApp(page, player());
  const rows = await page.evaluate(() => { const t = [...document.querySelectorAll("#badges .badge")].map((b) => Math.round(b.getBoundingClientRect().top));
    const r = {}; t.forEach((y) => (r[y] = (r[y] || 0) + 1)); return Object.values(r); });
  expect(rows).toEqual([5, 5, 5, 5]);
  await expect(page.locator("#badges .badge").last()).toBeInViewport();
});

test("Word Legend: a win in Longest Word or Word Marathon, any level", async ({ page }) => {
  await openApp(page, player({ marathon: { best: 0, played: 1, boss: 0, lv: { fun: { best: 8, played: 1, boss: 1 } } } }));
  expect(await page.evaluate("ladderWins()")).toBe(1);
  await page.evaluate("checkBadges(); save()");
  expect((await page.evaluate("state.badges")).ladder).toBeTruthy();
});
