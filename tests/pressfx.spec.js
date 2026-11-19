// Press feedback: buttons squish and ripple on press, but never during typing runs.
const { test, expect } = require("@playwright/test");
const { player, openApp } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

test("a home tile squishes, ripples and bounces its letters, then cleans up", async ({ page }) => {
  await openApp(page, player());
  const tile = page.locator("#mRain");
  await tile.hover();
  await page.mouse.down();
  await expect(tile).toHaveClass(/fx-press/);
  await expect(tile.locator(".fx-ripple")).toHaveCount(1);
  await expect(tile.locator("b .fx-l").first()).toBeAttached();
  // All effects are gone after 300 ms, and the title text is back.
  await page.waitForTimeout(400);
  await expect(page.locator(".fx-wave")).toHaveCount(0);
  await expect(page.locator(".fx-l")).toHaveCount(0);
});

test("no press feedback during a typing run", async ({ page }) => {
  await openApp(page, player());
  await page.locator("#mContinue").click();
  await expect(page.locator("#type")).toBeVisible();
  await page.locator("#tBlind").hover();
  await page.mouse.down();
  await expect(page.locator("#tBlind")).not.toHaveClass(/fx-press/);
  await expect(page.locator(".fx-ripple")).toHaveCount(0);
  await page.mouse.up();
});

test("reduced motion: only a short highlight, no ripple", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page, player());
  await page.locator("#hSettings").hover();
  await page.mouse.down();
  await expect(page.locator("#hSettings")).toHaveClass(/fx-press/);
  await expect(page.locator(".fx-ripple")).toHaveCount(0);
  await page.mouse.up();
});
