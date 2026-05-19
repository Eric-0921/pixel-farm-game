const crypto = require('crypto');

/**
 * 全局配置文件
 */

// JWT 密钥：优先从环境变量读取，未设置则生成随机密钥
function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  
  const fs = require('fs');
  const path = require('path');
  const secretFile = path.resolve('./database/.jwt_secret');
  
  try {
    if (fs.existsSync(secretFile)) {
      return fs.readFileSync(secretFile, 'utf8').trim();
    }
  } catch (e) {}
  
  const randomSecret = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    fs.writeFileSync(secretFile, randomSecret);
  } catch (e) {}
  
  console.warn('⚠️ 警告: JWT_SECRET 未设置，已生成随机密钥并保存到 database/.jwt_secret');
  return randomSecret;
}

const jwtSecret = getJwtSecret();

module.exports = {
  // 服务器配置
  port: process.env.PORT || 3000,
  
  // JWT 密钥
  jwtSecret,
  jwtExpiresIn: '7d',
  
  // 数据库配置
  database: {
    path: './database/farm_game.db'
  },
  
  // 游戏配置
  game: {
    // 农场默认尺寸
    farmWidth: 8,
    farmHeight: 6,
    
    // 初始金币
    initialCoins: 100,
    
    // 浇水加速系数
    waterBoostMultiplier: 1.5,
    
    // 浇水效果持续时间（秒）
    waterEffectDuration: 3600,
    
    // 作物枯萎时间（收获窗口过期后，秒）
    witherAfterHarvestWindow: 86400
  },
  
  // WebSocket 配置
  ws: {
    pingInterval: 30000
  },
  
  // 通知配置（预留扩展）
  notifications: {
    // 检查间隔（秒）
    checkInterval: 60,
    
    // 默认启用渠道
    defaultChannels: ['in_app']
  }
};
