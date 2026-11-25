// Daily goal moment: one time per day, on the result screen, when today's practice reaches 10 minutes.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

async function todayStr(page) { return page.evaluate("todayStr()"); }

test("the run that reaches 10 minutes shows the goal moment after the summary", async ({ page }) => {
  await openApp(page, player());
  const t = await todayStr(page);
  await page.evaluate((t) => { state.today = { date: t, secs: 599.8 }; save(); }, t);
  await page.click("#mContinue");
  // No goal moment during the run.
  await page.keyboard.type(await page.evaluate("S.text.slice(0,4)"), { delay: 2 });
  await expect(page.locator("#rGoal")).toBeHidden();
  await page.keyboard.type(await page.evaluate("S.text.slice(S.pos)"), { delay: 2 });
  await expect(page.locator("#result")).toBeVisible();
  const goal = page.locator("#rGoal");
  await expect(goal).toBeVisible({ timeout: 6000 });
  await expect(goal).toContainText("Goal reached, see you tomorrow");
  expect(await page.evaluate("confParts.length")).toBeGreaterThan(0);
  expect((await saved(page)).today.goal).toBe(1);
  // Soft line (UX-31): chapter 2 is new, so Next is gone. Retry still works: no forced stop.
  await expect(page.locator("#rNext")).toBeHidden();
  await page.click("#rRetry");
  await expect(page.locator("#type")).toBeVisible();
});

test("only one time per day", async ({ page }) => {
  await openApp(page, player({ lessons: { qwerty: { 0: { stars: 0, wpm: 5, acc: 80 } }, azerty: {} } }));   // chapter 1 started: open after the goal
  const t = await todayStr(page);
  await page.evaluate((t) => { state.today = { date: t, secs: 700, goal: 1 }; save(); }, t);
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(page.locator("#rGoal")).toBeHidden();
});

test("below 10 minutes: no goal moment", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(page.locator("#rGoal")).toBeHidden();
  expect((await saved(page)).today.goal).toBeUndefined();
});

test("home shows a tick when the goal is done", async ({ page }) => {
  await openApp(page, player());
  const t = await todayStr(page);
  await page.evaluate((t) => { state.today = { date: t, secs: 610, goal: 1 }; save(); renderHome(); }, t);
  await expect(page.locator("#gTxt")).toHaveText("10 / 10 min ✅");
});

test("a new day: the goal moment can come again", async ({ page }) => {
  await openApp(page, player());
  const r = await page.evaluate(() => {
    state.today = { date: "2000-01-01", secs: 900, goal: 1 };
    const a = addToday(30);            // new day: starts at 30 s
    const b = addToday(580);           // 610 s: goal
    const c = addToday(60);            // already done today
    goalPending = false;
    return [a, b, c, state.today.goal];
  });
  expect(r).toEqual([false, true, false, 1]);
});
