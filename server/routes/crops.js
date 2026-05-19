const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDatabase, db } = require('../database');
const dailyActionService = require('../services/dailyActionService');

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
 * GET /api/crops
 * 获取所有作物类型
 */
router.get('/', (req, res) => {
  try {
    const db2 = getDatabase();
    const crops = db2.prepare('SELECT * FROM crop_types ORDER BY buy_price ASC').all();
    res.json({ success: true, data: crops });
  } catch (err) {
    console.error('获取作物类型失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/crops/water-friend/:friendId/:plotId
 * 帮好友浇水
 * 限制：每天最多帮同一个好友浇 3 次水
 * 奖励：双方获得少量经验
 */
router.post('/water-friend/:friendId/:plotId', authenticateToken, (req, res) => {
  try {
    const friendValidation = validatePositiveInteger(req.params.friendId, '好友ID');
    if (!friendValidation.valid) {
      return res.status(400).json({ success: false, message: friendValidation.message });
    }

    const plotValidation = validatePositiveInteger(req.params.plotId, '地块ID');
    if (!plotValidation.valid) {
      return res.status(400).json({ success: false, message: plotValidation.message });
    }

    const userId = req.userId;
    const friendId = friendValidation.value;
    const plotId = plotValidation.value;

    // 不能给自己浇水
    if (userId === friendId) {
      return res.status(400).json({ success: false, message: '不能给自己浇水' });
    }

    // 检查是否为好友
    const friendship = db.friends.find(f => f.user_id === userId && f.friend_id === friendId && f.status === 'accepted');
    if (!friendship) {
      return res.status(403).json({ success: false, message: '只能给好友浇水' });
    }

    // 检查每日次数限制
    const MAX_DAILY_WATER = 3;
    if (!dailyActionService.canPerformAction(userId, friendId, 'water_friend', MAX_DAILY_WATER)) {
      return res.status(429).json({ success: false, message: '今天已经帮该好友浇过水了，明天再来吧' });
    }

    // 验证地块属于好友
    const plot = db.plots.find(p => p.id === plotId);
    if (!plot) {
      return res.status(404).json({ success: false, message: '地块不存在' });
    }

    const farm = db.farms.find(f => f.id === plot.farm_id);
    if (!farm || farm.user_id !== friendId) {
      return res.status(403).json({ success: false, message: '该地块不属于该好友' });
    }

    // 检查地块是否有作物
    if (plot.status !== 'planted') {
      return res.status(400).json({ success: false, message: '该地块没有作物' });
    }

    const planting = db.plantings.find(pl => pl.plot_id === plotId && !pl.harvested_at);
    if (!planting) {
      return res.status(400).json({ success: false, message: '该地块没有作物' });
    }

    // 更新浇水时间
    const now = new Date().toISOString();
    planting.watered_at = now;

    // 双方获得少量经验
    const EXP_REWARD = 5;
    const currentUser = db.users.find(u => u.id === userId);
    const friendUser = db.users.find(u => u.id === friendId);

    if (currentUser) {
      currentUser.experience = (currentUser.experience || 0) + EXP_REWARD;
    }
    if (friendUser) {
      friendUser.experience = (friendUser.experience || 0) + EXP_REWARD;
    }

    // 记录每日操作
    dailyActionService.recordAction(userId, friendId, 'water_friend');

    // 保存数据库
    const { saveDatabase } = require('../database');
    saveDatabase();

    res.json({
      success: true,
      message: '帮好友浇水成功',
      data: {
        plotId,
        wateredAt: now,
        experienceGained: EXP_REWARD
      }
    });
  } catch (err) {
    console.error('帮好友浇水失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
