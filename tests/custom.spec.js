// Custom Letters: the player picks keys on an on-screen keyboard and types words with only those letters.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved, typeAll } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** Letters of the run text, without spaces. */
async function runLetters(page) {
  const text = await page.evaluate("S.text");
  return new Set(text.replace(/ /g, ""));
}

test("lobby opens with the home row picked; keys toggle by click and by keyboard", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mCustom");
  await expect(page.locator("#customLobby")).toBeVisible();
  await expect(page.locator("#clKb .ckey")).toHaveCount(26);
  await expect(page.locator("#clKb .ckey.on")).toHaveCount(9);   // a s d f g h j k l
  await expect(page.locator("#clInfo")).toContainText("9 keys");

  await page.click("#clClear");
  await expect(page.locator("#clKb .ckey.on")).toHaveCount(0);
  await expect(page.locator("#clGo")).toBeDisabled();
  await expect(page.locator("#clInfo")).toContainText("at least 1 key");

  await page.click('#clKb .ckey[data-c="e"]');
  await page.keyboard.press("t");
  await expect(page.locator('#clKb .ckey[data-c="e"]')).toHaveClass(/on/);
  await expect(page.locator('#clKb .ckey[data-c="t"]')).toHaveClass(/on/);
  await page.keyboard.press("t");
  await expect(page.locator('#clKb .ckey[data-c="t"]')).not.toHaveClass(/on/);

  await page.keyboard.press("Escape");
  await expect(page.locator("#customLobby")).toBeHidden();
});

test("many keys: the run has only real words with the picked letters", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mCustom");
  await page.click("#clClear");
  for (const c of "etaoinsrhl") await page.keyboard.press(c);
  await page.keyboard.press("Enter");
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#tTitle")).toContainText("Custom Letters");
  const letters = await runLetters(page);
  for (const c of letters) expect("etaoinsrhl").toContain(c);
  const { tokens, real } = await page.evaluate(() => {
    const words = new Set(wordList());
    const t = S.text.split(" ");
    return { tokens: t.length, real: t.filter((w) => words.has(w)).length };
  });
  expect(tokens).toBe(24);
  expect(real).toBe(24);
});

test("few keys: letter groups fill the run; finish saves the pick and shows the result", async ({ page }) => {
  await openApp(page, player());
  await page.click("#mCustom");
  await page.click("#clClear");
  await page.click('#clKb .ckey[data-c="f"]');
  await page.click('#clKb .ckey[data-c="j"]');
  await expect(page.locator("#clInfo")).toContainText("letter groups");
  await page.click("#clGo");
  const letters = await runLetters(page);
  expect([...letters].sort().join("")).toBe("fj");
  expect(await page.evaluate("S.text.split(' ').length")).toBe(24);

  await typeAll(page);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rTitle")).toContainText("Custom Letters");
  await expect(page.locator("#rNext")).toHaveText("Pick other keys");
  const st = await saved(page);
  expect(st.custom).toEqual({ keys: "fj", played: 1 });
  expect(st.history.length).toBe(1);
  expect(st.xp).toBeGreaterThan(0);

  // "Pick other keys" opens the lobby with the last pick
  await page.click("#rNext");
  await expect(page.locator("#customLobby")).toBeVisible();
  await expect(page.locator("#clKb .ckey.on")).toHaveCount(2);
});

test("home tile shows the last pick; AZERTY shows its own keys", async ({ page }) => {
  await openApp(page, player({ layout: "azerty", custom: { keys: "qsdf", played: 3 } }));
  await expect(page.locator("#mCustomText")).toContainText("Q S D F");
  await page.click("#mCustom");
  const first = await page.locator("#clKb .ckrow").first().innerText();
  expect(first.replace(/\s/g, "").toLowerCase()).toBe("azertyuiop");
  await expect(page.locator("#clKb .ckey.on")).toHaveCount(4);
  await page.click("#clLearned");                     // new player: only chapter 1 keys (f, j)
  await expect(page.locator("#clKb .ckey.on")).toHaveCount(2);
});
