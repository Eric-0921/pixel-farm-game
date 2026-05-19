# 像素农场游戏 - 架构审查报告

> 审查日期: 2026-05-19  
> 审查范围: 完整项目（前后端、文档、配置、数据库）  
> 审查维度: 目录结构、模块依赖、前后端分离、配置管理、单一职责、社交预留、通知系统、状态同步、单点故障、部署运维、文档准确性

---

## 一、总体评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 目录结构 | ⭐⭐⭐⭐☆ (4/5) | 基本清晰，但缺少测试、脚本、日志等目录 |
| 模块依赖 | ⭐⭐⭐☆☆ (3/5) | 存在隐式循环依赖和跨层调用问题 |
| 前后端分离 | ⭐⭐⭐☆☆ (3/5) | 物理分离但部署耦合，后端直接托管前端静态资源 |
| 配置管理 | ⭐⭐☆☆☆ (2/5) | JWT密钥硬编码，环境配置缺失，生产安全隐患大 |
| 单一职责 | ⭐⭐⭐☆☆ (3/5) | 多处职责混杂，尤其是database.js和路由层 |
| 社交预留 | ⭐⭐⭐☆☆ (3/5) | 有基础数据结构和API，但设计深度不足 |
| 通知系统 | ⭐⭐⭐⭐☆ (4/5) | Provider模式设计良好，但调度器未被实际使用 |
| 状态同步 | ⭐⭐⭐☆☆ (3/5) | 双端计算导致一致性风险，同步策略不完善 |
| 可用性/故障 | ⭐⭐☆☆☆ (2/5) | JSON文件数据库是单点，无备份/集群/容灾 |
| 部署运维 | ⭐⭐☆☆☆ (2/5) | 无Docker/CI/监控/日志轮转，运维友好度低 |
| 文档质量 | ⭐⭐⭐☆☆ (3/5) | 结构完整但多处与代码不一致，存在误导 |

**综合评分: 3.0/5.0** —— 适合原型/MVP阶段，距离生产级架构差距明显。

---

## 二、详细问题清单

### 2.1 目录结构

#### ✅ 优点
- 前后端代码物理分离 (`client/` vs `server/`)
- 后端按功能分层：`routes/`、`services/`、`middleware/`、`jobs/`、`notifications/`
- 文档独立存放于 `docs/`，便于维护

#### ❌ 问题

| # | 问题 | 严重程度 | 说明 |
|---|------|----------|------|
| 1.1 | **缺少测试目录** | 🔴 高 | 无 `tests/` 或 `__tests__/` 目录，无任何自动化测试 |
| 1.2 | **缺少脚本目录** | 🟡 中 | 无 `scripts/` 目录，数据库初始化、备份等脚本无处可放 |
| 1.3 | **缺少日志目录** | 🟡 中 | 日志直接输出到控制台，`server.log` 位于根目录无规范 |
| 1.4 | **前端无资源组织** | 🟢 低 | 所有JS平铺在 `client/js/`，无组件/模块/资源分层 |
| 1.5 | **无 CI/CD 配置** | 🟡 中 | 无 `.github/workflows/`、`.gitlab-ci.yml` 等持续集成配置 |

#### 💡 改进建议
```
project-root/
├── client/              # 前端（保持）
├── server/              # 后端（保持）
├── tests/               # 新增：单元测试 + 集成测试 + E2E测试
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/             # 新增：运维脚本
│   ├── db-migrate.js
│   └── backup.js
├── .github/workflows/   # 新增：CI/CD
├── docker/              # 新增：Dockerfile、docker-compose.yml
└── logs/                # 新增：日志目录（gitignore）
```

---

### 2.2 模块间依赖关系

#### ✅ 优点
- 使用了经典的 MVC/分层模式：Route → Service → Database
- 通知系统的 Provider 模式解耦了渠道实现

#### ❌ 问题

