// Result screen: the text box of the run at the top, letters with an error in orange.
const { test, expect } = require("@playwright/test");
const { player, openApp, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** Type a wrong key at the given positions of the text, then the correct text. */
async function typeWithErrors(page, at) {
  const text = await page.evaluate("S.text");
  for (let i = 0; i < text.length; i++) {
    if (at.includes(i)) await page.keyboard.type(text[i] === "x" ? "z" : "x");
    await page.keyboard.type(text[i]);
  }
  return text;
}

test("the text box of the run is at the top; letters with an error are orange, no pressed keys", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, player());
  await page.click("#mContinue");
  const text = await typeWithErrors(page, [0, 5]);
  const box = page.locator("#rText");
  await expect(box).toBeVisible();
  await expect(box).toHaveClass(/textbox/);
  const ms = box.locator(".ms");
  await expect(ms).toHaveCount(2);
  await expect(ms.first()).toHaveCSS("color", "rgb(192, 138, 58)");        // the orange of a fixed error while typing
  expect((await box.innerText()).replace(/\s+/g, " ").trim()).toBe(text.replace(/\s+/g, " ").trim());
  // order: text box, tricky keys, Keebo, title
  const y = async (sel) => (await page.locator(sel).boundingBox()).y;
  expect(await y("#rText")).toBeLessThan(await y("#rWeak"));
  expect(await y("#rWeak")).toBeLessThan(await y("#result .botbox"));
  expect(await y("#result .botbox")).toBeLessThan(await y("#rTitle"));
  await expect(page.locator("#rTyped")).toHaveCount(0);                      // the old lower box is gone
  // the buttons can be reached
  await page.locator("#rNext").scrollIntoViewIfNeeded();
  await expect(page.locator("#rNext")).toBeInViewport();
  // nothing of it goes into the saved state
  const savedStr = await page.evaluate(() => localStorage.getItem("typo.v1"));
  expect(savedStr).not.toContain("wrong");
});

test("no errors: the text box shows, with no orange letters", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#rText")).toBeVisible();
  await expect(page.locator("#rText .ms")).toHaveCount(0);
});
