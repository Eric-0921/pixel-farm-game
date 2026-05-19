# 像素农场游戏后端代码审查报告

## 审查概览

| 维度 | 问题数量 | 严重程度 |
|------|---------|---------|
| 安全漏洞 | 7 | 🔴 严重 |
| 功能缺陷/逻辑错误 | 9 | 🔴 严重 |
| 并发/竞态条件 | 5 | 🟠 高 |
| 性能问题 | 4 | 🟡 中 |
| 错误处理缺失 | 5 | 🟡 中 |
| 代码规范/可维护性 | 4 | 🟢 低 |

---

## 一、安全漏洞 🔴

### 1.1 JWT 密钥硬编码且强度不足

**文件**: `server/config.js:9`

**问题**: JWT 密钥存在硬编码回退值，如果未设置环境变量 `JWT_SECRET`，将使用弱密钥 `pixel-farm-secret-key-2024`，攻击者极易伪造 Token。

```javascript
// 存在问题的代码
jwtSecret: process.env.JWT_SECRET || 'pixel-farm-secret-key-2024',
jwtExpiresIn: '7d',  // 7天过长
```

**修复建议**:
```javascript
// server/config.js
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('FATAL: JWT_SECRET 环境变量未设置');
  process.exit(1);
}

module.exports = {
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h', // 缩短默认过期时间
  // ...
};
```

---

### 1.2 WebSocket 认证缺失 — 任意用户可冒充

**文件**: `server/websocket.js:73-82`

**问题**: WebSocket 的 `auth` 消息处理仅检查 `data.userId` 是否存在，完全不验证 JWT Token。攻击者可以构造 `{ type: 'auth', userId: 1 }` 冒充任意用户接收通知。

```javascript
// 存在问题的代码
case 'auth':
  if (data.userId) {
    clients.set(data.userId, ws);  // 任何人都能设置任意 userId
    ws.userId = data.userId;
    ws.send(JSON.stringify({ type: 'auth_success', userId: data.userId }));
  }
  break;
```

**修复建议**:
```javascript
const jwt = require('jsonwebtoken');
const config = require('./config');

case 'auth':
  if (data.token) {
    try {
      const decoded = jwt.verify(data.token, config.jwtSecret);
      clients.set(decoded.userId, ws);
      ws.userId = decoded.userId;
      ws.send(JSON.stringify({ type: 'auth_success', userId: decoded.userId }));
    } catch (err) {
      ws.send(JSON.stringify({ type: 'auth_failed', message: 'Invalid token' }));
      ws.terminate();
    }
  }
  break;
```

---

### 1.3 密码哈希使用同步方法阻塞事件循环

**文件**: `server/routes/auth.js:30`, `server/routes/auth.js:90`

**问题**: 使用 `bcrypt.hashSync` 和 `bcrypt.compareSync` 在注册/登录时会阻塞 Node.js 事件循环，在高并发场景下会导致服务器无响应。应使用异步版本。

```javascript
// 存在问题的代码
const passwordHash = bcrypt.hashSync(password, 10);
const validPassword = bcrypt.compareSync(password, user.password_hash);
```

**修复建议**:
```javascript
// 注册时
const passwordHash = await bcrypt.hash(password, 12); // 提升到12轮

// 登录时
const validPassword = await bcrypt.compare(password, user.password_hash);
```

同时需将路由处理器改为 `async`:
```javascript
router.post('/register', async (req, res) => {
  try {
    // ...
    const passwordHash = await bcrypt.hash(password, 12);
    // ...
  } catch (err) {
    // ...
  }
});
```

---

### 1.4 缺少请求速率限制 — 易受暴力破解和 DoS

**文件**: `server/app.js`, `server/routes/auth.js`

**问题**: 没有任何 API 速率限制中间件，攻击者可以：
- 暴力破解用户名密码
- 高频注册消耗服务器资源
- 对 WebSocket 发送大量消息

**修复建议**:
```bash
npm install express-rate-limit
```

