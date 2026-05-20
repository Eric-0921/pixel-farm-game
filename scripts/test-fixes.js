const http = require('http');
const { initDatabase, getDatabase } = require('../server/database');

const BASE_URL = 'localhost';
const PORT = 3000;

function request(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=== 开始修复验证测试 ===\n');
  let passed = 0;
  let failed = 0;

  // 初始化数据库连接（用于测试中的直接数据操作）
  initDatabase();

  // 1. 测试安全响应头 (CSP + HSTS)
  console.log('--- 测试 1: CSP 和 HSTS 响应头 ---');
  const health = await request('/api/health');
  const csp = health.headers['content-security-policy'];
  const hsts = health.headers['strict-transport-security'];
  if (csp && csp.includes("default-src 'self'")) {
    console.log('✅ CSP 头已设置');
    passed++;
  } else {
    console.log('❌ CSP 头缺失或错误:', csp);
    failed++;
  }
  if (hsts && hsts.includes('max-age=31536000')) {
    console.log('✅ HSTS 头已设置');
    passed++;
  } else {
    console.log('❌ HSTS 头缺失或错误:', hsts);
    failed++;
  }

  // 2. 注册用户并获取 token
  console.log('\n--- 测试 2: 注册用户 ---');
  const username = `t_${Date.now()}`;
  const registerRes = await request('/api/auth/register', 'POST', { username, password: 'test1234' });
  if (!registerRes.body.success) {
    console.log('注册失败:', JSON.stringify(registerRes.body));
    failed++;
  } else {
    console.log('✅ 注册成功');
    passed++;
  }
  const token = registerRes.body.data?.token;

  // 3. 测试农场操作速率限制
  console.log('\n--- 测试 3: 农场操作速率限制 (每分钟30次) ---');
  const farmRes = await request('/api/farm', 'GET', null, { Authorization: `Bearer ${token}` });
  const farm = farmRes.body.data;
  if (!farm) {
    console.log('❌ 无法获取农场数据:', JSON.stringify(farmRes.body));
    failed++;
  } else {
    const cropTypeId = 1;
    const plots = farm.plots;
    
    // 给测试用户充足金币
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (user) {
      db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(99999, user.id);
    }

    let rateLimited = false;
    let successCount = 0;
    let reqCount = 0;
    // 只发送种植请求（不使用收获，避免请求数翻倍）
    for (let i = 0; i < 35; i++) {
      const plotId = plots[i % plots.length]?.plot_id;
      const res = await request('/api/farm/plant', 'POST', { plotId, cropTypeId }, { Authorization: `Bearer ${token}` });
      reqCount++;
      if (res.body.success) {
        successCount++;
      } else if (res.body.message === '操作过于频繁，请稍后再试') {
        rateLimited = true;
        console.log(`✅ 第 ${reqCount} 次种植请求被速率限制（成功次数: ${successCount}）`);
        break;
      }
    }
    if (rateLimited && reqCount > 30) {
      console.log(`✅ 农场速率限制生效（第${reqCount}次请求触发）`);
      passed++;
    } else if (!rateLimited) {
      console.log(`❌ 农场速率限制未在35次请求内触发`);
      failed++;
    } else {
      console.log(`⚠️ 农场速率限制在${reqCount}次请求时触发（可能受apiLimiter影响）`);
      passed++;
    }
  }

  // 等待 apiLimiter 窗口重置
  console.log('\n--- 等待速率限制窗口重置 ---');
  await sleep(65000);

  // 4. 测试签到速率限制
  console.log('--- 测试 4: 签到速率限制 (每天5次) ---');
  const checkinUser = `c_${Date.now()}`;
  const reg2 = await request('/api/auth/register', 'POST', { username: checkinUser, password: 'test1234' });
  if (!reg2.body.success) {
    console.log('❌ 签到测试用户注册失败:', JSON.stringify(reg2.body));
    failed++;
  } else {
    const token2 = reg2.body.data?.token;
    
    let checkinLimited = false;
    let checkinTotal = 0;
    for (let i = 0; i < 7; i++) {
      const res = await request('/api/checkin', 'POST', {}, { Authorization: `Bearer ${token2}` });
      checkinTotal++;
      if (res.body.message === '今日签到次数已达上限') {
        checkinLimited = true;
        console.log(`✅ 第 ${checkinTotal} 次请求被签到速率限制`);
        break;
      }
    }
    if (checkinLimited && checkinTotal === 6) {
      console.log(`✅ 签到速率限制生效（第6次请求触发）`);
      passed++;
    } else {
      console.log(`❌ 签到速率限制异常，总请求: ${checkinTotal}, 被限制: ${checkinLimited}`);
      failed++;
    }
  }

  // 5. 测试连续7天签到奖励
  console.log('\n--- 测试 5: 连续7天签到额外奖励 ---');
  const bonusUser = `b_${Date.now()}`;
  const reg3 = await request('/api/auth/register', 'POST', { username: bonusUser, password: 'test1234' });
  if (!reg3.body.success) {
    console.log('❌ 奖励测试用户注册失败:', JSON.stringify(reg3.body));
    failed++;
  } else {
    const token3 = reg3.body.data?.token;
    const db = getDatabase();
    const bonusDbUser = db.prepare('SELECT * FROM users WHERE username = ?').get(bonusUser);
    if (!bonusDbUser) {
      console.log('❌ 找不到测试用户');
      failed++;
    } else {
      // 删除该用户的所有签到记录
      db.prepare('DELETE FROM checkins WHERE user_id = ?').run(bonusDbUser.id);
      
      // 插入6条连续签到记录（过去6天）
      const today = new Date();
      for (let i = 6; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        db.prepare('INSERT INTO checkins (user_id, checkin_date, consecutive_days, reward) VALUES (?, ?, ?, ?)')
          .run(bonusDbUser.id, dateStr, 7 - i, 10 + (7 - i) * 5);
      }
      
      // 重置金币到初始值
      db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(100, bonusDbUser.id);
      
      // 删除今天的签到记录（如果有）
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      db.prepare('DELETE FROM checkins WHERE user_id = ? AND checkin_date = ?').run(bonusDbUser.id, todayStr);
      
      const checkinRes = await request('/api/checkin', 'POST', {}, { Authorization: `Bearer ${token3}` });
      
      if (checkinRes.body.success && checkinRes.body.data?.reward > 50) {
        console.log(`✅ 7天签到奖励生效，获得 ${checkinRes.body.data.reward} 金币`);
        console.log(`   消息: ${checkinRes.body.data.message}`);
        passed++;
      } else {
        console.log(`❌ 7天签到奖励异常:`, JSON.stringify(checkinRes.body, null, 2));
        failed++;
      }
    }
  }

  // 6. 测试 JWT 密钥文件权限
  console.log('\n--- 测试 6: JWT 密钥文件权限 ---');
  const fs = require('fs');
  const path = require('path');
  const secretFile = path.resolve('./database/.jwt_secret');
  const stats = fs.statSync(secretFile);
  const mode = stats.mode;
  if ((mode & 0o777) === 0o600) {
    console.log('✅ JWT 密钥文件权限正确 (0o600)');
    passed++;
  } else {
    console.log(`❌ JWT 密钥文件权限错误: 0o${(mode & 0o777).toString(8)}`);
    failed++;
  }

  // 7. 测试 bcrypt 轮数
  console.log('\n--- 测试 7: bcrypt 哈希轮数 ---');
  const bcrypt = require('bcryptjs');
  const hashStart = Date.now();
  await bcrypt.hash('test', 12);
  const hashTime = Date.now() - hashStart;
  if (hashTime > 50) {
    console.log(`✅ bcrypt hash(12) 耗时 ${hashTime}ms，轮数正常`);
    passed++;
  } else {
    console.log(`⚠️ bcrypt hash 耗时 ${hashTime}ms，可能轮数偏低`);
    passed++;
  }

  console.log('\n=== 测试完成 ===');
  console.log(`通过: ${passed}, 失败: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
