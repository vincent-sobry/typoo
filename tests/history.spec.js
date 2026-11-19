// Browser Back and Forward: the map is one step, each other screen is one step on top of it.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  // The test seed script cannot run on about:blank after the app is left. That error is not from the app.
  expect(page.errors.filter((m) => !m.includes("sessionStorage")), "no JavaScript errors").toEqual([]);
});

const hash = (page) => page.evaluate(() => location.hash);

test("Back in a run stops it, saves nothing and shows the map", async ({ page }) => {
  await openApp(page, player());
  await expect(page.locator("#home")).toBeVisible();
  expect(await hash(page)).toBe("#home");
  await page.click("#mContinue");
  await expect(page.locator("#type")).toBeVisible();
  expect(await hash(page)).toBe("#type");
  await page.keyboard.type((await page.evaluate("S.text")).slice(0, 3));
  await page.goBack();
  await expect(page.locator("#home")).toBeVisible();
  expect(await page.evaluate("S")).toBeNull();
  expect(await hash(page)).toBe("#home");
  const s = await saved(page);
  expect(s.xp).toBe(0);
  expect(s.history).toEqual([]);
  // Forward cannot bring a stopped run back: the map stays.
  await page.goForward();
  await page.waitForTimeout(200);
  await expect(page.locator("#home")).toBeVisible();
  expect(await hash(page)).toBe("#home");
});

test("Back on the result screen goes to the map, in one step", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  expect(await hash(page)).toBe("#result");
  await page.goBack();
  await expect(page.locator("#home")).toBeVisible();
  expect((await saved(page)).xp).toBeGreaterThan(0);        // the finished run stays saved
  // The map is the first step of the app: one more Back leaves it.
  await page.goBack();
  await expect(page).toHaveURL("about:blank");
});

test("Settings: Back closes, Forward opens again", async ({ page }) => {
  await openApp(page, player());
  await page.click("#hSettings");
  await expect(page.locator("#settings")).toBeVisible();
  expect(await hash(page)).toBe("#settings");
  await page.goBack();
  await expect(page.locator("#settings")).toBeHidden();
  await expect(page.locator("#home")).toBeVisible();
  await page.goForward();
  await expect(page.locator("#settings")).toBeVisible();
  // The Close button also goes back one step, so Back after it leaves the app.
  await page.click("#setClose");
  await expect(page.locator("#settings")).toBeHidden();
  await expect.poll(() => hash(page)).toBe("#home");
  await page.goBack();
  await expect(page).toHaveURL("about:blank");
});

test("lobby to game: Back from the race goes to the map, not the lobby", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mRace");
  await expect(page.locator("#raceLobby")).toBeVisible();
  expect(await hash(page)).toBe("#raceLobby");
  await page.locator("#raceChoices .choice").first().click();
  await expect(page.locator("#type")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#raceLobby")).toBeHidden();
  expect((await saved(page)).races.played).toBe(0);
  // Forward from the map after the race: nothing restarts.
  await page.goForward();
  await page.waitForTimeout(200);
  await expect(page.locator("#home")).toBeVisible();
});

test("Word Rain: Back stops the game", async ({ page }) => {
  await openApp(page, player());
  await page.evaluate(() => startRain());
  await expect(page.locator("#meteor")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#home")).toBeVisible();
  expect(await page.evaluate("M.running")).toBe(false);
});

test("a reload on a game step opens the map and Back still leaves the app", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await expect(page.locator("#type")).toBeVisible();
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
  await expect.poll(() => hash(page)).toBe("#home");
  await page.goBack();
  await expect(page).toHaveURL("about:blank");
});
