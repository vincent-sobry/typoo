// Keyboard layout hint: never during typing, only after the run (result or home screen).
const { test, expect } = require("@playwright/test");
const { player, openApp, saved, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** A key press from an AZERTY keyboard: the key at the Q position gives "a". */
async function azertyKey(page) {
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyQ", bubbles: true, cancelable: true })));
}

test("no hint during the run, hint on the result screen", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await azertyKey(page);
  await expect(page.locator("#layoutWarn")).toBeHidden();
  const textTop = (await page.locator("#text").boundingBox()).y;
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#layoutWarn")).toBeVisible();
  await expect(page.locator("#layoutWarnTxt")).toContainText("AZERTY");
  expect(textTop).toBeGreaterThan(0);
  await page.click("#layoutFix");
  await expect(page.locator("#layoutWarn")).toBeHidden();
  expect((await saved(page)).layout).toBe("azerty");
});

test("leave the run with Esc: hint on the home screen, Not now hides it", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await azertyKey(page);
  await expect(page.locator("#layoutWarn")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#layoutWarn")).toBeVisible();
  await page.click("#layoutLater");
  await expect(page.locator("#layoutWarn")).toBeHidden();
  expect((await saved(page)).layout).toBe("qwerty");
  // Next run: no hint again in this page load.
  await page.click("#mContinue");
  await azertyKey(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#layoutWarn")).toBeHidden();
});
