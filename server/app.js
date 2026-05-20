const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('./config');
const rateLimit = require('express-rate-limit');

const app = express();

// 安全响应头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:3000 wss://*;");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 速率限制：登录路由 - 每 IP 每分钟 5 次
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
  skipSuccessfulRequests: false
});

// 速率限制：通用 API 路由 - 每 IP 每分钟 60 次
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '请求过于频繁，请稍后再试' }
});

// 对登录注册路由应用严格限流
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);

// 对其他 API 路由应用通用限流
app.use('/api', apiLimiter);

// 辅助函数：从请求中获取用户ID（优先使用已解析的，其次从JWT头解析）
function getRateLimitKey(req) {
  if (req.userId) return req.userId.toString();
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwtSecret);
      return decoded.userId.toString();
    } catch (e) {
      return 'unauth';
    }
  }
  return 'unauth';
}

// 速率限制：农场操作（种植/浇水/收获）- 每用户每分钟 30 次
const farmActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  message: { success: false, message: '操作过于频繁，请稍后再试' }
});

// 速率限制：签到 - 每用户每天 5 次
const checkinLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  message: { success: false, message: '今日签到次数已达上限' }
});

app.use('/api/farm/', farmActionLimiter);
app.use('/api/checkin', checkinLimiter);

// 静态文件服务（前端）
app.use(express.static(path.join(__dirname, '../client')));

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/farm', require('./routes/farm'));
app.use('/api/crops', require('./routes/crops'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/checkin', require('./routes/checkin'));
app.use('/api/achievements', require('./routes/achievements'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    ...(isDev ? { debug: err.message } : {})
  });
});

module.exports = app;
