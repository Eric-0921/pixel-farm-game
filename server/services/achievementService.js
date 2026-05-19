const { db, saveDatabase } = require('../database');
const { sendToUser } = require('../websocket');

const ACHIEVEMENTS = [
  { id: 'first_plant', name: '初次播种', description: '完成第一次种植', condition: 'plant_count >= 1', reward: 10 },
  { id: 'harvest_10', name: '小有收获', description: '累计收获10个作物', condition: 'harvest_count >= 10', reward: 50 },
  { id: 'harvest_100', name: '丰收达人', description: '累计收获100个作物', condition: 'harvest_count >= 100', reward: 300 },
  { id: 'water_50', name: '勤劳园丁', description: '累计浇水50次', condition: 'water_count >= 50', reward: 100 },
  { id: 'rich_1000', name: '小有积蓄', description: '累计拥有1000金币', condition: 'max_coins >= 1000', reward: 200 },
  { id: 'rich_10000', name: '富豪农场主', description: '累计拥有10000金币', condition: 'max_coins >= 10000', reward: 1000 },
  { id: 'login_7', name: '坚持不懈', description: '连续登录7天', condition: 'consecutive_login >= 7', reward: 150 },
  { id: 'login_30', name: '月度标兵', description: '连续登录30天', condition: 'consecutive_login >= 30', reward: 500 },
  { id: 'friend_5', name: '广交朋友', description: '拥有5个好友', condition: 'friend_count >= 5', reward: 100 },
  { id: 'help_water_10', name: '热心助人', description: '帮好友浇水10次', condition: 'help_water_count >= 10', reward: 100 }
];

/**
 * 解析条件字符串
 * @param {string} condition
 * @returns {Object} — { statKey, operator, threshold }
 */
function parseCondition(condition) {
  const match = condition.match(/^(\w+)\s*>=\s*(\d+)$/);
  if (!match) return null;
  return { statKey: match[1], operator: '>=', threshold: parseInt(match[2], 10) };
}

/**
 * 获取用户统计
 * @param {number} userId
 * @returns {Object} — 各项统计数据
 */
function getUserStats(userId) {
  const stats = db.user_stats.filter(s => s.user_id === userId);
  const result = {};
  for (const s of stats) {
    result[s.stat_key] = s.stat_value;
  }

  // 确保基本统计项存在
  const defaultStats = {
    plant_count: 0,
    harvest_count: 0,
    water_count: 0,
    max_coins: 0,
    consecutive_login: 0,
    friend_count: 0,
    help_water_count: 0
  };

  for (const [key, val] of Object.entries(defaultStats)) {
    if (result[key] === undefined) {
      result[key] = val;
    }
  }

  return result;
}

/**
 * 更新用户统计（增量）
 * @param {number} userId
 * @param {string} statKey
 * @param {number} delta — 增量
 */
