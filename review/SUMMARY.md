# 代码审查汇总报告

## 🔴 P0 - 必须立即修复（8项）

### 1. [后端] 数据库 INSERT/UPDATE 逻辑错误
- 位置: server/database.js
- 影响: 用户注册后数据存储格式错误，系统无法正常运行
- 修复: 重写 INSERT/UPDATE 的 prepared statement 逻辑

### 2. [后端] 金币超卖漏洞（竞态条件）
- 位置: server/services/farmService.js plantCrop
- 影响: 并发请求可花超余额
- 修复: 读取和扣款需原子操作

### 3. [后端] WebSocket 零认证
- 位置: server/websocket.js
- 影响: 任意用户可冒充他人接收通知
- 修复: WebSocket 连接需验证 JWT

### 4. [后端] 浇水加速收获时完全失效
- 位置: server/services/farmService.js harvestCrop
- 影响: SQL未SELECT watered_at，浇水对收获无任何效果
- 修复: SQL查询中加上 watered_at 字段

### 5. [前端] XSS 注入漏洞
- 位置: client/js/ui.js renderSeedList / renderNotifList
- 影响: innerHTML 直接插入未转义的服务器数据
- 修复: 使用 textContent 或 DOM API 替代 innerHTML

### 6. [前端] disconnect() 后仍然无限重连
- 位置: client/js/network.js
- 影响: 调用 disconnect() 后 WebSocket 仍在后台重连
- 修复: 添加主动断开标志，阻止 onclose 中的重连

### 7. [前端] Canvas 事件监听器内存泄漏
- 位置: client/js/game.js setupInputListeners
- 影响: 5个监听器从未移除，旧实例持续引用
- 修复: 保存监听器引用，stop() 中移除

### 8. [前端] 未适配高 DPI/Retina 屏幕
- 位置: client/js/renderer.js
- 影响: 320x240 canvas 在高DPI屏幕上极度模糊
- 修复: 使用 devicePixelRatio 缩放 canvas

## 🟠 P1 - 高优先级修复（6项）

### 9. [后端] JWT 密钥硬编码
- 位置: server/config.js
- 修复: 使用环境变量，生产环境强制要求设置

### 10. [后端] 密码哈希同步阻塞
- 位置: server/routes/auth.js
- 修复: 改用 bcrypt.hash / bcrypt.compare 异步版本

### 11. [后端] 无 API 速率限制
- 位置: server/app.js
- 修复: 添加 express-rate-limit

### 12. [后端] 定时任务全表扫描性能问题
- 位置: server/jobs/cropGrowthJob.js
- 修复: 添加索引，只查询需要检查的记录

### 13. [前端] 刷新按钮 then() 无 catch
- 位置: client/js/ui.js btnRefresh
- 修复: 添加 catch 隐藏 loading

### 14. [前端] 触摸事件坐标计算错误
- 位置: client/js/game.js
- 修复: touchend 时重新计算坐标

## 🟡 P2 - 中等优先级（10项）
- 缺少安全响应头 (Helmet)
- 输入验证不完善
- 好友系统 SQL 逻辑缺陷
- CURRENT_TIMESTAMP 内存DB不支持
- 生长进度双重计算不一致
- 自动刷新无页面可见性管理
- 登录/注册按钮无 loading 状态
- 键盘快捷键未过滤 TEXTAREA
- 未处理 uncaughtException/unhandledRejection
- 缺少 404 路由

## 🟢 P3 - 低优先级/优化（8项）
- CSS transition: all 性能问题
- viewport 禁用缩放违反 WCAG
- 弹窗可用原生 dialog 元素
- 预渲染草地背景优化
- 添加 prefers-reduced-motion
- 缺少 Docker/PM2/监控
- 文档与代码不一致
- 无 CI/CD
