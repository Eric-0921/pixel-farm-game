const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_FILE = path.resolve('./database/farm_game.json');

// 内存数据库对象
const db = {
  users: [],
  farms: [],
  plots: [],
  crop_types: [],
  plantings: [],
  friends: [],
  notifications: [],
  messages: [],
  daily_actions: [],
  gifts: [],
  _seq: { users: 1, farms: 1, plots: 1, crop_types: 1, plantings: 1, friends: 1, notifications: 1, messages: 1, daily_actions: 1, gifts: 1 }
};

function save() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) { console.error('save error:', e); }
}

function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      Object.assign(db, data);
      return true;
    }
  } catch (e) { console.error('load error:', e); }
  return false;
}

function nextId(table) {
  const id = db._seq[table] || 1;
  db._seq[table] = id + 1;
  return id;
}

function findOne(arr, fn) {
  return arr.find(fn) || null;
}

function findAll(arr, fn) {
  return arr.filter(fn);
}

function initDatabase() {
  console.log('🌱 初始化数据库...');
  const loaded = load();
  
  if (!loaded || db.crop_types.length === 0) {
    db.crop_types = [
      { id: nextId('crop_types'), name: '小麦', description: '金黄的小麦，生长迅速', growth_time: 60, sell_price: 15, buy_price: 10, color: '#F4D03F', stages: 4 },
      { id: nextId('crop_types'), name: '胡萝卜', description: '脆甜的胡萝卜', growth_time: 120, sell_price: 30, buy_price: 20, color: '#E67E22', stages: 4 },
      { id: nextId('crop_types'), name: '番茄', description: '鲜红的番茄', growth_time: 180, sell_price: 50, buy_price: 35, color: '#E74C3C', stages: 4 },
      { id: nextId('crop_types'), name: '玉米', description: '饱满的玉米', growth_time: 300, sell_price: 80, buy_price: 50, color: '#F1C40F', stages: 5 },
      { id: nextId('crop_types'), name: '南瓜', description: '大大的南瓜', growth_time: 600, sell_price: 150, buy_price: 90, color: '#D35400', stages: 5 }
    ];
    save();
  }
  console.log('✅ 数据库就绪');
}

