const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  // ========== 1. 首页（登录界面） ==========
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(__dirname, '../docs/screenshots/01_login_screen.png'),
    fullPage: true
  });

  // ========== 2. 登录进入游戏 ==========
  await page.fill('#login-username', 'zhangsan');
  await page.fill('#login-password', '123456');
  await page.click('#login-btn');

  await page.waitForSelector('#game-screen:not(.hidden)', { timeout: 10000 });
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(__dirname, '../docs/screenshots/02_game_main.png'),
    fullPage: true
  });

  // ========== 3. 点击「种子」按钮 → 弹出种子选择 ==========
  await page.click('#btn-seeds');
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(__dirname, '../docs/screenshots/03_seed_popup.png'),
    fullPage: true
  });

  // ========== 4. 选择第一个种子并关闭弹窗 ==========
  const seedItem = await page.locator('.seed-item').first();
  if (await seedItem.isVisible().catch(() => false)) {
    await seedItem.click();
    await page.waitForTimeout(500);
  }

  // 关闭弹窗（如果还在）
  const popup = await page.locator('#seed-popup');
  if (await popup.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // ========== 5. 切换到种植工具，点击地块 ==========
  await page.click('button[data-tool="plant"]');
  await page.waitForTimeout(300);

  const canvas = await page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  const plotX = box.x + 55;
  const plotY = box.y + 55;
  await page.mouse.click(plotX, plotY);
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(__dirname, '../docs/screenshots/04_farm_planted.png'),
    fullPage: true
  });

  // ========== 6. 切换到浇水工具，浇水 ==========
  await page.click('button[data-tool="water"]');
  await page.waitForTimeout(300);
  await page.mouse.click(plotX, plotY);
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(__dirname, '../docs/screenshots/05_farm_watered.png'),
    fullPage: true
  });

  // ========== 7. 通知弹窗 ==========
  const notifBtn = page.locator('#btn-notifications');
  if (await notifBtn.isVisible().catch(() => false)) {
    await notifBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(__dirname, '../docs/screenshots/06_notifications.png'),
      fullPage: true
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // ========== 8. 好友弹窗 ==========
  const friendBtn = page.locator('#btn-friends');
  if (await friendBtn.isVisible().catch(() => false)) {
    await friendBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(__dirname, '../docs/screenshots/07_friends.png'),
      fullPage: true
    });
  }

  await browser.close();
  console.log('✅ 所有截图完成！');
})();
