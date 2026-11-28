// Settings: items in groups, the Done row stays visible. Test tools are in the dev test menu, not in Settings.
const { test, expect } = require("@playwright/test");
const { player, openApp } = require("./helpers");

test("settings: groups in order, Done stays visible at Chromebook size", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, player({ flags: { tour: 1 } }));
  await page.click("#hSettings");
  const groups = await page.locator("#settings .setgrp h3 span").evaluateAll((e) => e.map((x) => x.dataset.t));
  expect(groups).toEqual(["set.gPlayer", "set.gHelp", "set.gSound", "set.gGuide", "set.gData"]);
  await expect(page.locator("#setSlide")).toHaveCount(1);
  expect(await page.locator("#setSlide button").count()).toBe(2);       // On / Off
  await expect(page.locator("#settings #setNewDayGo, #settings #setChSel")).toHaveCount(0);   // test tools: dev menu only
  await expect(page.locator("#setClose")).toBeInViewport();
  await page.locator("#settings .setbody").evaluate((b) => (b.scrollTop = b.scrollHeight));
  await expect(page.locator("#setClose")).toBeInViewport();
  await page.click("#setClose");
  await expect(page.locator("#settings")).toBeHidden();
});
