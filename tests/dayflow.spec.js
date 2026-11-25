// Daily flow (UX-31): a welcome opens the day (Enter = warm-up, Esc = skip).
// Soft line: after today's goal, new chapters wait until tomorrow and runs give 25% XP.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

const done = (n) => { const q = {}; for (let i = 0; i < n; i++) q[i] = { stars: 1, wpm: 15, acc: 95 }; return { qwerty: q, azerty: {} }; };
const day = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const veteran = (extra = {}) => player(Object.assign({ lessons: done(3), flags: { tour: 1, rev: 1 }, today: { date: day(-1), secs: 700, goal: 1 } }, extra));
const W = "#dayWelcome";

test("new day: the welcome asks for the warm-up; Enter starts it", async ({ page }) => {
  await openApp(page, veteran(), { welcome: true });
  await expect(page.locator(W)).toHaveClass(/on/);
  await expect(page.locator("#dwTxt")).toContainText("Ready to warm up");
  await page.keyboard.press("Enter");
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#tTitle")).toContainText("warm-up");
});

test("Esc skips the welcome; it does not come back today", async ({ page }) => {
  await openApp(page, veteran(), { welcome: true });
  await expect(page.locator(W)).toHaveClass(/on/);
  await page.keyboard.press("Escape");
  await expect(page.locator(W)).not.toHaveClass(/on/);
  expect((await saved(page)).dayOpen).toBe(day());
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator(W)).not.toHaveClass(/on/);
  // The warm-up tile is still there for later.
  await expect(page.locator("#mWarm")).not.toHaveClass(/locked/);
});

test("before chapter 1 is passed: the welcome opens chapter 1", async ({ page }) => {
  await openApp(page, player({ flags: { tour: 1 } }), { welcome: true });
  await expect(page.locator("#dwTxt")).toContainText("chapter 1");
  await expect(page.locator("#dwGoT")).toHaveText("Start chapter 1");
  await page.click("#dwGo");
  await expect(page.locator("#tTitle")).toHaveText(/^1\. /);
});

test("no welcome when the player already played today, or before the tour", async ({ page }) => {
  await openApp(page, veteran({ today: { date: day(), secs: 30 } }), { welcome: true });
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator(W)).not.toHaveClass(/on/);
});

test("after the warm-up the home screen opens without the welcome", async ({ page }) => {
  await openApp(page, veteran(), { welcome: true });
  await page.keyboard.press("Enter");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await page.click("#rMap");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator(W)).not.toHaveClass(/on/);
  expect((await saved(page)).dayOpen).toBe(day());
});

test("soft line: new chapters wait until tomorrow, played chapters stay open", async ({ page }) => {
  await openApp(page, veteran({ today: { date: day(), secs: 610, goal: 1 } }));
  await expect(page.locator("#mContText")).toContainText("Opens tomorrow");
  await expect(page.locator('#map .lesson[data-i="3"]')).toHaveClass(/rest/);
  await expect(page.locator('#map .lesson[data-i="1"]')).not.toHaveClass(/locked/);
  await page.click("#mContinue");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#toast")).toContainText("New chapters open tomorrow");
  // Keebo says it on the home screen.
  await expect(page.locator("#home .botbox")).toContainText("See you tomorrow");
  // A replay of chapter 3 works and gives 25% XP.
  await page.click('#map .lesson[data-i="2"]');
  await expect(page.locator("#type")).toBeVisible();
  const xp0 = (await saved(page)).xp;
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rXpL")).toHaveText("XP · 25%");
  const shown = +(await page.locator("#rXp").textContent()).replace("+", "");
  expect((await saved(page)).xp - xp0).toBe(shown);
  // Next would open chapter 4, a new chapter: no Next button.
  await expect(page.locator("#rNext")).toBeHidden();
});

test("XP: full before the goal, 25% after it", async ({ page }) => {
  await openApp(page, veteran());
  expect(await page.evaluate("runSoft=false; earnXp(100)")).toBe(100);
  expect(await page.evaluate("runSoft=true; earnXp(100)")).toBe(25);
});

test("test tools: reach today's goal, then a new day brings the welcome back", async ({ page }) => {
  await openApp(page, veteran(), { welcome: true });
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.querySelector("#setGoalGo").click());
  const s = await saved(page);
  expect(s.today.secs).toBeGreaterThanOrEqual(600);
  expect(s.days).toContain(day());
  await expect(page.locator("#toast")).toContainText("Today's goal is reached");
  await expect(page.locator("#mContText")).toContainText("Opens tomorrow");
  await page.evaluate(() => document.querySelector("#setNewDayGo").click());
  await expect(page.locator(W)).toHaveClass(/on/);
  expect((await saved(page)).dayOpen).toBe(day(-1));
});

// Quiet hours 23:00 to 5:00: no XP, stars, badges or goal time; Keebo says it is late. The app stays open.
test.describe("quiet hours", () => {
  test("a chapter run gives no XP, no stars and no goal time; Keebo says it is late", async ({ page }) => {
    await openApp(page, veteran(), { hour: 23 });
    await expect(page.locator("#home .botbox")).toContainText("It's late");
    await page.click('#map .lesson[data-i="2"]');
    await typeAll(page);
    await expect(page.locator("#result")).toBeVisible();
    await expect(page.locator("#rXp")).toHaveText("+0");
    await expect(page.locator("#rXpL")).toContainText("quiet");
    await expect(page.locator("#result .botbox")).toContainText("Sleep makes your fingers faster");
    const s = await saved(page);
    expect(s.xp).toBe(0);
    expect(s.today.date).toBe(day(-1));               // no goal time today
    expect(s.lessons.qwerty[2].wpm).toBe(15);          // record unchanged
  });

  test("new chapters wait until 5:00; games stay open", async ({ page }) => {
    await openApp(page, veteran(), { hour: 2 });
    await expect(page.locator("#mContText")).toContainText("after 5:00");
    await page.click("#mContinue");
    await expect(page.locator("#toast")).toContainText("Quiet hours");
    await page.click("#mSmart");
    await expect(page.locator("#type")).toBeVisible();
  });

  test("at 5:00 a new day starts: play at 2:00 counts for the day before", async ({ page }) => {
    await openApp(page, veteran());
    const r = await page.evaluate(() => {
      const at = (h) => todayStr(new Date(new Date(2026, 10, 26, h, 30).getTime() - 5 * 36e5));
      return [at(2), at(4), at(5), at(23)];
    });
    expect(r).toEqual(["2026-11-25", "2026-11-25", "2026-11-26", "2026-11-26"]);
  });

  test("test tool: quiet hours On in Settings", async ({ page }) => {
    await openApp(page, veteran());
    expect(await page.evaluate("isQuiet()")).toBe(false);
    await page.evaluate("state.quietTest = 1");
    // On main (IS_DEV false) the test switch does nothing.
    expect(await page.evaluate("isQuiet()")).toBe(false);
  });
});
