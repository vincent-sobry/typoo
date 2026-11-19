// Rewards: badge card (touch + mouse), unlock reason, level-up celebration, confetti.
const { test, expect } = require("@playwright/test");
const { player, openApp, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });
  test("tap a badge to see its rule and progress", async ({ page }) => {
    await openApp(page, player({ bestWpm: 14 }));
    await page.locator('#badges .badge[data-id="w20"]').tap();
    const card = page.locator("#badgeCard");
    await expect(card).toBeVisible();
    await expect(card.locator("#bcName")).toHaveText("20 WPM");
    await expect(card.locator("#bcRule")).toContainText("Type 20 WPM");
    await expect(card.locator("#bcProg")).toHaveText("14 of 20 WPM");
    await expect(card.locator("#bcDate")).toContainText("Not earned yet");
    await page.locator("#bcClose").tap();
    await expect(card).toBeHidden();
  });
});

test("an earned badge shows the date", async ({ page }) => {
  await openApp(page, player({ badges: { first: "2026-11-10" }, lessons: { qwerty: { 0: { stars: 1, wpm: 12, acc: 92 } }, azerty: {} } }));
  await page.click('#badges .badge[data-id="first"]');
  await expect(page.locator("#bcProg")).toHaveText("Done! ✅");
  await expect(page.locator("#bcDate")).toContainText("Earned on");
  await expect(page.locator("#bcDate")).toContainText("2026");
  await page.keyboard.press("Escape");
  await expect(page.locator("#badgeCard")).toBeHidden();
});

test("stage badge counts chapters", async ({ page }) => {
  await openApp(page, player({ lessons: { qwerty: { 0: { stars: 1, wpm: 12, acc: 92 }, 1: { stars: 2, wpm: 14, acc: 95 } }, azerty: {} } }));
  await page.click('#badges .badge[data-id="home"]');
  await expect(page.locator("#bcProg")).toHaveText(/^2 of \d+ chapters$/);
});

test("unlock toast tells why", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#toast")).toHaveClass(/on/, { timeout: 5000 });
  await expect(page.locator("#toastT")).toContainText("First Steps");
  await expect(page.locator("#toastT")).toContainText("Finish your first chapter");
});

test("level up after the chapter summary", async ({ page }) => {
  await openApp(page, player({ xp: 95 })); // 5 XP to level 2
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rLvl")).toBeVisible();
  const up = page.locator("#rLvlUp");
  await expect(up).toBeVisible({ timeout: 5000 });
  await expect(up).toContainText("Level up! Level 2");
  await expect(page.locator("#rLvlName")).toContainText("Level 2");
  expect(await page.evaluate("confParts.length")).toBeGreaterThan(0);
});

test("no level up: XP bar only", async ({ page }) => {
  await openApp(page, player({ xp: 218 })); // start of level 3
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#rLvlXp")).not.toHaveText(/^0 \//, { timeout: 5000 });
  await page.waitForTimeout(2200);
  await expect(page.locator("#rLvlUp")).toBeHidden();
  await expect(page.locator("#rLvlName")).toContainText("Level 3");
});

test("level up in a new title shows the title", async ({ page }) => {
  // Level 3 -> 4 changes the title from Key Rookie to Home Row Scout. Level 4 starts at 357 XP.
  await openApp(page, player({ xp: 355 }));
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#rLvlUp")).toContainText("New title: Home Row Scout", { timeout: 5000 });
});
