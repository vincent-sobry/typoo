// Result screen: the typed text with the errors marked, so the player can see what went wrong.
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

test("chapter with errors: the text shows, each wrong key is on top of its letter", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, player());
  await page.click("#mContinue");
  const text = await typeWithErrors(page, [0, 5]);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rTyped")).toBeVisible();
  const box = page.locator("#rTypedBox");
  const er = box.locator(".er");
  await expect(er).toHaveCount(2);
  await expect(er.first()).toHaveAttribute("data-w", text[0] === "x" ? "z" : "x");
  await expect(er.first()).toHaveText(text[0] === " " ? "␣" : text[0]);
  // all text is in the box (spaces with an error show as ␣)
  const shown = (await box.innerText()).replace(/␣/g, " ").replace(/\s+/g, " ").trim();
  expect(shown).toBe(text.replace(/\s+/g, " ").trim());
  // the box scrolls when the text is long, and the buttons can still be reached
  await page.locator("#rNext").scrollIntoViewIfNeeded();
  await expect(page.locator("#rNext")).toBeInViewport();
  // nothing of it goes into the saved state
  const savedStr = await page.evaluate(() => localStorage.getItem("typo.v1"));
  expect(savedStr).not.toContain("wrong");
});

test("chapter with no errors: no typed text block", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mContinue");
  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rTyped")).toBeHidden();
});

test("the head of the block follows the language", async ({ page }) => {
  await openApp(page, player({ lang: "nl" }));
  await page.click("#mContinue");
  await typeWithErrors(page, [1]);
  await expect(page.locator("#rTyped .tyhead b")).toHaveText("Jouw tekst");
});
