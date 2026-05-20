const { getDatabase } = require('../database');

/**
 * 获取当前日期字符串（本地时间 YYYY-MM-DD）
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取昨天的日期字符串
 */
function getYesterdayString() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 计算连续签到奖励
 * @param {number} consecutiveDays
 * @returns {number} — 奖励金币数
 */
function calculateReward(consecutiveDays) {
  const rewards = {
    1: 10,
    2: 15,
    3: 20,
    4: 25,
    5: 30,
    6: 40,
    7: 50
  };
  return rewards[Math.min(consecutiveDays, 7)] || 50;
}

/**
 * 获取今日签到状态
 * @param {number} userId
 * @returns {Object} — { checkedInToday: boolean, consecutiveDays: number, todayReward: number }
 */
function getCheckinStatus(userId) {
  const db = getDatabase();
  const today = getTodayString();
  const todayCheckin = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?').get(userId, today);

  let consecutiveDays = 0;
  const latestCheckin = db.prepare('SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1').get(userId);

  if (latestCheckin) {
    if (latestCheckin.checkin_date === today) {
      consecutiveDays = latestCheckin.consecutive_days;
    } else if (latestCheckin.checkin_date === getYesterdayString()) {
      consecutiveDays = latestCheckin.consecutive_days;
    } else {
      consecutiveDays = 0;
    }
  }

  return {
    checkedInToday: !!todayCheckin,
    consecutiveDays,
    todayReward: calculateReward(consecutiveDays + (todayCheckin ? 0 : 1))
  };
}

/**
 * 获取最近7天的签到记录（用于日历展示）
 * @param {number} userId
 * @returns {Array} — 最近7天的签到状态
 */
function getRecentCheckins(userId) {
  const db = getDatabase();
  const result = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const checkin = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?').get(userId, dateStr);
    result.push({
      date: dateStr,
      checkedIn: !!checkin,
      isToday: i === 0
    });
  }

  return result;
}

/**
 * 执行每日签到
 * @param {number} userId
 * @returns {Object} — { success: boolean, reward: number, consecutiveDays: number, message: string, extraReward?: string }
 */
function doCheckin(userId) {
  const db = getDatabase();
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const yesterdayCheckin = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?').get(userId, yesterday);

  let consecutiveDays = 1;
  if (yesterdayCheckin) {
    consecutiveDays = yesterdayCheckin.consecutive_days + 1;
  }

  const reward = calculateReward(consecutiveDays);

  try {
    const result = db.prepare(
      "INSERT OR IGNORE INTO checkins (user_id, checkin_date, consecutive_days, reward) VALUES (?, ?, ?, ?)"
    ).run(userId, today, consecutiveDays, reward);

    if (result.changes === 0) {
      const existing = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?').get(userId, today);
      return { success: false, reward: 0, consecutiveDays: existing ? existing.consecutive_days : consecutiveDays, message: '今日已签到' };
    }

    // 增加用户金币
    db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(reward, userId);

    // 更新最大金币统计
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (user) {
      const maxCoinsStat = db.prepare("SELECT * FROM user_stats WHERE user_id = ? AND stat_key = 'max_coins'").get(userId);
      const now = new Date().toISOString();
      if (maxCoinsStat) {
        if (user.coins > maxCoinsStat.stat_value) {
          db.prepare('UPDATE user_stats SET stat_value = ?, updated_at = ? WHERE id = ?')
            .run(user.coins, now, maxCoinsStat.id);
        }
      } else {
        db.prepare('INSERT INTO user_stats (user_id, stat_key, stat_value) VALUES (?, ?, ?)')
          .run(userId, 'max_coins', user.coins);
      }
    }

    // 7天额外奖励：随机种子
    let extraReward = null;
    if (consecutiveDays >= 7) {
      const seeds = ['小麦', '胡萝卜', '番茄'];
      extraReward = seeds[Math.floor(Math.random() * seeds.length)];
    }

    return {
      success: true,
      reward,
      consecutiveDays,
      message: `签到成功！获得 ${reward} 金币`,
      extraReward
    };
  } catch (err) {
    console.error('签到失败:', err);
    return { success: false, reward: 0, consecutiveDays: 0, message: '签到失败，请稍后重试' };
  }
}

module.exports = {
  getCheckinStatus,
  getRecentCheckins,
  doCheckin,
  calculateReward
};
