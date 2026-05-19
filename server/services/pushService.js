const { getDatabase, saveDatabase } = require('../database');

/**
 * 保存用户的 Push 订阅信息
 * @param {number} userId
 * @param {Object} subscription — PushSubscription 对象
 */
function saveSubscription(userId, subscription) {
  const db = getDatabase();
  
  // 检查是否已有订阅
  const existing = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare('UPDATE push_subscriptions SET subscription = ?, updated_at = ? WHERE user_id = ?')
      .run(JSON.stringify(subscription), new Date().toISOString(), userId);
  } else {
    db.prepare(`
      INSERT INTO push_subscriptions (user_id, subscription, created_at)
      VALUES (?, ?, ?)
    `).run(userId, JSON.stringify(subscription), new Date().toISOString());
  }
  saveDatabase();
}

/**
 * 获取用户的 Push 订阅
 * @param {number} userId
 */
function getSubscription(userId) {
  const db = getDatabase();
  const record = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').get(userId);
  if (record && record.subscription) {
    try {
      return JSON.parse(record.subscription);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * 删除用户的 Push 订阅
 * @param {number} userId
 */
function removeSubscription(userId) {
  const db = getDatabase();
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
  saveDatabase();
}

/**
 * 发送推送通知
 * @param {number} userId
 * @param {string} title — 通知标题
 * @param {string} body — 通知内容
 */
async function sendPushNotification(userId, title, body) {
  try {
    const webpush = require('web-push');
    const subscription = getSubscription(userId);
    
    if (!subscription) {
      return { success: false, error: '用户未订阅推送通知' };
    }
    
    const payload = JSON.stringify({
      title,
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'crop-mature',
      requireInteraction: true,
      data: {
        url: '/'
      }
    });
    
    await webpush.sendNotification(subscription, payload);
    return { success: true };
  } catch (err) {
    // 如果订阅已过期，删除它
    if (err.statusCode === 404 || err.statusCode === 410) {
      removeSubscription(userId);
      console.log(`🗑️ 用户 ${userId} 的推送订阅已过期，已删除`);
      return { success: false, error: '订阅已过期' };
    }
    console.error('发送推送通知失败:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  saveSubscription,
  getSubscription,
  removeSubscription,
  sendPushNotification
};
