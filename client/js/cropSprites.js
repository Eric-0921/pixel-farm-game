/**
 * 作物图案渲染器
 * 使用硬编码像素数据绘制 5 种作物的生长阶段
 */
class CropSpriteRenderer {
  constructor() {
    this.frameCount = 0;

    // 作物图案定义：每种作物每个阶段为一组 fillRect 形状
    // 坐标以地块中心为原点 (cx, cy)，使用中心锚点绘制
    this.cropDefs = {
      wheat: {
        stages: [
          // 0: 种子 - 小棕点
          [{ x: -1, y: 2, w: 2, h: 2, color: '#8B6914' }],
          // 1: 发芽 - 细茎 + 小叶
          [
            { x: 0, y: -1, w: 1, h: 4, color: '#6B8E23' },
            { x: -2, y: -1, w: 1, h: 1, color: '#90EE90' },
            { x: 1, y: -2, w: 1, h: 1, color: '#90EE90' }
          ],
          // 2: 生长 - 长茎 + 大叶
          [
            { x: 0, y: -5, w: 1, h: 8, color: '#6B8E23' },
            { x: -3, y: -3, w: 2, h: 2, color: '#7CFC00' },
            { x: 2, y: -4, w: 2, h: 2, color: '#7CFC00' },
            { x: -2, y: -6, w: 1, h: 1, color: '#7CFC00' }
          ],
          // 3: 成熟 - 金色麦穗 + 茎
          [
            { x: 0, y: -7, w: 1, h: 10, color: '#6B8E23' },
            { x: -3, y: -9, w: 2, h: 2, color: '#FFD700' },
            { x: 2, y: -10, w: 2, h: 2, color: '#FFD700' },
            { x: -2, y: -11, w: 1, h: 2, color: '#FFD700' },
            { x: 1, y: -12, w: 2, h: 1, color: '#FFD700' },
            { x: -1, y: -8, w: 3, h: 2, color: '#FFD700' },
            { x: -4, y: -5, w: 2, h: 3, color: '#7CFC00' },
            { x: 3, y: -6, w: 2, h: 3, color: '#7CFC00' }
          ]
        ],
        windSway: true,
        swayAmp: 2
      },

      carrot: {
        stages: [
          // 0: 种子
          [{ x: -1, y: 2, w: 2, h: 2, color: '#8B6914' }],
          // 1: 发芽 - 细茎 + 2 小叶
          [
            { x: 0, y: -2, w: 1, h: 5, color: '#228B22' },
            { x: -2, y: -3, w: 1, h: 1, color: '#90EE90' },
            { x: 1, y: -2, w: 1, h: 1, color: '#90EE90' }
          ],
          // 2: 生长 - 叶片变大
          [
            { x: 0, y: -4, w: 1, h: 7, color: '#228B22' },
            { x: -3, y: -3, w: 2, h: 2, color: '#32CD32' },
            { x: 2, y: -4, w: 2, h: 2, color: '#32CD32' },
            { x: -2, y: -6, w: 1, h: 2, color: '#32CD32' },
            { x: 1, y: -7, w: 1, h: 2, color: '#32CD32' }
          ],
          // 3: 成熟 - 顶部绿叶茂盛
          [
            { x: 0, y: -5, w: 1, h: 8, color: '#228B22' },
            { x: -4, y: -4, w: 3, h: 3, color: '#228B22' },
            { x: 2, y: -5, w: 3, h: 3, color: '#228B22' },
            { x: -3, y: -8, w: 2, h: 3, color: '#228B22' },
            { x: 2, y: -9, w: 2, h: 3, color: '#228B22' },
            { x: -1, y: -10, w: 3, h: 2, color: '#228B22' },
            { x: -5, y: -2, w: 2, h: 2, color: '#32CD32' },
            { x: 4, y: -3, w: 2, h: 2, color: '#32CD32' }
          ]
        ],
        windSway: false,
        swayAmp: 0
      },

      tomato: {
        stages: [
          // 0: 种子
          [{ x: -1, y: 2, w: 2, h: 2, color: '#8B6914' }],
          // 1: 发芽 - 藤蔓开始
          [
            { x: 0, y: -2, w: 1, h: 5, color: '#228B22' },
            { x: -1, y: -3, w: 1, h: 1, color: '#32CD32' },
            { x: 1, y: -1, w: 1, h: 2, color: '#32CD32' }
          ],
          // 2: 开花 - 黄色小花
          [
            { x: 0, y: -3, w: 1, h: 6, color: '#228B22' },
            { x: -2, y: -4, w: 2, h: 2, color: '#FFD700' },
            { x: 1, y: -5, w: 2, h: 2, color: '#FFD700' },
            { x: -1, y: -7, w: 1, h: 1, color: '#FFD700' },
            { x: 1, y: -8, w: 1, h: 1, color: '#FFD700' }
          ],
          // 3: 结果(青) - 青果
          [
            { x: 0, y: -4, w: 1, h: 7, color: '#228B22' },
            { x: -3, y: -3, w: 3, h: 3, color: '#32CD32' },
            { x: 1, y: -4, w: 3, h: 3, color: '#32CD32' },
            { x: -2, y: -6, w: 2, h: 1, color: '#228B22' },
            { x: 1, y: -7, w: 2, h: 1, color: '#228B22' }
          ],
          // 4: 成熟(红) - 红果 + 光泽
          [
            { x: 0, y: -4, w: 1, h: 7, color: '#228B22' },
            { x: -3, y: -3, w: 3, h: 3, color: '#FF4500' },
            { x: 1, y: -4, w: 3, h: 3, color: '#FF4500' },
            { x: -2, y: -6, w: 2, h: 1, color: '#228B22' },
            { x: 1, y: -7, w: 2, h: 1, color: '#228B22' },
            { x: -2, y: -2, w: 1, h: 1, color: 'rgba(255,255,255,0.4)' },
            { x: 2, y: -3, w: 1, h: 1, color: 'rgba(255,255,255,0.4)' }
          ]
        ],
        windSway: false,
        swayAmp: 0
      },

      corn: {
        stages: [
          // 0: 种子
          [{ x: -1, y: 2, w: 2, h: 2, color: '#8B6914' }],
          // 1: 发芽 - 单茎
          [
            { x: 0, y: -3, w: 1, h: 6, color: '#6B8E23' },
            { x: -1, y: -1, w: 1, h: 2, color: '#6B8E23' }
          ],
          // 2: 生长 - 长叶展开
          [
            { x: 0, y: -7, w: 1, h: 10, color: '#6B8E23' },
            { x: -3, y: -5, w: 2, h: 3, color: '#7CFC00' },
            { x: 2, y: -6, w: 2, h: 3, color: '#7CFC00' },
            { x: -2, y: -9, w: 2, h: 2, color: '#7CFC00' },
            { x: 1, y: -10, w: 2, h: 2, color: '#7CFC00' }
          ],
          // 3: 抽穗 - 顶部穗须
          [
            { x: 0, y: -8, w: 1, h: 11, color: '#6B8E23' },
            { x: -3, y: -6, w: 2, h: 3, color: '#7CFC00' },
            { x: 2, y: -7, w: 2, h: 3, color: '#7CFC00' },
            { x: -2, y: -11, w: 2, h: 2, color: '#F5DEB3' },
            { x: 1, y: -12, w: 2, h: 2, color: '#F5DEB3' },
            { x: 0, y: -13, w: 1, h: 2, color: '#F5DEB3' }
          ],
          // 4: 成熟 - 苞叶 + 玉米粒
          [
            { x: 0, y: -8, w: 1, h: 11, color: '#6B8E23' },
            { x: -3, y: -6, w: 2, h: 3, color: '#228B22' },
            { x: 2, y: -7, w: 2, h: 3, color: '#228B22' },
            { x: -2, y: -4, w: 4, h: 4, color: '#FFD700' },
            { x: -1, y: -5, w: 2, h: 1, color: '#228B22' },
            { x: -3, y: -3, w: 1, h: 2, color: '#228B22' },
            { x: 2, y: -3, w: 1, h: 2, color: '#228B22' }
          ]
        ],
        windSway: false,
        swayAmp: 0
      },

      pumpkin: {
        stages: [
          // 0: 种子
          [{ x: -1, y: 2, w: 2, h: 2, color: '#8B6914' }],
          // 1: 发芽 - 小藤蔓
          [
            { x: -1, y: -1, w: 2, h: 4, color: '#228B22' },
            { x: -2, y: 0, w: 1, h: 2, color: '#32CD32' }
          ],
          // 2: 生长 - 藤蔓展开
          [
            { x: -2, y: -2, w: 4, h: 3, color: '#32CD32' },
            { x: -3, y: -1, w: 2, h: 2, color: '#228B22' },
            { x: 2, y: -2, w: 2, h: 2, color: '#228B22' },
            { x: 0, y: 1, w: 2, h: 2, color: '#32CD32' }
          ],
          // 3: 开花 - 黄色大花
          [
            { x: -2, y: -2, w: 4, h: 3, color: '#32CD32' },
            { x: -1, y: -5, w: 3, h: 3, color: '#FFD700' },
            { x: -2, y: -4, w: 1, h: 2, color: '#FFD700' },
            { x: 2, y: -5, w: 1, h: 2, color: '#FFD700' },
            { x: 0, y: -6, w: 2, h: 1, color: '#FFD700' }
          ],
          // 4: 结果(青) - 小球
          [
            { x: -2, y: -2, w: 4, h: 3, color: '#32CD32' },
            { x: -1, y: -5, w: 3, h: 3, color: '#32CD32' },
            { x: -2, y: -4, w: 1, h: 2, color: '#32CD32' },
            { x: 2, y: -5, w: 1, h: 2, color: '#32CD32' },
            { x: 0, y: -1, w: 2, h: 1, color: '#228B22' }
          ],
          // 5: 成熟 - 橙色大南瓜（尺寸在绘制时按 progress 缩放）
          [
            { x: -2, y: -2, w: 4, h: 3, color: '#228B22' },
            { x: -3, y: -5, w: 6, h: 5, color: '#FF8C00' },
            { x: -4, y: -4, w: 1, h: 3, color: '#FF8C00' },
            { x: 3, y: -4, w: 1, h: 3, color: '#FF8C00' },
            { x: -2, y: -6, w: 4, h: 1, color: '#FF8C00' },
            { x: -1, y: -1, w: 2, h: 1, color: '#228B22' }
          ]
        ],
        windSway: false,
        swayAmp: 0
      }
    };
  }