function incrementStat(userId, statKey, delta = 1) {
  if (!statKey || delta === 0) return;

  let stat = db.user_stats.find(s => s.user_id === userId && s.stat_key === statKey);
  if (stat) {
    stat.stat_value += delta;
    stat.updated_at = new Date().toISOString();
  } else {
    const statId = db._seq.user_stats || 1;
    db._seq.user_stats = statId + 1;
    stat = {
      id: statId,
      user_id: userId,
      stat_key: statKey,
      stat_value: delta,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.user_stats.push(stat);
  }

  // 同步更新 max_coins
  if (statKey === 'max_coins') {
    const user = db.users.find(u => u.id === userId);
    if (user && user.coins > stat.stat_value) {
      stat.stat_value = user.coins;
    }
  }

  saveDatabase();

  // 检查并解锁成就
  checkAndUnlock(userId, statKey, stat.stat_value);
}

/**
 * 设置用户统计（直接赋值）
 * @param {number} userId
 * @param {string} statKey
 * @param {number} value
 */
function setStat(userId, statKey, value) {
  let stat = db.user_stats.find(s => s.user_id === userId && s.stat_key === statKey);
  if (stat) {
    stat.stat_value = value;
    stat.updated_at = new Date().toISOString();
  } else {
    const statId = db._seq.user_stats || 1;
    db._seq.user_stats = statId + 1;
    stat = {
      id: statId,
      user_id: userId,
      stat_key: statKey,
      stat_value: value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.user_stats.push(stat);
  }

  saveDatabase();

  checkAndUnlock(userId, statKey, stat.stat_value);
}

/**
 * 检查并解锁成就
 * @param {number} userId
 * @param {string} statKey — 统计项（如 'harvest_count'）
 * @param {number} value — 当前值
 */
function checkAndUnlock(userId, statKey, value) {
  const userAchievements = db.user_achievements.filter(ua => ua.user_id === userId);
  const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedIds.has(achievement.id)) continue;

    const parsed = parseCondition(achievement.condition);
    if (!parsed) continue;
    if (parsed.statKey !== statKey) continue;

    if (value >= parsed.threshold) {
      unlockAchievement(userId, achievement);
    }
  }
}

/**
 * 解锁单个成就
 * @param {number} userId
 * @param {Object} achievement
 */
function unlockAchievement(userId, achievement) {
  const existing = db.user_achievements.find(
    ua => ua.user_id === userId && ua.achievement_id === achievement.id
  );
  if (existing) return;

  const uaId = db._seq.user_achievements || 1;
  db._seq.user_achievements = uaId + 1;

  const now = new Date().toISOString();
  db.user_achievements.push({
    id: uaId,
    user_id: userId,
    achievement_id: achievement.id,
    unlocked_at: now,
    created_at: now
  });

  // 发放奖励金币
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.coins += achievement.reward;
    // 更新最大金币
    const maxCoinsStat = db.user_stats.find(s => s.user_id === userId && s.stat_key === 'max_coins');
    if (maxCoinsStat && user.coins > maxCoinsStat.stat_value) {
      maxCoinsStat.stat_value = user.coins;
    }
  }

  saveDatabase();

  // WebSocket 通知
  sendToUser(userId, {
    type: 'achievement_unlocked',
    achievement: {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      reward: achievement.reward
    }
  });
}

/**
 * 获取用户成就列表
 * @param {number} userId
 * @returns {Array} — 成就列表（含是否已解锁）
 */
function getUserAchievements(userId) {
  const stats = getUserStats(userId);
  const userAchievements = db.user_achievements.filter(ua => ua.user_id === userId);
  const unlockedMap = new Map();
  for (const ua of userAchievements) {
    unlockedMap.set(ua.achievement_id, ua.unlocked_at);
  }

  return ACHIEVEMENTS.map(ach => {
    const parsed = parseCondition(ach.condition);
    const currentValue = parsed ? (stats[parsed.statKey] || 0) : 0;
    const unlockedAt = unlockedMap.get(ach.id) || null;

    return {
      id: ach.id,
      name: ach.name,
      description: ach.description,
      reward: ach.reward,
      condition: ach.condition,
      unlocked: !!unlockedAt,
      unlockedAt: unlockedAt,
      progress: {
        current: currentValue,
        target: parsed ? parsed.threshold : 0
      }
    };
  });
}

/**
 * 检查所有成就（用于初始化或全量刷新）
 * @param {number} userId
 */
function checkAllAchievements(userId) {
  const stats = getUserStats(userId);
  for (const achievement of ACHIEVEMENTS) {
    const parsed = parseCondition(achievement.condition);
    if (!parsed) continue;
    const value = stats[parsed.statKey] || 0;
    if (value >= parsed.threshold) {
      unlockAchievement(userId, achievement);
    }
  }
}

module.exports = {
  ACHIEVEMENTS,
  getUserAchievements,
  getUserStats,
  incrementStat,
  setStat,
  checkAndUnlock,
  checkAllAchievements
};
