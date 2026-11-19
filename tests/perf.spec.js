// Low-end smoke test: typing must stay smooth on a slow CPU, like a cheap school Chromebook.
// The CPU is slowed down with Chrome DevTools (CDP). We type at a fast teen pace and measure:
//   - key latency: time from key press to the next frame on screen (Event Timing API)
//   - long tasks: main-thread work of more than 50 ms
//   - frame gaps: the longest time between two frames (a "freeze")
// Limits have a big margin, so a slow CI runner does not make the test fail at random.
// A real problem (heavy work on each key, or a freeze) is still far over the limits.
const { test, expect } = require("@playwright/test");
const { player, openApp } = require("./helpers");

const CPU_SLOWDOWN = Number(process.env.PERF_CPU || 4);      // 4x slower CPU. Lighthouse uses 4x for a "mid-range mobile" device.
const KEY_DELAY = 90;         // ms between keys: about 130 WPM, faster than the kids type
const LIMITS = {
  p95: 100,                   // ms, 95% of keys show on screen within this time. Google calls < 200 ms "good" (INP).
  max: 250,                   // ms, the slowest key
  longTask: 200,              // ms, the longest main-thread task
  frameGap: 400,              // ms, the longest time without a new frame
};

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

/** A player with 1 star on the first `n` chapters, so all games are open. */
function withChapters(n, extra = {}) {
  const q = {};
  for (let i = 0; i < n; i++) q[i] = { stars: 1, wpm: 12, acc: 92 };
  return player(Object.assign({ lessons: { qwerty: q, azerty: {} } }, extra));
}

/** Start the observers in the page. They collect data until `stopMeasure`. */
async function startMeasure(page) {
  await page.evaluate(() => {
    const m = (window.__perf = { keys: [], long: [], gap: 0, run: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === "keydown") m.keys.push(e.duration);
    }).observe({ type: "event", durationThreshold: 16, buffered: false });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) m.long.push(e.duration);
    }).observe({ type: "longtask" });
    // Count every keydown (also the fast ones that Event Timing does not report).
    m.count = 0;
    addEventListener("keydown", () => m.count++, true);
    let last = performance.now();
    const tick = (t) => { if (!m.run) return; m.gap = Math.max(m.gap, t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

async function stopMeasure(page) {
  await page.waitForTimeout(300); // let the last entries arrive
  return page.evaluate(() => {
    const m = window.__perf; m.run = false;
    // Keys under 16 ms are not reported. Count them as 16 ms.
    const all = m.keys.concat(Array(Math.max(0, m.count - m.keys.length)).fill(16)).sort((a, b) => a - b);
    const pct = (p) => all.length ? all[Math.min(all.length - 1, Math.ceil(p * all.length) - 1)] : 0;
    return {
      keys: m.count, p50: pct(0.5), p95: pct(0.95), max: all.length ? all[all.length - 1] : 0,
      longTasks: m.long.length, longTask: m.long.length ? Math.round(Math.max(...m.long)) : 0,
      frameGap: Math.round(m.gap),
    };
  });
}

function check(name, r) {
  console.log(`[perf] ${name} at ${CPU_SLOWDOWN}x CPU: ${r.keys} keys, latency p50 ${r.p50} ms, p95 ${r.p95} ms, max ${r.max} ms, ` +
    `long tasks ${r.longTasks} (max ${r.longTask} ms), max frame gap ${r.frameGap} ms`);
  test.info().annotations.push({ type: "perf", description: `${name}: ${JSON.stringify(r)}` });
  expect(r.keys, "keys were measured").toBeGreaterThan(20);
  expect(r.p95, "p95 key latency (ms)").toBeLessThanOrEqual(LIMITS.p95);
  expect(r.max, "slowest key (ms)").toBeLessThanOrEqual(LIMITS.max);
  expect(r.longTask, "longest main-thread task (ms)").toBeLessThanOrEqual(LIMITS.longTask);
  expect(r.frameGap, "longest frame gap (ms)").toBeLessThanOrEqual(LIMITS.frameGap);
}

async function slowCpu(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
}

/** Type `n` characters of the current text (or all of it), at KEY_DELAY. */
async function typeSome(page, n = Infinity) {
  const text = await page.evaluate("S.text.slice(S.pos)");
  for (const ch of text.slice(0, n)) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(KEY_DELAY);
  }
}

test.describe("low-end CPU", () => {
  test.describe.configure({ retries: 2 }); // timing on shared CI runners can have a rare spike
  test.use({ viewport: { width: 1366, height: 768 } }); // a common Chromebook screen

  test("a normal chapter stays smooth", async ({ page }) => {
    test.setTimeout(60000);
    await openApp(page, withChapters(4));
    await page.click("#map .lesson >> nth=4");
    await expect(page.locator("#type")).toBeVisible();
    await slowCpu(page);
    await startMeasure(page);
    await typeSome(page, 80);
    check("chapter", await stopMeasure(page));
  });

  for (const [name, btn] of [["Longest Word", "#mLadder"], ["Word Marathon", "#mMarathon"]]) {
    test(`${name} stays smooth`, async ({ page }) => {
      test.setTimeout(60000);
      await openApp(page, withChapters(18, { bestWpm: 10 })); // slow Keebo, so he does not win
      await page.click(btn);
      await page.click("#lvChoices .lv-normal");               // level lobby: Normal
      await expect(page.locator("#type")).toBeVisible();
      await slowCpu(page);
      await startMeasure(page);
      // Words 1 to 7 (2 to 8 letters): about 35 keys, with the start lights and word changes.
      for (let sub = 1; sub <= 7; sub++) {
        await page.waitForFunction((n) => LW && LW.sub === n && S && !S.locked, sub, { timeout: 15000 });
        await typeSome(page);
      }
      check(name, await stopMeasure(page));
    });
  }
});
