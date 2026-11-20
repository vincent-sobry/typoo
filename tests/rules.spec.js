// Keebo's golden rules: card above the map. It gets smaller with progress and can be resized.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** A player who passed the first n chapters. */
function passed(n, extra = {}) {
  const q = {};
  for (let i = 0; i < n; i++) q[i] = { stars: 1, wpm: 20, acc: 95 };
  return player(Object.assign({ lessons: { qwerty: q, azerty: {} } }, extra));
}

test("the rules sit above the map, not in the side column", async ({ page }) => {
  await openApp(page, player());
  const rules = page.locator("main > #rules");
  await expect(rules).toBeVisible();
  const r = await rules.boundingBox(), m = await page.locator("#map").boundingBox();
  expect(r.y + r.height).toBeLessThanOrEqual(m.y + 1);
  await expect(page.locator("aside .tips")).toHaveCount(0);
});

test("the size gets smaller with progress", async ({ browser }) => {
  for (const [n, size] of [[0, "all"], [5, "tip"], [12, "mini"]]) {
    const page = await browser.newPage();
    await openApp(page, passed(n));
    await expect(page.locator("#rules")).toHaveAttribute("data-size", size);
    await page.close();
  }
});

test("all rules: tap a rule to see why", async ({ page }) => {
  await openApp(page, player());
  await expect(page.locator("#rules .rall button")).toHaveCount(6);
  await page.click('#rules .rall button[data-go="3"]');
  await expect(page.locator('#rules .rall button[data-go="3"] .rw')).toBeVisible();
});

test("tip: arrows and dots change the rule, sizes are saved", async ({ page }) => {
  await openApp(page, passed(5, { ruleI: 0 }));
  const box = page.locator("#rules");
  await expect(box.locator(".rn")).toHaveText(/^\d \/ 6$/);
  const first = await box.locator(".rn").textContent();
  await box.locator('[data-r="next"]').click();
  await expect(box.locator(".rn")).not.toHaveText(first);
  await box.locator('[data-go="5"]').click();
  await expect(box.locator(".rn")).toHaveText("6 / 6");
  await box.locator('[data-r="mini"]').click();
  await expect(box).toHaveAttribute("data-size", "mini");
  expect((await saved(page)).rules).toBe("mini");
  await box.locator('[data-r="tip"]').click();
  await box.locator('[data-r="all"]').click();
  await expect(box).toHaveAttribute("data-size", "all");
  await page.reload();
  await expect(page.locator("#rules")).toHaveAttribute("data-size", "all");
});

test("a new rule on each home visit", async ({ page }) => {
  await openApp(page, passed(5, { ruleI: 2 }));
  const n0 = await page.locator("#rules .rn").textContent();
  await page.click("#mContinue");
  await page.click("#tBack");
  await expect(page.locator("#rules .rn")).not.toHaveText(n0);
});