| # | 问题 | 严重程度 | 代码位置 | 说明 |
|---|------|----------|----------|------|
| 2.1 | **跨层直接调用 WebSocket** | 🔴 高 | `cropGrowthJob.js:5,85` | 定时任务直接 `require('../websocket')` 调用 `sendToUser`，绕过通知调度器，破坏了通知系统的抽象层 |
| 2.2 | **Service 直接操作 WebSocket** | 🔴 高 | `inAppProvider.js:1` | 应用内通知提供者直接依赖 `websocket.js`，而非通过事件总线或依赖注入 |
| 2.3 | **Database 模块职责过重** | 🔴 高 | `database.js:206-234` | `database.js` 既实现数据访问层（DAL），又包含业务逻辑 `createUserFarm()`，违反单一职责 |
| 2.4 | **隐式循环依赖风险** | 🟡 中 | `database.js:208` | `createUserFarm()` 内部 `require('./config')`，而 `config.js` 若未来引用 database 将产生循环依赖 |
| 2.5 | **全局状态暴露** | 🟡 中 | `database.js:8-17` | `db` 对象直接 `module.exports` 暴露，任何模块都可直接修改内存数据，无访问控制 |
| 2.6 | **路由层直接操作数据库** | 🟡 中 | `auth.js:21-36`, `crops.js:12` | `auth.js` 和 `crops.js` 路由直接调用 `getDatabase()`，未通过 Service 层，破坏分层 |
| 2.7 | **Auth 路由重复认证逻辑** | 🟡 中 | `auth.js:126-156` | `GET /api/auth/me` 在路由内手动解析 JWT，而非复用 `authenticateToken` 中间件 |

#### 💡 改进建议

**2.1 & 2.2: 引入事件总线（Event Bus）**
```javascript
// server/events/index.js
const EventEmitter = require('events');
const eventBus = new EventEmitter();
module.exports = eventBus;

// cropGrowthJob.js — 只发布事件，不关心谁接收
eventBus.emit('crop:matured', { userId, cropName, plotId });

// websocket.js / inAppProvider.js — 订阅事件
eventBus.on('crop:matured', (data) => sendToUser(data.userId, {...}));
```

**2.3: 拆分业务逻辑**
```javascript
// 将 createUserFarm 移到 services/farmService.js 或新建 services/userSetupService.js
// database.js 只负责：连接、查询、持久化
```

**2.5: 封装数据库访问**
```javascript
// 不直接暴露 db 对象，只暴露安全的查询接口
module.exports = { getDatabase, initDatabase, saveDatabase };
// getDatabase 返回的 prepare() 内部操作 db，但外部无法直接访问 db.users.push(...)
```

**2.6: 统一分层规范**
```
严格分层规则：
- routes/    → 只处理 HTTP 请求/响应，不直接调用 database
- services/  → 处理业务逻辑，可调用 database
- middleware/→ 处理横切关注点（认证、日志、错误）
```

---

### 2.3 前后端分离

#### ✅ 优点
- 前端纯静态文件，不依赖后端模板引擎
- 前后端通过 REST API + WebSocket 通信，接口契约清晰

#### ❌ 问题

| # | 问题 | 严重程度 | 代码位置 | 说明 |
|---|------|----------|----------|------|
| 3.1 | **部署耦合** | 🔴 高 | `app.js:12` | `express.static(path.join(__dirname, '../client'))` 使前后端部署强耦合，无法独立部署、独立扩展 |
| 3.2 | **无 API 版本控制** | 🟡 中 | `app.js:15-19` | 所有 API 为 `/api/*`，无版本号（如 `/api/v1/farm`），未来升级困难 |
| 3.3 | **无 CORS 配置** | 🟡 中 | `app.js` | 缺少 CORS 中间件，当前因同域无问题，但前后端分离部署后将无法工作 |
| 3.4 | **前端直接暴露全局变量** | 🟢 低 | `game.js:362-364` | `window.game = game` 等全局变量不利于模块化和测试 |

