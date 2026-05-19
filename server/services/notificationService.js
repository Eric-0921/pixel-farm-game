const { getDatabase } = require('../database');

/**
 * 获取用户通知列表
 */
function getNotifications(userId, limit = 50) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY sent_at DESC 
    LIMIT ?
  `).all(userId, limit);
}

/**
 * 创建通知
 */
function createNotification(userId, type, title, content, channel = 'in_app', data = null) {
  const db = getDatabase();
  
  const result = db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, channel, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, type, title, content, channel, data ? JSON.stringify(data) : null);
  
  return result.lastInsertRowid;
}

/**
 * 标记通知为已读
 */
function markAsRead(userId, notificationId) {
  const db = getDatabase();
  
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(notificationId, userId);
  if (!notification) {
    throw new Error('通知不存在');
  }
  
  const now = new Date().toISOString();
  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ?').run(now, notificationId);
}

/**
 * 标记所有通知为已读
 */
function markAllAsRead(userId) {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now, userId);
}

module.exports = {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead
};
