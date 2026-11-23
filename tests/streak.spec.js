// UX-26 Check streak: streak days = days with today's goal reached, week strip, 1 freeze with a 5-day recharge.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** Local date, n days from today (n<0 = in the past), as the app stores it. */
function day(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
/** Days n..m days ago (both included). */
const ago = (...ns) => ns.map((n) => day(-n));
const migrated = { days2: 1 };

/** Streak info for the given saved days, on day `on` (days from today). */
async function info(page, days, on = 0) {
  await openApp(page, player({ days, flags: migrated }));
  return page.evaluate((t) => { const s = streakInfo(t); return { ...s, mark: undefined }; }, day(on));
}

test("rules: goal days in a row count, a gap of 2 days breaks the streak", async ({ page }) => {
  const s = await info(page, ago(9, 2, 1));
  expect(s.count).toBe(2);
  expect(s.atRisk).toBe(true);
  const s2 = await page.evaluate((t) => streakInfo(t).count, day(1));
  expect(s2, "tomorrow: today is frozen, so the streak still shows").toBe(2);
  const s3 = await page.evaluate((t) => streakInfo(t).count, day(2));
  expect(s3, "2 missed days in a row break the streak").toBe(0);
});

test("rules: 1 missed day is frozen and becomes a streak day when the goal is reached the next day", async ({ page }) => {
  const s = await info(page, ago(4, 3, 1, 0));
  expect(s.count, "4 goal days + 1 saved frozen day").toBe(5);
  expect(s.frozen).toBe(false);
  expect(s.freezeReady).toBe(false);
  expect(s.freezeIn, "freeze comes back 5 days after the missed day (2 days ago)").toBe(3);
  expect(s.atRisk).toBe(false);
});

test("rules: a frozen day with no goal on the next day breaks the streak", async ({ page }) => {
  const s = await info(page, ago(4, 3));
  expect(s.count).toBe(0);
  expect(s.broken).toBe(true);
  const y = await page.evaluate((t) => { const i = streakInfo(t); return [i.count, i.frozen]; }, day(-1));
  expect(y, "yesterday: 2 days ago was frozen, the streak still showed").toEqual([2, true]);
});

test("rules: the freeze comes back 5 days after the missed day, not before", async ({ page }) => {
  // Missed 9 days ago (frozen, saved). Missed again 5 days ago: 4 days later, no freeze -> break.
  const early = await info(page, ago(12, 11, 10, 8, 7, 6, 4, 3, 2, 1));
  expect(early.count, "streak broke 5 days ago, then 4 new days").toBe(4);
  // Missed 9 days ago and 4 days ago: 5 days later, freeze is back -> no break.
  const s = await page.evaluate(([days, t]) => { state.days = days; return streakInfo(t).count; }, [ago(12, 11, 10, 8, 7, 6, 5, 3, 2, 1), day(0)]);
  expect(s, "12 days: 10 goal days + 2 saved").toBe(12);
});

test("rules: one busy weekday per week does not break the streak", async ({ page }) => {
  const days = []; for (let n = 1; n <= 28; n++) if (n % 7 !== 3) days.push(day(-n));
  const s = await info(page, days);
  expect(s.count).toBe(28);
  expect(s.freezeIn, "missed 3 days ago: back in 2 days, before the next miss 7 days later").toBe(2);
});

test("a run alone is no streak day; reaching the 10-minute goal is", async ({ page }) => {
  await openApp(page, player({ flags: migrated }));
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  let st = await saved(page);
  expect(st.days).toEqual([]);
  await page.click("#rMap");
  await expect(page.locator("#hStreak")).toHaveText("🔥 0 days");
  await page.evaluate((t) => { state.today = { date: t, secs: 599.99 }; save(); }, day(0));
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  st = await saved(page);
  expect(st.days).toEqual([day(0)]);
  expect(st.streak).toEqual({ count: 1, last: day(0) });
});

test("home: week strip shows the last 7 days, the frozen day and the freeze state", async ({ page }) => {
  await openApp(page, player({ days: ago(6, 5, 4, 3, 2), flags: migrated }));
  const pill = page.locator("#hStreak");
  await expect(pill).toHaveText("🔥 5 days · at risk");
  await expect(pill).toHaveClass(/risk/);
  const cells = page.locator("#wDays .wd");
  await expect(cells).toHaveCount(7);
  await expect(cells.nth(0)).toHaveClass(/goal/);
  await expect(cells.nth(5)).toHaveClass(/frozen/);
  await expect(cells.nth(6)).toHaveClass(/today/);
  await expect(cells.nth(6)).toHaveClass(/now/);
  await expect(page.locator("#wFreeze")).toHaveText("❄ Freeze back in 4 days");
  await expect(page.locator("#wSave")).toBeVisible();
  await expect(page.locator("#wSave")).toHaveText("Reach today's goal to save your streak");
  await expect(page.locator("#homeBubble")).toContainText("save your streak");
  // Goal reached today: frozen day saved, no warning.
  await page.evaluate((t) => { addStreakDay(t); renderHome(); }, day(0));
  await expect(pill).toHaveText("🔥 7 days");
  await expect(pill).not.toHaveClass(/risk/);
  await expect(cells.nth(5)).toHaveClass(/saved/);
  await expect(page.locator("#wSave")).toBeHidden();
});

test("home: freeze ready, no 'at risk' without a streak", async ({ page }) => {
  await openApp(page, player({ flags: migrated }));
  await expect(page.locator("#hStreak")).toHaveText("🔥 0 days");
  await expect(page.locator("#hStreak")).not.toHaveClass(/risk/);
  await expect(page.locator("#wFreeze")).toHaveText("❄ Freeze ready");
  await expect(page.locator("#wSave")).toBeHidden();
});

test("migration: an old streak keeps its count", async ({ page }) => {
  await openApp(page, player({ streak: { count: 6, last: day(-1) }, xp: 120 }));
  await expect(page.locator("#hStreak")).toHaveText("🔥 6 days · at risk");
  const r = await page.evaluate(() => ({ days: state.days, f: state.flags.days2, xp: state.xp }));
  expect(r.days).toEqual(ago(6, 5, 4, 3, 2, 1));
  expect(r.f).toBe(1);
  expect(r.xp).toBe(120);
});

test("migration: an old streak with a run today but no goal moves to end yesterday", async ({ page }) => {
  await openApp(page, player({ streak: { count: 3, last: day(0) }, today: { date: day(0), secs: 200 } }));
  expect(await page.evaluate("state.days")).toEqual(ago(3, 2, 1));
  await expect(page.locator("#hStreak")).toHaveText("🔥 3 days · at risk");
});

test("migration: goal already reached today counts today", async ({ page }) => {
  await openApp(page, player({ streak: { count: 2, last: day(0) }, today: { date: day(0), secs: 650, goal: 1 } }));
  expect(await page.evaluate("state.days")).toEqual(ago(1, 0));
  await expect(page.locator("#hStreak")).toHaveText("🔥 2 days");
});

test("migration: a broken old streak shows 'welcome back'", async ({ page }) => {
  await openApp(page, player({ streak: { count: 5, last: day(-4) } }));
  await expect(page.locator("#hStreak")).toHaveText("🔥 0 days");
  await expect(page.locator("#homeBubble")).toContainText("Welcome back");
});

test("badges On Fire and Unstoppable follow the new streak", async ({ page }) => {
  await openApp(page, player({ days: ago(3, 2, 1), flags: migrated }));
  await page.evaluate(() => checkBadges());
  const b = await page.evaluate(() => state.badges);
  expect(b.s3).toBeTruthy();
  expect(b.s7).toBeFalsy();
});
