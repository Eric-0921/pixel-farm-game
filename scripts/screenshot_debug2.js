const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.fill('#login-username', 'zhangsan');
  await page.fill('#login-password', '123456');
  await page.click('#login-btn');

  await page.waitForSelector('#game-screen:not(.hidden)', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // 获取游戏界面HTML
  const gameHtml = await page.locator('#game-screen').innerHTML();
  console.log('游戏界面HTML:', gameHtml.substring(0, 4000));

  await browser.close();
})();
