const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase, createUserFarm } = require('../database');
const config = require('../config');

const router = express.Router();

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    
    const db = getDatabase();
    
    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ success: false, message: '用户名已存在' });
    }
    
    // 密码哈希（异步）
    const passwordHash = await bcrypt.hash(password, 10);
    
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
    res.status(500).json({ success: false, message: '注册失败: ' + err.message });
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
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
    res.status(500).json({ success: false, message: '登录失败: ' + err.message });
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
