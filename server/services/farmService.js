const { getDatabase, createUserFarm } = require('../database');
const config = require('../config');
const achievementService = require('./achievementService');

/**
 * 获取用户农场数据（包含地块和作物信息）
 */
function getFarmByUserId(userId) {
  const db = getDatabase();

  // 查找农场
  let farm = db.prepare('SELECT * FROM farms WHERE user_id = ?').get(userId);

  if (!farm) {
    // 检查用户是否存在
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw new Error('用户不存在，请重新登录');
    }
    // 自动为用户创建农场
    createUserFarm(userId);
    farm = db.prepare('SELECT * FROM farms WHERE user_id = ?').get(userId);
  }

  // 获取用户信息
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  // 获取地块信息
  const plots = db.prepare('SELECT * FROM plots WHERE farm_id = ? ORDER BY y, x').all(farm.id);

  const plotData = plots.map(plot => {
    // 查找当前种植记录（未收获的）
    const planting = db.prepare('SELECT * FROM plantings WHERE plot_id = ? AND harvested_at IS NULL').get(plot.id);

    if (!planting) {
      return {
        plot_id: plot.id,
        x: plot.x,
        y: plot.y,
        status: plot.status,
        soil_moisture: plot.soil_moisture,
        soil_fertility: plot.soil_fertility,
        planting_id: null,
        crop_type_id: null,
        planted_at: null,
        watered_at: null,
        growth_progress: 0,
        crop_name: null,
        growth_time: null,
        sell_price: null,
        buy_price: null,
        color: null,
        stages: null,
        is_mature: false,
        is_watered: false,
        pest_infected: 0,
        health_score: null
      };
    }

    // 查找作物类型
    const cropType = db.prepare('SELECT * FROM crop_types WHERE id = ?').get(planting.crop_type_id);

    // 计算实时生长进度
    const now = Date.now();
    const plantedTime = new Date(planting.planted_at).getTime();
    const elapsed = (now - plantedTime) / 1000;

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

    const growthTime = cropType ? cropType.growth_time : 60;
    const progress = Math.min(1.0, (elapsed * boost) / growthTime);
    const isWatered = planting.watered_at && ((now - new Date(planting.watered_at).getTime()) / 1000 < config.game.waterEffectDuration);

    return {
      plot_id: plot.id,
      x: plot.x,
      y: plot.y,
      status: plot.status,
      soil_moisture: plot.soil_moisture,
      soil_fertility: plot.soil_fertility,
      planting_id: planting.id,
      crop_type_id: planting.crop_type_id,
      planted_at: planting.planted_at,
      watered_at: planting.watered_at,
      growth_progress: progress,
      crop_name: cropType ? cropType.name : null,
      growth_time: growthTime,
      sell_price: cropType ? cropType.sell_price : 0,
      buy_price: cropType ? cropType.buy_price : 0,
      color: cropType ? cropType.color : '#4a7c32',
      stages: cropType ? cropType.stages : 4,
      is_mature: progress >= 1.0,
      is_watered: isWatered,
      pest_infected: planting.pest_infected || 0,
      health_score: planting.health_score
    };
  });

  return {
    ...farm,
    coins: user ? user.coins : 0,
    experience: user ? (user.experience || 0) : 0,
    display_name: user ? user.display_name : '',
    username: user ? user.username : '',
    plots: plotData
  };
}

/**
 * 种植作物
 */
function plantCrop(userId, plotId, cropTypeId) {
  const db = getDatabase();

  // 验证地块属于该用户
  const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(plotId);
  if (!plot) {
    throw new Error('地块不存在');
  }

  const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(plot.farm_id);
  if (!farm || farm.user_id !== userId) {
    throw new Error('无权操作该地块');
  }

  if (plot.status !== 'empty') {
    throw new Error('该地块已被占用');
  }

  // 获取作物信息
  const cropType = db.prepare('SELECT * FROM crop_types WHERE id = ?').get(cropTypeId);
  if (!cropType) {
    throw new Error('作物类型不存在');
  }

  // 获取用户并检查金币
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || user.coins < cropType.buy_price) {
    throw new Error('金币不足');
  }

  // 扣除金币
  db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(cropType.buy_price, userId);

  // 创建种植记录
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO plantings (plot_id, crop_type_id, planted_at, watered_at, harvested_at, growth_progress, is_notified, pest_infected, health_score, fertilizer_applied)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(plotId, cropTypeId, now, null, null, 0, 0, 0, 100, 0);

  // 更新地块状态，消耗少量水分
  const newMoisture = Math.max(0, (plot.soil_moisture || 50) - 5);
  db.prepare("UPDATE plots SET status = 'planted', soil_moisture = ? WHERE id = ?").run(newMoisture, plotId);

  // 更新种植统计
  try {
    achievementService.incrementStat(userId, 'plant_count', 1);
  } catch (e) {
    console.error('更新种植统计失败:', e);
  }

  return { plotId, cropTypeId, cost: cropType.buy_price };
}

