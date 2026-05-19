const cron = require('node-cron');
const { getDatabase } = require('../database');
const config = require('../config');
const notifier = require('../notifications/notifier');

/**
 * 启动作物生长检查定时任务
 * 每分钟检查一次所有种植中的作物
 */
function startCropGrowthJob() {
  console.log('⏰ 启动作物生长检查定时任务');
  
  // 每分钟执行一次
  cron.schedule('*/1 * * * *', async () => {
    await checkCropGrowth();
  });
}

/**
 * 检查作物生长状态
 */
async function checkCropGrowth() {
  const db = getDatabase();
  const now = Date.now();
  
  try {
    // 获取所有未收获的种植记录
    const plantings = db.prepare(`
      SELECT 
        pl.id,
        pl.plot_id,
        pl.crop_type_id,
        pl.planted_at,
        pl.watered_at,
        pl.is_notified,
        pl.growth_progress,
        ct.growth_time,
        ct.name as crop_name,
        ct.sell_price,
        f.user_id
      FROM plantings pl
      JOIN crop_types ct ON pl.crop_type_id = ct.id
      JOIN plots p ON pl.plot_id = p.id
      JOIN farms f ON p.farm_id = f.id
      WHERE pl.harvested_at IS NULL
    `).all();
    
    for (const planting of plantings) {
      try {
        const plantedTime = new Date(planting.planted_at).getTime();
        const elapsed = (now - plantedTime) / 1000;
        
        // 检查浇水状态
        let boost = 1.0;
        if (planting.watered_at) {
          const wateredTime = new Date(planting.watered_at).getTime();
          const waterAge = (now - wateredTime) / 1000;
          if (waterAge < config.game.waterEffectDuration) {
            boost = config.game.waterBoostMultiplier;
          }
        }
        
        // 计算生长进度
        const progress = Math.min(1.0, (elapsed * boost) / planting.growth_time);
        
        // 更新数据库中的生长进度
        db.prepare('UPDATE plantings SET growth_progress = ? WHERE id = ?').run(progress, planting.id);
        
        // 检查是否刚成熟且未通知
        if (progress >= 1.0 && !planting.is_notified) {
          // 标记为已通知
          db.prepare('UPDATE plantings SET is_notified = 1 WHERE id = ?').run(planting.id);
          
          // 通过通知器发送（包含 in_app + push）
          await notifier.notifyCropMature(planting.user_id, planting.crop_name, {
            plot_id: planting.plot_id,
            crop_type_id: planting.crop_type_id
          });
          
          console.log(`🌾 用户 ${planting.user_id} 的 ${planting.crop_name} 已成熟`);
        }
      } catch (cropErr) {
        console.error(`作物处理失败 (planting id=${planting.id}):`, cropErr.message);
      }
    }
  } catch (err) {
    console.error('作物生长检查失败:', err);
  }
}

module.exports = {
  startCropGrowthJob,
  checkCropGrowth
};
