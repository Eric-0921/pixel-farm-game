const { sendToUser } = require('../websocket');
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');

/**
 * 应用内通知提供者
 * 通过 WebSocket 实时推送，同时发送 Push 通知
 */
class InAppProvider {
  async send(userId, notification) {
    // 保存到数据库
    const notificationId = await notificationService.createNotification(
      userId,
      notification.type,
      notification.title,
      notification.content,
      'in_app',
      notification.data
    );
    
    // 如果用户在线，实时推送
    const sent = sendToUser(userId, {
      type: 'notification',
      notification: {
        id: notificationId,
        ...notification
      }
    });
    
    // 同时尝试发送 Push 通知（渐进增强，失败不报错）
    let pushResult = null;
    try {
      pushResult = await pushService.sendPushNotification(
        userId,
        notification.title,
        notification.body || notification.content
      );
    } catch (err) {
      // Push 发送失败静默处理
      console.log(`Push 通知发送失败 (用户 ${userId}):`, err.message);
    }
    
    return { notificationId, delivered: sent, push: pushResult };
  }
}

module.exports = new InAppProvider();
