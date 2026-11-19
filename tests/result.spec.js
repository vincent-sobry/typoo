// Result screen: the card is in the centre of the window, and nothing is cut off on short screens.
const { test, expect } = require("@playwright/test");
const { player, openApp, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

async function toResult(page) {
  await openApp(page, player());
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await page.waitForTimeout(300);
  return page.locator("#result .result").boundingBox();
}

test("result card in the centre of a tall window", async ({ page }) => {
  await page.setViewportSize({ width: 1538, height: 1000 });
  const b = await toResult(page);
  const vw = 1538, vh = 1000;
  expect(Math.abs(b.x + b.width / 2 - vw / 2)).toBeLessThan(12);          // centred horizontally
  const top = b.y, bottom = vh - (b.y + b.height);
  expect(top).toBeGreaterThan(60);                                          // not glued to the top
  expect(Math.abs(top - bottom)).toBeLessThan(12);                          // centred vertically
});

test("short window (1366x657): the whole card can be seen, the page scrolls if needed", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const b = await toResult(page);
  expect(b.y).toBeGreaterThanOrEqual(0);                                    // top not cut off
  await page.locator("#rNext").scrollIntoViewIfNeeded();
  await expect(page.locator("#rNext")).toBeInViewport();                    // buttons can be reached
});
