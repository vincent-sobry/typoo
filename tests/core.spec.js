// Core flows: onboarding, saved progress, a full chapter, settings, dev storage key.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { KEY, player, openApp, saved, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

test("onboarding saves a new player", async ({ page }) => {
  await openApp(page, null);
  await expect(page.locator("#onboard")).toBeVisible();
  await page.fill("#obName", "Nova");
  await page.click("#obLayout [data-v=qwerty]");
  await page.click("#obLang [data-v=en]");
  await page.click("#obGo");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#pName")).toHaveText("Nova");
  const s = await saved(page);
  expect(s).toMatchObject({ name: "Nova", layout: "qwerty", lang: "en" });
});

test("old saved progress still loads", async ({ page }) => {
  // A save from before new settings were added: no "hands" field.
  const old = player({ xp: 250, bestWpm: 18, lessons: { qwerty: { 0: { stars: 2, wpm: 18, acc: 96 } }, azerty: {} } });
  await openApp(page, old);
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#pXp")).toHaveText("250 XP");
  await expect(page.locator("#sBest")).toHaveText("18");
  await expect(page.locator("#map .lesson").nth(0).locator(".s .on")).toHaveCount(2);
});

test("a full chapter gives stars and XP", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await expect(page.locator("#type")).toBeVisible();
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rStars span.on").first()).toBeVisible();
  const s = await saved(page);
  expect(s.lessons.qwerty[0].stars).toBeGreaterThanOrEqual(1);
  expect(s.xp).toBeGreaterThan(0);
  expect(s.badges.first).toBeTruthy();
  // Next chapter is open now.
  await page.click("#rMap");
  await expect(page.locator("#map .lesson").nth(1)).not.toHaveClass(/locked/);
});

test("a wrong key does not move the cursor", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  const first = await page.evaluate("S.text[0]");
  await page.keyboard.press(first === "q" ? "w" : "q");
  expect(await page.evaluate("S.pos")).toBe(0);
  expect(await page.evaluate("S.errors")).toBe(1);
  await page.keyboard.type(first);
  expect(await page.evaluate("S.pos")).toBe(1);
});

test("settings open, change and close", async ({ page }) => {
  await openApp(page, player());
  await page.click("#hSettings");
  await expect(page.locator("#settings")).toBeVisible();
  await page.click("#setBlind [data-v='1']");
  await page.click("#setClose");
  await expect(page.locator("#settings")).toBeHidden();
  expect((await saved(page)).blind).toBe(1);
});

test("dev preview uses its own storage key", async ({ page }) => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  await page.route("**/typoo/dev/", (r) => r.fulfill({ contentType: "text/html", body: html }));
  await page.goto("/index.html");
  await page.evaluate((k) => localStorage.setItem(k, "KEEP"), KEY);
  await page.goto("/typoo/dev/");
  await expect(page.locator("#onboard")).toBeVisible();
  await page.fill("#obName", "DevTester");
  await page.click("#obGo");
  await expect(page.locator("#home")).toBeVisible();
  const keys = await page.evaluate(() => ({ main: localStorage.getItem("typo.v1"), dev: localStorage.getItem("typo.dev.v1") }));
  expect(keys.main).toBe("KEEP");
  expect(JSON.parse(keys.dev).name).toBe("DevTester");
});