/**
 * 浇水
 */
function waterCrop(userId, plotId) {
  const db = getDatabase();

  // 验证地块
  const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(plotId);
  if (!plot) {
    throw new Error('地块不存在');
  }

  const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(plot.farm_id);
  if (!farm || farm.user_id !== userId) {
    throw new Error('无权操作该地块');
  }

  if (plot.status !== 'planted') {
    throw new Error('该地块没有作物');
  }

  // 查找种植记录
  const planting = db.prepare('SELECT * FROM plantings WHERE plot_id = ? AND harvested_at IS NULL').get(plotId);
  if (!planting) {
    throw new Error('该地块没有作物');
  }

  // 更新浇水时间
  const now = new Date().toISOString();
  db.prepare('UPDATE plantings SET watered_at = ? WHERE id = ?').run(now, planting.id);

  // 增加土壤湿度
  const newMoisture = Math.min(100, (plot.soil_moisture || 50) + 30);
  db.prepare('UPDATE plots SET soil_moisture = ? WHERE id = ?').run(newMoisture, plotId);

  // 更新浇水统计
  try {
    achievementService.incrementStat(userId, 'water_count', 1);
  } catch (e) {
    console.error('更新浇水统计失败:', e);
  }

  return { plotId, wateredAt: now };
}

/**
 * 收获作物
 */
function harvestCrop(userId, plotId) {
  const db = getDatabase();

  // 验证地块
  const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(plotId);
  if (!plot) {
    throw new Error('地块不存在');
  }

  const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(plot.farm_id);
  if (!farm || farm.user_id !== userId) {
    throw new Error('无权操作该地块');
  }

  if (plot.status !== 'planted') {
    throw new Error('该地块没有作物');
  }

  // 查找种植记录
  const planting = db.prepare('SELECT * FROM plantings WHERE plot_id = ? AND harvested_at IS NULL').get(plotId);
  if (!planting) {
    throw new Error('该地块没有作物');
  }

  // 查找作物类型
  const cropType = db.prepare('SELECT * FROM crop_types WHERE id = ?').get(planting.crop_type_id);
  if (!cropType) {
    throw new Error('作物类型不存在');
  }

  // 计算实时生长进度
  const now = Date.now();
  const plantedTime = new Date(planting.planted_at).getTime();
  const elapsed = (now - plantedTime) / 1000;
  let boost = 1.0;
  if (planting.watered_at) {
    const wateredTime = new Date(planting.watered_at).getTime();
    const waterAge = (now - wateredTime) / 1000;
    if (waterAge < config.game.waterEffectDuration) {
      boost = config.game.waterBoostMultiplier;
    }
  }
  if (planting.fertilizer_applied) {
    boost *= 1.3;
  }
  const progress = Math.min(1.0, (elapsed * boost) / cropType.growth_time);

  if (progress < 1.0) {
    throw new Error('作物尚未成熟');
  }

  // 健康度影响产量
  let healthFactor = 1.0;
  const health = planting.health_score || 100;
  if (health < 50) {
    healthFactor = 0.8;
  } else if (health > 80) {
    healthFactor = 1.2;
  }
  const earned = Math.floor(cropType.sell_price * healthFactor);

  // 更新种植记录为已收获
  const harvestTime = new Date().toISOString();
  db.prepare('UPDATE plantings SET harvested_at = ?, growth_progress = 1 WHERE id = ?').run(harvestTime, planting.id);

  // 重置地块状态和土壤
  const newMoisture = 50;
  const newFertility = Math.max(30, (plot.soil_fertility || 50) - 10);
  db.prepare("UPDATE plots SET status = 'empty', soil_moisture = ?, soil_fertility = ? WHERE id = ?").run(newMoisture, newFertility, plotId);

  // 增加用户金币和经验
  db.prepare('UPDATE users SET coins = coins + ?, experience = experience + 10 WHERE id = ?').run(earned, userId);

  // 更新收获统计和最大金币
  try {
    achievementService.incrementStat(userId, 'harvest_count', 1);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (user) {
      achievementService.setStat(userId, 'max_coins', Math.max(user.coins, (achievementService.getUserStats(userId).max_coins || 0)));
    }
  } catch (e) {
    console.error('更新收获统计失败:', e);
  }

  return {
    plotId,
    cropName: cropType.name,
    earned,
    experience: 10,
    healthFactor
  };
}

