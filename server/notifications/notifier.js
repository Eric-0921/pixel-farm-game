/**
 * 通知抽象接口
 * 所有通知渠道提供者需实现 send(userId, notification) 方法
 */

class Notifier {
  constructor() {
    this.providers = new Map();
  }
  
  /**
   * 注册通知渠道
   * @param {string} name - 渠道名称
   * @param {Object} provider - 提供者实例
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
    console.log(`📨 通知渠道已注册: ${name}`);
  }
  
  /**
   * 发送通知
   * @param {number} userId - 用户ID
   * @param {Object} notification - 通知内容
   * @param {string[]} channels - 渠道列表
   */
  async send(userId, notification, channels = ['in_app']) {
    const results = [];
    
    for (const channel of channels) {
      const provider = this.providers.get(channel);
      if (provider) {
        try {
          const result = await provider.send(userId, notification);
          results.push({ channel, success: true, result });
        } catch (err) {
          console.error(`通知发送失败 [${channel}]:`, err);
          results.push({ channel, success: false, error: err.message });
        }
      } else {
        console.warn(`通知渠道未配置: ${channel}`);
        results.push({ channel, success: false, error: '渠道未配置' });
      }
    }
    
    return results;
  }
}

// 单例实例
const notifier = new Notifier();

module.exports = notifier;
