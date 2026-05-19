const express = require('express');
const { getDatabase } = require('../database');

const router = express.Router();

/**
 * GET /api/crops
 * 获取所有作物类型
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const crops = db.prepare('SELECT * FROM crop_types ORDER BY buy_price ASC').all();
    res.json({ success: true, data: crops });
  } catch (err) {
    console.error('获取作物类型失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
