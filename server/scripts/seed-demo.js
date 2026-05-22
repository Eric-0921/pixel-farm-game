/**
 * Demo 数据种子脚本
 * 创建两个演示账号，已经是好友，有作物、通知、留言
 */
const bcrypt = require('bcryptjs');
const { getDatabase, createUserFarm } = require('../database');

const WANG_USERNAME = 'wang_demo';
const WANG_DISPLAY = '王奶奶';
const LI_USERNAME = 'li_demo';
const LI_DISPLAY = '李爷爷';
const DEMO_PASSWORD = 'demo123';

async function ensureUser(db, username, displayName, password, coins, experience) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    // 更新用户数据确保正确
    db.prepare('UPDATE users SET display_name = ?, coins = ?, experience = ? WHERE id = ?')
      .run(displayName, coins, experience, existing.id);
    return existing.id;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, coins, experience)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, passwordHash, displayName, coins, experience);

  return result.lastInsertRowid;
}

function ensureFarm(db, userId) {
  const farm = db.prepare('SELECT id FROM farms WHERE user_id = ?').get(userId);
  if (farm) return farm.id;
  return createUserFarm(userId);
}

function getTodayString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getISOTime(secondsAgo) {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

async function seedDemoData() {
  console.log('🌱 开始创建 Demo 数据...');

  const db = getDatabase();

  // 1. 创建用户
  const wangId = await ensureUser(db, WANG_USERNAME, WANG_DISPLAY, DEMO_PASSWORD, 200, 50);
  const liId = await ensureUser(db, LI_USERNAME, LI_DISPLAY, DEMO_PASSWORD, 150, 30);
  console.log(`  👵 王奶奶 (ID: ${wangId}), 👴 李爷爷 (ID: ${liId})`);

  // 2. 创建农场
  const wangFarmId = ensureFarm(db, wangId);
  const liFarmId = ensureFarm(db, liId);

  // 3. 获取作物类型 ID
  const crops = db.prepare('SELECT id, name, growth_time FROM crop_types').all();
  const wheat = crops.find(c => c.name === '小麦');
  const carrot = crops.find(c => c.name === '胡萝卜');
  const tomato = crops.find(c => c.name === '番茄');

  if (!wheat || !carrot || !tomato) {
    console.warn('  ⚠️ 作物类型数据不完整，跳过种植');
  } else {
    // 4. 清空旧种植数据（避免重复运行产生脏数据）
    db.prepare('DELETE FROM plantings WHERE plot_id IN (SELECT id FROM plots WHERE farm_id IN (?, ?))').run(wangFarmId, liFarmId);
    db.prepare("UPDATE plots SET status = 'empty' WHERE farm_id IN (?, ?)").run(wangFarmId, liFarmId);

    // 获取两个农场的地块
    const wangPlots = db.prepare('SELECT id, x, y FROM plots WHERE farm_id = ? ORDER BY y, x').all(wangFarmId);
    const liPlots = db.prepare('SELECT id, x, y FROM plots WHERE farm_id = ? ORDER BY y, x').all(liFarmId);

    // 王奶奶：3个小麦（1个已成熟），2个胡萝卜（生长中）
    // 已成熟小麦：种了很久（超过小麦60秒生长时间）
    const matureWheatTime = getISOTime(wheat.growth_time + 30);
    const growingWheatTime1 = getISOTime(10);
    const growingWheatTime2 = getISOTime(20);
    const growingCarrotTime1 = getISOTime(30);
    const growingCarrotTime2 = getISOTime(45);

    db.prepare(`
      INSERT INTO plantings (plot_id, crop_type_id, planted_at, watered_at, growth_progress, is_notified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(wangPlots[0].id, wheat.id, matureWheatTime, null, 0, 0);
    db.prepare("UPDATE plots SET status = 'planted' WHERE id = ?").run(wangPlots[0].id);

    db.prepare(`
      INSERT INTO plantings (plot_id, crop_type_id, planted_at, watered_at, growth_progress, is_notified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(wangPlots[1].id, wheat.id, growingWheatTime1, null, 0, 0);
    db.prepare("UPDATE plots SET status = 'planted' WHERE id = ?").run(wangPlots[1].id);

    db.prepare(`
      INSERT INTO plantings (plot_id, crop_type_id, planted_at, watered_at, growth_progress, is_notified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(wangPlots[2].id, wheat.id, growingWheatTime2, null, 0, 0);
    db.prepare("UPDATE plots SET status = 'planted' WHERE id = ?").run(wangPlots[2].id);

    db.prepare(`
      INSERT INTO plantings (plot_id, crop_type_id, planted_at, watered_at, growth_progress, is_notified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(wangPlots[3].id, carrot.id, growingCarrotTime1, null, 0, 0);
    db.prepare("UPDATE plots SET status = 'planted' WHERE id = ?").run(wangPlots[3].id);

    db.prepare(`
      INSERT INTO plantings (plot_id, crop_type_id, planted_at, watered_at, growth_progress, is_notified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(wangPlots[4].id, carrot.id, growingCarrotTime2, null, 0, 0);
    db.prepare("UPDATE plots SET status = 'planted' WHERE id = ?").run(wangPlots[4].id);

    // 李爷爷：2个胡萝卜，1个番茄（都生长中）
    const liCarrotTime1 = getISOTime(40);
    const liCarrotTime2 = getISOTime(50);
    const liTomatoTime = getISOTime(25);

    db.prepare(`
      INSERT INTO plantings (plot_id, crop_type_id, planted_at, watered_at, growth_progress, is_notified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(liPlots[0].id, carrot.id, liCarrotTime1, null, 0, 0);
    db.prepare("UPDATE plots SET status = 'planted' WHERE id = ?").run(liPlots[0].id);

    db.prepare(`
      INSERT INTO plantings (plot_id, crop_type_id, planted_at, watered_at, growth_progress, is_notified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(liPlots[1].id, carrot.id, liCarrotTime2, null, 0, 0);
    db.prepare("UPDATE plots SET status = 'planted' WHERE id = ?").run(liPlots[1].id);

    db.prepare(`
      INSERT INTO plantings (plot_id, crop_type_id, planted_at, watered_at, growth_progress, is_notified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(liPlots[2].id, tomato.id, liTomatoTime, null, 0, 0);
    db.prepare("UPDATE plots SET status = 'planted' WHERE id = ?").run(liPlots[2].id);

    console.log('  🌾 已创建作物种植数据');
  }

  // 5. 好友关系（双向 accepted）
  const existingFriend = db.prepare('SELECT id FROM friends WHERE user_id = ? AND friend_id = ?').get(wangId, liId);
  if (!existingFriend) {
    db.prepare("INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')").run(wangId, liId);
    db.prepare("INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')").run(liId, wangId);
    console.log('  👫 已建立好友关系');
  } else {
    db.prepare("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?").run(wangId, liId);
    db.prepare("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?").run(liId, wangId);
  }

  // 6. 历史留言 3 条（王奶奶→李爷爷）
  const existingMessages = db.prepare('SELECT COUNT(*) as count FROM messages WHERE sender_id = ? AND receiver_id = ?').get(wangId, liId);
  if (existingMessages.count === 0) {
    const messages = [
      { content: '我来帮你浇水了', minutesAgo: 120 },
      { content: '今天天气真好', minutesAgo: 60 },
      { content: '一起收成吧', minutesAgo: 30 }
    ];
    const stmt = db.prepare('INSERT INTO messages (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?)');
    for (const m of messages) {
      stmt.run(wangId, liId, m.content, getISOTime(m.minutesAgo * 60));
    }
    console.log('  💬 已创建历史留言');
  }

  // 7. 王奶奶有 2 条未读通知
  const existingNotifs = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(wangId);
  if (existingNotifs.count === 0) {
    const notifStmt = db.prepare(`
      INSERT INTO notifications (user_id, type, title, content, channel, data, created_at, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    notifStmt.run(
      wangId,
      'water',
      '好友浇水',
      '李爷爷帮你浇了水',
      'in_app',
      null,
      getISOTime(300),
      getISOTime(300)
    );
    notifStmt.run(
      wangId,
      'mature',
      '作物成熟',
      '你的小麦已成熟，快去收获吧！',
      'in_app',
      null,
      getISOTime(180),
      getISOTime(180)
    );
    console.log('  🔔 已创建未读通知');
  }

  // 8. 王奶奶连续签到 3 天
  const existingCheckins = db.prepare('SELECT COUNT(*) as count FROM checkins WHERE user_id = ?').get(wangId);
  if (existingCheckins.count === 0) {
    const checkinStmt = db.prepare('INSERT OR IGNORE INTO checkins (user_id, checkin_date, consecutive_days, reward) VALUES (?, ?, ?, ?)');
    // 前天（第1天）
    checkinStmt.run(wangId, getTodayString(2), 1, 10);
    // 昨天（第2天）
    checkinStmt.run(wangId, getTodayString(1), 2, 15);
    // 今天（第3天）
    checkinStmt.run(wangId, getTodayString(0), 3, 20);
    console.log('  📅 已创建连续签到记录');
  }

  console.log('✅ Demo 数据准备完毕！');
}

module.exports = { seedDemoData };