#### 💡 改进建议
- **分离部署**：前端使用 Nginx / CDN / Vercel 部署，后端只提供 API 服务
- **API 版本化**：
  ```javascript
  app.use('/api/v1/auth', require('./routes/auth'));
  app.use('/api/v1/farm', require('./routes/farm'));
  // 未来可并行维护 v2
  ```
- **添加 CORS**：
  ```javascript
  const cors = require('cors');
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
  ```

---

### 2.4 配置管理

#### ✅ 优点
- 使用独立 `config.js` 文件集中管理配置
- 部分配置支持环境变量覆盖（`PORT`）

#### ❌ 问题

| # | 问题 | 严重程度 | 代码位置 | 说明 |
|---|------|----------|----------|------|
| 4.1 | **JWT 密钥硬编码** | 🔴 高 | `config.js:9` | `jwtSecret: 'pixel-farm-secret-key-2024'` 硬编码在源码中，生产环境极易被泄露，安全风险极高 |
| 4.2 | **无环境配置文件** | 🔴 高 | - | 缺少 `.env` 或 `config/production.js`、`config/development.js` 等多环境配置 |
| 4.3 | **bcrypt 轮次无配置** | 🟡 中 | `auth.js:30` | `bcrypt.hashSync(password, 10)` 写死为 10 轮，应可配置以适应不同环境性能要求 |
| 4.4 | **数据库路径硬编码** | 🟡 中 | `config.js:14`, `database.js:5` | JSON 文件路径 `./database/farm_game.json` 分散在两个文件，未统一管理 |
| 4.5 | **无配置验证** | 🟡 中 | `config.js` | 启动时不验证配置项是否合法（如 jwtSecret 是否为默认弱密钥） |
| 4.6 | **密码最小长度配置缺失** | 🟢 低 | `auth.js:156` | 密码最少 4 位写死在 UI 层，应为全局配置 |

#### 💡 改进建议
```javascript
// config.js 重构示例
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET, // 强制从环境变量读取
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  database: {
    path: process.env.DB_PATH || './database/farm_game.json',
    backupPath: process.env.DB_BACKUP_PATH || './database/backups/'
  },
  // ...
};

// 启动时验证
if (!config.jwtSecret || config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}
if (config.jwtSecret === 'pixel-farm-secret-key-2024') {
  console.warn('WARNING: Using default JWT secret in production!');
}
```

---

### 2.5 单一职责原则（SRP）

#### ❌ 问题

| # | 问题 | 严重程度 | 代码位置 | 说明 |
|---|------|----------|----------|------|
| 5.1 | **database.js 职责混乱** | 🔴 高 | `database.js` | 同时承担：(1)内存数据库实现 (2)SQL解析器 (3)JSON持久化 (4)业务逻辑（createUserFarm）(5)ID序列管理。应拆分为 `dal/`、`persistence/`、`migrations/` |
| 5.2 | **cropGrowthJob 职责过多** | 🔴 高 | `cropGrowthJob.js` | 同时承担：(1)定时调度 (2)生长计算 (3)数据库更新 (4)通知触发 (5)WebSocket推送。应拆分为 `scheduler/` + `calculator/` + `notifier/` |
| 5.3 | **auth 路由混合业务逻辑** | 🟡 中 | `auth.js` | 路由层直接处理密码哈希、JWT签发、用户创建、农场创建，应提取到 `authService.js` |
| 5.4 | **FarmGame 类过于庞大** | 🟡 中 | `game.js` | 前端 `FarmGame` 类同时处理：游戏循环、输入处理、网络请求、粒子效果、状态管理、UI联动。应按功能拆分为 `GameLoop`、`InputManager`、`StateManager` 等 |
| 5.5 | **UIManager 职责过重** | 🟡 中 | `ui.js` | `UIManager` 同时处理：DOM操作、事件绑定、网络请求、认证逻辑、模态框管理、键盘快捷键。应将认证逻辑移到 `AuthManager`，网络请求留在 `network.js` |

#### 💡 改进建议

