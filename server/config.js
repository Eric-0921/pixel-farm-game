const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

// VAPID 密钥对：自动生成或读取已有
function getVapidKeys() {
  const vapidFile = path.resolve('./database/.vapid_keys.json');
  
  try {
    if (fs.existsSync(vapidFile)) {
      const keys = JSON.parse(fs.readFileSync(vapidFile, 'utf8'));
      if (keys.publicKey && keys.privateKey) {
        return keys;
      }
    }
  } catch (e) {
    console.warn('⚠️ 读取 VAPID 密钥失败，将重新生成');
  }
  
  try {
    const webpush = require('web-push');
    const vapidKeys = webpush.generateVAPIDKeys();
    fs.mkdirSync(path.dirname(vapidFile), { recursive: true });
    fs.writeFileSync(vapidFile, JSON.stringify(vapidKeys, null, 2));
    console.log('🔐 已生成新的 VAPID 密钥对');
    return vapidKeys;
  } catch (e) {
    console.error('❌ 生成 VAPID 密钥失败:', e.message);
    return { publicKey: '', privateKey: '' };
  }
}

const vapidKeys = getVapidKeys();

// 配置 web-push
if (vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    const webpush = require('web-push');
    webpush.setVapidDetails(
      'mailto:admin@pixelfarm.game',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    console.log('🔐 VAPID 密钥已配置');
  } catch (e) {
    console.error('❌ 配置 VAPID 失败:', e.message);
  }
}

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
  
  // VAPID 公钥
  vapidPublicKey: vapidKeys.publicKey,
  
  // WebSocket 配置
  ws: {
    pingInterval: 30000
  },
  
  // 通知配置（预留扩展）
  notifications: {
    // 检查间隔（秒）
    checkInterval: 60,
    
    // 默认启用渠道（in_app 已集成 Push 发送）
    defaultChannels: ['in_app']
  }
};
