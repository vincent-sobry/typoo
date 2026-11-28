// Result screen: staged reveal. Accuracy first, then stars, record, stats, text, tricky keys, Keebo and buttons.
// Any key or tap ends it. Reduced motion shows all at once.
const { test, expect } = require("@playwright/test");
const { player, openApp, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

const op = (page, sel) => page.$eval(sel, (e) => +getComputedStyle(e).opacity);

async function toResult(page, opts = { reveal: true }) {
  await openApp(page, player(), opts);
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
}

test("steps come in order of importance, then all show", async ({ page }) => {
  await toResult(page);
  await page.waitForTimeout(450);
  expect(await op(page, "#result .stat.main")).toBeGreaterThan(0.9);       // accuracy first
  expect(await op(page, "#rText")).toBe(0);                                // the text box waits
  expect(await op(page, "#result .rbtns")).toBe(0);                        // the buttons come last
  await page.waitForTimeout(1500);
  expect(await op(page, "#result .stat.minor")).toBeGreaterThan(0.9);                    // WPM after the stars
  await expect(page.locator("#result")).not.toHaveClass(/reveal/, { timeout: 2000 });   // done in about 2.5 s
  await page.waitForTimeout(350);                                          // last fade ends
  for (const s of ["#rText", "#rWeak", "#result .botbox", "#result .rbtns"]) expect(await op(page, s)).toBe(1);
  await expect(page.locator("#rStars span.on").first()).toBeVisible();
  await expect(page.locator("#rNext")).toHaveClass(/glow/);
  await expect(page.locator("#rAcc")).toHaveText("100%");
});

test("accuracy counts up from 0", async ({ page }) => {
  await toResult(page);
  const seen = await page.evaluate(() => new Promise((ok) => {
    const v = new Set(), t0 = performance.now();
    const f = () => { v.add($("#rAcc").textContent); if (performance.now() - t0 < 900) requestAnimationFrame(f); else ok([...v]); };
    f();
  }));
  expect(seen.length).toBeGreaterThan(3);
  expect(seen[seen.length - 1]).toBe("100%");
});

test("a key ends the reveal at once and does not start the next run", async ({ page }) => {
  await openApp(page, player(), { reveal: true, resultLock: true });
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await expect(page.locator("#result")).not.toHaveClass(/reveal/);
  await page.waitForTimeout(350);
  expect(await op(page, "#result .rbtns")).toBe(1);
  await expect(page.locator("#rAcc")).toHaveText("100%");
  await expect(page.locator("#result")).toBeVisible();                     // still on the result
});

test("a tap ends the reveal", async ({ page }) => {
  await toResult(page);
  await page.waitForTimeout(200);
  await page.click("#result .result", { position: { x: 5, y: 5 } });
  await expect(page.locator("#result")).not.toHaveClass(/reveal/);
  await expect(page.locator("#rAcc")).toHaveText("100%");
});

test("reduced motion: all at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await toResult(page);
  await expect(page.locator("#result")).not.toHaveClass(/reveal/);
  expect(await op(page, "#result .rbtns")).toBe(1);
  expect(await op(page, "#rText")).toBe(1);
  await expect(page.locator("#rAcc")).toHaveText("100%");
});

test("the shown accuracy rounds down: a failed run at 89.6% shows 89%", async ({ page }) => {
  await openApp(page, player());
  await page.evaluate(() => showResult({ title: "T", stars: 0, res: { acc: 89.6, wpm: 20, secs: 30, miss: {} }, xp: 0, msg: "", retry: () => {}, next: null }));
  await expect(page.locator("#rAcc")).toHaveText("89%");
});
