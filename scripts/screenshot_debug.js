const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 截图初始页面
  await page.screenshot({
    path: path.join(__dirname, '../docs/screenshots/debug_home.png'),
    fullPage: true
  });

  // 输出页面HTML结构
  const html = await page.content();
  console.log('页面HTML片段:', html.substring(0, 3000));

  // 查找表单元素
  const inputs = await page.locator('input').all();
  console.log('输入框数量:', inputs.length);
  for (const input of inputs) {
    const id = await input.getAttribute('id');
    const type = await input.getAttribute('type');
    const placeholder = await input.getAttribute('placeholder');
    console.log(`input: id=${id}, type=${type}, placeholder=${placeholder}`);
  }

  await browser.close();
})();
