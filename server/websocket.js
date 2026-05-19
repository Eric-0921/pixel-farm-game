const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');

// 存储连接的客户端 { userId -> ws }
const clients = new Map();

/**
 * 初始化 WebSocket 服务器
 */
function initWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });
  
  console.log('🔗 WebSocket 服务器已启动');
  
  wss.on('connection', (ws, req) => {
    console.log('📡 新客户端连接');
    
    ws.isAlive = true;
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleMessage(ws, data);
      } catch (err) {
        console.error('WebSocket 消息解析失败:', err);
      }
    });
    
    ws.on('close', () => {
      console.log('📡 客户端断开连接');
      // 清理客户端映射
      for (const [userId, client] of clients.entries()) {
        if (client === ws) {
          clients.delete(userId);
          break;
        }
      }
    });
    
    ws.on('error', (err) => {
      console.error('WebSocket 错误:', err);
    });
    
    // 发送欢迎消息
    ws.send(JSON.stringify({ type: 'connected', message: '已连接到游戏服务器' }));
  });
  
  // 心跳检测
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, config.ws.pingInterval);
  
  wss.on('close', () => {
    clearInterval(interval);
  });
  
  return wss;
}

/**
 * 处理客户端消息
 */
function handleMessage(ws, data) {
  // 非 auth 消息需要先认证
  if (data.type !== 'auth' && !ws.userId) {
    ws.send(JSON.stringify({ type: 'auth_failed', message: '请先进行认证' }));
    return;
  }

  switch (data.type) {
    case 'auth':
      // 客户端认证 - 使用 JWT token 验证
      if (data.token) {
        try {
          const decoded = jwt.verify(data.token, config.jwtSecret);
          const userId = decoded.userId;
          if (!userId) {
            ws.send(JSON.stringify({ type: 'auth_failed', message: '令牌中未包含用户ID' }));
            break;
          }
          clients.set(userId, ws);
          ws.userId = userId;
          ws.send(JSON.stringify({ type: 'auth_success', userId }));
        } catch (err) {
          console.error('WebSocket 认证失败:', err.message);
          ws.send(JSON.stringify({ type: 'auth_failed', message: '认证令牌无效或已过期' }));
        }
      } else {
        ws.send(JSON.stringify({ type: 'auth_failed', message: '未提供认证令牌' }));
      }
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
      
    default:
      console.log('未知消息类型:', data.type);
  }
}

/**
 * 向指定用户发送消息
 */
function sendToUser(userId, message) {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

/**
 * 广播消息给所有在线用户
 */
function broadcast(message) {
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

module.exports = {
  initWebSocketServer,
  sendToUser,
  broadcast,
  clients
};
