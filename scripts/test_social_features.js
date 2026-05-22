const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. 打开页面并登录
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // 使用演示账号登录 (li_demo / demo123)
    await page.fill('#login-username', 'li_demo');
    await page.fill('#login-password', 'demo123');
    await page.click('#login-btn');

    // 等待游戏界面显示
    await page.waitForSelector('#game-screen:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // 2. 打开好友弹窗
    await page.waitForSelector('#btn-friends', { state: 'visible' });
    await page.click('#btn-friends');
    await page.waitForSelector('#friend-modal:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(600);

    // 3. 点击留言按钮，验证预设按钮
    await page.waitForSelector('.friend-item button:has-text("留言")', { state: 'visible' });
    await page.click('.friend-item button:has-text("留言")');
    await page.waitForSelector('#message-modal:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(600);

    // 截图 - 留言弹窗
    await page.screenshot({ path: '/Users/erictseng/git/demo0519/screenshots/test_message_modal.png' });

    // 验证 6 个预设按钮
    const presetBtns = await page.locator('.preset-btn').all();
    console.log('预设按钮数量:', presetBtns.length);
    if (presetBtns.length !== 6) {
      throw new Error('预设按钮数量不对，期望 6 个，实际 ' + presetBtns.length);
    }

    const btnTexts = [];
    for (const btn of presetBtns) {
      const text = await btn.textContent();
      btnTexts.push(text.trim());
    }
    console.log('预设按钮文本:', btnTexts);

    // 点击第一个预设按钮
    await presetBtns[0].click();
    await page.waitForTimeout(800);

    // 截图 - 发送后
    await page.screenshot({ path: '/Users/erictseng/git/demo0519/screenshots/test_after_preset_send.png' });

    // 验证 Toast
    const toast = await page.locator('#toast-message').textContent();
    console.log('Toast 内容:', toast);
    if (!toast.includes('问候已发送')) {
      throw new Error('Toast 消息不正确: ' + toast);
    }

    // 关闭留言弹窗
    await page.click('#message-modal-close');
    await page.waitForTimeout(500);

    // 关闭好友弹窗
    await page.click('#friend-modal .close-btn');
    await page.waitForTimeout(500);

    // 4. 进入好友农场，验证一键帮助
    await page.click('#btn-friends');
    await page.waitForSelector('#friend-modal:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(600);

    await page.waitForSelector('.friend-item button:has-text("农场")', { state: 'visible' });
    await page.click('.friend-item button:has-text("农场")');
    await page.waitForTimeout(1500);

    // 截图 - 好友农场
    await page.screenshot({ path: '/Users/erictseng/git/demo0519/screenshots/test_friend_farm.png' });

    // 验证一键帮助按钮存在
    await page.waitForSelector('#one-click-help:not(.hidden)', { timeout: 3000 });
    const oneClickBtn = await page.locator('#btn-one-click-help');
    const isVisible = await oneClickBtn.isVisible();
    console.log('一键帮助按钮可见:', isVisible);
    if (!isVisible) {
      throw new Error('一键帮助按钮不可见');
    }

    // 验证底部提示
    const hint = await page.locator('#current-hint').textContent();
    console.log('底部提示:', hint);
    if (!hint.includes('一键帮助') && !hint.includes('明天再来')) {
      throw new Error('底部提示不正确: ' + hint);
    }

    // 点击一键帮助
    await oneClickBtn.click();
    await page.waitForTimeout(1500);

    // 截图 - 一键帮助后
    await page.screenshot({ path: '/Users/erictseng/git/demo0519/screenshots/test_after_one_click.png' });

    // 5. 返回我的农场
    await page.click('#btn-back-my-farm');
    await page.waitForTimeout(1000);

    // 验证一键帮助按钮隐藏
    await page.waitForTimeout(800);
    const oneClickHidden = await page.locator('#one-click-help').isHidden();
    console.log('一键帮助隐藏:', oneClickHidden);
    if (!oneClickHidden) {
      throw new Error('返回我的农场后一键帮助按钮应该隐藏');
    }

    // 6. 验证赠送种子简化
    await page.click('#btn-friends');
    await page.waitForSelector('#friend-modal:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(600);

    await page.waitForSelector('.friend-item button:has-text("赠种")', { state: 'visible' });
    await page.click('.friend-item button:has-text("赠种")');
    await page.waitForSelector('#gift-modal:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(600);

    // 截图 - 赠送种子弹窗
    await page.screenshot({ path: '/Users/erictseng/git/demo0519/screenshots/test_gift_modal.png' });

    const giftHint = await page.locator('#gift-hint-text').textContent();
    console.log('赠送提示:', giftHint);
    if (!giftHint.includes('小麦种子')) {
      throw new Error('赠送种子提示不正确: ' + giftHint);
    }

    const wheatBtn = await page.locator('#gift-send-wheat-btn');
    const wheatBtnVisible = await wheatBtn.isVisible();
    console.log('小麦种子按钮可见:', wheatBtnVisible);
    if (!wheatBtnVisible) {
      throw new Error('小麦种子按钮不可见');
    }

    // 点击赠送
    await wheatBtn.click();
    await page.waitForTimeout(1000);

    // 截图 - 赠送后
    await page.screenshot({ path: '/Users/erictseng/git/demo0519/screenshots/test_after_gift.png' });

    console.log('\n✅ 所有测试通过！');
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    await page.screenshot({ path: '/Users/erictseng/git/demo0519/screenshots/test_failure.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
