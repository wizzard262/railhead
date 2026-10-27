// Takes a screenshot of the game in a visible browser: node tools/shot.js <name> [days to play] [width]
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'harrier-carrier-playwright-tests', 'node_modules', 'playwright'));
(async () => {
  const [name = 'test', days = '0', width = '1600'] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: false, slowMo: 40 });
  const page = await browser.newPage({ viewport: { width: +width, height: +width < 800 ? 900 : 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8766/');
  await page.waitForTimeout(600);
  if (name.includes('help')) { await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false }); await browser.close(); console.log(errors.join('\n') || 'no errors'); return; }
  await page.click('#help [data-close]');
  for (let i = 0; i < +days; i++) {
    await page.evaluate(() => window.Game.endDay());
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  console.log(await page.evaluate(() => JSON.stringify({ day: Game.state.day, fronts: Game.state.sectors.map(s => Math.round(s.front)), report: Game.state.report })));
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})();
