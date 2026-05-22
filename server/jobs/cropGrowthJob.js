const cron = require('node-cron');
const { getDatabase } = require('../database');
const config = require('../config');
const notifier = require('../notifications/notifier');

let pestCheckCounter = 0;

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
    // 土壤自然蒸发
    db.prepare("UPDATE plots SET soil_moisture = MAX(0, soil_moisture - 0.5) WHERE status = 'planted'").run();
    
    // 获取所有未收获的种植记录（包含地块信息）
    const plantings = db.prepare(`
      SELECT 
        pl.id,
        pl.plot_id,
        pl.crop_type_id,
        pl.planted_at,
        pl.watered_at,
        pl.is_notified,
        pl.growth_progress,
        pl.pest_infected,
        pl.health_score,
        pl.fertilizer_applied,
        ct.growth_time,
        ct.name as crop_name,
        ct.sell_price,
        p.soil_moisture,
        p.soil_fertility,
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
        // growth 肥料加速
        if (planting.fertilizer_applied) {
          boost *= 1.3;
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
    
    // 健康度计算和通知
    for (const planting of plantings) {
      try {
        const moisture = planting.soil_moisture || 0;
        const fertility = planting.soil_fertility || 0;
        const pestPenalty = planting.pest_infected ? 0 : 30;
        const health = Math.round((moisture / 100 * 40) + (fertility / 100 * 30) + pestPenalty);
        const clampedHealth = Math.max(0, Math.min(100, health));
        
        // 只在健康度变化时更新
        if (clampedHealth !== planting.health_score) {
          db.prepare('UPDATE plantings SET health_score = ? WHERE id = ?').run(clampedHealth, planting.id);
          
          // 低健康度通知（首次低于30）
          if (clampedHealth < 30 && (planting.health_score === null || planting.health_score >= 30)) {
            await notifier.notifyLowHealth(planting.user_id, planting.crop_name, {
              plot_id: planting.plot_id,
              health: clampedHealth
            });
            console.log(`⚠️ 用户 ${planting.user_id} 的 ${planting.crop_name} 健康度低 (${clampedHealth})`);
          }
        }
      } catch (healthErr) {
        console.error(`健康度处理失败 (planting id=${planting.id}):`, healthErr.message);
      }
    }
    
    // 虫害检测（每小时一次）
    pestCheckCounter++;
    if (pestCheckCounter >= 60) {
      pestCheckCounter = 0;
      await checkPestInfestation(db);
    }
  } catch (err) {
    console.error('作物生长检查失败:', err);
  }
}

/**
 * 虫害检测
 */
async function checkPestInfestation(db) {
  const plantings = db.prepare(`
    SELECT 
      pl.id,
      pl.plot_id,
      pl.pest_infected,
      p.soil_moisture,
      p.soil_fertility,
      f.user_id,
      ct.name as crop_name
    FROM plantings pl
    JOIN plots p ON pl.plot_id = p.id
    JOIN farms f ON p.farm_id = f.id
    JOIN crop_types ct ON pl.crop_type_id = ct.id
    WHERE pl.harvested_at IS NULL AND pl.pest_infected = 0
  `).all();
  
  for (const planting of plantings) {
    try {
      // 检查是否有防虫剂
      const protection = db.prepare(`
        SELECT 1 FROM plot_fertilizers pf
        JOIN fertilizers ft ON pf.fertilizer_id = ft.id
        WHERE pf.plot_id = ? AND ft.type = 'pest'
          AND (pf.expires_at IS NULL OR pf.expires_at > datetime('now'))
        LIMIT 1
      `).get(planting.plot_id);
      
      if (protection) continue;
      
      // 计算虫害概率
      let probability = 0.01; // 基础1%
      if ((planting.soil_fertility || 0) < 30) probability += 0.02;
      if ((planting.soil_moisture || 0) < 30) probability += 0.01;
      
      if (Math.random() < probability) {
        db.prepare('UPDATE plantings SET pest_infected = 1 WHERE id = ?').run(planting.id);
        console.log(`🐛 用户 ${planting.user_id} 的 ${planting.crop_name} 发生虫害`);
      }
    } catch (pestErr) {
      console.error(`虫害检测失败 (planting id=${planting.id}):`, pestErr.message);
    }
  }
}

module.exports = {
  startCropGrowthJob,
  checkCropGrowth
};
