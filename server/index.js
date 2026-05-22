const http = require('http');
const app = require('./app');
const config = require('./config');
const { initDatabase } = require('./database');
const { initWebSocketServer } = require('./websocket');
const { startCropGrowthJob } = require('./jobs/cropGrowthJob');
const notifier = require('./notifications/notifier');
const inAppProvider = require('./notifications/inAppProvider');
const { seedDemoData } = require('./scripts/seed-demo');

// 初始化数据库
initDatabase();

// 注册应用内通知渠道（已集成 Push 发送）
notifier.registerProvider('in_app', inAppProvider);

// 创建 HTTP 服务器
const server = http.createServer(app);

// 初始化 WebSocket
initWebSocketServer(server);

// 启动定时任务
startCropGrowthJob();

// 启动服务器
server.listen(config.port, async () => {
  console.log(`\n🎮 像素农场游戏服务器已启动`);
  console.log(`📍 HTTP 服务: http://localhost:${config.port}`);
  console.log(`🔌 WebSocket: ws://localhost:${config.port}`);
  console.log(`📚 API 文档: http://localhost:${config.port}/api/health\n`);

  // 开发/Demo 模式下自动创建演示数据
  if (process.env.NODE_ENV !== 'production') {
    try {
      await seedDemoData();
    } catch (err) {
      console.error('❌ Demo 数据创建失败:', err);
    }
  }
});

module.exports = server;
