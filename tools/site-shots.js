// Screenshots of the harriercarrier.com Showdown/Railhead panels and the portfolio: node tools/site-shots.js <base url> <folder>
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'harrier-carrier-playwright-tests', 'node_modules', 'playwright'));
(async () => {
  const [base, out] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base);
  await page.locator('.play-badge').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'home_badge.png') });
  await page.goto(base + 'portfolio.html');
  await page.locator('a[href="railhead/index.html"] img').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'portfolio.png') });
  await page.goto(base + 'railhead/index.html');
  await page.waitForTimeout(800);
  console.log('game day', await page.evaluate(() => Game.state.day));
  await browser.close();
})();