```javascript
// server/app.js
const rateLimit = require('express-rate-limit');

// 全局限制
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: '请求过于频繁，请稍后再试' }
});
app.use('/api/', globalLimiter);

// 认证接口更严格的限制
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

---

### 1.5 `/api/auth/me` 未使用认证中间件，重复验证逻辑

**文件**: `server/routes/auth.js:126-156`

**问题**: `/api/auth/me` 直接在路由内处理 JWT 验证，而非复用 `authenticateToken` 中间件，违反 DRY 原则且容易出错。JWT 验证失败返回 403（应该是 401）。

**修复建议**:
```javascript
const { authenticateToken } = require('../middleware/auth');

router.get('/me', authenticateToken, (req, res) => {
  const db = getDatabase();
  const user = db.prepare('SELECT id, username, display_name, coins, experience FROM users WHERE id = ?').get(req.userId);
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }
  res.json({ success: true, data: { /* ... */ } });
});
```

---

### 1.6 未验证输入类型和范围

**文件**: `server/routes/farm.js:30,53,74,95`, `server/routes/friends.js:28,42`

**问题**: `parseInt()` 可能返回 `NaN`，且负数、0、超大数值均未被过滤，可能导致数据库查询异常或 DoS。

```javascript
// 存在问题的代码
const targetUserId = parseInt(req.params.userId); // NaN 未检查
const result = farmService.plantCrop(req.userId, parseInt(plotId), parseInt(cropTypeId)); // 未验证
```

**修复建议**:
```javascript
function validatePositiveInt(value, name) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${name} 必须是正整数`);
  }
  return num;
}

// 路由中使用
try {
  const targetUserId = validatePositiveInt(req.params.userId, 'userId');
  // ...
}
```

---

### 1.7 未设置安全响应头

**文件**: `server/app.js`

**问题**: 缺少 Helmet 等安全中间件，未设置 `X-Content-Type-Options`、`X-Frame-Options`、`Content-Security-Policy` 等响应头。

**修复建议**:
```bash
npm install helmet cors
```

```javascript
const helmet = require('helmet');
const cors = require('cors');

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || false, credentials: true }));
```

---

## 二、功能缺陷 / 逻辑错误 🔴

### 2.1 内存数据库 INSERT 逻辑严重错误

**文件**: `server/database.js:143-156`

**问题**: INSERT 处理器从 `params` 中取出最后一个参数作为 `record`，但 INSERT VALUES 调用传的是标量值而非对象，导致 `record` 为标量值，`record.id` 设置不会生效。而且 `db[table].push(record)` 会把标量推入数组，数据结构被破坏。

```javascript
// 存在问题的代码
run(...params) {
  const record = params[params.length - 1] || {}; // 标量值如 "alice", "$2a$12$..."
  if (typeof record === 'object' && !record.id) {
    record.id = nextId(table);
  }
  db[table].push(record); // 推入字符串/数字！
  save();
  return { lastInsertRowid: record.id, changes: 1 };
}
```

**实际影响**: `users` 表最终存储的是 `['alice', '$2a$12$...', 'Alice', 100]` 而非对象，后续所有查询都会失败。

**修复建议**:
```javascript
run(...params) {
  const record = {};
  // 解析 SQL 获取字段名
  const columnsMatch = sql.match(/\(([^)]+)\)/);
  if (columnsMatch) {
    const columns = columnsMatch[1].split(',').map(c => c.trim());
    columns.forEach((col, idx) => {
      record[col] = params[idx];
    });
  }
  record.id = nextId(table);
  db[table].push(record);
  save();
  return { lastInsertRowid: record.id, changes: 1 };
}
```

---

### 2.2 内存数据库 UPDATE 参数解析逻辑错误

**文件**: `server/database.js:159-194`

**问题**:
1. `params.find(p => typeof p === 'number')` 在多个数字参数时可能匹配到错误的值（SET 字段值而非 WHERE id）。
2. `paramIdx` 从 0 开始，但 `params` 数组中 WHERE 条件的参数也在末尾，SET 参数索引可能错位。
3. `split('=')` 不处理 SQL 中的空格，可能导致 key 包含多余空格。

