// Settings: items in groups, the Done row stays visible, test settings in the last group.
const { test, expect } = require("@playwright/test");
const { player, openApp } = require("./helpers");

test("settings: groups in order, Done stays visible at Chromebook size", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await openApp(page, player({ flags: { tour: 1 } }));
  await page.click("#hSettings");
  const groups = await page.locator("#settings .setgrp h3 span").evaluateAll((e) => e.map((x) => x.dataset.t));
  expect(groups).toEqual(["set.gPlayer", "set.gHelp", "set.gSound", "set.gGuide", "set.gData", "set.gTest"]);
  await expect(page.locator("#setTestGrp #setSlide")).toHaveCount(1);
  await expect(page.locator("#setTestGrp #setChapters")).toHaveCount(1);
  await expect(page.locator("#setTestGrp #setNewDay")).toHaveCount(1);
  await expect(page.locator("#setClose")).toBeInViewport();
  await page.locator("#settings .setbody").evaluate((b) => (b.scrollTop = b.scrollHeight));
  await expect(page.locator("#setClose")).toBeInViewport();
  await page.click("#setClose");
  await expect(page.locator("#settings")).toBeHidden();
});
