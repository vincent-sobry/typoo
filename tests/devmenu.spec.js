// Dev test menu: only on the dev preview. Start a run, finish it with a set score, skip, day tools.
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { player, openApp } = require("./helpers");

const DEV_KEY = "typo.dev.v1";
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

/** Open the app at /typoo/dev/ (served from index.html) with a saved dev state. */
async function openDev(page, state) {
  await page.route("**/typoo/dev/", (r) => r.fulfill({ contentType: "text/html", body: html }));
  await page.addInitScript(() => { window.TYPOO_RESULT_LOCK = { keys: 0, clicks: 0 }; window.TYPOO_HOUR = 12; window.TYPOO_DAY_START = 0; window.TYPOO_WELCOME_OFF = true; });
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem(k, v); localStorage.setItem("typo.dev.tools", '{"reveal":"off"}'); }
  }, [DEV_KEY, JSON.stringify(state)]);
  await page.goto("/typoo/dev/");
}
const devSaved = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), DEV_KEY);
const vet = (extra) => player(Object.assign({ flags: { tour: 1, rev: 1 }, lessons: { qwerty: { 0: { stars: 2, wpm: 20, acc: 96 }, 1: { stars: 1, wpm: 15, acc: 91 } }, azerty: {} } }, extra));

test("dev menu: hidden on the stable site, not in Settings", async ({ page }) => {
  await openApp(page, vet());
  await expect(page.locator("#devMenu")).toBeHidden();
  await page.click("#hSettings");
  await expect(page.locator("#settings #setNewDayGo")).toHaveCount(0);
});

test("dev menu: open by default top right, collapses and opens again", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openDev(page, vet());
  const m = page.locator("#devMenu");
  await expect(m).toBeVisible();
  await expect(page.locator("#dmFin")).toBeVisible();
  const box = await m.boundingBox();
  expect(box.x + box.width).toBeGreaterThan(1366 - 20);
  expect(box.y).toBeLessThan(60);
  await page.click("#dmToggle");
  await expect(page.locator("#dmFin")).toBeHidden();
  expect((await m.boundingBox()).width).toBeLessThan(120);
  await page.click("#dmHead");
  await expect(page.locator("#dmFin")).toBeVisible();
});

const LEVELS = [
  { fin: "0", stars: 0, minAcc: 85, maxAcc: 89 },
  { fin: "1", stars: 1, minAcc: 90, maxAcc: 95 },
  { fin: "2", stars: 2, minAcc: 96, maxAcc: 97 },
  { fin: "3", stars: 3, minAcc: 98, maxAcc: 100 },
];
for (const L of LEVELS) {
  test(`dev menu: chapter finish ${L.fin} gives ${L.stars} stars`, async ({ page }) => {
    await openDev(page, vet());
    await page.selectOption("#dmStart", "next");
    await page.click("#dmGo");
    await expect(page.locator("#type")).toBeVisible();
    await page.click(`#dmFin [data-fin="${L.fin}"]`);
    await expect(page.locator("#result")).toBeVisible();
    await expect(page.locator("#rStars span.on")).toHaveCount(L.stars);
    const acc = parseInt(await page.locator("#rAcc").textContent(), 10);
    expect(acc).toBeGreaterThanOrEqual(L.minAcc);
    expect(acc).toBeLessThanOrEqual(L.maxAcc);
    if (L.stars < 3) await expect(page.locator("#rText .ms").first()).toBeVisible();   // orange errors in the text box
    expect((await devSaved(page)).lessons.qwerty[2]?.stars || 0).toBe(L.stars);
  });
}

test("dev menu: record finish shows the accuracy record chip", async ({ page }) => {
  await openDev(page, vet());
  await page.selectOption("#dmStart", "last");
  await page.evaluate(() => { lastLesson = 0; });
  await page.click("#dmGo");
  await page.click('#dmFin [data-fin="rec"]');
  await expect(page.locator("#rRec")).toBeVisible();
});

test("dev menu: race lost at 0★, won at ★★★", async ({ page }) => {
  await openDev(page, vet());
  await page.selectOption("#dmStart", "race");
  await page.click("#dmGo");
  await page.click('#dmFin [data-fin="0"]');
  await expect(page.locator("#rTitle")).toHaveText(/lost|Keebo/i);
  await page.click("#dmGo");
  await page.click('#dmFin [data-fin="3"]');
  const s = await devSaved(page);
  expect(s.races).toEqual({ won: 1, played: 2 });
});