```
server/
├── dal/                 # 数据访问层（替代 database.js 的查询部分）
│   ├── memoryAdapter.js
│   └── queryBuilder.js
├── persistence/         # 持久化层
│   └── jsonStore.js     # JSON 文件读写
├── domain/              # 领域模型（可选，复杂后引入）
│   ├── Farm.js
│   └── Crop.js
└── services/
    ├── authService.js   # 新增：认证业务逻辑
    └── cropCalculator.js # 新增：生长计算
```

---

### 2.6 社交模块预留设计

#### ✅ 优点
- 已预留 `friends` 表和基础路由
- `GET /api/farm/:userId` 已预留访问他人农场的能力

#### ❌ 问题

| # | 问题 | 严重程度 | 代码位置 | 说明 |
|---|------|----------|----------|------|
| 6.1 | **好友关系查询有缺陷** | 🔴 高 | `friendService.js:9-19` | `getFriends` SQL 使用 `OR` 条件拼接双向关系，但 `SELECT u.id, u.username...` 在两种 OR 条件下可能返回错误用户（当 `f.user_id = ?` 时，`u` 应取 `f.friend_id` 对应的用户） |
| 6.2 | **缺少好友请求通知** | 🔴 高 | `friendService.js` | 发送好友请求后无任何通知机制，接收方无法感知 |
| 6.3 | **无隐私控制** | 🟡 中 | `farm.js:28-38` | `GET /api/farm/:userId` 目前无任何权限检查，任何人可查看任何用户农场 |
| 6.4 | **好友列表无分页** | 🟡 中 | `friendService.js:6` | 无分页/上限控制，用户好友过多时性能问题 |
| 6.5 | **无好友状态（在线/离线）** | 🟡 中 | - | WebSocket `clients` Map 可用于实现在线状态，但未暴露给社交模块 |
| 6.6 | **无黑名单/屏蔽** | 🟢 低 | `DATABASE.md` | `friends.status` 有 `blocked`，但无任何相关 API 实现 |
| 6.7 | **缺少用户搜索** | 🟡 中 | - | 无法通过用户名搜索添加好友，前端好友模态框为空壳 |

#### 💡 改进建议
- **修复好友查询**：
  ```sql
  SELECT u.id, u.username, u.display_name, f.status, f.created_at
  FROM friends f
  JOIN users u ON u.id = CASE 
    WHEN f.user_id = ? THEN f.friend_id 
    ELSE f.user_id 
  END
  WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
  ```
- **添加好友请求通知**：在 `sendFriendRequest` 中触发 `friend:request` 事件，由通知系统处理
- **添加用户搜索 API**：`GET /api/users/search?q=keyword`
- **暴露在线状态**：通过 WebSocket 心跳维护在线状态，提供 `GET /api/friends/online` 接口

---

### 2.7 通知系统扩展性

#### ✅ 优点
- Provider 模式设计良好，新增渠道只需实现 `send()` 方法
- 文档 NOTIFICATION.md 详细描述了扩展方式
- `Notifier` 类支持多渠道并行发送

#### ❌ 问题

| # | 问题 | 严重程度 | 代码位置 | 说明 |
|---|------|----------|----------|------|
| 7.1 | **调度器未被实际使用** | 🔴 高 | `cropGrowthJob.js:75-90` | 作物成熟通知直接调用 `notificationService.createNotification()` + `sendToUser()`，完全绕过了 `notifier.send()` 调度器。`notifier.js` 沦为死代码 |
| 7.2 | **无用户偏好配置** | 🟡 中 | `NOTIFICATION.md:217-228` | 文档中提及但未实现，所有用户强制接收所有通知 |
| 7.3 | **无通知限流/去重** | 🟡 中 | `cropGrowthJob.js` | 同一作物每分钟被重复检查，虽然 `is_notified` 标记可防止重复通知，但无通用限流机制 |
| 7.4 | **无失败重试** | 🟡 中 | `notifier.js:27-47` | 通知发送失败仅记录日志，无重试队列 |
| 7.5 | **离线通知无推送保障** | 🟡 中 | `inAppProvider.js` | 用户离线时通知仅存入数据库，无推送保障机制（如邮件补发） |
| 7.6 | **WebSocket 与 HTTP 通知重复** | 🟡 中 | `cropGrowthJob.js` | 同一次成熟事件同时发 WebSocket 实时消息和创建通知记录，前端可能收到两次提醒 |
| 7.7 | **预留 Provider 为空壳** | 🟢 低 | `smsProvider.js` 等 | 所有预留 Provider 为 0 行有效代码，无接口定义或基类约束 |

