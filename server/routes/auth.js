const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase, createUserFarm } = require('../database');
const config = require('../config');

const router = express.Router();

function validateUsername(username) {
  if (!username || username.length < 3 || username.length > 20) return '用户名长度应为3-20位';
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) return '用户名只能包含字母、数字、下划线和中文';
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 4) return '密码至少4位';
  if (password.length > 30) return '密码最长30位';
  return null;
}

function isBusinessError(err) {
  if (!err || !err.message) return false;
  const msg = err.message;
  return msg.includes('不存在') || msg.includes('不能') || msg.includes('已存在') ||
    msg.includes('不能为空') || msg.includes('超过') || msg.includes('只能') ||
    msg.includes('好友请求') || msg.includes('缺少') || msg.includes('请求过于频繁') ||
    msg.includes('无效') || msg.includes('未提供') || msg.includes('错误');
}

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, displayName } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ success: false, message: usernameError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }
    
    const db = getDatabase();
    
    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ success: false, message: '用户名已存在' });
    }
    
    // 密码哈希（异步）
    const passwordHash = await bcrypt.hash(password, 12);
    
    // 创建用户
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, coins, experience)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, passwordHash, displayName || username, config.game.initialCoins, 0);
    
    const userId = result.lastInsertRowid;
    
    // 创建默认农场
    createUserFarm(userId);
    
    // 生成 JWT
    const token = jwt.sign(
      { userId, username },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
    
    res.json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user: {
          id: userId,
          username,
          displayName: displayName || username,
          coins: config.game.initialCoins
        }
      }
    });
  } catch (err) {
    console.error('注册失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    
    const db = getDatabase();
    
    // 查询用户
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    // 验证密码（异步）
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          coins: user.coins,
          experience: user.experience
        }
      }
    });
  } catch (err) {
    console.error('登录失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: '未提供认证令牌' });
    }
    
    const decoded = jwt.verify(token, config.jwtSecret);
    const db = getDatabase();
    const user = db.prepare('SELECT id, username, display_name, coins, experience FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        coins: user.coins,
        experience: user.experience
      }
    });
  } catch (err) {
    res.status(403).json({ success: false, message: '令牌无效' });
  }
});

module.exports = router;
