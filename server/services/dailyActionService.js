const { getDatabase, db, saveDatabase } = require('../database');

/**
 * 获取今天的日期字符串（YYYY-MM-DD）
 */
function getToday() {
  return new Date().toISOString().split('T')[0];
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
  const today = getToday();
  const record = db.daily_actions.find(
    a => a.user_id === userId && a.target_user_id === targetId && a.action_type === actionType && a.action_date === today
  );
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
  const today = getToday();
  const existing = db.daily_actions.find(
    a => a.user_id === userId && a.target_user_id === targetId && a.action_type === actionType && a.action_date === today
  );

  if (existing) {
    existing.count += 1;
  } else {
    const db2 = getDatabase();
    db2.prepare("INSERT INTO daily_actions (user_id, target_user_id, action_type, action_date, count) VALUES (?, ?, ?, ?, 1)")
      .run(userId, targetId, actionType, today);
    return;
  }

  saveDatabase();
}

module.exports = {
  canPerformAction,
  recordAction
};