```javascript
// 存在问题的代码
if (s.includes('where id = ?')) {
  const id = params.find(p => typeof p === 'number'); // BUG: 可能匹配 SET 中的数字
  // ...
  sets.forEach(set => {
    const [key] = set.split('=').map(x => x.trim());
    if (params[paramIdx] !== undefined && typeof params[paramIdx] !== 'object') {
      record[key] = params[paramIdx];
    }
    paramIdx++;
  });
}
```

**修复建议**:
```javascript
run(...params) {
  if (!db[table]) return { changes: 0 };
  let count = 0;

  if (s.includes('where id = ?')) {
    const id = params[params.length - 1]; // WHERE 条件通常是最后一个参数
    const record = findOne(db[table], r => r.id === id);
    if (record) {
      const setMatch = sql.match(/set\s+(.+?)\s+where/i);
      if (setMatch) {
        const sets = setMatch[1].split(',').map(x => x.trim());
        sets.forEach((set, idx) => {
          const key = set.split(/\s*=\s*/)[0].trim();
          if (params[idx] !== undefined) {
            record[key] = params[idx];
          }
        });
        count = 1;
      }
    }
  }

  if (count > 0) save();
  return { changes: count };
}
```

---

### 2.3 好友请求接受后只创建单向关系

**文件**: `server/services/friendService.js:47-60`

**问题**: `acceptFriendRequest` 只将请求方的记录状态改为 `accepted`，没有创建被请求方指向请求方的反向记录。这导致 `getFriends` 查询时，如果查询方向与 `sendFriendRequest` 方向相反，会查不到好友。

**修复建议**:
```javascript
function acceptFriendRequest(userId, friendId) {
  const db = getDatabase();

  const request = db.prepare(`
    SELECT * FROM friends 
    WHERE user_id = ? AND friend_id = ? AND status = 'pending'
  `).get(friendId, userId);

  if (!request) {
    throw new Error('好友请求不存在');
  }

  db.prepare("UPDATE friends SET status = 'accepted' WHERE id = ?").run(request.id);

  // 创建反向关系
  const reverse = db.prepare(`
    SELECT * FROM friends WHERE user_id = ? AND friend_id = ?
  `).get(userId, friendId);

  if (!reverse) {
    db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)')
      .run(userId, friendId, 'accepted');
  }
}
```

---

### 2.4 内存数据库不支持 CURRENT_TIMESTAMP

**文件**: `server/services/notificationService.js:42,50`

**问题**: `markAsRead` 和 `markAllAsRead` 使用 `CURRENT_TIMESTAMP`，但内存数据库的 UPDATE 解析器仅支持简单的字段赋值，不支持 SQL 函数。这将导致 `read_at` 被设置为字符串 `"CURRENT_TIMESTAMP"` 或解析失败。

**修复建议**:
```javascript
// notificationService.js
function markAsRead(userId, notificationId) {
  const db = getDatabase();
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(notificationId, userId);
  if (!notification) {
    throw new Error('通知不存在');
  }
  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ?').run(new Date().toISOString(), notificationId);
}

function markAllAsRead(userId) {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now, userId);
}
```

---

### 2.5 作物生长进度重复计算不一致

**文件**: `server/services/farmService.js:54-82`, `server/jobs/cropGrowthJob.js:49-65`

**问题**: `farmService.getFarmByUserId()` 和 `cropGrowthJob.checkCropGrowth()` 分别独立计算生长进度，且 `cropGrowthJob` 会将计算结果写回数据库的 `growth_progress` 字段，而 `farmService` 又实时重新计算。这可能导致：
- 客户端看到的数据与定时任务写入的数据不一致
- `cropGrowthJob` 更新 `growth_progress` 对 `farmService` 的实时计算毫无影响（被覆盖）

**修复建议**: 统一进度计算逻辑到一个工具函数，且 `farmService` 优先使用数据库中已保存的 `growth_progress`，只在获取时才做增量微调。

