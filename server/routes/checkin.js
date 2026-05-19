const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const checkinService = require('../services/checkinService');
const achievementService = require('../services/achievementService');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/checkin/status
 * 获取签到状态
 */
router.get('/status', (req, res) => {
  try {
    const status = checkinService.getCheckinStatus(req.userId);
    const recent = checkinService.getRecentCheckins(req.userId);
    res.json({
      success: true,
      data: {
        ...status,
        recentCheckins: recent
      }
    });
  } catch (err) {
    console.error('获取签到状态失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/checkin
 * 执行签到
 */
router.post('/', (req, res) => {
  try {
    const result = checkinService.doCheckin(req.userId);
    if (result.success) {
      // 更新连续登录统计
      achievementService.setStat(req.userId, 'consecutive_login', result.consecutiveDays);
    }
    res.json({ success: result.success, message: result.message, data: result });
  } catch (err) {
    console.error('签到失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
