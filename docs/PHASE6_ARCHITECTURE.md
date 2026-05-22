# Phase 6 技术架构文档 — 真实感生态模拟

> 对应 ROADMAP Phase 6：像素小人 + 土壤/肥料/虫害/天气系统

---

## 一、像素小人系统

### 1.1 状态机

```
┌─────────┐    click     ┌──────────┐    arrive     ┌─────────┐
│  idle   │ ──────────→ │ walking  │ ────────────→ │ acting  │
└─────────┘             └──────────┘               └─────────┘
     ↑                                                 │
     └─────────────────────────────────────────────────┘
                     action_complete
```

- **idle**：站立、随机走动、伸懒腰
- **walking**：向目标地块移动
- **acting**：播放动作动画（种植/浇水/收获/除虫/施肥）
- 动作完成后自动回到 idle

### 1.2 数据结构（前端状态）

```js
const avatar = {
  x: 0,          // 像素坐标（相对于 Canvas）
  y: 0,
  targetX: null, // 目标坐标
  targetY: null,
  state: 'idle', // idle | walking | acting
  direction: 'down', // up | down | left | right
  actionQueue: [],   // 动作队列（支持连续点击）
  frameIndex: 0,     // 当前动画帧
  lastActionTime: Date.now()
};
```

### 1.3 寻路算法

农场是 8×6 网格，地块尺寸 28px，不需要复杂 A*：

```js
function moveToTarget(avatar, targetPlot) {
  const dx = targetPlot.x - avatar.x;
  const dy = targetPlot.y - avatar.y;
  const speed = 2; // 像素/帧
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < speed) {
    avatar.x = targetPlot.x;
    avatar.y = targetPlot.y;
    return true; // 到达
  }
  
  avatar.x += (dx / distance) * speed;
  avatar.y += (dy / distance) * speed;
  
  // 更新方向
  if (Math.abs(dx) > Math.abs(dy)) {
    avatar.direction = dx > 0 ? 'right' : 'left';
  } else {
    avatar.direction = dy > 0 ? 'down' : 'up';
  }
  
  return false;
}
```

### 1.4 渲染集成

小人在 `renderFarm()` 之后绘制：

```js
renderFarm(farmData, state);      // 先画农场
renderAvatar(avatar, state);      // 再画小人（覆盖在地块上）
renderParticles(state.particles); // 最后画粒子
```

---

## 二、作物图案升级

### 2.1 数据库变更

```sql
-- crop_types 表新增 sprite 配置
ALTER TABLE crop_types ADD COLUMN sprite_config TEXT;

-- 示例数据（小麦）
UPDATE crop_types SET sprite_config = '{
  "stages": [
    {"shapes":[{"type":"rect","x":-2,"y":0,"w":4,"h":3,"color":"#3d6b2a"}]},
    {"shapes":[{"type":"rect","x":-1,"y":-3,"w":2,"h":5,"color":"#5a9e3d"},{"type":"rect","x":-3,"y":-4,"w":2,"h":2,"color":"#5a9e3d"}]},
    {"shapes":[{"type":"rect","x":-1,"y":-7,"w":2,"h":9,"color":"#7bc45a"},{"type":"rect","x":-4,"y":-5,"w":3,"h":3,"color":"#7bc45a"}]},
    {"shapes":[{"type":"rect","x":-1,"y":-9,"w":2,"h":11,"color":"#9ee07a"},{"type":"rect","x":-5,"y":-6,"w":3,"h":4,"color":"#D4AF37"},{"type":"rect","x":2,"y":-7,"w":3,"h":4,"color":"#D4AF37"}]}
  ],
  "windSway": true,
  "swayAmplitude": 2,
  "swaySpeed": 0.05
}' WHERE name = '小麦';
```

### 2.2 渲染器改造

`renderer.js` 的 `drawCrop()` 改为读取 `plot.sprite_config`：

