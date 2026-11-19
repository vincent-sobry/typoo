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
  const done = await page.evaluate(() => keeboChars((performance.now() - LW.botStart) / 1000, LW.botV, LW.ramp));
  expect(done).toBeGreaterThan(0);                     // he already moves
  expect(done).toBeLessThan(1);                        // but very slowly
});

test("the word is in the centre of the box, above the start lights", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  await expect(page.locator("#lights")).toBeVisible();
  const box = await page.locator("#text").boundingBox();
  const cur = await page.locator("#c0").boundingBox();
  const lights = await page.locator("#lights").boundingBox();
  const last = await page.locator(`#c${(await page.evaluate("S.text")).length - 1}`).boundingBox();
  const mid = (cur.x + last.x + last.width) / 2;                                          // centre of the word
  expect(Math.abs(mid - (box.x + box.width / 2))).toBeLessThan(20);
  expect(cur.y + cur.height).toBeLessThanOrEqual(lights.y);                              // word above the lights
  expect(lights.y + lights.height).toBeLessThanOrEqual(box.y + box.height);
  // Race keeps left-aligned text.
  await page.keyboard.press("Escape");
  await page.click("#mRace");
  await page.locator("#raceChoices .choice").first().click();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("#text")).textAlign)).not.toBe("center");
});

test("hold: the finished word stays for 1.5 strokes, keys typed then go to the next word", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  await waitRung(page, 1);
  const [w1, w2] = await page.evaluate(() => LW.words.slice(0, 2));
  await expect(page.locator(".prog")).toBeHidden();                       // no progress bar
  const cur = await page.locator("#c0").boundingBox(), pk = await page.locator("#ladderPeek").boundingBox();
  expect(pk.y).toBeGreaterThan(cur.y + cur.height - 2);                   // next word on the line below
  await page.keyboard.type(w1, { delay: 5 });
  await page.keyboard.type(w2.slice(0, 1));                               // typed during the hold
  expect(await page.evaluate("S.hold")).toBe(true);
  await expect(page.locator("#text")).toHaveClass(/held/);
  expect(await page.evaluate("S.text")).toBe(w1);                          // still the finished word
  await expect(page.locator("#text .cur")).toHaveCount(0);                // no cursor on the held word
  await page.waitForFunction(() => LW && LW.sub === 2 && !S.hold);
  expect(await page.evaluate("S.text")).toBe(w2);
  expect(await page.evaluate("S.pos")).toBe(1);                           // the key was not lost
  expect(await page.evaluate("S.errors")).toBe(0);
});

test("hold time: 1.5 key strokes at the reference WPM, from 250 to 600 ms", async ({ page }) => {
  await openApp(page, withChapters(18));
  expect(await page.evaluate(() => [ladderHold(30), ladderHold(40), ladderHold(60), ladderHold(10), ladderHold(120)])).toEqual([600, 450, 300, 600, 250]);
});

test("full-race tracks above the per-word tracks: they show the whole ladder", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  await typeRung(page, 1);
  await waitRung(page, 2);
  const [x, total, done] = await page.evaluate(() => {
    const tr = document.querySelector("#fYou").parentElement.getBoundingClientRect();
    return [(document.querySelector("#fYou").getBoundingClientRect().left - tr.left - 6) / (tr.width - 60), ladderTotal(), ladderDone()];
  });
  expect(done).toBe(2);                                                     // the 2-letter word is done
  expect(x).toBeGreaterThan(done / total - 0.02);                           // not back at the start
  expect(x).toBeLessThan(0.1);                                              // a small step on the full track
  const ys = await page.evaluate(() => ["#fYou", "#fBot", "#rYou", "#rBot"].map(id => document.querySelector(id).getBoundingClientRect().top));
  expect(ys[1]).toBeLessThan(ys[2]);                                        // full race above the per-word tracks
  expect(await page.evaluate(() => document.querySelector("#rYou").style.left)).toBe("6px");   // per word: back at the start
});

test("danger cue: Keebo's lane turns red when he is about to win the word", async ({ page }) => {
  await openApp(page, withChapters(18, { bestWpm: 10 }));
  await page.click("#mLadder");
  await waitRung(page, 1);
  const track = page.locator("#fBot").locator("..");
  await expect(track).not.toHaveClass(/danger/);
  await expect(track).toHaveClass(/danger/, { timeout: 8000 });            // Keebo near the end, you did not type
  await page.waitForFunction(() => !LW || LW.over);                       // Keebo wins
  await expect(track).not.toHaveClass(/danger/);
});
