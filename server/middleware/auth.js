const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT 认证中间件
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ success: false, message: '未提供认证令牌' });
  }
  
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: '令牌无效或已过期' });
  }
}

module.exports = { authenticateToken };
