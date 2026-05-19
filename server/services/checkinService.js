const { db, saveDatabase } = require('../database');

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
  const today = getTodayString();
  const todayCheckin = db.checkins.find(c => c.user_id === userId && c.checkin_date === today);

  let consecutiveDays = 0;
  const latestCheckin = db.checkins
    .filter(c => c.user_id === userId)
    .sort((a, b) => b.checkin_date.localeCompare(a.checkin_date))[0];

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
  const result = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const checkin = db.checkins.find(c => c.user_id === userId && c.checkin_date === dateStr);
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
  const today = getTodayString();
  const existing = db.checkins.find(c => c.user_id === userId && c.checkin_date === today);
  if (existing) {
    return { success: false, reward: 0, consecutiveDays: existing.consecutive_days, message: '今日已签到' };
  }

  const yesterday = getYesterdayString();
  const yesterdayCheckin = db.checkins.find(c => c.user_id === userId && c.checkin_date === yesterday);

  let consecutiveDays = 1;
  if (yesterdayCheckin) {
    consecutiveDays = yesterdayCheckin.consecutive_days + 1;
  }

  const reward = calculateReward(consecutiveDays);

  // 创建签到记录
  const checkinId = db._seq.checkins || 1;
  db._seq.checkins = checkinId + 1;
  db.checkins.push({
    id: checkinId,
    user_id: userId,
    checkin_date: today,
    consecutive_days: consecutiveDays,
    reward: reward,
    created_at: new Date().toISOString()
  });

  // 增加用户金币
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.coins += reward;
    // 更新最大金币统计
    const maxCoinsStat = db.user_stats.find(s => s.user_id === userId && s.stat_key === 'max_coins');
    if (maxCoinsStat) {
      if (user.coins > maxCoinsStat.stat_value) {
        maxCoinsStat.stat_value = user.coins;
      }
    } else {
      const statId = db._seq.user_stats || 1;
      db._seq.user_stats = statId + 1;
      db.user_stats.push({
        id: statId,
        user_id: userId,
        stat_key: 'max_coins',
        stat_value: user.coins,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  saveDatabase();

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
}

module.exports = {
  getCheckinStatus,
  getRecentCheckins,
  doCheckin,
  calculateReward
};
