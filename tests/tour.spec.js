// Tour of the home screen: after onboarding, and again with the ? button or the ? key.
// Order: Keebo, you, XP, goal, accuracy, games, badges, Settings, ?, map, Continue. The last step starts the next chapter.
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
  await expect(page.locator("#tour")).toBeVisible();
}

/** The card is beside the spotlight (left or right), not above or below it, and inside the window. */
async function cardBeside(page) {
  await page.waitForTimeout(300);                      // the card slides to its place
  const c = await page.locator("#tourCard").boundingBox(), h = await page.locator("#tourHole").boundingBox(), vp = page.viewportSize();
  expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0);
  expect(c.x + c.width).toBeLessThanOrEqual(vp.width); expect(c.y + c.height).toBeLessThanOrEqual(vp.height);
  const beside = c.x >= h.x + h.width - 1 || c.x + c.width <= h.x + 1;
  expect(beside, `card beside the spot (card x ${c.x}, spot ${h.x}..${h.x + h.width})`).toBe(true);
}

test("order: big picture first, map and Continue last", async ({ page }) => {
  await onboard(page);
  const titles = [];
  const n = await page.evaluate("TOUR.length");
  for (let i = 0; i < n; i++) {
    titles.push(await page.locator("#tourT").textContent());
    if (i < n - 1) await page.click("#tourNext");
  }
  expect(titles[0]).toContain("Keebo");
  expect(titles.findIndex((t) => t.includes("XP"))).toBeLessThan(titles.findIndex((t) => t.includes("Games")));
  expect(titles.findIndex((t) => t.includes("Accuracy"))).toBeGreaterThan(-1);
  expect(titles.findIndex((t) => t.includes("Accuracy"))).toBeLessThan(titles.findIndex((t) => t.includes("Games")));
  expect(titles.findIndex((t) => t.includes("Badges"))).toBeLessThan(titles.findIndex((t) => t.includes("Settings")));
  expect(titles.findIndex((t) => t.includes("❓"))).toBeLessThan(titles.findIndex((t) => t.includes("map")));
  expect(titles[n - 1]).toContain("Go");
});

test("desktop: the card is beside each section", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await onboard(page);
  const n = await page.evaluate("TOUR.length");
  for (let i = 0; i < n; i++) {
    await cardBeside(page);
    if (i < n - 1) await page.click("#tourNext");
  }
});

test("arrows: back and next; back is off on step 1", async ({ page }) => {
  await onboard(page);
  await expect(page.locator("#tourBack")).toBeDisabled();
  await expect(page.locator("#tourN")).toHaveText(/^1\//);
  await page.click("#tourNext");
  await page.click("#tourNext");
  await expect(page.locator("#tourN")).toHaveText(/^3\//);
  await page.click("#tourBack");
  await expect(page.locator("#tourN")).toHaveText(/^2\//);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tourN")).toHaveText(/^3\//);
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#tourN")).toHaveText(/^2\//);
  await expect(page.locator("#tourDots i.done")).toHaveCount(1);
});

test("the last step starts the next chapter", async ({ page }) => {
  await onboard(page);
  const n = await page.evaluate("TOUR.length");
  for (let i = 0; i < n - 1; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tourNext")).toContainText("Let's type");
  await page.click("#tourNext");
  await expect(page.locator("#tour")).toBeHidden();
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#tTitle")).toHaveText(/^1\. /);
  expect((await saved(page)).flags.tour).toBe(1);
});

test("Skip ends the tour; it does not come back by itself", async ({ page }) => {
  await onboard(page);
  await page.click("#tourSkip");
  await expect(page.locator("#tour")).toBeHidden();
  await expect(page.locator("#home")).toBeVisible();
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.locator("#tour")).toBeHidden();
});

test("Esc ends the tour; shortcuts stay off during the tour", async ({ page }) => {
  await onboard(page);
  await page.keyboard.press("s");
  await expect(page.locator("#settings")).not.toHaveClass(/on/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#tour")).toBeHidden();
  await expect(page.locator("#home")).toBeVisible();
});

test("saved players get no tour; the ? button and the ? key start it", async ({ page }) => {
  await openApp(page, player());
  await page.waitForTimeout(600);
  await expect(page.locator("#tour")).toBeHidden();
  await page.click("#hHelp");
  await expect(page.locator("#tour")).toBeVisible();
  await expect(page.locator("#tourT")).toContainText("Keebo");
  await page.keyboard.press("Escape");
  await page.keyboard.press("?");
  await expect(page.locator("#tour")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.click("#hSettings");
  await page.click("#setTour");
  await expect(page.locator("#tour")).toBeVisible();
});

test.describe("phone size", () => {
  test.use({ viewport: { width: 390, height: 760 } });
  test("the card stays in the window", async ({ page }) => {
    await onboard(page);
    const n = await page.evaluate("TOUR.length");
    for (let i = 0; i < n; i++) {
      await page.waitForTimeout(300);
      const c = await page.locator("#tourCard").boundingBox();
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x + c.width).toBeLessThanOrEqual(390);
      expect(c.y).toBeGreaterThanOrEqual(0); expect(c.y + c.height).toBeLessThanOrEqual(760);
      if (i < n - 1) await page.click("#tourNext");
    }
  });
});