```javascript
// server/utils/growthCalculator.js
function calculateGrowthProgress(planting, now = Date.now()) {
  const plantedTime = new Date(planting.planted_at).getTime();
  const elapsed = (now - plantedTime) / 1000;
  let boost = 1.0;
  if (planting.watered_at) {
    const wateredTime = new Date(planting.watered_at).getTime();
    const waterAge = (now - wateredTime) / 1000;
    if (waterAge < config.game.waterEffectDuration) {
      boost = config.game.waterBoostMultiplier;
    }
  }
  return Math.min(1.0, (elapsed * boost) / planting.growth_time);
}
```

---

### 2.6 `/api/farm/:userId` 未验证好友关系

**文件**: `server/routes/farm.js:28-38`

**问题**: 虽然代码中有 TODO 注释，但当前任何认证用户都可以通过 userId 查看任何其他用户的农场数据，存在隐私泄露。

**修复建议**:
```javascript
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const targetUserId = validatePositiveInt(req.params.userId, 'userId');

    // 检查是否为本人或好友
    if (targetUserId !== req.userId) {
      const areFriends = friendService.areFriends(req.userId, targetUserId);
      if (!areFriends) {
        return res.status(403).json({ success: false, message: '无权查看该农场' });
      }
    }

    const farm = farmService.getFarmByUserId(targetUserId);
    res.json({ success: true, data: farm });
  } catch (err) {
    // ...
  }
});
```

---

### 2.7 `notificationService.createNotification` 未 await 异步存储

**文件**: `server/notifications/inAppProvider.js:9-18`

**问题**: `notificationService.createNotification` 是同步函数（当前实现），但 `InAppProvider.send` 标记为 `async` 且调用时未使用 `await`。如果未来 `createNotification` 改为异步（如真实数据库），通知可能在发送 WebSocket 消息前未完成存储。

**修复建议**:
```javascript
async send(userId, notification) {
  const notificationId = await notificationService.createNotification(
    userId,
    notification.type,
    notification.title,
    notification.content,
    'in_app',
    notification.data
  );
  // ...
}
```

---

### 2.8 通知路由缺少 `markAllAsRead` 接口

**文件**: `server/routes/notifications.js`

**问题**: `notificationService` 已实现了 `markAllAsRead`，但路由层没有暴露该 API。

**修复建议**:
```javascript
router.post('/read-all', authenticateToken, (req, res) => {
  try {
    notificationService.markAllAsRead(req.userId);
    res.json({ success: true, message: '全部标记为已读' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
```

---

### 2.9 `plantCrop` 和 `harvestCrop` 中 `plot` 查询未包含 `watered_at`

**文件**: `server/services/farmService.js:93-136`, `server/services/farmService.js:172-228`

**问题**: `plantCrop` 查询的 plot 不包含 `watered_at`，但这不是 bug（种植时地块为空）。`harvestCrop` 的查询包含 `pl.watered_at` 了吗？检查 SQL：

```sql
SELECT p.*, f.user_id, pl.id as planting_id, pl.crop_type_id, pl.growth_progress, pl.planted_at,
       ct.growth_time, ct.sell_price, ct.name as crop_name
```

`pl.watered_at` 没有在 SELECT 中列出！但代码第 198 行使用了 `plot.watered_at`，这会永远为 `undefined`，导致浇水加速效果在收获时**完全失效**。

**修复建议**:
```sql
SELECT p.*, f.user_id, pl.id as planting_id, pl.crop_type_id, pl.growth_progress, pl.planted_at,
       pl.watered_at, ct.growth_time, ct.sell_price, ct.name as crop_name
```

---

## 三、并发 / 竞态条件 🟠

### 3.1 金币扣除无原子性保护 — 超卖漏洞

**文件**: `server/services/farmService.js:118-136`

**问题**: `plantCrop` 中读取用户金币、扣除金币、创建种植记录是三个独立操作，无事务保护。并发请求下，用户可能花费超过实际拥有的金币。

**场景**:
1. 用户有 100 金币，作物价格 60
2. 请求 A 读取金币 100，请求 B 也读取金币 100
3. A 扣除 60 剩 40，B 扣除 60 剩 40
4. 用户实际花费 120，但只有 100

