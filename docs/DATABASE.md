# 像素农场 - 数据库设计文档

## 数据存储方式

本项目采用**内存数据库 + JSON 文件持久化**方案：
- 运行时所有数据存储在内存中，读写性能高
- 数据变更后自动保存到 `database/farm_game.json`
- 服务启动时从 JSON 文件加载数据

> 生产环境建议迁移到 SQLite/PostgreSQL/MySQL

## 数据表结构

### 1. users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 用户唯一ID |
| username | TEXT UNIQUE | 登录用户名 |
| password_hash | TEXT | bcrypt 哈希后的密码 |
| display_name | TEXT | 显示名称 |
| coins | INTEGER DEFAULT 100 | 金币数量 |
| experience | INTEGER DEFAULT 0 | 经验值 |
| phone | TEXT | 手机号（通知用，可选） |
| email | TEXT | 邮箱（通知用，可选） |
| created_at | DATETIME | 创建时间 |

### 2. farms（农场表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 农场ID |
| user_id | INTEGER FK | 所属用户ID |
| name | TEXT | 农场名称 |
| width | INTEGER DEFAULT 8 | 农场宽度（格数） |
| height | INTEGER DEFAULT 6 | 农场高度（格数） |
| created_at | DATETIME | 创建时间 |

**关系**: 一个用户对应一个农场 (1:1)

### 3. plots（地块表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 地块ID |
| farm_id | INTEGER FK | 所属农场ID |
| x | INTEGER | 横向坐标（0-based） |
| y | INTEGER | 纵向坐标（0-based） |
| status | TEXT | 状态: `empty`/`planted`/`withered` |
| created_at | DATETIME | 创建时间 |

**索引**: (farm_id, x, y) 联合唯一索引

**关系**: 一个农场包含多个地块 (1:N)

### 4. crop_types（作物类型表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 作物类型ID |
| name | TEXT | 作物名称 |
| description | TEXT | 作物描述 |
| growth_time | INTEGER | 生长时间（秒） |
| sell_price | INTEGER | 出售价格（金币） |
| buy_price | INTEGER | 种子价格（金币） |
| color | TEXT | 像素颜色（前端渲染用） |
| stages | INTEGER DEFAULT 4 | 生长阶段数 |

**默认作物数据:**

| 名称 | 生长时间 | 种子价 | 出售价 | 颜色 |
|------|----------|--------|--------|------|
| 小麦 | 60秒 | 10 | 15 | #F4D03F |
| 胡萝卜 | 120秒 | 20 | 30 | #E67E22 |
| 番茄 | 180秒 | 35 | 50 | #E74C3C |
| 玉米 | 300秒 | 50 | 80 | #F1C40F |
| 南瓜 | 600秒 | 90 | 150 | #D35400 |

### 5. plantings（种植记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 记录ID |
| plot_id | INTEGER FK | 种植地块ID |
| crop_type_id | INTEGER FK | 作物类型ID |
| planted_at | DATETIME | 种植时间 |
| watered_at | DATETIME | 最后浇水时间 |
| harvested_at | DATETIME | 收获时间（NULL表示未收获） |
| growth_progress | REAL DEFAULT 0 | 生长进度 (0.0 - 1.0) |
| is_notified | INTEGER DEFAULT 0 | 是否已发送成熟通知 |

**关系**: 
- 一个地块同一时间只能有一条未收获的种植记录
- 种植记录关联作物类型 (N:1)

### 6. friends（好友关系表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 关系ID |
| user_id | INTEGER FK | 发起用户ID |
| friend_id | INTEGER FK | 目标用户ID |
| status | TEXT | 状态: `pending`/`accepted`/`blocked` |
| created_at | DATETIME | 创建时间 |

**索引**: (user_id, friend_id) 联合唯一索引

### 7. notifications（通知记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 通知ID |
| user_id | INTEGER FK | 接收用户ID |
| type | TEXT | 类型: `crop_mature`/`friend_request`/`system` |
| title | TEXT | 通知标题 |
| content | TEXT | 通知内容 |
| channel | TEXT DEFAULT 'in_app' | 通知渠道 |
| data | TEXT | 附加数据（JSON字符串） |
| sent_at | DATETIME | 发送时间 |
| read_at | DATETIME | 读取时间（NULL表示未读） |

## ER 关系图

```
┌─────────┐       ┌─────────┐       ┌─────────┐
│  users  │◄──────┤  farms  │◄──────┤  plots  │
└────┬────┘  1:1  └────┬────┘  1:N  └────┬────┘
     │                 │                 │
     │                 │            ┌────┴────┐
     │                 │            │plantings│
     │                 │            └────┬────┘
     │                 │                 │
     │            ┌────┴────┐            │
     │            │crop_types│◄───────────┘
     │            └─────────┘        N:1
     │
     │       ┌─────────────┐
     └──────►│   friends   │
             └─────────────┘
             
     └──────►│ notifications│
             └─────────────┘
```

## 数据持久化策略

1. **写入时机**: 每次数据变更后立即保存到 JSON 文件
2. **文件位置**: `database/farm_game.json`
3. **加载时机**: 服务启动时自动加载
4. **备份**: 可定期复制 JSON 文件作为备份

## 迁移到关系型数据库

如需迁移到 SQLite/PostgreSQL/MySQL：

1. 替换 `server/database.js` 为真实数据库驱动
2. 使用 `better-sqlite3` / `pg` / `mysql2` 等包
3. 将内存操作替换为 SQL 查询
4. API 层（routes/services）无需修改

示例（SQLite）:
```javascript
const Database = require('better-sqlite3');
const db = new Database('./database/farm_game.db');
// 其余 SQL 操作保持不变
```
