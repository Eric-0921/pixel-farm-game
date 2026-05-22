/**
 * 像素渲染引擎
 * 使用 Canvas 绘制像素风格的农场场景
 */
class PixelRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // 游戏内部分辨率（低分辨率像素风格）
    this.gameWidth = 320;
    this.gameHeight = 240;
    
    // 适配高 DPI / Retina 屏幕
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.canvas.width = this.gameWidth * dpr;
    this.canvas.height = this.gameHeight * dpr;
    this.ctx.scale(dpr, dpr);
    
    // 像素风格渲染设置
    this.ctx.imageSmoothingEnabled = false;
    
    // 颜色调色板
    this.colors = {
      grass: '#5a8f3c',
      grassDark: '#4a7c32',
      grassLight: '#6ba84a',
      soil: '#8B6914',
      soilWet: '#6B4E0A',
      soilTilled: '#A07820',
      water: '#4a9eff',
      outline: '#1a2e25',
      highlight: '#f0e6d2',
      withered: '#6b5b4f',
      progressBg: 'rgba(0,0,0,0.5)',
      progressFill: '#27ae60',
      progressFillNear: '#f1c40f'
    };
    
    // 作物生长阶段颜色映射
    this.cropStageColors = {
      seed: '#3d6b2a',
      sprout: '#5a9e3d',
      growing: '#7bc45a',
      mature: '#9ee07a'
    };
    
    // 动画帧计数器
    this.frameCount = 0;
    
    // 草地动画偏移
    this.grassAnimOffset = 0;
    
    // Phase 6: 集成新渲染模块（如果可用）
    this.cropSprites = (typeof CropSpriteRenderer !== 'undefined') ? new CropSpriteRenderer() : null;
    this.soilRenderer = (typeof SoilRenderer !== 'undefined') ? new SoilRenderer() : null;
  }

  /**
   * 清除画布
   */
  clear(weatherEffects) {
    // Phase 6: 根据天气使用不同草地颜色
    const grassColor = (weatherEffects && weatherEffects.getGrassColor) 
      ? weatherEffects.getGrassColor() 
      : this.colors.grass;
    this.ctx.fillStyle = grassColor;
    this.ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
    
    // 绘制草地纹理（像素点）
    this.ctx.fillStyle = this.colors.grassLight;
    for (let i = 0; i < 30; i++) {
      const gx = ((i * 37 + this.grassAnimOffset) % this.gameWidth);
      const gy = ((i * 53) % this.gameHeight);
      this.ctx.fillRect(Math.floor(gx), Math.floor(gy), 2, 2);
    }
  }

  /**
   * 绘制农场场景
   */
  renderFarm(farmData, state = {}) {
    this.frameCount++;
    this.grassAnimOffset = Math.sin(this.frameCount * 0.02) * 1;
    
    this.clear(state.weatherEffects);
    
    if (!farmData || !farmData.plots) {
      // 绘制等待提示
      this.drawText('正在加载农场...', this.gameWidth / 2, this.gameHeight / 2, {
        align: 'center',
        color: '#8ab88a',
        size: 12
      });
      return;
    }
    
    const { width, height, plots } = farmData;
    
    // 计算地块尺寸和偏移，使其居中
    const plotSize = 28;
    const gap = 2;
    const totalWidth = width * (plotSize + gap);
    const totalHeight = height * (plotSize + gap);
    const offsetX = Math.floor((this.gameWidth - totalWidth) / 2);
    const offsetY = Math.floor((this.gameHeight - totalHeight) / 2) + 8;
    
    // Phase 6: 绘制天气背景层（在地块下方）
    if (state.weatherEffects) {
      state.weatherEffects.drawBackground(this.ctx);
    }
    
    // 绘制每个地块
    plots.forEach(plot => {
      const x = offsetX + plot.x * (plotSize + gap);
      const y = offsetY + plot.y * (plotSize + gap);
      this.drawPlot(x, y, plotSize, plot, state, offsetX, offsetY, plotSize, gap);
    });
    
    // Phase 6: 绘制像素小人
    if (state.avatar) {
      state.avatar.draw(this.ctx, this.frameCount);
    }
    
    // Phase 6: 绘制天气效果（雨滴等，在最上层）
    if (state.weatherEffects) {
      state.weatherEffects.drawRain(this.ctx);
    }
    
    // 绘制农场标题
    this.drawText(farmData.name || '我的农场', this.gameWidth / 2, 12, {
      align: 'center',
      color: '#f0e6d2',
      size: 10,
      shadow: true
    });
    
    // 绘制地块统计
    const plantedCount = plots.filter(p => p.status === 'planted').length;
    const matureCount = plots.filter(p => p.status === 'planted' && p.is_mature).length;
    const statsText = matureCount > 0 
      ? `种植: ${plantedCount}  可收获: ${matureCount}`
      : `种植: ${plantedCount}/48`;
    this.drawText(statsText, this.gameWidth / 2, this.gameHeight - 5, {
      align: 'center',
      color: '#8ab88a',
      size: 8
    });
  }

  /**
   * 绘制单个地块
   */
  drawPlot(x, y, size, plot, state, offsetX, offsetY, plotSize, gap) {
    const isHovered = state.hoverPlot && state.hoverPlot.plot_id === plot.plot_id;
    const isSelected = state.selectedPlot && state.selectedPlot.plot_id === plot.plot_id;
    
    // Phase 6: 使用土壤渲染器（如果可用且是种植状态）
    if (this.soilRenderer && plot.status === 'planted') {
      this.soilRenderer.drawSoil(this.ctx, x, y, size, plot);
    } else {
      // 原有绘制逻辑作为 fallback
      // 绘制地块背景
      let bgColor = this.colors.grassDark;
      
      if (plot.status === 'empty') {
        bgColor = this.colors.grassDark;
      } else if (plot.status === 'planted') {
        bgColor = plot.is_watered ? this.colors.soilWet : this.colors.soil;
      } else if (plot.status === 'withered') {
        bgColor = this.colors.withered;
      }
      
      this.ctx.fillStyle = bgColor;
      this.ctx.fillRect(x, y, size, size);
    }
    
    // 空地块额外绘制草皮效果
    if (plot.status === 'empty') {
      this.ctx.fillStyle = this.colors.grassLight;
      this.ctx.fillRect(x + 2, y + 2, 3, 2);
      this.ctx.fillRect(x + size - 6, y + size - 5, 3, 2);
      this.ctx.fillRect(x + 6, y + size - 4, 2, 2);
    }
    
    // 绘制内边框（像素风格）
    this.ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    
    // 外边框
    this.ctx.strokeStyle = this.colors.outline;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, size, size);
    
    // 悬停高亮
    if (isHovered) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.fillRect(x, y, size, size);
      this.ctx.strokeStyle = '#e8c547';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x - 1, y - 1, size + 2, size + 2);
    }
    
    // 选中高亮
    if (isSelected) {
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([2, 2]);
      this.ctx.strokeRect(x - 1, y - 1, size + 2, size + 2);
      this.ctx.setLineDash([]);
    }
    
    // 绘制作物
    if (plot.status === 'planted' && plot.crop_type_id) {
      // Phase 6: 优先使用独立作物图案
      if (this.cropSprites) {
        this.cropSprites.drawCrop(this.ctx, x, y, size, plot, this.frameCount);
      } else {
        this.drawCrop(x, y, size, plot);
      }
    }
    
    // 绘制枯萎标记
    if (plot.status === 'withered') {
      this.drawPixelText('X', x + size / 2, y + size / 2, {
        align: 'center',
        size: 12,
        color: '#3d2b20'
      });
    }
  }

  /**
   * 绘制作物
   */
  drawCrop(x, y, size, plot) {
    const progress = Math.min(1, plot.growth_progress || 0);
    const isMature = plot.is_mature || progress >= 1.0;
    const isWatered = plot.is_watered;
    const cropColor = plot.color || '#4a7c32';
    
    const cx = x + size / 2;
    const cy = y + size / 2;
    
    if (progress < 0.25) {
      // 种子阶段
      this.ctx.fillStyle = this.cropStageColors.seed;
      this.fillPixelRect(cx - 2, cy, 4, 3);
      this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
      this.fillPixelRect(cx - 1, cy + 2, 2, 1);
    } else if (progress < 0.5) {
      // 发芽阶段
      this.ctx.fillStyle = this.cropStageColors.sprout;
      this.fillPixelRect(cx - 1, cy - 3, 2, 5);
      this.fillPixelRect(cx - 3, cy - 4, 2, 2);
      this.fillPixelRect(cx + 1, cy - 3, 2, 2);
      // 根部阴影
      this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
      this.fillPixelRect(cx - 2, cy + 2, 4, 1);
    } else if (progress < 0.75) {
      // 生长阶段
      this.ctx.fillStyle = this.cropStageColors.growing;
      this.fillPixelRect(cx - 1, cy - 7, 2, 9);
      this.fillPixelRect(cx - 4, cy - 5, 3, 3);
      this.fillPixelRect(cx + 1, cy - 6, 3, 3);
      this.fillPixelRect(cx - 3, cy - 8, 2, 2);
      // 果实雏形
      this.ctx.fillStyle = this.darkenColor(cropColor, 0.8);
      this.fillPixelRect(cx - 2, cy - 9, 4, 3);
    } else {
      // 接近成熟/成熟
      this.ctx.fillStyle = this.cropStageColors.mature;
      this.fillPixelRect(cx - 1, cy - 9, 2, 11);
      this.fillPixelRect(cx - 5, cy - 6, 3, 4);
      this.fillPixelRect(cx + 2, cy - 7, 3, 4);
      this.fillPixelRect(cx - 4, cy - 10, 3, 3);
      this.fillPixelRect(cx + 1, cy - 11, 3, 3);
      
      this.ctx.fillStyle = cropColor;
      if (isMature) {
        this.fillPixelRect(cx - 4, cy - 11, 8, 7);
        // 高光
        this.ctx.fillStyle = 'rgba(255,255,255,0.25)';
        this.fillPixelRect(cx - 2, cy - 9, 3, 2);
        
        // 成熟闪烁效果
        if (Math.floor(this.frameCount / 20) % 2 === 0) {
          this.ctx.fillStyle = 'rgba(255,255,200,0.15)';
          this.fillPixelRect(x + 1, y + 1, size - 2, size - 2);
        }
        
        // 成熟标记（小星星）
        this.ctx.fillStyle = '#fff';
        this.fillPixelRect(cx + 3, cy - 11, 2, 2);
      } else {
        this.fillPixelRect(cx - 3, cy - 10, 6, 6);
        this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
        this.fillPixelRect(cx - 1, cy - 8, 2, 2);
      }
    }
    
    // 浇水效果
    if (isWatered) {
      this.ctx.fillStyle = 'rgba(74, 158, 255, 0.35)';
      this.fillPixelRect(x + 1, y + size - 4, size - 2, 3);
      
      const dropY = y + size - 6 + Math.sin(this.frameCount * 0.12 + plot.x * 0.7) * 2;
      this.ctx.fillStyle = this.colors.water;
      this.fillPixelRect(cx - 1, dropY, 2, 2);
    }
    
    // 生长进度条
    if (!isMature && progress > 0) {
      const barW = size - 6;
      const barH = 3;
      const barX = x + 3;
      const barY = y + 3;
      
      this.ctx.fillStyle = this.colors.progressBg;
      this.fillPixelRect(barX, barY, barW, barH);
      
      this.ctx.fillStyle = progress > 0.75 ? this.colors.progressFillNear : this.colors.progressFill;
      this.fillPixelRect(barX, barY, Math.max(1, Math.floor(barW * progress)), barH);
    }
    
    // 成熟度标记
    if (isMature) {
      this.ctx.fillStyle = '#f1c40f';
      this.fillPixelRect(x + size - 6, y + 2, 4, 4);
    }
  }

  /**
   * 填充像素矩形（确保整数坐标）
   */
  fillPixelRect(x, y, w, h) {
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  /**
   * 绘制像素风格文字
   */
  drawText(text, x, y, options = {}) {
    const {
      align = 'left',
      color = '#f0e6d2',
      size = 10,
      shadow = false
    } = options;
    
    this.ctx.font = `bold ${size}px 'Courier New', 'Microsoft YaHei', monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    
    if (shadow) {
      this.ctx.fillStyle = '#2a1810';
      this.ctx.fillText(text, x + 1, y + 1);
    }
    
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }

  /**
   * 绘制像素文字（更小的）
   */
  drawPixelText(text, x, y, options = {}) {
    const {
      align = 'left',
      color = '#f0e6d2',
      size = 10
    } = options;
    
    this.ctx.font = `bold ${size}px monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }

  /**
   * 绘制粒子效果
   */
  drawParticles(particles) {
    if (!particles) return;
    this.ctx.save();
    particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.fillPixelRect(p.x, p.y, p.size, p.size);
    });
    this.ctx.restore();
  }

  /**
   * 颜色变暗辅助函数
   */
  darkenColor(hex, factor) {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) {
      return 'rgb(128, 128, 128)';
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return 'rgb(128, 128, 128)';
    }
    return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
  }
}

// 全局渲染器实例
let renderer = null;

function initRenderer(canvas) {
  renderer = new PixelRenderer(canvas);
  return renderer;
}
