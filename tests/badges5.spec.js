// UX-29: a 6th badge column with 4 badges for warm-up, Booster, daily sentence and a 30-day streak.
const { test, expect } = require("@playwright/test");
const { player, openApp } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

const NEW = ["pilot", "early", "scroll", "s30"];

test("24 badges in 6 columns, the new ones in the last column", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openApp(page, player({}));
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll("#badges .badge")];
    const tops = [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))];
    const right = Math.max(...els.map((e) => Math.round(e.getBoundingClientRect().right)));
    const last = els.filter((e) => Math.round(e.getBoundingClientRect().right) === right).map((e) => e.dataset.id);
    return { n: els.length, rows: tops.length, last, count: document.querySelector("#bCount").textContent };
  });
  expect(r.n).toBe(24);
  expect(r.rows).toBe(4);
  expect(r.last).toEqual(NEW);
  expect(r.count).toBe("0 / 24");
});

test("the new badges show progress and unlock", async ({ page }) => {
  await openApp(page, player({ warmup: { last: "", count: 3 }, boost: { played: 6, ups: 4 }, daily: { last: "", count: 9, best: 0 } }));
  const prog = async (id) => {
    await page.click(`#badges .badge[data-id="${id}"]`);
    const t = await page.locator("#bcProg").textContent();
    await page.click("#bcClose");
    return t;
  };
  expect(await prog("early")).toBe("3 of 7 warm-ups");
  expect(await prog("pilot")).toBe("4 of 5 chapters");
  expect(await prog("scroll")).toBe("9 of 10 sentences");
  expect(await prog("s30")).toMatch(/of 30 days/);
  const b = await page.evaluate(() => {
    state.warmup.count = 7; state.boost.ups = 5; state.daily.count = 10;
    checkBadges();
    return state.badges;
  });
  expect(Object.keys(b).sort()).toEqual(["early", "pilot", "scroll"]);
});

test("the new badges have a text in each language", async ({ page }) => {
  await openApp(page, player({}));
  const r = await page.evaluate((ids) => ["nl", "fr", "it"].map((l) => ids.every((id) => Array.isArray(I18N[l].badgeText[id]))
    && ["u.warmups", "u.sentences"].every((k) => I18N[l][k])), NEW);
  expect(r).toEqual([true, true, true]);
});
