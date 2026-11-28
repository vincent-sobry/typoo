// National keyboards: US, UK, Italian (QWERTY) and Belgian, French (AZERTY).
// state.layout keeps the family (chapters and progress), state.kbd the national keyboard.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** Finger (0-7, see LAYOUTS) and key of the next character of a short test text, and the key lit on screen. */
async function hint(page, text) {
  await page.evaluate((t) => startSession({ mode: "smart", title: "test", text: t, onFinish: () => {} }), text);
  return page.evaluate(() => { const m = CHARMAP[S.text[0]] || CHARMAP[fold(S.text[0])]; if (!document.getElementById(m.id).classList.contains("next")) return "not lit"; return { finger: m.finger, key: m.id }; });
}

test("old saves get the national keyboard of their family", async ({ page }) => {
  await openApp(page, player({ layout: "azerty" }));
  expect(await page.evaluate("kbd()")).toBe("be");
  await page.evaluate(() => { state.layout = "qwerty"; });
  expect(await page.evaluate("kbd()")).toBe("us");
});

test("Settings: 5 keyboards, a new one keeps the progress of its family", async ({ page }) => {
  const q = { 0: { stars: 1, wpm: 12, acc: 95 } };
  await openApp(page, player({ layout: "azerty", lessons: { qwerty: {}, azerty: q } }));
  await page.click("#hSettings");
  await expect(page.locator("#setLayout button")).toHaveCount(5);
  await expect(page.locator("#setLayout [data-v=be]")).toHaveClass(/on/);
  await page.click("#setLayout [data-v=fr]");
  let s = await saved(page);
  expect(s).toMatchObject({ layout: "azerty", kbd: "fr" });
  expect(s.lessons.azerty).toEqual(q);
  await expect(page.locator("#k3_10 .b")).toHaveText("!");      // French: ! on the bottom row
  await page.click("#setLayout [data-v=it]");
  s = await saved(page);
  expect(s).toMatchObject({ layout: "qwerty", kbd: "it" });
  expect(s.lessons.azerty).toEqual(q);
});

test("French and Belgian AZERTY: ! and - are on different keys", async ({ page }) => {
  await openApp(page, player({ layout: "azerty", kbd: "be" }));
  expect(await hint(page, "!")).toEqual({ finger: 5, key: "k0_8" });
  expect(await hint(page, "-")).toEqual({ finger: 7, key: "k0_12" });
  await page.evaluate(() => { state.kbd = "fr"; buildKeyboard(); });
  expect(await hint(page, "!")).toEqual({ finger: 7, key: "k3_10" });
  expect(await hint(page, "-")).toEqual({ finger: 4, key: "k0_6" });
});

test("Italian: chapter keys ò and -, and the keys for ; ? and accents", async ({ page }) => {
  await openApp(page, player({ kbd: "it" }));
  const L = await page.evaluate(() => lessonsFlat().map((l) => l.keys).filter((k) => k[0] !== "*"));
  expect(L).toContain("aò");
  expect(L).toContain("z-");
  expect(L.join("")).not.toMatch(/[;/]/);
  expect(await page.evaluate("lessonsFlat()[0].tip")).toContain("J K L Ò");
  expect(await hint(page, "ò")).toEqual({ finger: 7, key: "k2_9" });
  expect(await hint(page, ";")).toEqual({ finger: 5, key: "k3_8" });   // Shift + ,
  expect(await hint(page, "?")).toEqual({ finger: 7, key: "k0_11" });
  expect(await hint(page, "è")).toEqual({ finger: 7, key: "k1_10" });
  // The US keyboard keeps ; and /
  await page.evaluate(() => { state.kbd = "us"; });
  expect(await page.evaluate(() => lessonsFlat().map((l) => l.keys).join(""))).toContain("a;");
});

test("UK: the # key and the extra key next to Z", async ({ page }) => {
  await openApp(page, player({ kbd: "uk" }));
  await expect(page.locator("#k2_11 .b")).toHaveText("#");
  await expect(page.locator("#k3_0 .b")).toHaveText("\\");
  expect(await hint(page, "'")).toEqual({ finger: 7, key: "k2_10" });
});

test("hint: a key press shows the national keyboard, Switch saves it", async ({ page }) => {
  await openApp(page, player({ layout: "azerty", kbd: "be" }));
  await page.click("#mContinue");
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "-", code: "Digit6", bubbles: true, cancelable: true })));
  await page.keyboard.press("Escape");
  await expect(page.locator("#layoutWarnTxt")).toContainText("French AZERTY");
  await expect(page.locator("#layoutWarnTxt")).toContainText("Belgian AZERTY");
  await page.click("#layoutFix");
  expect(await saved(page)).toMatchObject({ layout: "azerty", kbd: "fr" });
});

test("hint: the ò key gives Italian on a US setting", async ({ page }) => {
  await openApp(page, player({ kbd: "us" }));
  await page.click("#mContinue");
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ò", code: "Semicolon", bubbles: true, cancelable: true })));
  await page.keyboard.press("Escape");
  await expect(page.locator("#layoutWarnTxt")).toContainText("Italian QWERTY");
});

test("onboarding without detection: the language picks the keyboard", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "keyboard", { value: undefined }); });
  await openApp(page, null);
  await page.click("#obLang [data-v=nl]");
  await expect(page.locator("#obLayout [data-v=be]")).toHaveClass(/on/);
  await expect(page.locator("#obLayout [data-v=be]")).toContainText("Belgisch");
  await page.click("#obLang [data-v=it]");
  await expect(page.locator("#obLayout [data-v=it]")).toHaveClass(/on/);
  await page.click("#obLayout [data-v=fr]");
  await page.click("#obLang [data-v=en]");                         // a picked keyboard stays
  await expect(page.locator("#obLayout [data-v=fr]")).toHaveClass(/on/);
  await page.fill("#obName", "Nell");
  await page.click("#obGo");
  expect(await saved(page)).toMatchObject({ layout: "azerty", kbd: "fr" });
});