function getDatabase() {
  return {
    prepare(sql) {
      const s = sql.toLowerCase();
      
      // ---- SELECT ----
      if (s.trim().startsWith('select')) {
        // users
        if (s.includes('from users')) {
          if (s.includes('where username = ?')) {
            return { get: (v) => findOne(db.users, r => r.username === v), all: () => [] };
          }
          if (s.includes('where id = ?')) {
            return { get: (v) => findOne(db.users, r => r.id === v), all: () => [] };
          }
          return { get: () => db.users[0] || null, all: () => db.users };
        }
        // farms
        if (s.includes('from farms')) {
          if (s.includes('where user_id = ?')) {
            return {
              get: (v) => {
                const farm = findOne(db.farms, r => r.user_id === v);
                if (!farm) return null;
                // 如果 SQL 包含 JOIN users，合并用户字段
                if (s.includes('join users')) {
                  const user = findOne(db.users, r => r.id === v);
                  if (user) {
                    return { ...farm, coins: user.coins, experience: user.experience, display_name: user.display_name };
                  }
                }
                return farm;
              },
              all: (v) => {
                const farms = findAll(db.farms, r => r.user_id === v);
                if (s.includes('join users')) {
                  return farms.map(farm => {
                    const user = findOne(db.users, r => r.id === farm.user_id);
                    return user ? { ...farm, coins: user.coins, experience: user.experience, display_name: user.display_name } : farm;
                  });
                }
                return farms;
              }
            };
          }
          return { get: () => db.farms[0] || null, all: () => db.farms };
        }
        // plots
        if (s.includes('from plots')) {
          if (s.includes('where farm_id = ? and x = ? and y = ?')) {
            return { get: (a,b,c) => findOne(db.plots, r => r.farm_id === a && r.x === b && r.y === c), all: () => [] };
          }
          // 处理带 JOIN 的 plots 查询 (p.id = ?)
          if (s.includes('where p.id = ?') || s.includes('where id = ?')) {
            return {
              get: (v) => {
                const plot = findOne(db.plots, r => r.id === v);
                if (!plot) return null;
                const result = { ...plot };
                // JOIN farms
                if (s.includes('join farms')) {
                  const farm = findOne(db.farms, r => r.id === plot.farm_id);
                  if (farm) result.user_id = farm.user_id;
                }
                // JOIN plantings
                if (s.includes('join plantings') || s.includes('left join plantings')) {
                  const planting = findOne(db.plantings, p => p.plot_id === plot.id && !p.harvested_at);
                  if (planting) {
                    const cols = sql.match(/select\s+(.+?)\s+from/i);
                    if (cols) {
                      const selectStr = cols[1];
                      if (selectStr.includes('pl.id as planting_id')) result.planting_id = planting.id;
                      if (selectStr.includes('pl.crop_type_id')) result.crop_type_id = planting.crop_type_id;
                      if (selectStr.includes('pl.planted_at')) result.planted_at = planting.planted_at;
                      if (selectStr.includes('pl.watered_at')) result.watered_at = planting.watered_at;
                      if (selectStr.includes('pl.growth_progress')) result.growth_progress = planting.growth_progress;
                    }
                  }
                }
                // JOIN crop_types
                if ((s.includes('join crop_types') || s.includes('left join crop_types')) && result.crop_type_id) {
                  const cropType = findOne(db.crop_types, c => c.id === result.crop_type_id);
                  if (cropType) {
                    const cols = sql.match(/select\s+(.+?)\s+from/i);
                    if (cols) {
                      const selectStr = cols[1];
                      if (selectStr.includes('ct.name as crop_name')) result.crop_name = cropType.name;
                      if (selectStr.includes('ct.growth_time')) result.growth_time = cropType.growth_time;
                      if (selectStr.includes('ct.sell_price')) result.sell_price = cropType.sell_price;
                      if (selectStr.includes('ct.buy_price')) result.buy_price = cropType.buy_price;
                      if (selectStr.includes('ct.color')) result.color = cropType.color;
                      if (selectStr.includes('ct.stages')) result.stages = cropType.stages;
                    }
                  }
                }
                return result;
              },
              all: () => []
            };
          }
          if (s.includes('where farm_id = ?')) {
            return {
              get: () => null,
              all: (v) => {
                const plots = findAll(db.plots, r => r.farm_id === v);
                return plots.map(plot => {
                  const result = { ...plot };
                  // JOIN plantings
                  if (s.includes('join plantings') || s.includes('left join plantings')) {
                    const planting = findOne(db.plantings, p => p.plot_id === plot.id && !p.harvested_at);
                    if (planting) {
                      const cols = sql.match(/select\s+(.+?)\s+from/i);
                      if (cols) {
                        const selectStr = cols[1];
                        if (selectStr.includes('pl.id as planting_id')) result.planting_id = planting.id;
                        if (selectStr.includes('pl.crop_type_id')) result.crop_type_id = planting.crop_type_id;
                        if (selectStr.includes('pl.planted_at')) result.planted_at = planting.planted_at;
                        if (selectStr.includes('pl.watered_at')) result.watered_at = planting.watered_at;
                        if (selectStr.includes('pl.growth_progress')) result.growth_progress = planting.growth_progress;
                      }
                    }
                  }
                  // JOIN crop_types
                  if ((s.includes('join crop_types') || s.includes('left join crop_types')) && result.crop_type_id) {
                    const cropType = findOne(db.crop_types, c => c.id === result.crop_type_id);
                    if (cropType) {
                      const cols = sql.match(/select\s+(.+?)\s+from/i);
                      if (cols) {
                        const selectStr = cols[1];
                        if (selectStr.includes('ct.name as crop_name')) result.crop_name = cropType.name;
                        if (selectStr.includes('ct.growth_time')) result.growth_time = cropType.growth_time;
                        if (selectStr.includes('ct.sell_price')) result.sell_price = cropType.sell_price;
                        if (selectStr.includes('ct.buy_price')) result.buy_price = cropType.buy_price;
                        if (selectStr.includes('ct.color')) result.color = cropType.color;
                        if (selectStr.includes('ct.stages')) result.stages = cropType.stages;
                      }
                    }
                  }
                  return result;
                });
              }
            };
          }
          return { get: () => db.plots[0] || null, all: () => db.plots };
        }
        // crop_types
        if (s.includes('from crop_types')) {
          if (s.includes('where id = ?')) {
            return { get: (v) => findOne(db.crop_types, r => r.id === v), all: () => [] };
          }
          if (s.includes('where name = ?')) {
            return { get: (v) => findOne(db.crop_types, r => r.name === v), all: () => [] };
          }
          return { get: () => db.crop_types[0] || null, all: () => db.crop_types };
        }
        // plantings
        if (s.includes('from plantings')) {
          if (s.includes('where plot_id = ? and harvested_at is null')) {
            return { get: (v) => findOne(db.plantings, r => r.plot_id === v && !r.harvested_at), all: () => [] };
          }
          if (s.includes('where id = ?')) {
            return { get: (v) => findOne(db.plantings, r => r.id === v), all: () => [] };
          }
          if (s.includes('where harvested_at is null')) {
            return { get: () => null, all: () => findAll(db.plantings, r => !r.harvested_at) };
          }
          return { get: () => db.plantings[0] || null, all: () => db.plantings };
        }
        // friends
        if (s.includes('from friends')) {
          if ((s.includes('where f.user_id = ?') || s.includes('where user_id = ?')) && s.includes('join users')) {
            return {
              get: () => null,
              all: (...params) => {
                // 解析 WHERE 参数: f.user_id = ? AND f.status = ?
                let userIdVal, statusVal;
                let paramIdx = 0;
                const whereClause = sql.match(/where\s+(.+)/i);
                if (whereClause) {
                  const parts = whereClause[1].split(/\s+and\s+/i).map(w => w.trim());
                  for (const wp of parts) {
                    if (wp.match(/f?\.?user_id\s*=\s*\?/)) {
                      userIdVal = params[paramIdx++];
                    } else if (wp.match(/f?\.?status\s*=\s*['"]?([^'"?]+)['"]?/)) {
                      const m = wp.match(/f?\.?status\s*=\s*['"]?([^'"?]+)['"]?/);
                      statusVal = m[1];
                    } else if (wp.match(/f?\.?status\s*=\s*\?/)) {
                      statusVal = params[paramIdx++];
                    }
                  }
                }
                const friends = findAll(db.friends, r => r.user_id === userIdVal && r.status === statusVal);
                return friends.map(f => {
                  const user = findOne(db.users, r => r.id === f.friend_id);
                  return user ? {
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name,
                    status: f.status,
                    created_at: f.created_at
                  } : null;
                }).filter(Boolean);
              }
            };
          }
          if (s.includes('where user_id = ? and friend_id = ?') || s.includes('where f.user_id = ? and f.friend_id = ?')) {
            return { get: (a, b) => findOne(db.friends, r => r.user_id === a && r.friend_id === b), all: () => [] };
          }
          return { get: () => db.friends[0] || null, all: () => db.friends };
        }
        // notifications
        if (s.includes('from notifications')) {
          if (s.includes('where user_id = ?')) {
            return { get: () => null, all: (v) => findAll(db.notifications, r => r.user_id === v) };
          }
          return { get: () => db.notifications[0] || null, all: () => db.notifications };
        }
      }
      
      // ---- INSERT ----
      if (s.trim().startsWith('insert into')) {
        const m = sql.match(/insert into (\w+)/i);
        const table = m ? m[1].toLowerCase() : 'unknown';
        return {
          run(...params) {
            const record = { id: nextId(table) };
            
            // 解析列名和值: INSERT INTO table (col1, col2) VALUES (?, 'lit', ?)
            const colMatch = sql.match(/\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
            if (colMatch) {
              const cols = colMatch[1].split(',').map(c => c.trim());
              const vals = colMatch[2].split(',').map(c => c.trim());
              let paramIdx = 0;
              for (let i = 0; i < cols.length; i++) {
                const val = vals[i];
                if (val === '?') {
                  record[cols[i]] = params[paramIdx++];
                } else if (val.startsWith("'") && val.endsWith("'")) {
                  record[cols[i]] = val.slice(1, -1);
                } else if (!isNaN(val) && val !== '') {
                  record[cols[i]] = Number(val);
                } else if (val.toLowerCase() === 'current_timestamp') {
                  record[cols[i]] = new Date().toISOString();
                } else {
                  record[cols[i]] = val;
                }
              }
            }
            
            db[table].push(record);
            save();
            return { lastInsertRowid: record.id, changes: 1 };
          }
        };
      }
      
      // ---- UPDATE ----
      if (s.trim().startsWith('update')) {
        const m = sql.match(/update (\w+)/i);
        const table = m ? m[1].toLowerCase() : 'unknown';
        
        return {
          run(...params) {
            if (!db[table]) return { changes: 0 };
            
            // 提取 SET 和 WHERE 子句
            const setMatch = sql.match(/set\s+(.+?)\s+where\s+(.+)/i);
            if (!setMatch) return { changes: 0 };
            
            const setClause = setMatch[1];
            const whereClause = setMatch[2];
            
            // 解析 SET 表达式
            const setParts = setClause.split(',').map(s => s.trim());
            const assignments = [];
            let paramIdx = 0;
            
            for (const part of setParts) {
              const eqIdx = part.indexOf('=');
              if (eqIdx === -1) continue;
              const col = part.slice(0, eqIdx).trim();
              const expr = part.slice(eqIdx + 1).trim();
              
              if (expr === '?') {
                assignments.push({ col, type: 'assign', value: params[paramIdx++] });
              } else if (expr.startsWith("'") && expr.endsWith("'")) {
                assignments.push({ col, type: 'assign', value: expr.slice(1, -1) });
              } else if (!isNaN(expr) && expr !== '') {
                assignments.push({ col, type: 'assign', value: Number(expr) });
              } else if (expr.toLowerCase() === 'current_timestamp') {
                assignments.push({ col, type: 'assign', value: new Date().toISOString() });
              } else {
                // 处理算术表达式: col = col + ? / col = col - ? / col = col + 10 / col = col - 10
                const arithMatch = expr.match(/^(\w+)\s*([+\-])\s*(\?|\d+)$/);
                if (arithMatch) {
                  const refCol = arithMatch[1];
                  const op = arithMatch[2];
                  const valStr = arithMatch[3];
                  const value = valStr === '?' ? params[paramIdx++] : Number(valStr);
                  assignments.push({ col, type: 'arith', refCol, op, value });
                }
              }
            }
            
            // 解析 WHERE 条件
            const whereParts = whereClause.split(/\s+and\s+/i).map(w => w.trim());
            const conditions = [];
            for (const wp of whereParts) {
              // col = ?
              const eqMatch = wp.match(/^(\w+)\s*=\s*\?$/);
              if (eqMatch) {
                conditions.push({ col: eqMatch[1], type: 'eq', value: params[paramIdx++] });
                continue;
              }
              // col >= ? / col <= ? / col > ? / col < ?
              const cmpMatch = wp.match(/^(\w+)\s*([>=<]+)\s*\?$/);
              if (cmpMatch) {
                conditions.push({ col: cmpMatch[1], op: cmpMatch[2], type: 'cmp', value: params[paramIdx++] });
                continue;
              }
              // col IS NULL
              const nullMatch = wp.match(/^(\w+)\s+is\s+null$/i);
              if (nullMatch) {
                conditions.push({ col: nullMatch[1], type: 'null' });
                continue;
              }
            }
            
            // 匹配记录
            let records = db[table];
            for (const cond of conditions) {
              records = records.filter(r => {
                if (cond.type === 'eq') return r[cond.col] === cond.value;
                if (cond.type === 'cmp') {
                  if (cond.op === '>=') return r[cond.col] >= cond.value;
                  if (cond.op === '<=') return r[cond.col] <= cond.value;
                  if (cond.op === '>') return r[cond.col] > cond.value;
                  if (cond.op === '<') return r[cond.col] < cond.value;
                }
                if (cond.type === 'null') return r[cond.col] == null;
                return true;
              });
            }
            
            for (const record of records) {
              for (const assign of assignments) {
                if (assign.type === 'assign') {
                  record[assign.col] = assign.value;
                } else if (assign.type === 'arith') {
                  const base = record[assign.refCol] || 0;
                  if (assign.op === '+') record[assign.col] = base + assign.value;
                  if (assign.op === '-') record[assign.col] = base - assign.value;
                }
              }
            }
            
            if (records.length > 0) save();
            return { changes: records.length };
          }
        };
      }
      
      return { get: () => null, all: () => [], run: () => ({ changes: 0 }) };
    },
    
    exec(sql) {
      // CREATE TABLE 等 DDL 在内存中无需执行
    }
  };
}

function createUserFarm(userId, farmName = '我的农场') {
  const farmId = nextId('farms');
  const { game } = require('./config');
  
  db.farms.push({
    id: farmId,
    user_id: userId,
    name: farmName,
    width: game.farmWidth,
    height: game.farmHeight,
    created_at: new Date().toISOString()
  });
  
  for (let y = 0; y < game.farmHeight; y++) {
    for (let x = 0; x < game.farmWidth; x++) {
      db.plots.push({
        id: nextId('plots'),
        farm_id: farmId,
        x,
        y,
        status: 'empty',
        created_at: new Date().toISOString()
      });
    }
  }
  
  save();
  return farmId;
}

module.exports = {
  getDatabase,
  initDatabase,
  createUserFarm,
  db,
  saveDatabase: save
};
