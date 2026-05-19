const pushService = require('../services/pushService');

/**
 * Push 通知提供者
 * 通过 Web Push API 发送浏览器推送通知
 */
class PushProvider {
  async send(userId, notification) {
    const result = await pushService.sendPushNotification(
      userId,
      notification.title,
      notification.content || notification.body
    );
    return result;
  }
}

module.exports = new PushProvider();