/**
 * 施肥
 */
function applyFertilizer(userId, plotId, fertilizerId) {
  const db = getDatabase();

  // 验证地块属于用户
  const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(plotId);
  if (!plot) {
    throw new Error('地块不存在');
  }

  const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(plot.farm_id);
  if (!farm || farm.user_id !== userId) {
    throw new Error('无权操作该地块');
  }

  // 获取肥料信息
  const fertilizer = db.prepare('SELECT * FROM fertilizers WHERE id = ?').get(fertilizerId);
  if (!fertilizer) {
    throw new Error('肥料不存在');
  }

  // 检查金币
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || user.coins < fertilizer.price) {
    throw new Error('金币不足');
  }

  // 扣除金币
  db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(fertilizer.price, userId);

  const now = new Date().toISOString();
  let newFertility = null;

  // 应用效果
  if (fertilizer.type === 'growth') {
    // 标记种植记录使用生长肥料
    const planting = db.prepare('SELECT * FROM plantings WHERE plot_id = ? AND harvested_at IS NULL').get(plotId);
    if (planting) {
      db.prepare('UPDATE plantings SET fertilizer_applied = 1 WHERE id = ?').run(planting.id);
    }
  } else if (fertilizer.type === 'pest') {
    // 插入防虫剂记录
    const expiresAt = new Date(Date.now() + fertilizer.duration * 1000).toISOString();
    db.prepare('INSERT INTO plot_fertilizers (plot_id, fertilizer_id, applied_at, expires_at) VALUES (?, ?, ?, ?)').run(plotId, fertilizerId, now, expiresAt);
  } else if (fertilizer.type === 'soil') {
    // 提升土壤肥力
    newFertility = Math.min(100, (plot.soil_fertility || 50) + fertilizer.effect_value);
    db.prepare('UPDATE plots SET soil_fertility = ? WHERE id = ?').run(newFertility, plotId);
  }

  // 统一插入 plot_fertilizers 记录（pest 已插入，其他类型也记录）
  if (fertilizer.type !== 'pest') {
    const expiresAt = fertilizer.duration > 0 ? new Date(Date.now() + fertilizer.duration * 1000).toISOString() : null;
    db.prepare('INSERT INTO plot_fertilizers (plot_id, fertilizer_id, applied_at, expires_at) VALUES (?, ?, ?, ?)').run(plotId, fertilizerId, now, expiresAt);
  }

  return { fertilizer, cost: fertilizer.price, newFertility };
}

/**
 * 除虫
 */
function removePest(userId, plotId) {
  const db = getDatabase();

  // 验证地块属于用户
  const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(plotId);
  if (!plot) {
    throw new Error('地块不存在');
  }

  const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(plot.farm_id);
  if (!farm || farm.user_id !== userId) {
    throw new Error('无权操作该地块');
  }

  const planting = db.prepare('SELECT * FROM plantings WHERE plot_id = ? AND harvested_at IS NULL').get(plotId);
  if (!planting) {
    throw new Error('该地块没有作物');
  }

  if (!planting.pest_infected) {
    throw new Error('该地块没有虫害');
  }

  const newHealth = Math.min(100, (planting.health_score || 0) + 20);
  db.prepare('UPDATE plantings SET pest_infected = 0, health_score = ? WHERE id = ?').run(newHealth, planting.id);

  return { success: true };
}

/**
 * 获取好友农场（查看模式，不能操作）
 * @param {number} userId - 当前用户ID
 * @param {number} friendId - 好友ID
 * @returns {Object} - 好友农场数据
 */
function getFriendFarm(userId, friendId) {
  const db = getDatabase();

  // 检查是否为好友关系
  const friendship = db.prepare("SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'accepted'").get(userId, friendId);
  if (!friendship) {
    throw new Error('只能查看好友的农场');
  }

  const farm = getFarmByUserId(friendId);

  // 移除敏感信息（金币、经验）
  const { coins, experience, ...safeFarm } = farm;

  return safeFarm;
}

module.exports = {
  getFarmByUserId,
  getFriendFarm,
  plantCrop,
  waterCrop,
  harvestCrop,
  applyFertilizer,
  removePest
};
