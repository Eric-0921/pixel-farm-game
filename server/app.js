const express = require('express');
const path = require('path');
const config = require('./config');
const rateLimit = require('express-rate-limit');

const app = express();

// 安全响应头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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