**修复建议**:
```javascript
function plantCrop(userId, plotId, cropTypeId) {
  const db = getDatabase();

  // 原子性检查：先扣除金币，再检查是否为负
  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  if (!user || user.coins < cropType.buy_price) {
    throw new Error('金币不足');
  }

  // 由于内存数据库无真实事务，使用乐观锁模式
  const newCoins = user.coins - cropType.buy_price;
  const result = db.prepare('UPDATE users SET coins = ? WHERE id = ? AND coins = ?')
    .run(newCoins, userId, user.coins);

  if (result.changes === 0) {
    throw new Error('操作冲突，请重试');
  }

  // 继续创建种植记录...
}
```

更完善的方案是引入内存锁或使用真实的数据库事务（SQLite/PostgreSQL）。

---

### 3.2 同一地块并发种植/收获竞争

**文件**: `server/services/farmService.js:93-136`

**问题**: `plantCrop` 检查 `plot.status !== 'empty'` 后，再进行种植。并发时两个请求可能同时通过检查，导致同一地块被种植两次。

**修复建议**:
```javascript
function plantCrop(userId, plotId, cropTypeId) {
  const db = getDatabase();

  // 查询并锁定地块状态（乐观锁）
  const plot = db.prepare('SELECT p.*, f.user_id FROM plots p JOIN farms f ON p.farm_id = f.id WHERE p.id = ?').get(plotId);
  if (!plot || plot.user_id !== userId) {
    throw new Error('无权操作该地块');
  }
  if (plot.status !== 'empty') {
    throw new Error('该地块已被占用');
  }

  // 使用状态转换作为原子条件
  const updateResult = db.prepare("UPDATE plots SET status = 'planted' WHERE id = ? AND status = 'empty'").run(plotId);
  if (updateResult.changes === 0) {
    throw new Error('该地块状态已变更，请刷新后重试');
  }

  // 创建种植记录...
}
```

---

### 3.3 并发创建多个农场

**文件**: `server/services/farmService.js:7-27`

**问题**: `getFarmByUserId` 在发现用户没有农场时自动创建，并发调用可能导致一个用户拥有多个农场。

**修复建议**:
```javascript
function getFarmByUserId(userId) {
  const db = getDatabase();

  const farm = db.prepare('SELECT * FROM farms WHERE user_id = ?').get(userId);
  if (farm) return farm;

  // 双重检查
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('用户不存在');

  // 再次检查农场（防止并发）
  const farmAgain = db.prepare('SELECT * FROM farms WHERE user_id = ?').get(userId);
  if (farmAgain) return farmAgain;

  createUserFarm(userId);
  return db.prepare('SELECT * FROM farms WHERE user_id = ?').get(userId);
}
```

---

### 3.4 `nextId` 并发可能产生重复 ID

**文件**: `server/database.js:38-42`

**问题**: `nextId` 不是原子操作，并发调用时可能为不同记录分配相同 ID。

```javascript
function nextId(table) {
  const id = db._seq[table] || 1;
  db._seq[table] = id + 1;
  return id;
}
```

**修复建议**:
```javascript
function nextId(table) {
  const id = db._seq[table] || 1;
  db._seq[table] = id + 1;
  return id;
}
// 由于 Node.js 单线程，这个问题在纯同步代码中其实不会发生
// 但如果 future 引入 async/await（如真实 I/O），则需要原子操作
```

> **备注**: 当前纯同步实现中，由于 Node.js 事件循环单线程，此问题实际上不会发生。但如果将 `save()` 改为异步写入，则会出现竞态。

---

### 3.5 定时任务与 API 请求同时更新 plantings

**文件**: `server/jobs/cropGrowthJob.js:67`, `server/services/farmService.js:213`

**问题**: `cropGrowthJob` 每分钟批量更新所有 `plantings` 的 `growth_progress`，而 `harvestCrop` 同时更新 `harvested_at` 和 `growth_progress`。并发时可能导致数据覆盖。

**修复建议**: 在 harvest 时避免更新 `growth_progress`（因为即将被收获），或确保 harvest 的 UPDATE 只更新 `harvested_at`。

```javascript
// harvestCrop 中
// 不要同时更新 growth_progress
db.prepare('UPDATE plantings SET harvested_at = ? WHERE id = ?').run(now, plot.planting_id);
```

