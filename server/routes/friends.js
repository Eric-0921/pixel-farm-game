const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const friendService = require('../services/friendService');

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
 * GET /api/friends
 * 获取好友列表
 */
router.get('/', (req, res) => {
  try {
    const friends = friendService.getFriends(req.userId);
    res.json({ success: true, data: friends });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/friends/request
 * 发送好友请求
 */
router.post('/request', (req, res) => {
  try {
    const { friendId } = req.body;
    
    const validation = validatePositiveInteger(friendId, '好友ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    friendService.sendFriendRequest(req.userId, validation.value);
    res.json({ success: true, message: '好友请求已发送' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/friends/accept
 * 接受好友请求
 */
router.post('/accept', (req, res) => {
  try {
    const { friendId } = req.body;
    
    const validation = validatePositiveInteger(friendId, '好友ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    friendService.acceptFriendRequest(req.userId, validation.value);
    res.json({ success: true, message: '已接受好友请求' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
