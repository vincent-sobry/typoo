// Language: one language (NL, EN, FR, IT) for all screens, Keebo and all typing texts.
const { test, expect } = require("@playwright/test");
const { player, openApp, saved } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** A player with 1 star on the first `n` chapters (QWERTY). */
function withChapters(n, extra = {}) {
  const q = {};
  for (let i = 0; i < n; i++) q[i] = { stars: 1, wpm: 15, acc: 95 };
  return player(Object.assign({ lessons: { qwerty: q, azerty: {} } }, extra));
}

test("all languages have every text of English, with the same {fields}", async ({ page }) => {
  await openApp(page, player());
  const bad = await page.evaluate(() => {
    const out = [];
    for (const l of ["nl", "fr", "it"]) {
      for (const [k, en] of Object.entries(I18N.en)) {
        const v = I18N[l][k];
        if (v === undefined) { out.push(`${l} ${k}: missing`); continue; }
        if (typeof en === "string") {
          const f = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
          if (f(en) !== f(v)) out.push(`${l} ${k}: fields`);
        } else if (Array.isArray(en) && v.length !== en.length) out.push(`${l} ${k}: list length`);
      }
      if (I18N[l].titles.length !== TITLES.length) out.push(`${l} titles`);
      if (I18N[l].rules.length !== RULES.length) out.push(`${l} rules`);
      if (I18N[l].tourSteps.length !== TOUR.length) out.push(`${l} tour`);
      BADGES.forEach((b) => { if (!I18N[l].badgeText[b.id]) out.push(`${l} badge ${b.id}`); });
      CURRICULUM.qwerty.concat(CURRICULUM.azerty).forEach((st) => {
        [st.stage, st.tip, ...st.lessons.map((x) => x[1])].forEach((en) => {
          if (!/^(\S) and (\S)$/.test(en) && en !== "W" && !I18N[l].$[en]) out.push(`${l} data: ${en}`);
        });
      });
      for (const list of [WORDS, SENTENCES, DAILY_SENTENCES, LADDER_WORDS, LADDER_BOSS]) if (!list[l]) out.push(`${l} typing texts`);
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test("no English text left on the home screen and in Settings (NL, FR, IT)", async ({ page }) => {
  await openApp(page, withChapters(18, { history: [{ d: "2026-01-01", wpm: 20, acc: 95 }] }));
  const bad = await page.evaluate(() => {
    const out = [];
    const strip = (s) => s.replace(/<[^>]+>/g, "").trim();
    for (const l of ["nl", "fr", "it"]) {
      state.lang = l; applyLang(); renderHome(); openSettings();
      const seen = new Set();
      for (const root of [document.querySelector("#home"), document.querySelector("#settings")]) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) { const t = w.currentNode.nodeValue.trim(); if (t) seen.add(t); }
        root.querySelectorAll("[title],[aria-label]").forEach((e) => { seen.add(e.title); seen.add(e.getAttribute("aria-label")); });
      }
      for (const [k, en] of Object.entries(I18N.en)) {
        if (typeof en !== "string" || /\{/.test(en)) continue;
        const e = strip(en);
        if (e.length < 4 || strip(I18N[l][k]) === e) continue;   // same word in both languages (Booster, Turbo...)
        if (seen.has(e)) out.push(`${l}: "${e}" (${k})`);
      }
      document.querySelector("#settings").classList.remove("on");
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test("onboarding: the language comes first and changes the screen at once", async ({ page }) => {
  await openApp(page, null);
  await expect(page.locator("#obLang button")).toHaveCount(4);
  await page.click("#obLang [data-v=fr]");
  await expect(page.locator("#obGo")).toHaveText("C'est parti ! →");
  await expect(page.locator("label[for=obName]")).toHaveText("Comment tu t'appelles ?");
  await page.click("#obLang [data-v=it]");
  await expect(page.locator("label[for=obName]")).toHaveText("Come ti chiami?");
  await page.fill("#obName", "Lucas");
  await page.click("#obLayout [data-v=azerty]");
  await page.click("#obGo");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#mContinue b")).toHaveText("Continua");
  expect(await page.evaluate("document.documentElement.lang")).toBe("it");
  const s = await saved(page);
  expect(s).toMatchObject({ name: "Lucas", layout: "azerty", lang: "it" });
});

test("a saved player keeps the language: NL saves show Dutch screens", async ({ page }) => {
  await openApp(page, player({ lang: "nl" }));
  await expect(page.locator("#mContinue b")).toHaveText("Verder");
  await expect(page.locator("#map .stage h3").first()).toContainText("Thuisrij");
  await expect(page.locator("#map .lesson .n").first()).toContainText("HOOFDSTUK 1");
  await expect(page.locator("#map .lesson .t").first()).toHaveText("F en J");
});

test("Settings: a new language changes screens and typing texts", async ({ page }) => {
  await openApp(page, withChapters(18));
  await page.click("#hSettings");
  await page.click("#setLang [data-v=fr]");
  await expect(page.locator("#settings h2")).toHaveText("⚙️ Réglages");
  await page.click("#setClose");
  await expect(page.locator("#mContinue b")).toHaveText("Continuer");
  expect((await saved(page)).lang).toBe("fr");
  // Typing texts: the words come from the French list.
  const fr = await page.evaluate(() => { const set = new Set(wordList()); return genWords(new Set("abcdefghijklmnopqrstuvwxyz "), 30).split(" ").every((w) => set.has(w)); });
  expect(fr).toBe(true);
  expect(await page.evaluate("wordList().includes('maison')")).toBe(true);
  expect(await page.evaluate("ladderWords().pop()")).toBe("anticonstitutionnellement");
});

test("accents: the base letter counts as correct (é = e), the accent key too", async ({ page }) => {
  await openApp(page, player({ lang: "fr" }));
  await page.evaluate(() => startSession({ mode: "smart", title: "test", text: "été à ça", onFinish: (res) => { window.__res = res; } }));
  await page.keyboard.type("ete a ", { delay: 5 });
  // The real accent key works too (AZERTY has a ç key). Playwright cannot press it, so send the key event.
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ç", bubbles: true, cancelable: true })));
  await page.keyboard.type("a", { delay: 5 });
  await expect.poll(() => page.evaluate("window.__res && Math.round(window.__res.acc)")).toBe(100);
  expect(await page.evaluate("state.keys.e.h")).toBe(2);   // stats go to the base letter
});

test("the on-screen keyboard shows the base letter for an accent", async ({ page }) => {
  await openApp(page, player({ lang: "it" }));
  await page.evaluate(() => startSession({ mode: "smart", title: "test", text: "città", onFinish: () => {} }));
  await page.keyboard.type("citt", { delay: 5 });
  await expect(page.locator("#fingerLbl")).toHaveText("Mignolo sinistro");
  expect(await page.evaluate("document.querySelector('.key.next').textContent")).toBe("A");
});