---

## 四、性能问题 🟡

### 4.1 `save()` 每次操作都同步写盘

**文件**: `server/database.js:19-25`

**问题**: 每次 INSERT/UPDATE 都触发 `writeFileSync`，高频操作下 I/O 成为瓶颈，且 `fs.writeFileSync` 不是原子操作，崩溃时可能损坏 JSON 文件。

**修复建议**:
```javascript
// 使用防抖批量写入
let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmpFile = DB_FILE + '.tmp';
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
      fs.renameSync(tmpFile, DB_FILE); // 原子替换
    } catch (e) {
      console.error('save error:', e);
    }
  }, 100);
}
```

---

### 4.2 定时任务每分钟全表扫描

**文件**: `server/jobs/cropGrowthJob.js:29-47`

**问题**: 每分钟查询所有未收获的种植记录，随着数据量增长，性能线性下降。

**修复建议**: 
- 为 `plantings` 添加索引（在真实数据库中）
- 只查询 `planted_at` 在一定时间窗口内的记录（排除刚种下的）
- 或按用户分批处理

```sql
-- 只查询可能接近成熟的记录
WHERE pl.harvested_at IS NULL 
  AND datetime(pl.planted_at, '+' || ct.growth_time || ' seconds') <= datetime('now', '+5 minutes')
```

---

### 4.3 WebSocket `broadcast` 遍历所有客户端

**文件**: `server/websocket.js:108-114`

**问题**: `clients` Map 存储所有在线用户，`broadcast` 时遍历全部。用户量增大时可能成为瓶颈。且同一用户多设备登录会被覆盖。

**修复建议**:
```javascript
// 支持多设备
const clients = new Map(); // userId -> Set<ws>

function addClient(userId, ws) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);
}

function sendToUser(userId, message) {
  const userClients = clients.get(userId);
  if (!userClients) return false;
  let sent = false;
  userClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      sent = true;
    }
  });
  return sent;
}
```

---

### 4.4 `farmService.getFarmByUserId` 递归调用无深度限制

**文件**: `server/services/farmService.js:18-27`

**问题**: 虽然递归深度最多为 1（因为第二次查询一定能找到刚创建的农场），但如果 `createUserFarm` 失败（如 bug 导致农场未创建），将陷入无限递归直到栈溢出。

**修复建议**:
```javascript
function getFarmByUserId(userId, depth = 0) {
  if (depth > 2) throw new Error('获取农场数据失败，请联系管理员');
  // ...
  createUserFarm(userId);
  return getFarmByUserId(userId, depth + 1);
}
```

---

## 五、错误处理缺失 🟡

### 5.1 未处理未捕获的异常和 Promise 拒绝

**文件**: `server/index.js`

**问题**: 缺少 `uncaughtException` 和 `unhandledRejection` 处理器，任何未捕获的错误会导致进程崩溃。

**修复建议**:
```javascript
// server/index.js
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  // 记录后优雅退出
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  // 不直接退出，仅记录
});
```

---

### 5.2 WebSocket `send` 未捕获异常

**文件**: `server/websocket.js:96-103`

**问题**: `ws.send()` 可能在连接异常时抛出错误，未使用 try-catch。

**修复建议**:
```javascript
function sendToUser(userId, message) {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error(`发送消息给用户 ${userId} 失败:`, err);
      clients.delete(userId);
    }
  }
  return false;
}
```

---

### 5.3 数据库 `load()` 失败时静默忽略

**文件**: `server/database.js:27-36`

**问题**: `load()` 失败时仅打印错误并返回 false，可能导致数据丢失而不被察觉。

**修复建议**:
```javascript
function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // 验证数据结构完整性
      if (!data.users || !Array.isArray(data.users)) {
        throw new Error('数据库文件格式异常');
      }
      Object.assign(db, data);
      return true;
    }
  } catch (e) {
    console.error('数据库加载失败:', e);
    // 备份损坏的文件
    if (fs.existsSync(DB_FILE)) {
      const backup = DB_FILE + '.corrupted.' + Date.now();
      fs.copyFileSync(DB_FILE, backup);
      console.error(`已备份损坏的数据库到: ${backup}`);
    }
  }
  return false;
}
```