#### 💡 改进建议

**7.1: 统一使用调度器**
```javascript
// cropGrowthJob.js — 重构后
const notifier = require('../notifications/notifier');

// 注册时启用所有渠道
// notifier.registerProvider('sms', smsProvider);

// 统一发送
await notifier.send(userId, {
  type: 'crop_mature',
  title: '作物成熟了！',
  content: `你的 ${cropName} 已经成熟...`,
  data: { plot_id: plotId }
}, config.notifications.defaultChannels);
```

**7.4: 引入重试队列（简单版）**
```javascript
// 使用内存队列 + 指数退避
const retryQueue = [];
setInterval(() => {
  const item = retryQueue.shift();
  if (item) notifier.send(item.userId, item.notification, item.channels);
}, 60000);
```

---

### 2.8 游戏状态同步机制

#### ✅ 优点
- 服务端 `farmService.getFarmByUserId()` 实时计算生长进度，保证服务端权威
- 客户端每 5 秒轮询 + WebSocket 实时推送，双通道保障

#### ❌ 问题

| # | 问题 | 严重程度 | 代码位置 | 说明 |
|---|------|----------|----------|------|
| 8.1 | **双端计算导致数据不一致** | 🔴 高 | `game.js:309-328` | 客户端 `update()` 也独立计算生长进度，与服务端算法可能不一致（如服务端修复了 bug，客户端未同步更新） |
| 8.2 | **无服务端权威校验** | 🔴 高 | `farm.js` | 收获时服务端重新计算进度，但种植/浇水操作后客户端立即刷新，可能读取到旧状态 |
| 8.3 | **定时任务计算频率过低** | 🟡 中 | `cropGrowthJob.js:15` | 每分钟执行一次，对于 60 秒成熟的作物，通知延迟可能高达 1 分钟 |
| 8.4 | **无操作乐观锁** | 🟡 中 | `farmService.js` | 并发场景下（用户多端登录），同一地块可能被重复操作，无版本号/时间戳校验 |
| 8.5 | **客户端轮询过于频繁** | 🟢 低 | `game.js:18` | 5 秒轮询一次，用户量大时对服务器造成不必要的压力，可改用 10-15 秒 + WebSocket 事件驱动 |
| 8.6 | **WebSocket 认证简陋** | 🟡 中 | `websocket.js:73-82` | WebSocket 认证仅传递 `userId`，无 JWT 验证，任何知道 userId 的人可伪造连接接收他人通知 |
| 8.7 | **缺少状态快照/回放** | 🟢 低 | - | 无游戏状态快照机制，无法回溯历史状态或处理作弊争议 |

#### 💡 改进建议

**8.1: 客户端只渲染，不计算**
```javascript
// game.js update() 重构：移除生长计算逻辑
update(timestamp) {
  this.updateParticles();
  // 不再计算 growth_progress，完全信任服务端数据
  // 如需平滑动画，使用服务端返回的 planted_at + watered_at 本地推算，
  // 但收获等关键操作必须以服务端校验为准
}
```

**8.4: 添加乐观锁**
```javascript
// 地块表增加 version 字段
// 种植/浇水/收获时传入 version，服务端校验
function harvestCrop(userId, plotId, clientVersion) {
  const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(plotId);
  if (plot.version !== clientVersion) {
    throw new Error('地块状态已变更，请刷新后重试');
  }
  // ... 执行业务逻辑 ...
  db.prepare('UPDATE plots SET status = ?, version = version + 1 WHERE id = ?').run('empty', plotId);
}
```

