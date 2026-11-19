// Finger frame: the screen border has the colour of the finger for the next key.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** Colour of the frame and the colour of the finger for the next key. */
async function frameAndFinger(page) {
  return page.evaluate(() => {
    const m = CHARMAP[S.text[S.pos]];
    return { frame: getComputedStyle(document.getElementById("fframe")).getPropertyValue("--ff").trim(), finger: FINGER_COLORS[m.finger] };
  });
}

test("the frame follows the finger of the next key", async ({ page }) => {
  await openApp(page, player());
  await expect(page.locator("#fframe")).toBeHidden();            // not on the home screen
  await page.click("#mContinue");
  await expect(page.locator("#fframe")).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const c = await frameAndFinger(page);
    expect(c.frame).toBe(c.finger);
    await page.keyboard.type(await page.evaluate("S.text[S.pos]"));
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("#fframe")).toBeHidden();
});

test("the frame takes no clicks", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("fframe")).pointerEvents)).toBe("none");
  await page.click("#tBack");                                      // the button under the frame still works
  await expect(page.locator("#home")).toBeVisible();
});

test("no frame in Pro mode (no keyboard)", async ({ page }) => {
  await openApp(page, player({ blind: 2 }));
  await page.click("#mContinue");
  await expect(page.locator("#fframe")).toBeHidden();
});

test("Settings switch turns the frame off and on", async ({ page }) => {
  await openApp(page, player());
  await page.click("#hSettings");
  await expect(page.locator("#setFrame [data-v='1']")).toHaveClass(/on/);
  await page.click("#setFrame [data-v='0']");
  await page.click("#setClose");
  expect((await saved(page)).frame).toBe(0);
  await page.click("#mContinue");
  await expect(page.locator("#fframe")).toBeHidden();
  await page.keyboard.press("Escape");
  await page.click("#hSettings");
  await page.click("#setFrame [data-v='1']");
  await page.click("#setClose");
  await page.click("#mContinue");
  await expect(page.locator("#fframe")).toBeVisible();
});
