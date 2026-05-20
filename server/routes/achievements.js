const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const achievementService = require('../services/achievementService');

const router = express.Router();

router.use(authenticateToken);

function isBusinessError(err) {
  if (!err || !err.message) return false;
  const msg = err.message;
  return msg.includes('不存在') || msg.includes('不能') || msg.includes('已存在') ||
    msg.includes('不能为空') || msg.includes('超过') || msg.includes('只能') ||
    msg.includes('好友请求') || msg.includes('缺少') || msg.includes('请求过于频繁') ||
    msg.includes('无效') || msg.includes('未提供') || msg.includes('错误');
}

/**
 * GET /api/achievements
 * 获取成就列表
 */
router.get('/', (req, res, next) => {
  try {
    const achievements = achievementService.getUserAchievements(req.userId);
    res.json({ success: true, data: achievements });
  } catch (err) {
    console.error('获取成就列表失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/achievements/stats
 * 获取统计数据
 */
router.get('/stats', (req, res, next) => {
  try {
    const stats = achievementService.getUserStats(req.userId);
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('获取统计数据失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

module.exports = router;