**8.6: WebSocket JWT 认证**
```javascript
// 连接时通过 query string 或首条消息传递 token
ws.on('message', (message) => {
  const data = JSON.parse(message);
  if (data.type === 'auth') {
    const decoded = jwt.verify(data.token, config.jwtSecret);
    clients.set(decoded.userId, ws);
  }
});
```

---

### 2.9 单点故障

#### ❌ 问题

| # | 问题 | 严重程度 | 说明 |
|---|------|----------|------|
| 9.1 | **JSON 文件数据库是单点** | 🔴 高 | 所有数据存于单一 JSON 文件，文件损坏即全量丢失，无事务、无备份、无恢复机制 |
| 9.2 | **无进程守护** | 🔴 高 | Node.js 单进程运行，未捕获的异常会导致整个服务崩溃，无 PM2/Cluster 守护 |
| 9.3 | **内存数据库容量受限** | 🟡 中 | 所有数据常驻内存，用户量增长后内存占用线性增加，无法水平扩展 |
| 9.4 | **单 WebSocket 服务器** | 🟡 中 | 单机 WebSocket 连接数受限于单台服务器，无法通过负载均衡扩展（WebSocket 有状态） |
| 9.5 | **无健康检查端点** | 🟡 中 | `/api/health` 仅返回静态字符串，不检查数据库、WebSocket、定时任务等依赖健康状态 |
| 9.6 | **无数据备份机制** | 🔴 高 | JSON 文件仅在变更时写入，无定期备份、无异地备份、无快照 |
| 9.7 | **定时任务单点执行** | 🟢 低 | 多实例部署时，每个实例都会执行 `cropGrowthJob`，导致重复通知 |

#### 💡 改进建议

**短期（MVP→内测）**
- 使用 PM2 启动：`pm2 start server/index.js --name farm-api -i 1`
- 添加 JSON 文件定时备份：`node scripts/backup.js`（每小时复制一次）
- 完善健康检查：
  ```javascript
  app.get('/api/health', (req, res) => {
    const dbHealthy = checkDatabase(); // 尝试读写
    const wsHealthy = wss.clients.size >= 0; // WebSocket 服务器存活
    res.status(dbHealthy && wsHealthy ? 200 : 503).json({
      status: dbHealthy && wsHealthy ? 'ok' : 'degraded',
      checks: { database: dbHealthy, websocket: wsHealthy }
    });
  });
  ```

**中期（公测）**
- 迁移到 SQLite/PostgreSQL，获得事务和备份能力
- 使用 Redis 存储 WebSocket 连接映射，支持多实例 + 负载均衡
- 使用 Redis 分布式锁避免定时任务重复执行

**长期（规模化）**
- 引入消息队列（RabbitMQ/Redis Stream）处理通知
- 游戏状态使用事件溯源（Event Sourcing）模式
- 分离读写：API 服务 + 定时任务服务 + WebSocket 服务独立部署

---

### 2.10 部署和运维便利性

#### ❌ 问题

| # | 问题 | 严重程度 | 说明 |
|---|------|----------|------|
| 10.1 | **无 Docker 支持** | 🔴 高 | 无 Dockerfile、docker-compose.yml，环境一致性无法保障 |
| 10.2 | **无进程管理配置** | 🔴 高 | 无 PM2 ecosystem 文件，生产环境无法安全重启、日志切割 |
| 10.3 | **日志仅输出控制台** | 🔴 高 | 无结构化日志（JSON）、无日志级别控制、无日志轮转，无法排查生产问题 |
| 10.4 | **无监控和指标** | 🔴 高 | 无 Prometheus/StatsD 指标暴露，无法监控在线人数、API 延迟、错误率 |
| 10.5 | **缺少 graceful shutdown** | 🟡 中 | `index.js` 无 SIGTERM/SIGINT 处理，进程被kill时可能丢失未保存的 JSON 数据 |
| 10.6 | **playwright 误装为生产依赖** | 🟡 中 | `package.json:25` | Playwright 是 E2E 测试工具，不应在生产依赖中，体积巨大（~100MB+） |
| 10.7 | **无数据库迁移工具** | 🟡 中 | 数据结构变更时无法平滑升级 |
| 10.8 | **npm scripts 不完整** | 🟢 低 | `dev` 和 `start` 完全相同，缺少 `test`、`lint`、`build` 等脚本 |

