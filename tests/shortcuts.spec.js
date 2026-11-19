// Keyboard shortcuts: map, typing run, result, lobbies. The list is in Settings.
const { test, expect } = require("@playwright/test");
const { player, openApp, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

const done = (n) => { const q = {}; for (let i = 0; i < n; i++) q[i] = { stars: 1, wpm: 12, acc: 95 }; return { qwerty: q, azerty: {} }; };

test("Enter on the map starts the next chapter", async ({ page }) => {
  await openApp(page, player());
  await page.keyboard.press("Enter");
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#tTitle")).toHaveText(/^1\. /);
});

test("number keys open the tiles in screen order", async ({ page }) => {
  await openApp(page, player({ lessons: done(3) }));
  const tiles = page.locator("#home .modes .mode:not([hidden])");
  await expect(tiles.nth(0).locator(".hk")).toHaveText("1");
  const ids = await tiles.evaluateAll((b) => b.map((x) => x.id));
  const race = ids.indexOf("mRace") + 1;
  await page.keyboard.press(String(race));
  await expect(page.locator("#raceLobby")).toHaveClass(/on/);
  // 1-4 picks a speed in the lobby
  await page.keyboard.press("1");
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#tTitle")).toContainText("Race vs Keebo");
});

test("number keys work by key position (AZERTY: no Shift)", async ({ page }) => {
  await openApp(page, player({ lessons: done(3) }));
  const ids = await page.locator("#home .modes .mode:not([hidden])").evaluateAll((b) => b.map((x) => x.id));
  const n = ids.indexOf("mContinue") + 1;
  await page.evaluate((n) => document.dispatchEvent(new KeyboardEvent("keydown", { key: "&é\"'(§è!ç"[n - 1], code: "Digit" + n, bubbles: true })), n);
  await expect(page.locator("#type")).toBeVisible();
});

test("S opens Settings, which lists the shortcuts", async ({ page }) => {
  await openApp(page, player());
  await page.keyboard.press("s");
  await expect(page.locator("#settings")).toHaveClass(/on/);
  await expect(page.locator("#setKeys")).toContainText("Start the same run again");
  // Typing in the name field does not start anything
  await page.locator("#setName").fill("");
  await page.locator("#setName").type("Ann1");
  await expect(page.locator("#settings")).toHaveClass(/on/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings")).not.toHaveClass(/on/);
});

test("Tab in a run starts the same chapter again, nothing is saved", async ({ page }) => {
  await openApp(page, player());
  await page.keyboard.press("Enter");
  await page.keyboard.type(await page.evaluate("S.text.slice(0,5)"));
  expect(await page.evaluate("S.pos")).toBe(5);
  await page.keyboard.press("Tab");
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#tTitle")).toHaveText(/^1\. /);
  expect(await page.evaluate("S.pos")).toBe(0);
  expect(await page.evaluate("state.history.length")).toBe(0);
});

test("Tab restarts Longest Word cleanly", async ({ page }) => {
  // Longest Word opens after the Bottom Row (18 chapters with 1 star).
  await openApp(page, player({ lessons: done(18), bestWpm: 20 }));
  await page.click("#mLadder");
  await expect(page.locator("#type")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator("#tTitle")).toContainText("Longest Word · 2 letters");
  expect(await page.evaluate("!!LW && !LW.over")).toBe(true);
});

test("result: R = retry, M = map", async ({ page }) => {
  await openApp(page, player());
  await page.keyboard.press("Enter");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.locator("#type")).toBeVisible();
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await page.keyboard.press("m");
  await expect(page.locator("#home")).toBeVisible();
});

test("letters in a run are text, not shortcuts", async ({ page }) => {
  await openApp(page, player({ lessons: done(6) }));
  await page.keyboard.press("Enter");
  await page.keyboard.press("s");
  await page.keyboard.press("1");
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#settings")).not.toHaveClass(/on/);
});