```js
drawCrop(x, y, size, plot) {
  const config = JSON.parse(plot.sprite_config || '{}');
  const stage = Math.floor(plot.growth_progress * config.stages.length);
  const shapes = config.stages[stage]?.shapes || [];
  
  // 风吹摆动
  let swayX = 0;
  if (config.windSway) {
    swayX = Math.sin(this.frameCount * config.swaySpeed + plot.x) * config.swayAmplitude;
  }
  
  const cx = x + size / 2 + swayX;
  const cy = y + size / 2;
  
  shapes.forEach(shape => {
    this.ctx.fillStyle = shape.color;
    this.fillPixelRect(cx + shape.x, cy + shape.y, shape.w, shape.h);
  });
}
```

---

## 三、土壤系统

### 3.1 数据库变更

```sql
ALTER TABLE plots ADD COLUMN soil_moisture INTEGER DEFAULT 50;
ALTER TABLE plots ADD COLUMN soil_fertility INTEGER DEFAULT 50;

-- 索引
CREATE INDEX idx_plots_soil ON plots(soil_moisture, soil_fertility);
```

### 3.2 后端逻辑

**自然变化**（每分钟执行）：
```js
function updateSoilState() {
  const db = getDatabase();
  const plots = db.prepare('SELECT * FROM plots WHERE status = ?').all('planted');
  
  plots.forEach(plot => {
    let moisture = plot.soil_moisture - 1; // 每小时自然蒸发 -1
    let fertility = plot.soil_fertility;
    
    // 作物吸收水分
    const planting = db.prepare('SELECT * FROM plantings WHERE plot_id = ? AND harvested_at IS NULL').get(plot.id);
    if (planting) {
      moisture -= 0.5; // 作物持续消耗水分
    }
    
    // 边界
    moisture = Math.max(0, Math.min(100, moisture));
    
    db.prepare('UPDATE plots SET soil_moisture = ?, soil_fertility = ? WHERE id = ?')
      .run(moisture, fertility, plot.id);
  });
}
```

### 3.3 前端渲染

```js
drawPlot(x, y, size, plot) {
  // 土壤颜色根据湿度和肥力计算
  const moisture = plot.soil_moisture || 50;
  const fertility = plot.soil_fertility || 50;
  
  let baseColor = this.colors.soil; // 默认
  
  if (moisture < 30) {
    baseColor = '#C4A35A'; // 干燥
    this.drawCracks(x, y, size); // 裂纹纹理
  } else if (moisture > 70) {
    baseColor = '#5C4033'; // 湿润
    this.drawGloss(x, y, size); // 光泽点
  }
  
  if (fertility < 30) {
    baseColor = this.blendColors(baseColor, '#BDB76B', 0.3); // 偏贫瘠
  } else if (fertility > 70) {
    baseColor = this.blendColors(baseColor, '#3D2B1F', 0.3); // 偏肥沃
    this.drawOrganic(x, y, size); // 有机质颗粒
  }
  
  this.ctx.fillStyle = baseColor;
  this.ctx.fillRect(x, y, size, size);
}
```

---

## 四、肥料系统

### 4.1 数据库

```sql
CREATE TABLE fertilizers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'growth' | 'pest' | 'soil'
  effect_value INTEGER NOT NULL,
  duration INTEGER NOT NULL, -- 秒，0=永久
  price INTEGER NOT NULL,
  color TEXT,
  description TEXT
);

CREATE TABLE plot_fertilizers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plot_id INTEGER NOT NULL,
  fertilizer_id INTEGER NOT NULL,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  FOREIGN KEY (plot_id) REFERENCES plots(id),
  FOREIGN KEY (fertilizer_id) REFERENCES fertilizers(id)
);

-- 初始化数据
INSERT INTO fertilizers (name, type, effect_value, duration, price, color, description) VALUES
('营养液', 'growth', 30, 600, 15, '#4a9eff', '生长速度+30%，持续10分钟'),
('防虫剂', 'pest', 1, 86400, 20, '#27ae60', '防止虫害，持续24小时'),
('有机肥', 'soil', 20, 0, 25, '#8B6914', '提升土壤肥力+20，永久');
```

### 4.2 API

