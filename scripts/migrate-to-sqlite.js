const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const JSON_PATH = path.resolve('./database/farm_game.json');
const DB_PATH = path.resolve('./database/farm_game.db');

function migrate() {
  console.log('📦 开始迁移数据到 SQLite...');

  if (!fs.existsSync(JSON_PATH)) {
    console.error('❌ 找不到 JSON 数据库文件:', JSON_PATH);
    process.exit(1);
  }

  // 读取 JSON 数据
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const data = JSON.parse(raw);

  // 如果数据库已存在，先删除（或备份）
  if (fs.existsSync(DB_PATH)) {
    const backupPath = DB_PATH + '.backup.' + Date.now();
    fs.renameSync(DB_PATH, backupPath);
    console.log('🗂️  已备份旧数据库到', backupPath);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // 创建表结构（与 database-sqlite.js 保持一致）
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      coins INTEGER DEFAULT 100,
      experience INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS farms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT DEFAULT '我的农场',
      width INTEGER DEFAULT 8,
      height INTEGER DEFAULT 6,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id INTEGER NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      status TEXT DEFAULT 'empty',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crop_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      growth_time INTEGER NOT NULL,
      sell_price INTEGER NOT NULL,
      buy_price INTEGER NOT NULL,
      color TEXT,
      stages INTEGER DEFAULT 4
    );

    CREATE TABLE IF NOT EXISTS plantings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot_id INTEGER NOT NULL,
      crop_type_id INTEGER NOT NULL,
      planted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      watered_at TEXT,
      growth_progress REAL DEFAULT 0,
      harvested_at TEXT,
      is_notified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT,
      title TEXT,
      content TEXT,
      channel TEXT,
      data TEXT,
      read_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_user_id INTEGER,
      action_type TEXT NOT NULL,
      action_date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      UNIQUE(user_id, target_user_id, action_type, action_date)
    );

    CREATE TABLE IF NOT EXISTS gifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      crop_type_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      subscription TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      checkin_date TEXT NOT NULL,
      consecutive_days INTEGER DEFAULT 1,
      reward INTEGER DEFAULT 10,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, checkin_date)
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stat_key TEXT NOT NULL,
      stat_value INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, stat_key)
    );
  `);

  const stats = {};

  // 迁移 users
  if (data.users && data.users.length > 0) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, display_name, coins, experience, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const row of data.users) {
      const result = stmt.run(row.id, row.username, row.password_hash, row.display_name, row.coins, row.experience, row.created_at || new Date().toISOString());
      inserted += result.changes;
    }
    stats.users = inserted;
  }

  // 迁移 farms
  if (data.farms && data.farms.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO farms (id, user_id, name, width, height, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.farms) {
      stmt.run(row.id, row.user_id, row.name, row.width, row.height, row.created_at || new Date().toISOString());
    }
    stats.farms = data.farms.length;
  }

  // 迁移 plots
  if (data.plots && data.plots.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO plots (id, farm_id, x, y, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.plots) {
      stmt.run(row.id, row.farm_id, row.x, row.y, row.status, row.created_at || new Date().toISOString());
    }
    stats.plots = data.plots.length;
  }

  // 迁移 crop_types
  if (data.crop_types && data.crop_types.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO crop_types (id, name, description, growth_time, sell_price, buy_price, color, stages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.crop_types) {
      stmt.run(row.id, row.name, row.description, row.growth_time, row.sell_price, row.buy_price, row.color, row.stages);
    }
    stats.crop_types = data.crop_types.length;
  }

  // 迁移 plantings
  if (data.plantings && data.plantings.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO plantings (id, plot_id, crop_type_id, planted_at, watered_at, growth_progress, harvested_at, is_notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.plantings) {
      stmt.run(row.id, row.plot_id, row.crop_type_id, row.planted_at, row.watered_at || null, row.growth_progress || 0, row.harvested_at || null, row.is_notified || 0);
    }
    stats.plantings = data.plantings.length;
  }

  // 迁移 friends
  if (data.friends && data.friends.length > 0) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO friends (id, user_id, friend_id, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const row of data.friends) {
      const result = stmt.run(row.id, row.user_id, row.friend_id, row.status, row.created_at || new Date().toISOString());
      inserted += result.changes;
    }
    stats.friends = inserted;
    if (inserted < data.friends.length) {
      console.log(`  ⚠️ friends: 跳过 ${data.friends.length - inserted} 条重复记录`);
    }
  }

  // 迁移 notifications
  if (data.notifications && data.notifications.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, channel, data, read_at, created_at, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.notifications) {
      stmt.run(row.id, row.user_id, row.type, row.title, row.content, row.channel || 'in_app', row.data ? JSON.stringify(row.data) : null, row.read_at || null, row.created_at || new Date().toISOString(), row.sent_at || row.created_at || new Date().toISOString());
    }
    stats.notifications = data.notifications.length;
  }

  // 迁移 messages
  if (data.messages && data.messages.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO messages (id, sender_id, receiver_id, content, created_at, read_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.messages) {
      stmt.run(row.id, row.sender_id, row.receiver_id, row.content, row.created_at, row.read_at || null);
    }
    stats.messages = data.messages.length;
  }

  // 迁移 daily_actions
  if (data.daily_actions && data.daily_actions.length > 0) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO daily_actions (id, user_id, target_user_id, action_type, action_date, count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const row of data.daily_actions) {
      const result = stmt.run(row.id, row.user_id, row.target_user_id, row.action_type, row.action_date, row.count);
      inserted += result.changes;
    }
    stats.daily_actions = inserted;
  }

  // 迁移 gifts
  if (data.gifts && data.gifts.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO gifts (id, sender_id, receiver_id, crop_type_id, quantity, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.gifts) {
      stmt.run(row.id, row.sender_id, row.receiver_id, row.crop_type_id, row.quantity, row.status, row.created_at || new Date().toISOString());
    }
    stats.gifts = data.gifts.length;
  }

  // 迁移 push_subscriptions
  if (data.push_subscriptions && data.push_subscriptions.length > 0) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO push_subscriptions (id, user_id, subscription, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const row of data.push_subscriptions) {
      const result = stmt.run(row.id, row.user_id, row.subscription ? JSON.stringify(row.subscription) : null, row.created_at || new Date().toISOString(), row.updated_at || null);
      inserted += result.changes;
    }
    stats.push_subscriptions = inserted;
  }

  // 迁移 checkins
  if (data.checkins && data.checkins.length > 0) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO checkins (id, user_id, checkin_date, consecutive_days, reward, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const row of data.checkins) {
      const result = stmt.run(row.id, row.user_id, row.checkin_date, row.consecutive_days, row.reward, row.created_at || new Date().toISOString());
      inserted += result.changes;
    }
    stats.checkins = inserted;
  }

  // 迁移 user_achievements
  if (data.user_achievements && data.user_achievements.length > 0) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id, unlocked_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const row of data.user_achievements) {
      const result = stmt.run(row.id, row.user_id, row.achievement_id, row.unlocked_at || row.created_at, row.created_at || new Date().toISOString());
      inserted += result.changes;
    }
    stats.user_achievements = inserted;
  }

  // 迁移 user_stats
  if (data.user_stats && data.user_stats.length > 0) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO user_stats (id, user_id, stat_key, stat_value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const row of data.user_stats) {
      const result = stmt.run(row.id, row.user_id, row.stat_key, row.stat_value, row.created_at || new Date().toISOString(), row.updated_at || row.created_at || new Date().toISOString());
      inserted += result.changes;
    }
    stats.user_stats = inserted;
  }

  db.close();

  console.log('✅ 迁移完成！');
  console.log('📊 迁移数据汇总:');
  for (const [table, count] of Object.entries(stats)) {
    console.log(`  ${table}: ${count} 条`);
  }
  console.log(`\n💾 数据库文件: ${DB_PATH}`);
}

migrate();
