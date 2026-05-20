const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../database');
const { validatePositiveInteger } = require('../utils/validators');
const dailyActionService = require('../services/dailyActionService');
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
 * GET /api/crops
 * 获取所有作物类型
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const crops = db.prepare('SELECT * FROM crop_types ORDER BY buy_price ASC').all();
    res.json({ success: true, data: crops });
  } catch (err) {
    console.error('获取作物类型失败:', err);
    next(err);
  }
});

/**
 * POST /api/crops/water-friend/:friendId/:plotId
 * 帮好友浇水
 * 限制：每天最多帮同一个好友浇 3 次水
 * 奖励：双方获得少量经验
 */
router.post('/water-friend/:friendId/:plotId', authenticateToken, (req, res, next) => {
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

    const db = getDatabase();

    // 检查是否为好友
    const friendship = db.prepare("SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'accepted'").get(userId, friendId);
    if (!friendship) {
      return res.status(403).json({ success: false, message: '只能给好友浇水' });
    }

    // 检查每日次数限制
    const MAX_DAILY_WATER = 3;
    if (!dailyActionService.canPerformAction(userId, friendId, 'water_friend', MAX_DAILY_WATER)) {
      return res.status(429).json({ success: false, message: '今天已经帮该好友浇过水了，明天再来吧' });
    }

    // 验证地块属于好友
    const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(plotId);
    if (!plot) {
      return res.status(404).json({ success: false, message: '地块不存在' });
    }

    const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(plot.farm_id);
    if (!farm || farm.user_id !== friendId) {
      return res.status(403).json({ success: false, message: '该地块不属于该好友' });
    }

    // 检查地块是否有作物
    if (plot.status !== 'planted') {
      return res.status(400).json({ success: false, message: '该地块没有作物' });
    }

    const planting = db.prepare('SELECT * FROM plantings WHERE plot_id = ? AND harvested_at IS NULL').get(plotId);
    if (!planting) {
      return res.status(400).json({ success: false, message: '该地块没有作物' });
    }

    // 更新浇水时间
    const now = new Date().toISOString();
    db.prepare('UPDATE plantings SET watered_at = ? WHERE id = ?').run(now, planting.id);

    // 双方获得少量经验
    const EXP_REWARD = 5;
    db.prepare('UPDATE users SET experience = experience + ? WHERE id = ?').run(EXP_REWARD, userId);
    db.prepare('UPDATE users SET experience = experience + ? WHERE id = ?').run(EXP_REWARD, friendId);

    // 记录每日操作
    dailyActionService.recordAction(userId, friendId, 'water_friend');

    // 统计帮好友浇水次数
    achievementService.incrementStat(userId, 'help_water_count', 1);

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
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

module.exports = router;