---

### 5.4 `app.js` 缺少 404 处理

**文件**: `server/app.js`

**问题**: 未匹配的 API 路由会返回 Express 默认的 HTML 404 页面，而非 JSON 响应。

**修复建议**:
```javascript
// 放在所有路由之后，错误处理中间件之前
app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});
```

---

### 5.5 `cropGrowthJob` 中 `notificationService.createNotification` 未捕获异常

**文件**: `server/jobs/cropGrowthJob.js:75-82`

**问题**: `notificationService.createNotification` 可能抛出异常（如 database bug），导致整个定时任务中断，后续作物不再检查。

**修复建议**:
```javascript
for (const planting of plantings) {
  try {
    // 计算进度...
    if (progress >= 1.0 && !planting.is_notified) {
      // ...
      try {
        notificationService.createNotification(...);
      } catch (notifyErr) {
        console.error('创建通知失败:', notifyErr);
        // 继续处理下一个作物，不中断任务
      }
      // ...
    }
  } catch (err) {
    console.error(`处理作物 ${planting.id} 失败:`, err);
  }
}
```

---

## 六、代码规范 / 可维护性 🟢

### 6.1 `Object.assign(db, data)` 会覆盖运行时状态

**文件**: `server/database.js:31`

**问题**: 加载时 `Object.assign(db, data)` 会覆盖 `db` 上的所有属性，如果运行时新增了字段但 JSON 中没有，会被删除。

**修复建议**:
```javascript
function load() {
  if (fs.existsSync(DB_FILE)) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // 只合并已知表，不覆盖整个对象
    Object.keys(db).forEach(key => {
      if (data[key] !== undefined) {
        db[key] = data[key];
      }
    });
    // 恢复序列号
    if (data._seq) db._seq = data._seq;
    return true;
  }
  return false;
}
```

---

### 6.2 SQL 解析仅支持小写

**文件**: `server/database.js:72`

**问题**: `sql.toLowerCase()` 后匹配，但如果 SQL 中有大写字符串值（如 `WHERE name = 'UPPER'`)，不影响功能。真正的问题是复杂 SQL 中的注释、换行等可能导致匹配失败。

---

### 6.3 `db` 对象直接导出，可被外部修改

**文件**: `server/database.js:240`

**问题**: `module.exports = { ..., db, ... }` 导出了内部数据库对象，任何模块都可以直接修改 `db.users` 等，破坏封装。

**修复建议**: 不要导出 `db`，或导出深拷贝只读版本。

---

### 6.4 `package.json` 依赖未锁定

**项目级问题**: 缺少 `package-lock.json` 或 `yarn.lock`，生产环境依赖版本可能不一致。

---

## 七、修复优先级总结

| 优先级 | 问题 | 影响 |
|-------|------|------|
| P0 | 数据库 INSERT/UPDATE 逻辑错误 (2.1, 2.2) | 系统完全无法正常工作 |
| P0 | WebSocket 无认证 (1.2) | 任意用户冒充 |
| P0 | 金币超卖漏洞 (3.1) | 经济系统崩溃 |
| P1 | JWT 硬编码密钥 (1.1) | Token 可被伪造 |
| P1 | 密码哈希同步阻塞 (1.3) | DoS 风险 |
| P1 | 浇水加速收获时失效 (2.9) | 游戏逻辑错误 |
| P1 | 未处理未捕获异常 (5.1) | 进程崩溃 |
| P2 | 缺少速率限制 (1.4) | 暴力破解/DoS |
| P2 | 好友关系单向 (2.3) | 社交功能异常 |
| P2 | CURRENT_TIMESTAMP 不工作 (2.4) | 通知系统异常 |
| P2 | 数据库写入非原子 (4.1) | 数据损坏风险 |
| P3 | 缺少安全头 (1.7) | XSS/点击劫持风险 |
| P3 | 404 未处理 (5.4) | API 体验差 |

---

*审查完成时间: 2026-05-19*
*审查范围: server/ 目录下所有后端代码*