test("dev menu: games finish (Longest Word, Word Rain)", async ({ page }) => {
  await openDev(page, vet({ history: [{ d: "2026-01-01", wpm: 20, acc: 95 }] }));
  await page.selectOption("#dmStart", "ladder");
  await page.click("#dmGo");
  await page.click('#dmFin [data-fin="3"]');
  await expect(page.locator("#result")).toBeVisible();
  expect((await devSaved(page)).ladder.boss).toBe(1);
  await page.selectOption("#dmStart", "rain");
  await page.click("#dmGo");
  await expect(page.locator("#meteor")).toBeVisible();
  await page.click('#dmFin [data-fin="rec"]');
  await expect(page.locator("#rainOver")).toHaveClass(/on/);
  expect((await devSaved(page)).rainBest).toBeGreaterThan(0);
});

test("dev menu: skip ends the reveal, then goes to the next run; Home leaves a run", async ({ page }) => {
  await openDev(page, vet());
  await page.selectOption("#dmReveal", "slow");
  await page.click("#dmGo");
  await page.click('#dmFin [data-fin="2"]');
  await expect(page.locator("#result.reveal")).toHaveCount(1);
  await page.click("#dmSkip");
  await expect(page.locator("#result.reveal")).toHaveCount(0);
  await page.click("#dmSkip");
  await expect(page.locator("#type")).toBeVisible();          // next chapter
  await page.click("#dmHome");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator('#dmFin [data-fin="0"]')).toBeDisabled();
});

test("dev menu: day tools, quiet hours and chapter codes", async ({ page }) => {
  await openDev(page, vet());
  await page.click("#setGoalGo");
  expect((await devSaved(page)).today.secs).toBeGreaterThanOrEqual(600);
  await page.selectOption("#dmQuiet", "1");
  expect((await devSaved(page)).quietTest).toBe(1);
  await page.selectOption("#dmQuiet", "0");
  await page.selectOption("#setChSel", "qwerty:5");
  await page.click("#setChGo");
  const s = await devSaved(page);
  expect(Object.keys(s.lessons.qwerty).length).toBe(5);
  await expect(page.locator("#toast")).toContainText("6");
});

test("dev menu: finish works at once after start", async ({ page }) => {
  await openDev(page, vet());
  await page.evaluate(() => { $("#dmGo").click(); $('#dmFin [data-fin="1"]').click(); });
  await expect(page.locator("#result")).toBeVisible();
});

test("dev menu: restart a run (new text, no score) and replay the result reveal", async ({ page }) => {
  await openDev(page, vet());
  await page.click("#dmGo");
  const t1 = await page.evaluate("S.text");
  await page.click("#dmRestart");
  await expect(page.locator("#type")).toBeVisible();
  expect(await page.evaluate("S.pos")).toBe(0);
  expect(await page.evaluate("S.text")).not.toBe(t1);
  await page.selectOption("#dmReveal", "slow");
  await page.click('#dmFin [data-fin="1"]');
  const xp = (await devSaved(page)).xp;
  await page.click("#dmSkip");
  await expect(page.locator("#result.reveal")).toHaveCount(0);
  await page.click("#dmRestart");
  await expect(page.locator("#result.reveal")).toHaveCount(1);   // the reveal plays again
  expect((await devSaved(page)).xp).toBe(xp);                     // no new XP
});

test("dev menu: back goes 1 step back (run -> result -> run, run from home -> home)", async ({ page }) => {
  await openDev(page, vet());
  await page.click("#dmGo");
  await page.click('#dmFin [data-fin="2"]');
  await expect(page.locator("#result")).toBeVisible();
  const title = await page.locator("#rTitle").textContent();
  await page.click("#dmBack");                                  // result -> the same run again
  await expect(page.locator("#type")).toBeVisible();
  expect(await page.evaluate("S.pos")).toBe(0);
  await page.click("#dmBack");                                  // run -> the result before it
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#rTitle")).toHaveText(title);
  await page.click("#dmHome");
  await page.click("#dmGo");
  await page.click("#dmBack");                                  // run from home -> home
  await expect(page.locator("#home")).toBeVisible();
});

test("dev menu: typing in a run is not caught by the menu", async ({ page }) => {
  await openDev(page, vet());
  await page.click("#dmGo");
  await page.click("#dmToggle");          // a click on the menu must not take the keys
  const text = await page.evaluate("S.text");
  await page.keyboard.type(text.slice(0, 3), { delay: 5 });
  expect(await page.evaluate("S.pos")).toBe(3);
});