  /**
   * 绘制作物
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - 地块左上角 X
   * @param {number} y - 地块左上角 Y
   * @param {number} size - 地块尺寸（28px）
   * @param {Object} plot - 地块数据 { crop_name, growth_progress, pest_infected }
   * @param {number} frameCount - 全局帧计数
   */
  drawCrop(ctx, x, y, size, plot, frameCount) {
    this.frameCount = frameCount;
    const progress = plot.growth_progress || 0;
    const cropName = (plot.crop_name || '').toLowerCase();

    const cx = x + size / 2;
    const cy = y + size / 2;

    const def = this.cropDefs[cropName];
    if (!def) {
      // 未知作物：回退绘制通用种子/生长图案
      this.drawFallback(ctx, cx, cy, progress);
      return;
    }

    const stageInfo = this.getStage(cropName, progress);
    const stageIdx = stageInfo.stageIdx;
    const stageProgress = stageInfo.stageProgress;
    const shapes = def.stages[stageIdx] || [];

    // 保存上下文用于风吹摆动
    ctx.save();

    // 风吹摆动（仅成熟小麦）
    if (def.windSway && stageIdx === def.stages.length - 1) {
      const sway = Math.sin(frameCount * 0.05 + x) * def.swayAmp;
      ctx.translate(Math.floor(sway), 0);
    }

    // 南瓜按生长进度动态缩放（8px → 12px）
    if (cropName === 'pumpkin' && stageIdx >= 4) {
      const scale = stageIdx === 5 ? 1.0 : 0.7 + stageProgress * 0.3;
      ctx.translate(Math.floor(cx), Math.floor(cy));
      ctx.scale(scale, scale);
      ctx.translate(Math.floor(-cx), Math.floor(-cy));
    }

    // 绘制当前阶段的所有像素形状
    for (const shape of shapes) {
      ctx.fillStyle = shape.color;
      const rx = Math.floor(cx + shape.x);
      const ry = Math.floor(cy + shape.y);
      const rw = Math.max(1, Math.floor(shape.w));
      const rh = Math.max(1, Math.floor(shape.h));
      ctx.fillRect(rx, ry, rw, rh);
    }

    ctx.restore();

    // 番茄成熟光泽闪烁（每2秒白色半透明覆盖，持续约300ms ≈ 18帧 @ 60fps）
    if (cropName === 'tomato' && stageIdx === 4) {
      const phase = frameCount % 120; // 2秒周期
      if (phase < 18) {
        const alpha = phase < 9 ? phase / 9 * 0.25 : (18 - phase) / 9 * 0.25;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
      }
    }

    // 虫害标记：3×3 像素棕色虫子
    if (plot.pest_infected) {
      this.drawPestMarker(ctx, x + size - 7, y + 3);
    }
  }

