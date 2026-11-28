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

test("steps come in order: text, tricky keys, Keebo, time, WPM, accuracy, XP, buttons", async ({ page }) => {
  await toResult(page);
  // When does each step show? Read the opacity every frame.
  const first = await page.evaluate(() => new Promise((ok) => {
    const sel = { text: "#rText", weak: "#rWeak", keebo: "#result .botbox", time: "#result .rvT", wpm: "#result .rvW",
      acc: "#result .stat.main", xp: "#result .stat.xp", lvl: "#rLvl", btns: "#result .rbtns" };
    const seen = {}, t0 = performance.now();
    const f = () => {
      const now = performance.now() - t0;
      for (const [k, s] of Object.entries(sel)) if (seen[k] === undefined && +getComputedStyle($(s)).opacity > 0.5) seen[k] = now;
      if (Object.keys(seen).length < Object.keys(sel).length && now < 7000) requestAnimationFrame(f); else ok(seen);
    };
    f();
  }));
  const order = ["text", "weak", "keebo", "time", "wpm", "acc", "xp", "btns"];
  for (let i = 1; i < order.length; i++) expect(first[order[i]], order[i] + " after " + order[i - 1]).toBeGreaterThan(first[order[i - 1]]);
  expect(first.btns).toBeLessThan(5500);                                    // done in about 4 s
  await expect(page.locator("#result")).not.toHaveClass(/reveal/, { timeout: 2000 });
  await expect(page.locator("#rStars span.on").first()).toBeVisible();
  await expect(page.locator("#rNext")).toHaveClass(/glow/);
  await expect(page.locator("#rAcc")).toHaveText("100%");
});

test("XP bar: old value, then the gain slides out from under it, then both merge", async ({ page }) => {
  await openApp(page, player({ xp: 30 }), { reveal: true });
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  const gain = page.locator("#rLvlGain"), merged = page.locator("#rLvlNew");
  await expect(gain).not.toHaveClass(/go/);
  await expect(merged).not.toHaveClass(/on/);
  expect(+(await page.$eval("#rLvlBar", (e) => parseFloat(e.style.width)))).toBeGreaterThan(0);   // phase 1: XP before the run
  await expect(gain).toHaveClass(/go/, { timeout: 6000 });                  // phase 2
  await expect(merged).not.toHaveClass(/on/);
  await expect(merged).toHaveClass(/on/, { timeout: 2000 });                // phase 3
  const w = await page.$eval("#rLvlNew", (e) => parseFloat(e.style.width));
  const g = await page.$eval("#rLvlGain", (e) => parseFloat(e.style.left) + parseFloat(e.style.width));
  expect(Math.abs(w - g)).toBeLessThan(0.01);                               // the merged bar ends where the gain ends
});

test("accuracy counts up from 0", async ({ page }) => {
  await toResult(page);
  const seen = await page.evaluate(() => new Promise((ok) => {
    const v = new Set(), t0 = performance.now();
    const f = () => { v.add($("#rAcc").textContent); if (performance.now() - t0 < 4000) requestAnimationFrame(f); else ok([...v]); };
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
