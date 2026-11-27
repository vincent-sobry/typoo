// Sliding text (test mode): one row, the cursor stays at the same place and the text slides.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** x of the cursor on the screen, after the slide is done. */
async function cursorX(page) {
  await page.waitForTimeout(500);
  return page.evaluate(() => Math.round(document.querySelector("#text .cur").getBoundingClientRect().left));
}

test("off by default: rows of text", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await expect(page.locator("#text")).not.toHaveClass(/slidemode/);
});

test("on: one row, the cursor stays in place while the text slides", async ({ page }) => {
  await openApp(page, player({ slide: 1 }));
  await page.click("#mContinue");
  const box = page.locator("#text");
  await expect(box).toHaveClass(/slidemode/);
  expect(await box.locator("br").count()).toBe(0);
  const h = await box.evaluate((b) => b.clientHeight);
  const lh = await box.evaluate((b) => parseFloat(getComputedStyle(b).lineHeight));
  expect(h).toBeLessThan(lh * 2);                 // one row
  const x0 = await cursorX(page);
  const bx = await box.boundingBox();
  expect(Math.abs(x0 - (bx.x + bx.width * 0.35))).toBeLessThan(40);   // cursor at about 1/3 of the box
  await page.keyboard.type(await page.evaluate("S.text.slice(0,12)"), { delay: 5 });
  const x1 = await cursorX(page);
  expect(Math.abs(x1 - x0)).toBeLessThanOrEqual(2);
  const shift = await box.evaluate((b) => new DOMMatrix(getComputedStyle(b.querySelector(".slidetrack")).transform).m41);
  expect(shift).toBeLessThan(-50);                // the text moved to the left
  // the purple box does not move: it is a fixed layer, and the current letter sits on it
  const boxX = await box.evaluate((b) => b.getBoundingClientRect().left + parseFloat(getComputedStyle(b, "::before").left));
  expect(Math.abs(boxX - x1)).toBeLessThanOrEqual(2);
  await page.keyboard.type(await page.evaluate("S.text.slice(S.pos)"), { delay: 2 });
  await expect(page.locator("#result")).toBeVisible();
});

test("Longest Word keeps its own one-word view", async ({ page }) => {
  const q = {}; for (let i = 0; i < 18; i++) q[i] = { stars: 1, wpm: 12, acc: 95 };
  await openApp(page, player({ slide: 1, lessons: { qwerty: q, azerty: {} }, bestWpm: 20 }));
  await page.click("#mLadder");
  await expect(page.locator("#text")).not.toHaveClass(/slidemode/);
});

test("Settings switch", async ({ page }) => {
  await openApp(page, player());
  await page.click("#hSettings");
  await expect(page.locator("#setSlide [data-v='0']")).toHaveClass(/on/);
  await page.click("#setSlide [data-v='1']");
  await page.click("#setClose");
  expect((await saved(page)).slide).toBe(1);
  await page.click("#mContinue");
  await expect(page.locator("#text")).toHaveClass(/slidemode/);
});

test("short screen (1366x657): the cursor is still at about 1/3 of the box", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, player({ slide: 1 }));
  await page.click("#mContinue");
  const bx = await page.locator("#text").boundingBox();
  const x0 = await cursorX(page);
  expect(Math.abs(x0 - (bx.x + bx.width * 0.35))).toBeLessThan(40);
});

test("the box stays fixed during the slide; only the text moves", async ({ page }) => {
  await openApp(page, player({ slide: 1 }));
  await page.click("#mContinue");
  const box = page.locator("#text");
  await page.waitForTimeout(300);
  const before = await box.evaluate((b) => getComputedStyle(b, "::before").left);
  const text = await page.evaluate("S.text.slice(0,3)");
  await page.keyboard.type(text);
  // sample the box place during the slide (every frame for 200 ms)
  const lefts = await box.evaluate((b) => new Promise((res) => {
    const out = []; const t0 = performance.now();
    (function f() { out.push(getComputedStyle(b, "::before").left); if (performance.now() - t0 < 200) requestAnimationFrame(f); else res(out); })();
  }));
  expect(new Set(lefts)).toEqual(new Set([before]));
  expect(await box.evaluate((b) => getComputedStyle(b.querySelector(".cur")).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
});

test("compare A/B (test): two rows, same keys move both", async ({ page }) => {
  await openApp(page, player({ slide: 2 }));
  await page.click("#mContinue");
  const a = page.locator("#textA"), b = page.locator("#text");
  await expect(a).toBeVisible();
  await expect(a).toHaveClass(/slidemode/);
  await expect(b).toHaveClass(/slidemode/);
  await page.keyboard.type(await page.evaluate("S.text.slice(0,10)"), { delay: 20 });
  await page.waitForTimeout(600);
  const shift = (loc) => loc.evaluate((el) => new DOMMatrix(getComputedStyle(el.querySelector(".slidetrack")).transform).m41);
  const sa = await shift(a), sb = await shift(b);
  expect(sb).toBeLessThan(-50);
  expect(Math.abs(sa - sb)).toBeLessThanOrEqual(1);   // both rows end at the same letter
  expect(await a.locator(".cur").count()).toBe(1);
  expect(await a.locator(".ok, .fx").count()).toBe(10);
  await page.keyboard.type(await page.evaluate("S.text.slice(S.pos)"), { delay: 2 });
  await expect(page.locator("#result")).toBeVisible();
});