#### 💡 改进建议

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"
CMD ["node", "server/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./database:/app/database
    restart: unless-stopped
```

```javascript
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    saveDatabase();
    process.exit(0);
  });
});
```

---

### 2.11 文档完整性

#### ✅ 优点
- 5 份文档覆盖架构、API、数据库、游戏设计、通知系统，结构完整
- API 文档包含请求/响应示例，对前端开发者友好
- 扩展指南（添加通知渠道、社交功能、新作物）对后续开发有帮助

#### ❌ 问题

| # | 问题 | 严重程度 | 文档 | 说明 |
|---|------|----------|------|------|
| 11.1 | **README 项目结构与实际不符** | 🟡 中 | `README.md:86-131` | README 列出的目录结构缺少 `server.log`、`request.md` 等实际文件，且 `server/routes/` 下的 `crops.js` 未列出 |
| 11.2 | **API 文档与实际响应不一致** | 🔴 高 | `API.md:24-37` | 注册响应示例中 `displayName` 值为 `" farmer1"`（前导空格），而实际代码无此空格 |
| 11.3 | **API 文档字段命名不一致** | 🟡 中 | `API.md:97-124` | 响应字段为 `user_id`（下划线），而其他接口用 `userId`（驼峰），代码实际也混用两种风格 |
| 11.4 | **API 文档缺少错误响应示例** | 🟡 中 | `API.md:303-318` | 仅列出错误码，无具体错误响应 body 示例 |
| 11.5 | **ARCHITECTURE 图与代码不一致** | 🟡 中 | `ARCHITECTURE.md:31` | 图中列出 `cropService`，实际代码中不存在该 service，只有 `farmService` |
| 11.6 | **DATABASE 字段类型不准确** | 🟢 低 | `DATABASE.md` | 标注为 `INTEGER`/`TEXT`/`DATETIME`，但实际为 JavaScript 对象属性，无类型约束 |
| 11.7 | **GAME_DESIGN 数值与实际不符** | 🟡 中 | `GAME_DESIGN.md:76-83` | 玉米 `stages` 文档写 4，实际代码为 5；南瓜同理 |
| 11.8 | **NOTIFICATION 文档与实现脱节** | 🔴 高 | `NOTIFICATION.md` | 文档描述使用 `notifier.send()` 调度器，但 `cropGrowthJob.js` 完全未调用它 |
| 11.9 | **缺少部署文档** | 🟡 中 | - | 无 DEPLOYMENT.md 或运维手册 |
| 11.10 | **缺少测试文档** | 🟡 中 | - | 无 TESTING.md，新开发者不知如何运行测试 |
| 11.11 | **缺少 CHANGELOG** | 🟢 低 | - | 无版本变更记录 |

#### 💡 改进建议
- 建立文档与代码的同步机制：每次代码变更时检查相关文档
- 使用 API 测试工具（如 Postman/Insomnia）导出并与文档对比
- 添加 `docs/DEPLOYMENT.md` 和 `docs/TESTING.md`
- 引入 Swagger/OpenAPI 自动生成 API 文档，避免人工维护导致的不一致

---

## 三、架构层面的重大改进机会

### 3.1 引入事件驱动架构（EDA）

**现状问题**：模块间直接调用导致紧耦合，尤其是定时任务→WebSocket→通知的调用链。

**改进方案**：
```
┌─────────────────┐     ┌─────────────┐     ┌─────────────────┐
│  HTTP API/Routes │────►│  Event Bus  │◄────│  WebSocket Layer │
└─────────────────┘     └──────┬──────┘     └─────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌─────────┐     ┌──────────┐     ┌───────────┐
        │ Farm    │     │ Notify   │     │ Social    │
        │ Service │     │ Service  │     │ Service   │
        └─────────┘     └──────────┘     └───────────┘
