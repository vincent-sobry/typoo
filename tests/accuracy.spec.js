// Accuracy first: accuracy is the main number on home, map, typing and result. Speed counts only for ★★★.
const { test, expect } = require("@playwright/test");
const { player, openApp, typeAll } = require("./helpers");

test("star rules: ★ 90%, ★★ 96% at any speed, ★★★ 98% and the target WPM", async ({ page }) => {
  await openApp(page, player());
  const r = await page.evaluate(() => [starsFor(5, 89, 20), starsFor(5, 90, 20), starsFor(1, 96, 20), starsFor(19, 99, 20), starsFor(20, 98, 20), starsFor(60, 97, 20)]);
  expect(r).toEqual([0, 1, 2, 2, 3, 2]);
});

test("home: accuracy of the last 10 runs first, Best WPM last", async ({ page }) => {
  const history = [90, 94, 96, 98, 100, 95, 97, 93, 99, 98, 50].map((a) => ({ d: "x", wpm: 20, acc: a }));
  await openApp(page, player({ bestWpm: 31, history }));
  const stats = page.locator("#home .stats3 .stat b");
  await expect(stats.first()).toHaveAttribute("id", "sAcc");
  await expect(stats.last()).toHaveAttribute("id", "sBest");
  await expect(page.locator("#sAcc")).toHaveText(Math.round([94, 96, 98, 100, 95, 97, 93, 99, 98, 50].reduce((a, b) => a + b) / 10) + "%");
  await expect(page.locator("#sBest")).toHaveText("31");
});

test("home: a new player sees a dash, not 0%", async ({ page }) => {
  await openApp(page, player());
  await expect(page.locator("#sAcc")).toHaveText("–");
});

test("map: stage goal is accuracy; tiles show accuracy first", async ({ page }) => {
  await openApp(page, player({ lessons: { qwerty: { 0: { stars: 2, wpm: 22, acc: 97 } }, azerty: {} } }));
  await expect(page.locator("#map .stage h3 .tgt").first()).toHaveText("goal: 96% accuracy");
  await expect(page.locator("#map .lesson").nth(0).locator(".w")).toHaveText("🎯 97% · 22 WPM");
});

test("typing and result: accuracy first; a better accuracy shows a record chip", async ({ page }) => {
  await openApp(page, player({ lessons: { qwerty: { 0: { stars: 1, wpm: 10, acc: 91 } }, azerty: {} } }));
  await page.evaluate(() => startLesson(0));
  await expect(page.locator("#type .live .pill").first()).toContainText("🎯");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#result .rstats .stat b").first()).toHaveAttribute("id", "rAcc");
  await expect(page.locator("#rRec")).toBeVisible();
  await expect(page.locator("#rRec")).toContainText("New accuracy record");
});

test("result: no record chip on the first run of a chapter", async ({ page }) => {
  await openApp(page, player());
  await page.evaluate(() => startLesson(0));
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rRec")).toBeHidden();
});
