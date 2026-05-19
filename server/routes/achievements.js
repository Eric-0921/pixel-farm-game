const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const achievementService = require('../services/achievementService');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/achievements
 * 获取成就列表
 */
router.get('/', (req, res) => {
  try {
    const achievements = achievementService.getUserAchievements(req.userId);
    res.json({ success: true, data: achievements });
  } catch (err) {
    console.error('获取成就列表失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/achievements/stats
 * 获取统计数据
 */
router.get('/stats', (req, res) => {
  try {
    const stats = achievementService.getUserStats(req.userId);
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('获取统计数据失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
