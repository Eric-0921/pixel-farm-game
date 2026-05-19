const http = require('http');
const app = require('./app');
const config = require('./config');
const { initDatabase } = require('./database');
const { initWebSocketServer } = require('./websocket');
const { startCropGrowthJob } = require('./jobs/cropGrowthJob');
const notifier = require('./notifications/notifier');
const inAppProvider = require('./notifications/inAppProvider');

// 初始化数据库
initDatabase();

// 注册应用内通知渠道
notifier.registerProvider('in_app', inAppProvider);

// 创建 HTTP 服务器
const server = http.createServer(app);

// 初始化 WebSocket
initWebSocketServer(server);

// 启动定时任务
startCropGrowthJob();

// 启动服务器
server.listen(config.port, () => {
  console.log(`\n🎮 像素农场游戏服务器已启动`);
  console.log(`📍 HTTP 服务: http://localhost:${config.port}`);
  console.log(`🔌 WebSocket: ws://localhost:${config.port}`);
  console.log(`📚 API 文档: http://localhost:${config.port}/api/health\n`);
});

module.exports = server;
