const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const checkinService = require('../services/checkinService');
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
 * GET /api/checkin/status
 * 获取签到状态
 */
router.get('/status', (req, res, next) => {
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
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/checkin
 * 执行签到
 */
router.post('/', (req, res, next) => {
  try {
    const result = checkinService.doCheckin(req.userId);
    if (result.success) {
      // 更新连续登录统计
      achievementService.setStat(req.userId, 'consecutive_login', result.consecutiveDays);
    }
    res.json({ success: result.success, message: result.message, data: result });
  } catch (err) {
    console.error('签到失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

module.exports = router;
