/**
 * 短信通知提供者（预留扩展）
 * 
 * 集成说明：
 * 1. 安装短信 SDK（如阿里云短信、腾讯云短信）
 * 2. 在 send 方法中调用 SDK 发送短信
 * 3. 通过 notifier.registerProvider('sms', smsProvider) 注册
 * 
 * 示例（阿里云）：
 * const Core = require('@alicloud/pop-core');
 * const client = new Core({ accessKeyId, accessKeySecret, endpoint, apiVersion });
 */

class SMSProvider {
  constructor(config = {}) {
    this.config = config;
    this.enabled = false;
  }
  
  /**
   * 发送短信
   * @param {number} userId - 用户ID
   * @param {Object} notification - 通知内容
   */
  async send(userId, notification) {
    if (!this.enabled) {
      console.log('[SMSProvider] 短信通知未启用，跳过发送');
      return { sent: false, reason: '未启用' };
    }
    
    // TODO: 实现短信发送逻辑
    // 1. 查询用户手机号
    // 2. 调用短信 SDK 发送
    // 3. 记录发送结果
    
    console.log(`[SMSProvider] 模拟发送短信给用户 ${userId}: ${notification.title}`);
    return { sent: true, channel: 'sms' };
  }
  
  enable(config) {
    this.config = config;
    this.enabled = true;
  }
}

module.exports = new SMSProvider();
