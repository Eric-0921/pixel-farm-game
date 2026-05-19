# 像素农场 - 通知系统设计文档

## 1. 系统概述

通知系统负责在特定事件发生时向用户发送提醒。采用**抽象接口 + 多Provider**的架构，便于后续扩展不同的通知渠道。

## 2. 架构设计

```
┌─────────────────────────────────────────────┐
│           通知触发点                         │
│  作物成熟 / 好友请求 / 系统公告              │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│           notifier.js (抽象调度器)           │
│  - 管理所有 Provider                         │
│  - 根据配置选择渠道发送                      │
└────────────────────┬────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
┌────────────┐ ┌──────────┐ ┌──────────┐
│  in_app    │ │   sms    │ │  email   │
│ (已实现)   │ │ (预留)   │ │ (预留)   │
└────────────┘ └──────────┘ └──────────┘
         │           │           │
         ▼           ▼           ▼
    WebSocket    短信SDK      邮件服务
    实时推送     阿里云/腾讯   nodemailer
                 /Twilio
```

## 3. 核心组件

### 3.1 Notifier（调度器）

文件: `server/notifications/notifier.js`

职责:
- 注册/管理 Provider
- 接收发送请求并分发给对应 Provider
- 汇总发送结果

接口:
```javascript
// 注册 Provider
notifier.registerProvider('channelName', providerInstance);

// 发送通知（可指定多个渠道）
await notifier.send(userId, notification, ['in_app', 'sms']);
```

### 3.2 Provider（渠道提供者）

每个 Provider 需实现统一的接口:

```javascript
class BaseProvider {
  /**
   * 发送通知
   * @param {number} userId - 目标用户ID
   * @param {Object} notification - 通知内容
   * @returns {Promise<Object>} 发送结果
   */
  async send(userId, notification) {
    // 实现发送逻辑
  }
}
```

## 4. 已实现的 Provider

### 4.1 InAppProvider（应用内通知）

文件: `server/notifications/inAppProvider.js`

功能:
- 将通知保存到数据库
- 如果用户在线，通过 WebSocket 实时推送
- 如果用户离线，等待下次连接时推送（历史通知）

实现:
```javascript
// 保存到数据库
const notificationId = notificationService.createNotification(...);

// 实时推送
const delivered = sendToUser(userId, {
  type: 'notification',
  notification: { id: notificationId, ... }
});
```

## 5. 预留的 Provider

### 5.1 SMSProvider（短信通知）

文件: `server/notifications/smsProvider.js`

集成方案:
```bash
# 阿里云短信
npm install @alicloud/pop-core

# 或腾讯云短信
npm install tencentcloud-sdk-nodejs
```

启用方式:
```javascript
const smsProvider = require('./notifications/smsProvider');
smsProvider.enable({
  accessKeyId: 'your-key',
  accessKeySecret: 'your-secret',
  signName: '像素农场',
  templateCode: 'SMS_xxx'
});
notifier.registerProvider('sms', smsProvider);
```

### 5.2 EmailProvider（邮件通知）

文件: `server/notifications/emailProvider.js`

集成方案:
```bash
npm install nodemailer
```

启用方式:
```javascript
const emailProvider = require('./notifications/emailProvider');
emailProvider.enable({
  host: 'smtp.example.com',
  port: 587,
  auth: { user: 'xxx', pass: 'xxx' }
});
notifier.registerProvider('email', emailProvider);
```

### 5.3 WeChatProvider（微信通知）

文件: `server/notifications/wechatProvider.js`

集成方案:
- 方案A: 微信公众号模板消息
- 方案B: 微信小程序订阅消息

启用方式:
```javascript
const wechatProvider = require('./notifications/wechatProvider');
wechatProvider.enable({
  appId: 'wx-xxx',
  appSecret: 'xxx',
  templateId: 'xxx'
});
notifier.registerProvider('wechat', wechatProvider);
```

## 6. 通知数据结构

```typescript
interface Notification {
  type: 'crop_mature' | 'friend_request' | 'system';
  title: string;           // 通知标题
  content: string;         // 通知内容
  data?: object;           // 附加数据
}

interface NotificationRecord {
  id: number;
  user_id: number;
  type: string;
  title: string;
  content: string;
  channel: string;         // 发送渠道
  data?: string;           // JSON 字符串
  sent_at: Date;
  read_at?: Date;          // NULL 表示未读
}
```

## 7. 触发场景

### 7.1 作物成熟通知

触发时机: 定时任务检测到作物 growth_progress >= 1.0 且 is_notified = 0

处理流程:
1. 标记种植记录 is_notified = 1
2. 创建通知记录
3. 发送 WebSocket 消息（如果用户在线）
4. （可选）发送短信/邮件/微信

代码位置: `server/jobs/cropGrowthJob.js`

### 7.2 好友请求通知（预留）

触发时机: 用户B收到用户A的好友请求

处理流程:
1. 创建通知记录
2. 如果用户B在线，实时推送
3. （可选）发送短信/邮件

### 7.3 系统公告（预留）

触发时机: 管理员发布系统公告

处理流程:
1. 为所有用户创建通知记录
2. 广播给所有在线用户

## 8. 用户偏好配置（未来）

可扩展的用户通知偏好表:

```sql
CREATE TABLE notification_preferences (
  user_id INTEGER PRIMARY KEY,
  channels TEXT,           -- JSON: ["in_app", "sms"]
  crop_mature INTEGER,     -- 0/1 是否接收作物成熟通知
  friend_request INTEGER,  -- 0/1 是否接收好友请求通知
  quiet_hours_start TEXT,  -- 免打扰开始时间
  quiet_hours_end TEXT     -- 免打扰结束时间
);
```

## 9. 扩展指南

### 添加新的通知渠道

1. 创建 Provider 文件:
```javascript
// server/notifications/myProvider.js
class MyProvider {
  constructor(config) { this.config = config; }
  
  async send(userId, notification) {
    // 实现发送逻辑
    return { sent: true, channel: 'my_channel' };
  }
}

module.exports = new MyProvider();
```

2. 注册 Provider:
```javascript
// server/index.js
const myProvider = require('./notifications/myProvider');
myProvider.enable({ /* config */ });
notifier.registerProvider('my_channel', myProvider);
```

3. 使用新渠道:
```javascript
await notifier.send(userId, notification, ['in_app', 'my_channel']);
```
