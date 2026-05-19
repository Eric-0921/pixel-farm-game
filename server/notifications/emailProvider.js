/**
 * 邮件通知提供者（预留扩展）
 * 
 * 集成说明：
 * 1. 安装 nodemailer: npm install nodemailer
 * 2. 配置 SMTP 服务器信息
 * 3. 通过 notifier.registerProvider('email', emailProvider) 注册
 */

class EmailProvider {
  constructor(config = {}) {
    this.config = config;
    this.enabled = false;
    this.transporter = null;
  }
  
  /**
   * 发送邮件
   * @param {number} userId - 用户ID
   * @param {Object} notification - 通知内容
   */
  async send(userId, notification) {
    if (!this.enabled) {
      console.log('[EmailProvider] 邮件通知未启用，跳过发送');
      return { sent: false, reason: '未启用' };
    }
    
    // TODO: 实现邮件发送逻辑
    // 1. 查询用户邮箱
    // 2. 使用 nodemailer 发送邮件
    // 3. 记录发送结果
    
    console.log(`[EmailProvider] 模拟发送邮件给用户 ${userId}: ${notification.title}`);
    return { sent: true, channel: 'email' };
  }
  
  enable(config) {
    this.config = config;
    this.enabled = true;
    // TODO: 初始化 nodemailer transporter
  }
}

module.exports = new EmailProvider();
