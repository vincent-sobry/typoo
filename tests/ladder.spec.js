// Longest Word: word ladder against Keebo (unlock, pace, word lists, win, lose, errors).
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** A player with 1 star on the first `n` chapters (QWERTY). Home, Top and Bottom Row = 18 chapters. */
function withChapters(n, extra = {}) {
  const q = {};
  for (let i = 0; i < n; i++) q[i] = { stars: 1, wpm: 12, acc: 92 };
  return player(Object.assign({ lessons: { qwerty: q, azerty: {} } }, extra));
}

/** Wait until the word of sublevel `sub` can be typed, then type it. */
async function waitRung(page, sub) {
  await page.waitForFunction((n) => LW && LW.sub === n && S && !S.locked, sub, { timeout: 8000 });
}
async function typeRung(page, sub) {
  await waitRung(page, sub);
  await page.keyboard.type(await page.evaluate("S.text"), { delay: 1 });
}

test("locked before the Bottom Row: the lock screen lists what is missing", async ({ page }) => {
  await openApp(page, withChapters(15));
  await expect(page.locator("#mLadder")).toHaveClass(/locked/);
  await expect(page.locator("#mLadderText")).toContainText("Bottom Row");
  await page.click("#mLadder");
  const lock = page.locator("#ladderLock");
  await expect(lock).toBeVisible();
  await expect(page.locator("#llTxt")).toContainText("You still need 3");
  await expect(page.locator("#llList li")).toHaveCount(3);
  await expect(page.locator("#llList li").first()).toHaveText(await page.evaluate("lessonsFlat()[15].title"));
  await page.keyboard.press("Escape");
  await expect(lock).toBeHidden();
  await expect(page.locator("#home")).toBeVisible();
});

test("a chapter with 0 stars inside the first stages keeps it locked", async ({ page }) => {
  const st = withChapters(18);
  st.lessons.qwerty[3] = { stars: 0, wpm: 5, acc: 70 };
  await openApp(page, st);
  await page.click("#mLadder");
  await expect(page.locator("#llList li")).toHaveCount(1);
  await expect(page.locator("#llList li")).toHaveAttribute("value", "4");
});

test("pace: 80% of the reference WPM, plus 3% per sublevel, minimum 10", async ({ page }) => {
  await openApp(page, withChapters(18));
  const r = await page.evaluate(() => [ladderPace(50, 1), ladderPace(50, 11), ladderPace(40, 2), ladderPace(5, 1), ladderPace(0, 15), LADDER_SUBS]);
  expect(r).toEqual([40, 55, 33, 10, 10, 15]);
});

test("reference WPM: average of the last 10 runs, else the top WPM", async ({ page }) => {
  const hist = [];
  for (let i = 0; i < 12; i++) hist.push({ d: "2026-11-19", wpm: i < 2 ? 90 : 30, acc: 95 }); // 2 old fast runs drop out
  await openApp(page, withChapters(18, { bestWpm: 55, history: hist }));
  expect(await page.evaluate("ladderRef()")).toBe(30);
  await page.click("#mLadder");
  await expect(page.locator("#rBotLbl")).toContainText("Keebo · 24 WPM");
  await page.evaluate("state.history = []");
  expect(await page.evaluate("ladderRef()")).toBe(55);
});

test("word lists: 5+ words per length from 2 to 15, letters only, boss word last", async ({ page }) => {
  await openApp(page, withChapters(18));
  const r = await page.evaluate(() => {
    const out = {};
    for (const lang of ["en", "nl"]) {
      const bad = [];
      for (let n = 2; n <= 15; n++) {
        const ws = LADDER_WORDS[lang][n].split(" ");
        if (ws.length < 5) bad.push(`${n}: only ${ws.length}`);
        ws.forEach((w) => { if (w.length !== n || !/^[a-z]+$/.test(w)) bad.push(w); });
      }
      const run = ladderWords(lang);
      out[lang] = { bad, lengths: run.map((w) => w.length), boss: run[run.length - 1] };
    }
    return out;
  });
  const ladder = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  expect(r.en.bad).toEqual([]);
  expect(r.nl.bad).toEqual([]);
  expect(r.en.lengths).toEqual([...ladder, 34]);
  expect(r.nl.lengths).toEqual([...ladder, 33]);
  expect(r.en.boss).toBe("supercalifragilisticexpialidocious");
  expect(r.nl.boss).toBe("hottentottententententoonstelling");
});

