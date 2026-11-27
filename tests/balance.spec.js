// Pop-up text: when a text needs 2 or more rows, the rows have about the same length.
// The last row is at least half as long as the longest row (no single word alone on the last row).
const { test, expect } = require("@playwright/test");
const { player, openApp } = require("./helpers");

/** Rows of each text block in `root` with 2+ rows: [text, last row / longest row]. */
const rows = (root) => [...document.querySelectorAll(root + " *")]
  .filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
  .map(e => {
    const r = document.createRange(); r.selectNodeContents(e);
    const lines = [];
    for (const x of r.getClientRects()) {
      if (x.width < 1) continue;
      const l = lines.find(l => x.top < l.bottom - 4 && x.bottom > l.top + 4);
      if (l) { l.left = Math.min(l.left, x.left); l.right = Math.max(l.right, x.right); }
      else lines.push({ top: x.top, bottom: x.bottom, left: x.left, right: x.right });
    }
    lines.sort((a, b) => a.top - b.top);
    const w = lines.map(l => l.right - l.left);
    return [e.textContent.trim(), lines.length, w.length ? w[w.length - 1] / Math.max(...w) : 1];
  })
  .filter(([, n]) => n >= 2);

for (const lang of ["nl", "en", "fr", "it"]) {
  test(`pop-up rows are balanced (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 657 });
    await openApp(page, player({ lang, flags: { tour: 1, rev: 1 } }));
    const pops = [
      ["#raceLobby", "openRaceLobby()"], ["#levelLobby", "openLevelLobby('rain')"], ["#boostLobby", "openBoost()"],
      ["#customLobby", "openCustom()"], ["#ladderLock", "openLadder(false)"],
      ["#dayWelcome", "$('#dwTxt').textContent=t('dw.ch1'); $('#dayWelcome').classList.add('on')"],
      ["#toast", "toast('🌙', t('soft.toast'), 60000)"],
    ];
    const short = [];
    for (const [root, js] of pops) {
      await page.evaluate(js); await page.waitForTimeout(400);
      for (const [text, n, ratio] of await page.evaluate(rows, root)) if (ratio < 0.5) short.push(`${root} ${n} rows, last ${Math.round(ratio * 100)}%: ${text}`);
      await page.evaluate(() => { document.querySelectorAll(".overlay.on").forEach(o => o.classList.remove("on")); $("#toast").classList.remove("on"); });
    }
    await page.evaluate("startTour()");
    const n = await page.evaluate("TOUR.length");
    for (let i = 0; i < n; i++) {
      await page.evaluate(i => tourStep(i), i); await page.waitForTimeout(50);
      for (const [text, k, ratio] of await page.evaluate(rows, "#tourCard")) if (ratio < 0.5) short.push(`tour ${i + 1}, ${k} rows, last ${Math.round(ratio * 100)}%: ${text}`);
    }
    expect(short, "texts with a short last row").toEqual([]);
  });
}

for (const lang of ["nl", "en", "fr", "it"]) {
  test(`home text rows are balanced (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 657 });
    await openApp(page, player({ lang, xp: 300, rules: "all", flags: { tour: 1, rev: 1 } }));
    await page.waitForTimeout(300);
    // Keebo, profile, golden rules and map. Not #wFreeze: 2 or 3 short words in a narrow column, no good split exists.
    const short = [];
    for (const root of ["#home aside .profile", "#rules", "#map"])
      short.push(...(await page.evaluate(rows, root)).filter(([text, , ratio]) => ratio < 0.5 && !/❄/.test(text)));
    expect(short, "texts with a short last row").toEqual([]);
  });
}
