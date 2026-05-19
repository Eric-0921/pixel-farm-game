const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const farmService = require('../services/farmService');

const router = express.Router();

// 所有农场路由需要认证
router.use(authenticateToken);

/**
 * 验证正整数输入
 */
function validatePositiveInteger(value, fieldName) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0 || !Number.isFinite(num)) {
    return { valid: false, message: `${fieldName} 必须是有效的正整数` };
  }
  // 防止超大值（SQL 注入或溢出攻击）
  if (num > Number.MAX_SAFE_INTEGER) {
    return { valid: false, message: `${fieldName} 超出允许范围` };
  }
  return { valid: true, value: num };
}

/**
 * GET /api/farm
 * 获取当前用户的农场数据
 */
router.get('/', (req, res) => {
  try {
    const farm = farmService.getFarmByUserId(req.userId);
    res.json({ success: true, data: farm });
  } catch (err) {
    console.error('获取农场失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/farm/friend/:friendId
 * 获取好友农场（查看模式）
 */
router.get('/friend/:friendId', (req, res) => {
  try {
    const validation = validatePositiveInteger(req.params.friendId, '好友ID');
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const farm = farmService.getFriendFarm(req.userId, validation.value);
    res.json({ success: true, data: farm });
  } catch (err) {
    console.error('获取好友农场失败:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/farm/plant
 * 种植作物
 * Body: { plotId, cropTypeId }
 */
router.post('/plant', (req, res) => {
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
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/farm/water
 * 浇水
 * Body: { plotId }
 */
router.post('/water', (req, res) => {
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
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/farm/harvest
 * 收获作物
 * Body: { plotId }
 */
router.post('/harvest', (req, res) => {
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
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
