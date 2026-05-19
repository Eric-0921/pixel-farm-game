const { sendToUser } = require('../websocket');
const notificationService = require('../services/notificationService');

/**
 * 应用内通知提供者
 * 通过 WebSocket 实时推送
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
    
    return { notificationId, delivered: sent };
  }
}

module.exports = new InAppProvider();
