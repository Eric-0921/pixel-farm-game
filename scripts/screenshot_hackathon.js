const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  // 1. 登录页（含Demo入口）
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, '../docs/screenshots/hackathon_01_login.png'), fullPage: true });

  // 2. Demo一键登录
  await page.click('#demo-btn');
  await page.waitForSelector('#senior-home-view:not(.hidden)', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, '../docs/screenshots/hackathon_02_senior_home.png'), fullPage: true });

  // 3. 点击进入我的花园
  await page.click('#btn-my-farm');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, '../docs/screenshots/hackathon_03_my_farm.png'), fullPage: true });

  // 4. 点击好友
  await page.click('#btn-visit-friends');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, '../docs/screenshots/hackathon_04_friend_modal.png'), fullPage: true });

  // 5. 进入好友农场
  const friendFarmBtn = await page.locator('.friend-action-farm').first();
  if (await friendFarmBtn.isVisible().catch(() => false)) {
    await friendFarmBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(__dirname, '../docs/screenshots/hackathon_05_friend_farm.png'), fullPage: true });
  }

  // 6. 留言弹窗（预设按钮）
  await page.click('#btn-friends');
  await page.waitForTimeout(500);
  const msgBtn = await page.locator('.friend-action-message').first();
  if (await msgBtn.isVisible().catch(() => false)) {
    await msgBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(__dirname, '../docs/screenshots/hackathon_06_preset_messages.png'), fullPage: true });
  }

  // 7. 今日任务
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('#btn-today-tasks');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(__dirname, '../docs/screenshots/hackathon_07_today_tasks.png'), fullPage: true });

  await browser.close();
  console.log('✅ 截图完成');
})();
