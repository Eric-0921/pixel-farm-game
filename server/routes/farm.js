const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validatePositiveInteger } = require('../utils/validators');
const farmService = require('../services/farmService');

const router = express.Router();

// 所有农场路由需要认证
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
 * GET /api/farm
 * 获取当前用户的农场数据
 */
router.get('/', (req, res, next) => {
  try {
    const farm = farmService.getFarmByUserId(req.userId);
    res.json({ success: true, data: farm });
  } catch (err) {
    console.error('获取农场失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/farm/friend/:friendId
 * 获取好友农场（查看模式）
 */
router.get('/friend/:friendId', (req, res, next) => {
  try {
    const validation = validatePositiveInteger(req.params.friendId, '好友ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const farm = farmService.getFriendFarm(req.userId, validation.value);
    res.json({ success: true, data: farm });
  } catch (err) {
    console.error('获取好友农场失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/farm/plant
 * 种植作物
 * Body: { plotId, cropTypeId }
 */
router.post('/plant', (req, res, next) => {
  try {
    const { plotId, cropTypeId } = req.body;
    
    if (!plotId || !cropTypeId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    const plotValidation = validatePositiveInteger(plotId, '地块ID');
    if (!plotValidation.valid) {
      return res.status(400).json({ success: false, message: plotValidation.message });
    }
    
    const cropValidation = validatePositiveInteger(cropTypeId, '作物类型ID');
    if (!cropValidation.valid) {
      return res.status(400).json({ success: false, message: cropValidation.message });
    }
    
    const result = farmService.plantCrop(req.userId, plotValidation.value, cropValidation.value);
    res.json({ success: true, message: '种植成功', data: result });
  } catch (err) {
    console.error('种植失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/farm/water
 * 浇水
 * Body: { plotId }
 */
router.post('/water', (req, res, next) => {
  try {
    const { plotId } = req.body;
    
    if (!plotId) {
      return res.status(400).json({ success: false, message: '缺少地块ID' });
    }
    
    const validation = validatePositiveInteger(plotId, '地块ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    const result = farmService.waterCrop(req.userId, validation.value);
    res.json({ success: true, message: '浇水成功', data: result });
  } catch (err) {
    console.error('浇水失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/farm/harvest
 * 收获作物
 * Body: { plotId }
 */
router.post('/harvest', (req, res, next) => {
  try {
    const { plotId } = req.body;
    
    if (!plotId) {
      return res.status(400).json({ success: false, message: '缺少地块ID' });
    }
    
    const validation = validatePositiveInteger(plotId, '地块ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    const result = farmService.harvestCrop(req.userId, validation.value);
    res.json({ success: true, message: '收获成功', data: result });
  } catch (err) {
    console.error('收获失败:', err);
    if (isBusinessError(err)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

module.exports = router;
