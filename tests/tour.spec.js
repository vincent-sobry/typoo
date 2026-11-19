// First-visit tour: after onboarding, a short tour of the home screen. Skip with the button or Esc.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

async function onboard(page) {
  await openApp(page, null);
  await page.fill("#obName", "Nova");
  await page.click("#obGo");
  await expect(page.locator("#home")).toBeVisible();
}

test("a new player gets the tour; Next goes through all steps", async ({ page }) => {
  await onboard(page);
  const tour = page.locator("#tour");
  await expect(tour).toBeVisible();
  await expect(page.locator("#tourT")).toContainText("Start here");
  const n = await page.evaluate("TOUR.length");
  await expect(page.locator("#tourN")).toHaveText(`1 / ${n}`);
  // The spotlight sits on the Continue tile
  const hole = await page.locator("#tourHole").boundingBox(), tile = await page.locator("#mContinue").boundingBox();
  expect(Math.abs(hole.x + 6 - tile.x)).toBeLessThan(3);
  // The card stays in the window at each step
  for (let i = 1; i < n; i++) {
    await page.click("#tourNext");
    await expect(page.locator("#tourN")).toHaveText(`${i + 1} / ${n}`);
    const c = await page.locator("#tourCard").boundingBox(), vp = page.viewportSize();
    expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(vp.width); expect(c.y + c.height).toBeLessThanOrEqual(vp.height);
  }
  await expect(page.locator("#tourNext")).toHaveText("Done");
  await page.click("#tourNext");
  await expect(tour).toBeHidden();
  expect((await saved(page)).flags.tour).toBe(1);
});

test("Skip ends the tour; it does not come back", async ({ page }) => {
  await onboard(page);
  await expect(page.locator("#tour")).toBeVisible();
  await page.click("#tourSkip");
  await expect(page.locator("#tour")).toBeHidden();
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.locator("#tour")).toBeHidden();
});

test("keys: Enter = next, Esc = skip; shortcuts stay off during the tour", async ({ page }) => {
  await onboard(page);
  await expect(page.locator("#tour")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#tourN")).toHaveText(/^2 \//);
  await page.keyboard.press("s");                       // no Settings under the tour
  await expect(page.locator("#settings")).not.toHaveClass(/on/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#tour")).toBeHidden();
  await expect(page.locator("#home")).toBeVisible();
});

test("players with saved progress get no tour; Settings can show it again", async ({ page }) => {
  await openApp(page, player());
  await page.waitForTimeout(600);
  await expect(page.locator("#tour")).toBeHidden();
  await page.click("#hSettings");
  await page.click("#setTour");
  await expect(page.locator("#tour")).toBeVisible();
  await expect(page.locator("#settings")).not.toHaveClass(/on/);
});

test.describe("phone size", () => {
  test.use({ viewport: { width: 390, height: 760 } });
  test("the card stays in the window", async ({ page }) => {
    await onboard(page);
    await expect(page.locator("#tour")).toBeVisible();
    const n = await page.evaluate("TOUR.length");
    for (let i = 0; i < n; i++) {
      const c = await page.locator("#tourCard").boundingBox();
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x + c.width).toBeLessThanOrEqual(390);
      expect(c.y).toBeGreaterThanOrEqual(0); expect(c.y + c.height).toBeLessThanOrEqual(760);
      await page.click("#tourNext");
    }
    await expect(page.locator("#tour")).toBeHidden();
  });
});
