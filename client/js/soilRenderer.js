/**
 * 土壤状态渲染器
 * 根据 soil_moisture 和 soil_fertility 绘制 5 种土壤状态
 */
class SoilRenderer {
  constructor() {
    // plot_id -> 裂纹随机种子（确保同一地块纹理稳定）
    this.cracks = new Map();
    // plot_id -> 光泽点/有机质颗粒位置数组
    this.particles = new Map();
  }

  /**
   * 绘制土壤
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - 地块左上角 X
   * @param {number} y - 地块左上角 Y
   * @param {number} size - 地块尺寸（28px）
   * @param {Object} plot - 地块数据 { plot_id, soil_moisture, soil_fertility }
   */
  drawSoil(ctx, x, y, size, plot) {
    const moisture = plot.soil_moisture || 50;
    const fertility = plot.soil_fertility || 50;
    const plotId = plot.plot_id || 0;

    // 确定底色（先根据湿度）
    let baseColor = '#8B6914';
    if (moisture < 30) baseColor = '#C4A35A';
    else if (moisture > 70) baseColor = '#5C4033';

    // 再根据肥力混合
    if (fertility < 30) {
      baseColor = this.blendColor(baseColor, '#BDB76B', 0.3);
    } else if (fertility > 70) {
      baseColor = this.blendColor(baseColor, '#3D2B1F', 0.3);
    }

    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, size, size);

    // 绘制纹理（优先级：干燥裂纹、湿润光泽、肥沃颗粒、贫瘠草皮）
    if (moisture < 30) {
      this.drawCracks(ctx, x, y, size, plotId);
    }
    if (moisture > 70) {
      this.drawWetShine(ctx, x, y, size, plotId);
    }
    if (fertility > 70) {
      this.drawOrganic(ctx, x, y, size, plotId);
    }
    if (fertility < 30) {
      this.drawSparseGrass(ctx, x, y, size);
    }
  }

  /**
   * 简单的 RGB 颜色混合
   * @param {string} c1 - hex 颜色 1
   * @param {string} c2 - hex 颜色 2
   * @param {number} ratio - c2 混合比例 0~1
   * @returns {string} hex 颜色
   */
  blendColor(c1, c2, ratio) {
    const hex = (h) => {
      const v = parseInt(h.replace('#', ''), 16);
      return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
    };
    const [r1, g1, b1] = hex(c1);
    const [r2, g2, b2] = hex(c2);
    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 获取/初始化确定性随机数种子
   */
  _getSeed(plotId) {
    // 使用 plotId 本身作为种子基础，确保同一地块始终一致
    return plotId * 9301 + 49297;
  }

  /**
   * 线性同余伪随机数生成器（确定性）
   */
  _random(seed) {
    const next = (seed * 1664525 + 1013904223) & 0xffffffff;
    return { value: (next >>> 0) / 0xffffffff, next };
  }

  /**
   * 生成并缓存颗粒位置
   */
  _ensureParticles(plotId, count, size) {
    if (!this.particles.has(plotId)) {
      this.particles.set(plotId, []);
    }
    const list = this.particles.get(plotId);
    if (list.length < count) {
      let seed = this._getSeed(plotId);
      for (let i = list.length; i < count; i++) {
        const rx = this._random(seed);
        seed = rx.next;
        const ry = this._random(seed);
        seed = ry.next;
        list.push({
          x: Math.floor(rx.value * (size - 2)) + 1,
          y: Math.floor(ry.value * (size - 2)) + 1
        });
      }
    }
    return list.slice(0, count);
  }

  /**
   * 绘制干燥裂纹（2-3 条随机裂纹）
   */
  drawCracks(ctx, x, y, size, plotId) {
    let seed = this._getSeed(plotId);
    const rx1 = this._random(seed); seed = rx1.next;
    const count = 2 + Math.floor(rx1.value * 2); // 2~3 条

    ctx.fillStyle = '#8B7355';
    for (let i = 0; i < count; i++) {
      const rs = this._random(seed); seed = rs.next;
      const rx = this._random(seed); seed = rx.next;
      const ry = this._random(seed); seed = ry.next;
      const rl = this._random(seed); seed = rl.next;
      const rd = this._random(seed); seed = rd.next;

      const startX = x + Math.floor(rx.value * (size - 4)) + 2;
      const startY = y + Math.floor(ry.value * (size - 4)) + 2;
      const length = 3 + Math.floor(rl.value * 5); // 3~7 像素
      const dirX = rd.value > 0.5 ? 1 : -1;
      const dirY = (rd.value > 0.3 && rd.value < 0.7) ? 1 : -1;

      // 绘制折线裂纹（2-3 段）
      let cx = startX;
      let cy = startY;
      const segLen = Math.max(1, Math.floor(length / 2));
      for (let s = 0; s < 2; s++) {
        const nx = cx + segLen * dirX;
        const ny = cy + segLen * dirY;
        // 用 1px 矩形模拟线段
        const steps = Math.max(1, segLen);
        for (let t = 0; t <= steps; t++) {
          const px = Math.floor(cx + (nx - cx) * (t / steps));
          const py = Math.floor(cy + (ny - cy) * (t / steps));
          ctx.fillRect(px, py, 1, 1);
        }
        cx = nx;
        cy = ny;
      }
    }
  }

  /**
   * 绘制湿润光泽点（3-5 个光泽点）
   */
  drawWetShine(ctx, x, y, size, plotId) {
    let seed = this._getSeed(plotId);
    const rc = this._random(seed); seed = rc.next;
    const count = 3 + Math.floor(rc.value * 3); // 3~5 个

    const positions = this._ensureParticles(plotId, count, size);

    ctx.fillStyle = '#6B8E23';
    for (const pos of positions) {
      ctx.fillRect(x + pos.x, y + pos.y, 1, 1);
    }
  }

  /**
   * 绘制肥沃有机质颗粒（5-8 个颗粒）
   */
  drawOrganic(ctx, x, y, size, plotId) {
    let seed = this._getSeed(plotId);
    const rc = this._random(seed); seed = rc.next;
    const count = 5 + Math.floor(rc.value * 4); // 5~8 个

    const positions = this._ensureParticles(plotId + 10000, count, size);

    ctx.fillStyle = '#8B4513';
    for (const pos of positions) {
      ctx.fillRect(x + pos.x, y + pos.y, 1, 1);
      // 部分颗粒大一点（2×1）
      if (pos.x < size - 1) {
        ctx.fillRect(x + pos.x + 1, y + pos.y, 1, 1);
      }
    }
  }

  /**
   * 绘制贫瘠稀疏草皮（减少草皮，显得稀疏）
   */
  drawSparseGrass(ctx, x, y, size) {
    // 比正常草皮更少、更淡的草皮点
    ctx.fillStyle = '#9CAF88';
    // 只画 2-3 个稀疏点
    const sparse = [
      { x: 3, y: 3 },
      { x: size - 5, y: size - 4 },
      { x: size / 2, y: size - 3 }
    ];
    for (const p of sparse) {
      ctx.fillRect(x + Math.floor(p.x), y + Math.floor(p.y), 2, 1);
    }
  }
}

window.SoilRenderer = SoilRenderer;