test("climb all 15 sublevels and beat the boss word", async ({ page }) => {
  test.setTimeout(60000);
  await openApp(page, withChapters(18, { bestWpm: 10, xp: 0 }));
  await page.click("#mLadder");
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#ladder i")).toHaveCount(15);
  await expect(page.locator("#raceTracks")).toBeVisible();
  for (let sub = 1; sub <= 15; sub++) {
    await waitRung(page, sub);
    if (sub === 2) await expect(page.locator("#tTitle")).toContainText("3 letters (2/15)");
    if (sub === 15) await expect(page.locator("#tTitle")).toContainText("Boss word (15/15)");
    await expect(page.locator(`#ladder i:nth-child(${sub})`)).toHaveClass(/cur/);
    await typeRung(page, sub);
    if (sub < 15) await expect(page.locator(`#ladder i:nth-child(${sub})`)).toHaveClass(/done/, { timeout: 3000 });
  }
  await expect(page.locator("#result")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#rTitle")).toContainText("You beat the longest word");
  await expect(page.locator("#rNeed")).toContainText("Sublevels: 15 of 15");
  const s = await saved(page);
  expect(s.ladder).toEqual({ best: 15, played: 1, boss: 1 });
  expect(s.xp).toBe(2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 34 + 50);
  expect(s.bestWpm).toBe(10); // the game does not change the top WPM
  // Enter = play again
  await page.keyboard.press("Enter");
  await expect(page.locator("#type")).toBeVisible();
});

test("Keebo wins when he finishes the word first", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 200 }));
  await page.click("#mLadder");
  await typeRung(page, 1);                         // the 2-letter word: fast enough
  await page.waitForFunction(() => LW && LW.sub === 2 && !S.locked);
  await expect(page.locator("#rBotLbl")).toContainText("Keebo · 166 WPM");
  // Do not type: Keebo finishes the 3-letter word.
  await expect(page.locator("#result")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#rTitle")).toHaveText("Keebo wins at 3 letters");
  await expect(page.locator("#rNeed")).toContainText("Sublevels: 1 of 15");
  const s = await saved(page);
  expect(s.ladder).toEqual({ best: 1, played: 1, boss: 0 });
  await page.reload();
  await expect(page.locator("#mLadderText")).toContainText("Record: 1 of 15");
});

test("errors do not end the game", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  await page.waitForFunction(() => LW && LW.sub === 1 && !S.locked);
  const word = await page.evaluate("S.text");
  const wrong = word[0] === "q" ? "x" : "q";
  for (let i = 0; i < 6; i++) await page.keyboard.press(wrong);
  expect(await page.evaluate("S.errors")).toBe(6);
  await expect(page.locator("#type")).toBeVisible();
  await page.keyboard.type(word, { delay: 1 });
  await page.waitForFunction(() => LW && LW.sub === 2);
});

test("Esc during the game goes home without a result", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  await page.keyboard.press("Escape");
  await expect(page.locator("#home")).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#countdown")).toBeHidden();
  expect((await saved(page)).ladder?.played || 0).toBe(0);
});

test("ladder, keyboard and hands fit on a 1366x657 screen", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  await page.waitForFunction(() => LW && !S.locked);
  const hands = await page.locator("#hands").boundingBox();
  expect(hands.y + hands.height).toBeLessThanOrEqual(657);
});

