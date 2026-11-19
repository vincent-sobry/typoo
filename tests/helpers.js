// Shared helpers for the Typoo smoke tests.
const KEY = "typo.v1"; // tests run at the site root, so the app uses the stable key (in the test browser only)

/** A saved player, as the app stores it. Override fields with `extra`. */
function player(extra = {}) {
  return Object.assign({
    name: "Tester", layout: "qwerty", lang: "en", blind: 0, sound: 0, xp: 0,
    lessons: { qwerty: {}, azerty: {} }, keys: {}, badges: {},
    streak: { count: 0, last: "" }, today: { date: "", secs: 0 }, bestWpm: 0, history: [],
    races: { won: 0, played: 0 }, rainBest: 0, flags: {},
  }, extra);
}

/** Open the app with a saved state (or none, for onboarding). */
async function openApp(page, state) {
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      if (v) localStorage.setItem(k, v); else localStorage.removeItem(k);
    }
  }, [KEY, state ? JSON.stringify(state) : ""]);
  await page.goto("/index.html");
}

/** The saved state, read back from localStorage. */
async function saved(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
}

/** Type the full text of the current typing session without mistakes. */
async function typeAll(page) {
  const text = await page.evaluate("S && S.text");
  await page.keyboard.type(text, { delay: 2 });
}

module.exports = { KEY, player, openApp, saved, typeAll };