```js
// POST /api/farm/fertilize
// Body: { plotId, fertilizerId }
router.post('/fertilize', authenticateToken, (req, res) => {
  try {
    const { plotId, fertilizerId } = req.body;
    const result = farmService.applyFertilizer(req.userId, plotId, fertilizerId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
```

### 4.3 Service 逻辑

```js
function applyFertilizer(userId, plotId, fertilizerId) {
  const db = getDatabase();
  
  // 验证地块属于用户
  const plot = db.prepare('SELECT p.*, f.user_id FROM plots p JOIN farms f ON p.farm_id = f.id WHERE p.id = ?').get(plotId);
  if (!plot || plot.user_id !== userId) throw new Error('地块不存在');
  
  // 获取肥料信息
  const fertilizer = db.prepare('SELECT * FROM fertilizers WHERE id = ?').get(fertilizerId);
  if (!fertilizer) throw new Error('肥料不存在');
  
  // 扣金币
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (user.coins < fertilizer.price) throw new Error('金币不足');
  db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(fertilizer.price, userId);
  
  // 应用效果
  if (fertilizer.type === 'soil') {
    const newFertility = Math.min(100, plot.soil_fertility + fertilizer.effect_value);
    db.prepare('UPDATE plots SET soil_fertility = ? WHERE id = ?').run(newFertility, plotId);
  }
  
  // 记录施肥
  const expiresAt = fertilizer.duration > 0 
    ? new Date(Date.now() + fertilizer.duration * 1000).toISOString()
    : null;
  db.prepare('INSERT INTO plot_fertilizers (plot_id, fertilizer_id, expires_at) VALUES (?, ?, ?)')
    .run(plotId, fertilizerId, expiresAt);
  
  return { fertilizer, cost: fertilizer.price };
}
```

---

## 五、虫害系统

### 5.1 数据库

```sql
ALTER TABLE plantings ADD COLUMN pest_infected INTEGER DEFAULT 0;
ALTER TABLE plantings ADD COLUMN health INTEGER DEFAULT 100;
```

### 5.2 触发逻辑（cropGrowthJob.js）

```js
function checkPestInfestation() {
  const db = getDatabase();
  const plantings = db.prepare(`
    SELECT p.*, pl.soil_fertility, pl.soil_moisture
    FROM plantings p
    JOIN plots pl ON p.plot_id = pl.id
    WHERE p.harvested_at IS NULL AND p.pest_infected = 0
  `).all();
  
  plantings.forEach(planting => {
    // 基础概率 1%/小时
    let probability = 0.01;
    
    // 土壤肥力低增加概率
    if (planting.soil_fertility < 30) probability += 0.02;
    
    // 干燥增加概率
    if (planting.soil_moisture < 30) probability += 0.01;
    
    // 检查是否有防虫剂
    const hasPestProtection = db.prepare(`
      SELECT COUNT(*) as count FROM plot_fertilizers pf
      JOIN fertilizers f ON pf.fertilizer_id = f.id
      WHERE pf.plot_id = ? AND f.type = 'pest' AND (pf.expires_at IS NULL OR pf.expires_at > datetime('now'))
    `).get(planting.plot_id).count > 0;
    
    if (!hasPestProtection && Math.random() < probability) {
      db.prepare('UPDATE plantings SET pest_infected = 1, health = health - 20 WHERE id = ?')
        .run(planting.id);
      
      // 发送通知
      const farm = db.prepare('SELECT f.user_id FROM farms f JOIN plots p ON p.farm_id = f.id WHERE p.id = ?').get(planting.plot_id);
      notificationService.createNotification(farm.user_id, 'pest', '发现虫害', '您的作物生了虫子，快除虫！');
    }
  });
}
```

### 5.3 除虫 API

```js
// POST /api/crops/remove-pest/:plantingId
router.post('/remove-pest/:plantingId', authenticateToken, (req, res) => {
  const result = farmService.removePest(req.userId, req.params.plantingId);
  res.json({ success: true, message: '除虫成功' });
});
```

---

## 六、天气系统

### 6.1 全局状态（服务器内存）

