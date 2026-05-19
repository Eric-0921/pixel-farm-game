const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const friendService = require('../services/friendService');

const router = express.Router();

router.use(authenticateToken);

// 速率限制：发送好友请求 - 每用户每小时 10 次
const friendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '发送好友请求过于频繁，请稍后再试' },
  keyGenerator: (req) => req.userId.toString()
});

// 速率限制：发送留言 - 每用户每分钟 5 次
const friendMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '发送留言过于频繁，请稍后再试' },
  keyGenerator: (req) => req.userId.toString()
});

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
 * GET /api/friends/search?q=xxx
 * 搜索用户
 */
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ success: false, message: '搜索关键词不能为空' });
    }
    const results = friendService.searchUsers(req.userId, q.trim());
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/friends/requests
 * 获取待处理的好友请求
 */
router.get('/requests', (req, res) => {
  try {
    const requests = friendService.getPendingRequests(req.userId);
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/friends/request
 * 发送好友请求
 */
router.post('/request', friendRequestLimiter, (req, res) => {
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

/**
 * POST /api/friends/reject
 * 拒绝好友请求
 */
router.post('/reject', (req, res) => {
  try {
    const { friendId } = req.body;
    
    const validation = validatePositiveInteger(friendId, '好友ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    friendService.rejectFriendRequest(req.userId, validation.value);
    res.json({ success: true, message: '已拒绝好友请求' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/friends/:friendId
 * 删除好友
 */
router.delete('/:friendId', (req, res) => {
  try {
    const validation = validatePositiveInteger(req.params.friendId, '好友ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    friendService.removeFriend(req.userId, validation.value);
    res.json({ success: true, message: '已删除好友' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/friends/message
 * 发送留言
 */
router.post('/message', friendMessageLimiter, (req, res) => {
  try {
    const { friendId, content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: '留言内容不能为空' });
    }
    
    const friendValidation = validatePositiveInteger(friendId, '好友ID');
    if (!friendValidation.valid) {
      return res.status(400).json({ success: false, message: friendValidation.message });
    }
    
    friendService.sendMessage(req.userId, friendValidation.value, content);
    res.json({ success: true, message: '留言已发送' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/friends/messages/:friendId
 * 获取留言记录
 */
router.get('/messages/:friendId', (req, res) => {
  try {
    const validation = validatePositiveInteger(req.params.friendId, '好友ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    const messages = friendService.getMessages(req.userId, validation.value);
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/friends/gift
 * 赠送种子
 */
router.post('/gift', (req, res) => {
  try {
    const { friendId, cropTypeId, quantity } = req.body;
    
    const friendValidation = validatePositiveInteger(friendId, '好友ID');
    if (!friendValidation.valid) {
      return res.status(400).json({ success: false, message: friendValidation.message });
    }
    
    const cropValidation = validatePositiveInteger(cropTypeId, '作物类型ID');
    if (!cropValidation.valid) {
      return res.status(400).json({ success: false, message: cropValidation.message });
    }
    
    const qtyValidation = validatePositiveInteger(quantity, '数量');
    if (!qtyValidation.valid) {
      return res.status(400).json({ success: false, message: qtyValidation.message });
    }
    if (qtyValidation.value > 999) {
      return res.status(400).json({ success: false, message: '数量不能超过 999' });
    }
    
    friendService.sendGift(req.userId, friendValidation.value, cropValidation.value, qtyValidation.value);
    res.json({ success: true, message: '种子赠送成功' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
