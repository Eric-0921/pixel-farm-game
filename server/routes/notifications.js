const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

router.use(authenticateToken);

/**
 * 验证正整数输入
 */
function validatePositiveInteger(value, fieldName) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0 || !Number.isFinite(num)) {
    return { valid: false, message: `${fieldName} 必须是有效的正整数` };
  }
  if (num > Number.MAX_SAFE_INTEGER) {
    return { valid: false, message: `${fieldName} 超出允许范围` };
  }
  return { valid: true, value: num };
}

/**
 * GET /api/notifications
 * 获取通知列表
 */
router.get('/', (req, res) => {
  try {
    const notifications = notificationService.getNotifications(req.userId);
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/notifications/read
 * 标记通知为已读
 */
router.post('/read', (req, res) => {
  try {
    const { notificationId } = req.body;
    
    const validation = validatePositiveInteger(notificationId, '通知ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    notificationService.markAsRead(req.userId, validation.value);
    res.json({ success: true, message: '已标记为已读' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