  /**
   * 根据进度计算当前阶段
   */
  getStage(cropName, progress) {
    const def = this.cropDefs[cropName];
    if (!def) return { stageIdx: 0, stageProgress: 0 };

    const totalStages = def.stages.length;
    // 进度 0.0~1.0 均匀映射到所有阶段（修复：原来成熟阶段仅在 progress===1.0 时显示）
    const stageIdx = Math.min(totalStages - 1, Math.floor(progress * totalStages));
    const stageProgress = (progress * totalStages) - stageIdx;
    return { stageIdx, stageProgress };
  }

  /**
   * 绘制未知作物的回退图案
   */
  drawFallback(ctx, cx, cy, progress) {
    if (progress < 0.3) {
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(Math.floor(cx - 1), Math.floor(cy + 2), 2, 2);
    } else if (progress < 0.6) {
      ctx.fillStyle = '#6B8E23';
      ctx.fillRect(Math.floor(cx - 1), Math.floor(cy - 2), 2, 5);
      ctx.fillRect(Math.floor(cx - 2), Math.floor(cy - 1), 1, 2);
      ctx.fillRect(Math.floor(cx + 1), Math.floor(cy - 2), 1, 2);
    } else {
      ctx.fillStyle = '#7CFC00';
      ctx.fillRect(Math.floor(cx - 1), Math.floor(cy - 5), 2, 8);
      ctx.fillRect(Math.floor(cx - 3), Math.floor(cy - 3), 2, 2);
      ctx.fillRect(Math.floor(cx + 2), Math.floor(cy - 4), 2, 2);
    }
  }

  /**
   * 绘制虫害标记（3×3 像素棕色虫子）
   */
  drawPestMarker(ctx, x, y) {
    // 虫子身体
    ctx.fillStyle = '#8B4513';
    // 头
    ctx.fillRect(x + 1, y, 1, 1);
    // 身体
    ctx.fillRect(x, y + 1, 3, 1);
    ctx.fillRect(x + 1, y + 2, 1, 1);
    // 小触角
    ctx.fillStyle = '#5C4033';
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x + 2, y, 1, 1);
  }
}

window.CropSpriteRenderer = CropSpriteRenderer;