```js
// server/weather.js
let currentWeather = 'sunny'; // sunny | rainy | drought
let weatherDuration = 0;      // 当前天气已持续时间（分钟）
const WEATHER_CYCLE = 30;     // 每30分钟切换一次天气

function updateWeather() {
  weatherDuration++;
  if (weatherDuration >= WEATHER_CYCLE) {
    weatherDuration = 0;
    const roll = Math.random();
    if (roll < 0.5) currentWeather = 'sunny';
    else if (roll < 0.8) currentWeather = 'rainy';
    else currentWeather = 'drought';
    
    console.log(`🌤️ 天气变化: ${currentWeather}`);
    
    // 广播天气变化
    broadcast({ type: 'weather_change', weather: currentWeather });
  }
  
  // 天气效果
  if (currentWeather === 'rainy') {
    // 所有地块 soil_moisture +1
    const db = getDatabase();
    db.prepare('UPDATE plots SET soil_moisture = MIN(100, soil_moisture + 1) WHERE status = ?').run('planted');
  } else if (currentWeather === 'drought') {
    // 所有地块 soil_moisture -1
    const db = getDatabase();
    db.prepare('UPDATE plots SET soil_moisture = MAX(0, soil_moisture - 1) WHERE status = ?').run('planted');
  }
}

// 每分钟执行一次
setInterval(updateWeather, 60000);

module.exports = { getWeather: () => currentWeather };
```

### 6.2 前端渲染

```js
// renderer.js
renderWeather() {
  if (this.weather === 'rainy') {
    // 背景色调偏蓝
    this.ctx.fillStyle = 'rgba(30, 60, 100, 0.15)';
    this.ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
    
    // 雨滴
    for (let i = 0; i < 20; i++) {
      const rx = (this.frameCount * 3 + i * 47) % this.gameWidth;
      const ry = (this.frameCount * 4 + i * 31) % this.gameHeight;
      this.ctx.fillStyle = '#4a9eff';
      this.fillPixelRect(rx, ry, 2, 4);
    }
  } else if (this.weather === 'drought') {
    // 背景色调偏黄
    this.ctx.fillStyle = 'rgba(200, 150, 50, 0.1)';
    this.ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
  }
}
```

---

## 七、作物健康度

### 7.1 计算逻辑

```js
function calculateHealth(plot, planting) {
  const moisture = plot.soil_moisture || 50;
  const fertility = plot.soil_fertility || 50;
  const hasPest = planting.pest_infected || 0;
  
  let health = (moisture / 100 * 40) + (fertility / 100 * 30);
  health += hasPest ? 0 : 30;
  
  return Math.min(100, Math.max(0, Math.round(health)));
}
```

### 7.2 影响收获

```js
function harvestCrop(userId, plotId) {
  // ... 原有逻辑
  
  const health = calculateHealth(plot, planting);
  let yield = cropType.sell_price;
  
  if (health < 50) {
    yield = Math.floor(yield * 0.8); // 减产 20%
  } else if (health > 80) {
    yield = Math.floor(yield * 1.2); // 增产 20%
  }
  
  // ... 发放金币
}
```

---

## 八、实现优先级

| 优先级 | 模块 | 依赖 | 工时 |
|--------|------|------|------|
| P0 | 像素小人绘制 + 行走 | 无 | 1 天 |
| P0 | 动作动画（种植/浇水/收获） | 像素小人 | 1 天 |
| P1 | 土壤湿度/肥力 + 渲染 | 无 | 0.5 天 |
| P1 | 作物图案升级 | 无 | 1 天 |
| P1 | 肥料系统 | 土壤系统 | 1 天 |
| P2 | 虫害系统 | 肥料系统 | 0.5 天 |
| P2 | 天气系统 | 土壤系统 | 0.5 天 |
| P2 | 空闲动画/语音绑定 | 像素小人 | 0.5 天 |
| P3 | 健康度系统 | 土壤+虫害 | 0.5 天 |
| P3 | 雨天撑伞/看天 | 天气+小人 | 0.5 天 |

**总计：3-4 天**