```

所有状态变更通过事件总线广播，各模块订阅感兴趣的事件。新增功能只需新增订阅者，无需修改现有代码。

### 3.2 迁移到关系型数据库

**现状问题**：JSON 文件数据库无法支撑并发、事务、备份、扩容。

**推荐路径**：
```
Phase 1: SQLite（零配置，支持事务，文件存储兼容现有部署习惯）
Phase 2: PostgreSQL（生产级，支持 JSONB 字段、复杂查询、备份）
```

同时引入 ORM（如 Prisma/Sequelize）或 Query Builder（Knex.js），替换手工 SQL 字符串拼接。

### 3.3 分离游戏逻辑服务与网关服务

**现状问题**：HTTP API、WebSocket、定时任务全部运行在同一进程。

**目标架构**：
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  API Gateway │     │  WS Gateway  │     │ Job Worker  │
│  (Express)   │     │  (WebSocket) │     │ (Cron Jobs) │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           ▼
                    ┌─────────────┐
                    │  Redis      │
                    │  (Pub/Sub)  │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │ PostgreSQL  │
                    └─────────────┘
```

- API Gateway：处理 HTTP 请求，无状态，可水平扩展
- WS Gateway：处理 WebSocket 连接，通过 Redis Pub/Sub 广播消息
- Job Worker：执行定时任务，可独立部署多实例（配合分布式锁）

### 3.4 引入领域驱动设计（DDD）

随着社交、交易、排行榜等模块扩展，当前贫血模型将难以维护。

**核心领域**：
- `Farm`（农场）：地块管理、作物状态
- `Crop`（作物）：生长规则、收获规则
- `User`（用户）：金币、经验、等级
- `Friendship`（好友关系）：双向关系、权限
- `Notification`（通知）：渠道、偏好、状态

每个领域封装自己的业务规则（如 `Farm.canPlant(plotId)`、`Crop.calculateProgress()`），避免业务逻辑散落在路由和 Service 中。

---

## 四、优先级改进路线图

| 阶段 | 时间 | 重点任务 | 目标 |
|------|------|----------|------|
| **P0 - 紧急** | 1-2 天 | 修复 JWT 密钥硬编码、修复好友查询 bug、统一使用 notifier 调度器、添加 graceful shutdown | 消除安全和功能缺陷 |
| **P1 - 高优** | 1-2 周 | 拆分 database.js 职责、引入事件总线、添加配置验证、迁移到 SQLite、添加基础测试 | 技术债务清理 |
| **P2 - 中优** | 2-4 周 | 前后端完全分离部署、API 版本化、添加 Docker/Pm2、完善日志和监控、修复文档不一致 | 生产就绪 |
| **P3 - 长期** | 1-3 月 | 服务拆分（API/WS/Job）、引入 Redis、PostgreSQL、DDD 重构、事件溯源 | 支撑规模化 |

---

## 五、总结

像素农场项目作为 MVP/原型，其架构基本满足了核心功能需求，通知系统的 Provider 模式和前后端的分层思路值得肯定。但在**安全性（JWT硬编码）**、**数据持久化（JSON文件）**、**模块耦合（跨层直接调用）**、**生产运维（无Docker/监控）**等方面存在显著差距。

建议优先处理 P0 级别的安全和功能缺陷，然后在进入公测前完成 P1 的技术债务清理。如果项目目标是从原型演进为长期运营的产品，应在早期就规划 P3 的服务拆分和领域模型重构，避免后期重写成本过高。
