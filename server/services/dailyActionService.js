const { getDatabase } = require('../database');

/**
 * 获取今天的日期字符串（本地时间 YYYY-MM-DD）
 */
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * 检查用户今天是否还能对目标执行指定操作
 * @param {number} userId - 当前用户ID
 * @param {number} targetId - 目标用户ID
 * @param {string} actionType - 操作类型
 * @param {number} maxCount - 每日最大次数
 * @returns {boolean} - 是否可以执行
 */
function canPerformAction(userId, targetId, actionType, maxCount) {
  const db = getDatabase();
  const today = getToday();
  const record = db.prepare(
    'SELECT * FROM daily_actions WHERE user_id = ? AND target_user_id = ? AND action_type = ? AND action_date = ?'
  ).get(userId, targetId, actionType, today);
  if (!record) {
    return true;
  }
  return record.count < maxCount;
}

/**
 * 记录一次操作
 * @param {number} userId - 当前用户ID
 * @param {number} targetId - 目标用户ID
 * @param {string} actionType - 操作类型
 */
function recordAction(userId, targetId, actionType) {
  const db = getDatabase();
  const today = getToday();
  const existing = db.prepare(
    'SELECT * FROM daily_actions WHERE user_id = ? AND target_user_id = ? AND action_type = ? AND action_date = ?'
  ).get(userId, targetId, actionType, today);

  if (existing) {
    db.prepare('UPDATE daily_actions SET count = count + 1 WHERE id = ?').run(existing.id);
  } else {
    db.prepare(
      'INSERT INTO daily_actions (user_id, target_user_id, action_type, action_date, count) VALUES (?, ?, ?, ?, 1)'
    ).run(userId, targetId, actionType, today);
  }
}

module.exports = {
  canPerformAction,
  recordAction
};
