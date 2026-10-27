// Checks the harriercarrier.com home page panel and the game: node tools/site-check.js <base url> <screenshot file>
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'harrier-carrier-playwright-tests', 'node_modules', 'playwright'));
(async () => {
  const [base, shot] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  const panel = page.locator('a.railhead-panel');
  await panel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot });
  const loaded = await panel.locator('img').evaluate(i => i.complete && i.naturalWidth);
  await panel.click();
  await page.waitForURL(/railhead/);
  await page.waitForTimeout(800);
  const help = await page.locator('#help').isVisible();
  await page.click('#help [data-close]');
  await page.click('#end-btn');
  await page.waitForTimeout(1500);
  const day = await page.evaluate(() => Game.state.day);
  console.log(JSON.stringify({ bannerWidth: loaded, gameUrl: page.url(), helpShown: help, dayAfterEnd: day, errors }));
  await browser.close();
})();
