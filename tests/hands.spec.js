// Compact hands below the keyboard, and the Hands on/off setting.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

// 1366x657 = browser window on a 1366x768 laptop. 1280x600 = small laptop.
const SCREENS = [[1366, 657], [1366, 768], [1280, 600], [1920, 969]];

for (const [w, h] of SCREENS) {
  test(`hands fit on screen at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openApp(page, player());
    await page.click("#mContinue");
    const hands = page.locator("#hands");
    await expect(hands).toBeVisible();
    const box = await hands.boundingBox();
    expect(box.height).toBeGreaterThan(50);
    expect(box.y + box.height).toBeLessThanOrEqual(h);
    const kb = await page.locator("#kb").boundingBox();
    expect(kb.x).toBeGreaterThanOrEqual(0);
    expect(kb.x + kb.width).toBeLessThanOrEqual(w);
    // The finger for the next key lights up.
    await expect(page.locator("#hands .f.on").first()).toBeVisible();
  });
}

test("hands setting turns the hands off and on", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, player());
  await page.click("#hSettings");
  await expect(page.locator("#setHands [data-v='1']")).toHaveClass(/on/);
  await page.click("#setHands [data-v='0']");
  await page.click("#setClose");
  expect((await saved(page)).hands).toBe(0);
  await page.click("#mContinue");
  await expect(page.locator("#hands")).toBeHidden();
  await expect(page.locator("#kb")).toBeVisible();
  // Stays off after a reload.
  await page.reload();
  await page.click("#mContinue");
  await expect(page.locator("#hands")).toBeHidden();
  // Back on.
  await page.click("#tBack");
  await page.click("#hSettings");
  await page.click("#setHands [data-v='1']");
  await page.click("#setClose");
  await page.click("#mContinue");
  await expect(page.locator("#hands")).toBeVisible();
});