test("word transition: the next word shows ahead and takes keys at once", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  await waitRung(page, 1);
  const [w1, w2, w3] = await page.evaluate(() => LW.words.slice(0, 3));
  await expect(page.locator("#ladderPeek")).toHaveText(w2);
  // Type word 1, a space, and word 2 in one go, with no wait between the words.
  await page.keyboard.type(w1 + " " + w2, { delay: 15 });
  await page.waitForFunction(() => LW && LW.sub === 3);
  expect(await page.evaluate("S.errors")).toBe(0);   // no key lost, the space is not an error
  expect(await page.evaluate("S.locked")).toBe(false);
  expect(await page.evaluate("S.text")).toBe(w3);
  await expect(page.locator("#ladderPeek")).toHaveText(await page.evaluate("LW.words[3]"));
  await expect(page.locator("#ladder i:nth-child(2)")).toHaveClass(/done/);
});

test("when Keebo wins, the result shows fast", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 300 }));
  await page.click("#mLadder");
  await waitRung(page, 1);
  // 2 letters at 180 WPM = 0.13 s, plus the read time. The result must follow within 1 s.
  await page.waitForFunction(() => document.querySelector("#text").classList.contains("lost"), null, { timeout: 4000 });
  const t0 = Date.now();
  await expect(page.locator("#result")).toBeVisible({ timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(1000);
});

test("F1 start lights: 5 lights, light blur, clear word at GO", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  const lights = page.locator("#lights");
  await expect(lights).toBeVisible();
  await expect(page.locator("#text")).toHaveClass(/wait/);
  await expect(page.locator("#text")).toBeVisible();              // the word stays readable under the lights
  await expect(page.locator("#lights i.on")).toHaveCount(5, { timeout: 4000 });
  await waitRung(page, 1);                                         // GO: all lights off
  await expect(lights).toBeHidden();
  await expect(page.locator("#text")).not.toHaveClass(/wait/);
  await expect(page.locator("#text .cur")).toBeVisible();
});

test("breath: after a word, Keebo waits longer before the next word", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  await waitRung(page, 1);
  expect(await page.evaluate("LW.wait")).toBeCloseTo(1.2);
  await page.keyboard.type(await page.evaluate("S.text"), { delay: 5 });
  await page.waitForFunction(() => LW && LW.sub === 2);
  expect(await page.evaluate("LW.wait")).toBeCloseTo(1.8);
  await expect(page.locator("#rBotLbl")).toContainText("speeding up");
  expect(await page.evaluate("S.locked")).toBe(false);             // the player can type at once
});

test("Race uses the start lights too", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mRace");
  await page.locator("#raceChoices .choice").first().click();
  await expect(page.locator("#lights")).toBeVisible();
  await page.waitForFunction(() => S && !S.locked, null, { timeout: 5000 });
  await expect(page.locator("#lights")).toBeHidden();
});

test("Keebo speeds up along an S-curve and keeps the same time per word", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 40 }));
  const r = await page.evaluate(() => {
    const out = [];
    for (const [L, wpm, wait] of [[2, 32, 1.2], [8, 40, 1.8], [15, 50, 1.8], [34, 60, 1.8]]) {
      const v = wpm * 5 / 60, T = wait + L / v, R = keeboRamp(L, v, T);
      out.push({ T, R, atT: keeboChars(T, v, R), L,
        early: keeboChars(0.2, v, R) / (v * 0.2),              // speed factor near the start: slow
        mono: [0.25, 0.5, 0.75].every((u, i, a) => i === 0 || smooth(u) > smooth(a[i - 1])) });
    }
    return out;
  });
  for (const x of r) {
    expect(x.atT).toBeCloseTo(x.L, 3);       // finishes at the same time as before
    expect(x.R).toBeGreaterThan(0);
    expect(x.early).toBeLessThan(0.2);       // starts very slow
    expect(x.mono).toBe(true);
  }
  // Keebo moves before the old wait time ends.
  await page.click("#mLadder");
  await waitRung(page, 1);
  await page.waitForTimeout(800);
  const left = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#rBot")).left));
  expect(left).toBeGreaterThan(6);
});
