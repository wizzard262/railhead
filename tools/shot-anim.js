// Screenshot the map mid-animation: node tools/shot-anim.js <name> <days first>
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'harrier-carrier-playwright-tests', 'node_modules', 'playwright'));
(async () => {
  const [name, days = '8'] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: false, slowMo: 40 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/');
  await page.click('#help [data-close]');
  for (let i = 0; i < +days; i++) { await page.evaluate(() => { Game.endDay(); Game.endDay(); }); await page.waitForTimeout(150); }
  await page.waitForTimeout(400);
  await page.evaluate(() => Game.endDay());
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `screenshots/${name}.png`, clip: { x: 0, y: 40, width: 1140, height: 380 } });
  console.log(errors.join('\n') || 'no errors');
  await page.waitForTimeout(2500);
  await browser.close();
})();
