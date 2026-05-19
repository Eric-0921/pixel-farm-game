const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const DB_DIR = path.resolve('./database');
const DB_PATH = path.resolve(DB_DIR, 'farm_game.db');

let sqliteDb = null;

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function initDatabase() {
  console.log('🌱 初始化 SQLite 数据库...');
  ensureDir();
  sqliteDb = new Database(DB_PATH);
  sqliteDb.pragma('journal_mode = WAL');

  // 创建所有表
  sqliteDb.exec(`
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

  // 初始化 crop_types（如果不存在）
  const count = sqliteDb.prepare('SELECT COUNT(*) as count FROM crop_types').get();
  if (count.count === 0) {
    const stmt = sqliteDb.prepare(`
      INSERT INTO crop_types (name, description, growth_time, sell_price, buy_price, color, stages)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const crops = [
      ['小麦', '金黄的小麦，生长迅速', 60, 15, 10, '#F4D03F', 4],
      ['胡萝卜', '脆甜的胡萝卜', 120, 30, 20, '#E67E22', 4],
      ['番茄', '鲜红的番茄', 180, 50, 35, '#E74C3C', 4],
      ['玉米', '饱满的玉米', 300, 80, 50, '#F1C40F', 5],
      ['南瓜', '大大的南瓜', 600, 150, 90, '#D35400', 5]
    ];
    for (const crop of crops) {
      stmt.run(...crop);
    }
    console.log('🌾 已初始化默认作物数据');
  }

  console.log('✅ SQLite 数据库就绪');
}

function getDatabase() {
  if (!sqliteDb) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return {
    prepare(sql) {
      const stmt = sqliteDb.prepare(sql);
      return {
        get(...params) {
          try {
            return stmt.get(...params) || null;
          } catch (e) {
            console.error('SQL get error:', e.message, sql, params);
            throw e;
          }
        },
        all(...params) {
          try {
            return stmt.all(...params);
          } catch (e) {
            console.error('SQL all error:', e.message, sql, params);
            throw e;
          }
        },
        run(...params) {
          try {
            const info = stmt.run(...params);
            return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
          } catch (e) {
            console.error('SQL run error:', e.message, sql, params);
            throw e;
          }
        }
      };
    },
    exec(sql) {
      try {
        sqliteDb.exec(sql);
      } catch (e) {
        console.error('SQL exec error:', e.message, sql);
        throw e;
      }
    }
  };
}

function createUserFarm(userId, farmName = '我的农场') {
  const db = getDatabase();
  const farmResult = db.prepare(`
    INSERT INTO farms (user_id, name, width, height)
    VALUES (?, ?, ?, ?)
  `).run(userId, farmName, config.game.farmWidth, config.game.farmHeight);

  const farmId = farmResult.lastInsertRowid;

  const plotStmt = db.prepare(`
    INSERT INTO plots (farm_id, x, y, status)
    VALUES (?, ?, ?, 'empty')
  `);

  for (let y = 0; y < config.game.farmHeight; y++) {
    for (let x = 0; x < config.game.farmWidth; x++) {
      plotStmt.run(farmId, x, y);
    }
  }

  return farmId;
}

// 兼容性：saveDatabase 在 SQLite 中无需操作
function saveDatabase() {
  // SQLite 自动持久化，无需手动保存
}

// 兼容性：db 对象不再使用
const db = {};

module.exports = {
  getDatabase,
  initDatabase,
  createUserFarm,
  saveDatabase,
  db
};
