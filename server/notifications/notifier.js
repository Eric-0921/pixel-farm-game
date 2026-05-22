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
  
  /**
   * 作物成熟通知
   * @param {number} userId - 用户ID
   * @param {string} cropName - 作物名称
   * @param {Object} data - 额外数据
   */
  async notifyCropMature(userId, cropName, data = {}) {
    const notification = {
      type: 'crop_mature',
      title: '作物成熟了！',
      content: `你的 ${cropName} 已经成熟，快去收获吧！`,
      body: `您的 ${cropName} 已成熟！快来收获吧 🌾`,
      data
    };
    return this.send(userId, notification, ['in_app']);
  }

  /**
   * 作物低健康度通知
   * @param {number} userId - 用户ID
   * @param {string} cropName - 作物名称
   * @param {Object} data - 额外数据
   */
  async notifyLowHealth(userId, cropName, data = {}) {
    const notification = {
      type: 'low_health',
      title: '作物健康度危急！',
      content: `你的 ${cropName} 健康度很低，请尽快浇水或施肥！`,
      body: `您的 ${cropName} 健康度很低，请尽快照顾它 🌱`,
      data
    };
    return this.send(userId, notification, ['in_app']);
  }
}

// 单例实例
const notifier = new Notifier();

module.exports = notifier;
