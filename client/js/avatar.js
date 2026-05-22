/**
 * 像素小人渲染系统
 * 8×16 像素农场主角色，含4方向行走、5种动作动画、空闲动画
 * 参考 Phase 6 设计文档
 */
class PixelAvatar {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = null;
    this.targetY = null;
    this.state = 'idle';
    this.direction = 'down';
    this.actionQueue = [];
    this.frameIndex = 0;
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.actionTimer = 0;
    this.actionType = null;
    this.idleTime = 0;
    this.blinkTimer = 0;
    this.blinking = false;
    this.blinkInterval = 3000 + Math.random() * 2000; // 3-5秒随机
    this.stretching = false;
    this.umbrella = false;
    this.weather = 'sunny';
    this.speed = 2;
    this.visible = true;
    this.onActionComplete = null;
    this.scaleY = 1.0;
    this.breathDir = 1;

    // 颜色定义
    this.colors = {
      hat: '#FF6B6B',
      skin: '#FFCCAA',
      shirt: '#4ECDC4',
      pants: '#8B4513',
      shoes: '#333333',
      umbrella: '#FF6B6B',
      umbrellaHandle: '#333333'
    };
  }

  /**
   * 移动到目标地块
   */
  moveTo(plotX, plotY, plotSize, gap, offsetX, offsetY, onArrive) {
    this.targetX = offsetX + plotX * (plotSize + gap) + plotSize / 2;
    this.targetY = offsetY + plotY * (plotSize + gap) + plotSize / 2;
    this.state = 'walking';
    this.onActionComplete = onArrive;
  }

  /**
   * 执行动作
   */
  doAction(actionType, onComplete) {
    this.state = 'acting';
    this.actionType = actionType;
    this.frameIndex = 0;
    this.actionTimer = 0;
    this.onActionComplete = onComplete;
  }

  /**
   * 更新状态机
   */
  update(deltaTime = 16) {
    const dt = deltaTime;

    if (this.state === 'idle') {
      this.idleTime += dt;
      this.blinkTimer += dt;

      // 呼吸动画
      this.scaleY += 0.001 * this.breathDir;
      if (this.scaleY > 1.05) this.breathDir = -1;
      if (this.scaleY < 1.0) { this.scaleY = 1.0; this.breathDir = 1; }

      // 眨眼（3-5秒随机，持续200ms）
      if (!this.blinking && this.blinkTimer > this.blinkInterval) {
        this.blinking = true;
        this.blinkTimer = 0;
      }
      if (this.blinking && this.blinkTimer > 200) {
        this.blinking = false;
        this.blinkTimer = 0;
        this.blinkInterval = 3000 + Math.random() * 2000;
      }

      // 伸懒腰（10秒无操作）
      if (this.idleTime > 10000 && !this.stretching) {
        this.stretching = true;
        setTimeout(() => { this.stretching = false; }, 800);
      }

      // 雨天看天
      if (this.weather === 'rainy' && this.idleTime > 3000) {
        // 看天状态由绘制方法处理
      }

      // 检查动作队列
      if (this.actionQueue.length > 0) {
        const next = this.actionQueue.shift();
        if (next.move) {
          this.moveTo(next.plotX, next.plotY, next.plotSize, next.gap, next.offsetX, next.offsetY, () => {
            if (next.action) this.doAction(next.action, next.onComplete);
            else if (next.onComplete) next.onComplete();
          });
        } else if (next.action) {
          this.doAction(next.action, next.onComplete);
        }
      }
    }

    else if (this.state === 'walking') {
      this.idleTime = 0;
      this.blinkTimer = 0;
      this.stretching = false;

      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.speed) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.state = 'idle';
        if (this.onActionComplete) {
          const cb = this.onActionComplete;
          this.onActionComplete = null;
          cb();
        }
      } else {
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;

        // 更新方向
        if (Math.abs(dx) > Math.abs(dy)) {
          this.direction = dx > 0 ? 'right' : 'left';
        } else {
          this.direction = dy > 0 ? 'down' : 'up';
        }

        // 行走帧切换（每200ms）
        this.walkTimer += dt;
        if (this.walkTimer > 200) {
          this.walkTimer = 0;
          this.walkFrame = (this.walkFrame + 1) % 2;
        }
      }
    }
    
    // 雨天撑伞（所有状态）
    this.umbrella = (this.weather === 'rainy');

    if (this.state === 'acting') {
      this.idleTime = 0;
      this.actionTimer += dt;

      // 动作帧切换（每200ms一帧）
      const frameDuration = 200;
      const totalFrames = this.getActionFrameCount(this.actionType);

      if (this.actionTimer >= frameDuration) {
        this.actionTimer -= frameDuration;
        this.frameIndex++;

        if (this.frameIndex >= totalFrames) {
          // 动作完成
          this.frameIndex = 0;
          this.state = 'idle';
          this.actionType = null;
          if (this.onActionComplete) {
            const cb = this.onActionComplete;
            this.onActionComplete = null;
            cb();
          }
        }
      }
    }
  }

  /**
   * 获取动作总帧数
   */
  getActionFrameCount(actionType) {
    const frames = { plant: 6, water: 5, harvest: 6, pest: 5, fertilize: 5 };
    return frames[actionType] || 1;
  }

  /**
   * 绘制小人
   */
  draw(ctx, frameCount) {
    if (!this.visible) return;

    ctx.save();

    // 应用呼吸缩放（底部中心为锚点）
    const drawX = Math.floor(this.x);
    const drawY = Math.floor(this.y);

    if (this.state === 'idle' && !this.stretching) {
      ctx.translate(drawX, drawY);
      ctx.scale(1, this.scaleY);
      ctx.translate(-drawX, -drawY);
    }

    // 雨天看天：头部上移1px
    const headOffset = (this.weather === 'rainy' && this.state === 'idle' && this.idleTime > 3000) ? -1 : 0;

    // 绘制撑伞（在角色上方）
    if (this.umbrella) {
      this.drawUmbrella(ctx, drawX, drawY + headOffset - 10);
    }

    // 根据状态和方向绘制
    if (this.state === 'walking') {
      this.drawWalking(ctx, drawX, drawY, headOffset);
    } else if (this.state === 'acting') {
      this.drawAction(ctx, drawX, drawY, headOffset);
    } else {
      this.drawIdle(ctx, drawX, drawY, headOffset);
    }

    ctx.restore();
  }

  /**
   * 绘制站立/空闲姿态
   */
  drawIdle(ctx, x, y, headOffset) {
    const c = this.colors;
    const yo = headOffset;

    if (this.stretching) {
      // 伸懒腰：双臂上举
      this.drawPixel(ctx, x - 1, y - 9 + yo, c.hat, 2, 1);  // 帽子顶
      this.drawPixel(ctx, x - 2, y - 8 + yo, c.hat, 4, 1);  // 帽子檐
      this.drawPixel(ctx, x - 1, y - 7 + yo, c.skin, 2, 1); // 脸
      this.drawPixel(ctx, x - 2, y - 6 + yo, c.skin, 4, 1); // 眼睛
      this.drawPixel(ctx, x - 1, y - 5 + yo, c.shirt, 2, 1); // 身体
      this.drawPixel(ctx, x - 3, y - 5 + yo, c.skin, 1, 2);  // 左手上举
      this.drawPixel(ctx, x + 2, y - 5 + yo, c.skin, 1, 2);  // 右手上举
      this.drawPixel(ctx, x - 1, y - 4 + yo, c.pants, 2, 1); // 裤子
      this.drawPixel(ctx, x - 2, y - 2, c.shoes, 1, 1);      // 左鞋
      this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);      // 右鞋
      return;
    }

    // 正面站立
    this.drawPixel(ctx, x - 1, y - 9 + yo, c.hat, 2, 1);   // 帽子顶
    this.drawPixel(ctx, x - 2, y - 8 + yo, c.hat, 4, 1);   // 帽子檐
    this.drawPixel(ctx, x - 1, y - 7 + yo, c.skin, 2, 1);  // 脸

    // 眼睛（眨眼时闭合）
    if (this.blinking) {
      this.drawPixel(ctx, x - 2, y - 6 + yo, c.shoes, 4, 1); // 闭眼（深色）
    } else {
      this.drawPixel(ctx, x - 2, y - 6 + yo, c.skin, 4, 1);  // 眼睛
    }

    this.drawPixel(ctx, x - 1, y - 5 + yo, c.shirt, 2, 1); // 身体
    this.drawPixel(ctx, x - 2, y - 5 + yo, c.shirt, 4, 1); // 手臂
    this.drawPixel(ctx, x - 1, y - 4 + yo, c.pants, 2, 1); // 裤子
    this.drawPixel(ctx, x - 2, y - 2, c.shoes, 1, 1);      // 左鞋
    this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);      // 右鞋
  }

  /**
   * 绘制行走姿态
   */
  drawWalking(ctx, x, y, headOffset) {
    const c = this.colors;
    const yo = headOffset;
    const legOffset = this.walkFrame === 0 ? 0 : 1;

    // 头部（所有方向）
    this.drawPixel(ctx, x - 1, y - 9 + yo, c.hat, 2, 1);
    this.drawPixel(ctx, x - 2, y - 8 + yo, c.hat, 4, 1);

    if (this.direction === 'left' || this.direction === 'right') {
      // 侧面行走
      const side = this.direction === 'left' ? -1 : 1;
      this.drawPixel(ctx, x + side * 0, y - 7 + yo, c.skin, 1, 1); // 脸
      this.drawPixel(ctx, x + side * 0, y - 6 + yo, c.skin, 2, 1); // 眼睛
      this.drawPixel(ctx, x, y - 5 + yo, c.shirt, 1, 1);
      this.drawPixel(ctx, x + side * 0, y - 5 + yo, c.shirt, 3, 1); // 手臂摆动
      this.drawPixel(ctx, x, y - 4 + yo, c.pants, 1, 1);
      // 腿部交替
      if (this.walkFrame === 0) {
        this.drawPixel(ctx, x - 1, y - 2, c.shoes, 1, 1);
      } else {
        this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);
      }
    } else {
      // 正面/背面行走
      this.drawPixel(ctx, x - 1, y - 7 + yo, c.skin, 2, 1);
      this.drawPixel(ctx, x - 2, y - 6 + yo, c.skin, 4, 1);
      this.drawPixel(ctx, x - 1, y - 5 + yo, c.shirt, 2, 1);
      this.drawPixel(ctx, x - 2, y - 5 + yo, c.shirt, 4, 1);
      this.drawPixel(ctx, x - 1, y - 4 + yo, c.pants, 2, 1);

      if (this.direction === 'down') {
        // 正面腿部交替
        if (this.walkFrame === 0) {
          this.drawPixel(ctx, x - 2, y - 2, c.shoes, 1, 1);
          this.drawPixel(ctx, x + 1, y - 3, c.shoes, 1, 1);
        } else {
          this.drawPixel(ctx, x - 2, y - 3, c.shoes, 1, 1);
          this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);
        }
      } else {
        // 背面（无脸部细节）
        this.drawPixel(ctx, x - 2, y - 6 + yo, c.hat, 4, 1); // 背面帽子
        if (this.walkFrame === 0) {
          this.drawPixel(ctx, x - 2, y - 2, c.shoes, 1, 1);
          this.drawPixel(ctx, x + 1, y - 3, c.shoes, 1, 1);
        } else {
          this.drawPixel(ctx, x - 2, y - 3, c.shoes, 1, 1);
          this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);
        }
      }
    }
  }

  /**
   * 绘制动作动画
   */
  drawAction(ctx, x, y, headOffset) {
    const c = this.colors;
    const yo = headOffset;
    const f = this.frameIndex;

    switch (this.actionType) {
      case 'plant':
        this.drawPlantAction(ctx, x, y, yo, f);
        break;
      case 'water':
        this.drawWaterAction(ctx, x, y, yo, f);
        break;
      case 'harvest':
        this.drawHarvestAction(ctx, x, y, yo, f);
        break;
      case 'pest':
        this.drawPestAction(ctx, x, y, yo, f);
        break;
      case 'fertilize':
        this.drawFertilizeAction(ctx, x, y, yo, f);
        break;
      default:
        this.drawIdle(ctx, x, y, yo);
    }
  }

  /**
   * 种植动作（6帧）
   */
  drawPlantAction(ctx, x, y, yo, f) {
    const c = this.colors;
    // 帧0-1: 站立/蹲下准备
    // 帧2: 伸手
    // 帧3: 撒种
    // 帧4: 盖土
    // 帧5: 站起拍拍

    const bodyY = f < 2 ? yo : (f < 5 ? yo + 2 : yo);
    const armExtend = f === 2 || f === 3;

    this.drawPixel(ctx, x - 1, y - 9 + bodyY, c.hat, 2, 1);
    this.drawPixel(ctx, x - 2, y - 8 + bodyY, c.hat, 4, 1);
    this.drawPixel(ctx, x - 1, y - 7 + bodyY, c.skin, 2, 1);
    this.drawPixel(ctx, x - 2, y - 6 + bodyY, c.skin, 4, 1);
    this.drawPixel(ctx, x - 1, y - 5 + bodyY, c.shirt, 2, 1);

    if (armExtend) {
      // 手臂向前伸
      this.drawPixel(ctx, x + 2, y - 4 + bodyY, c.skin, 2, 1);
    } else {
      this.drawPixel(ctx, x - 2, y - 5 + bodyY, c.shirt, 4, 1);
    }

    this.drawPixel(ctx, x - 1, y - 4 + bodyY, c.pants, 2, 1);
    this.drawPixel(ctx, x - 2, y - 2, c.shoes, 1, 1);
    this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);

    // 撒种粒子效果（第3帧）
    if (f === 3) {
      this.drawPixel(ctx, x + 3, y - 2, '#8B6914', 1, 1);
      this.drawPixel(ctx, x + 4, y - 1, '#8B6914', 1, 1);
    }
  }

  /**
   * 浇水动作（5帧）
   */
  drawWaterAction(ctx, x, y, yo, f) {
    const c = this.colors;
    const armUp = f >= 1 && f <= 3;

    this.drawPixel(ctx, x - 1, y - 9 + yo, c.hat, 2, 1);
    this.drawPixel(ctx, x - 2, y - 8 + yo, c.hat, 4, 1);
    this.drawPixel(ctx, x - 1, y - 7 + yo, c.skin, 2, 1);
    this.drawPixel(ctx, x - 2, y - 6 + yo, c.skin, 4, 1);
    this.drawPixel(ctx, x - 1, y - 5 + yo, c.shirt, 2, 1);

    if (armUp) {
      // 右手上举（水壶）
      this.drawPixel(ctx, x + 2, y - 8 + yo, c.skin, 1, 3);
      this.drawPixel(ctx, x + 3, y - 9 + yo, '#4a9eff', 2, 2); // 水壶
    } else {
      this.drawPixel(ctx, x - 2, y - 5 + yo, c.shirt, 4, 1);
    }

    this.drawPixel(ctx, x - 1, y - 4 + yo, c.pants, 2, 1);
    this.drawPixel(ctx, x - 2, y - 2, c.shoes, 1, 1);
    this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);

    // 水花（第3帧）
    if (f === 3) {
      this.drawPixel(ctx, x + 4, y - 1, '#4a9eff', 2, 2);
      this.drawPixel(ctx, x + 5, y, '#4a9eff', 1, 1);
    }
  }

  /**
   * 收获动作（6帧）
   */
  drawHarvestAction(ctx, x, y, yo, f) {
    const c = this.colors;
    const bodyY = f < 2 ? yo : (f < 5 ? yo + 2 : yo);
    const holding = f >= 3 && f <= 4;
    const showCrop = f >= 4;

    this.drawPixel(ctx, x - 1, y - 9 + bodyY, c.hat, 2, 1);
    this.drawPixel(ctx, x - 2, y - 8 + bodyY, c.hat, 4, 1);
    this.drawPixel(ctx, x - 1, y - 7 + bodyY, c.skin, 2, 1);
    this.drawPixel(ctx, x - 2, y - 6 + bodyY, c.skin, 4, 1);
    this.drawPixel(ctx, x - 1, y - 5 + bodyY, c.shirt, 2, 1);

    if (holding) {
      // 双手抱作物
      this.drawPixel(ctx, x - 3, y - 6 + bodyY, c.skin, 1, 2);
      this.drawPixel(ctx, x + 2, y - 6 + bodyY, c.skin, 1, 2);
    } else if (f === 2) {
      // 镰刀挥动
      this.drawPixel(ctx, x + 2, y - 6 + bodyY, '#ccc', 3, 1);
    } else {
      this.drawPixel(ctx, x - 2, y - 5 + bodyY, c.shirt, 4, 1);
    }

    this.drawPixel(ctx, x - 1, y - 4 + bodyY, c.pants, 2, 1);
    this.drawPixel(ctx, x - 2, y - 2, c.shoes, 1, 1);
    this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);

    // 展示作物（第5帧）
    if (showCrop) {
      this.drawPixel(ctx, x - 2, y - 10 + bodyY, '#FFD700', 4, 3);
    }
  }

  /**
   * 除虫动作（5帧）
   */
  drawPestAction(ctx, x, y, yo, f) {
    const c = this.colors;
    const bodyY = f === 1 || f === 2 ? yo + 2 : yo;
    const spraying = f === 2;

    this.drawPixel(ctx, x - 1, y - 9 + bodyY, c.hat, 2, 1);
    this.drawPixel(ctx, x - 2, y - 8 + bodyY, c.hat, 4, 1);
    this.drawPixel(ctx, x - 1, y - 7 + bodyY, c.skin, 2, 1);
    this.drawPixel(ctx, x - 2, y - 6 + bodyY, c.skin, 4, 1);
    this.drawPixel(ctx, x - 1, y - 5 + bodyY, c.shirt, 2, 1);

    if (spraying) {
      // 喷药动作
      this.drawPixel(ctx, x + 2, y - 5 + bodyY, c.skin, 2, 1);
      this.drawPixel(ctx, x + 4, y - 4 + bodyY, '#90EE90', 2, 2); // 喷雾
    } else {
      this.drawPixel(ctx, x - 2, y - 5 + bodyY, c.shirt, 4, 1);
    }

    this.drawPixel(ctx, x - 1, y - 4 + bodyY, c.pants, 2, 1);
    this.drawPixel(ctx, x - 2, y - 2, c.shoes, 1, 1);
    this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);
  }

  /**
   * 施肥动作（5帧）
   */
  drawFertilizeAction(ctx, x, y, yo, f) {
    const c = this.colors;
    const bodyY = f === 1 || f === 2 ? yo + 2 : yo;
    const spreading = f === 2;

    this.drawPixel(ctx, x - 1, y - 9 + bodyY, c.hat, 2, 1);
    this.drawPixel(ctx, x - 2, y - 8 + bodyY, c.hat, 4, 1);
    this.drawPixel(ctx, x - 1, y - 7 + bodyY, c.skin, 2, 1);
    this.drawPixel(ctx, x - 2, y - 6 + bodyY, c.skin, 4, 1);
    this.drawPixel(ctx, x - 1, y - 5 + bodyY, c.shirt, 2, 1);

    if (spreading) {
      // 撒肥
      this.drawPixel(ctx, x + 2, y - 4 + bodyY, c.skin, 2, 1);
      this.drawPixel(ctx, x + 3, y - 2, '#8B4513', 2, 1); // 肥料
    } else {
      this.drawPixel(ctx, x - 2, y - 5 + bodyY, c.shirt, 4, 1);
    }

    this.drawPixel(ctx, x - 1, y - 4 + bodyY, c.pants, 2, 1);
    this.drawPixel(ctx, x - 2, y - 2, c.shoes, 1, 1);
    this.drawPixel(ctx, x + 1, y - 2, c.shoes, 1, 1);
  }

  /**
   * 绘制像素伞
   */
  drawUmbrella(ctx, x, y) {
    const c = this.colors;
    // 伞面 6×3
    this.drawPixel(ctx, x - 3, y - 2, c.umbrella, 6, 1);
    this.drawPixel(ctx, x - 4, y - 1, c.umbrella, 8, 1);
    this.drawPixel(ctx, x - 3, y, c.umbrella, 6, 1);
    // 伞柄
    this.drawPixel(ctx, x, y + 1, c.umbrellaHandle, 1, 3);
  }

  /**
   * 绘制像素矩形辅助方法
   */
  drawPixel(ctx, x, y, color, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  }

  // --- 公共方法 ---

  setWeather(weather) {
    this.weather = weather;
  }

  isBusy() {
    return this.state !== 'idle';
  }

  queueAction(action) {
    this.actionQueue.push(action);
  }

  clearQueue() {
    this.actionQueue = [];
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = null;
    this.targetY = null;
    this.state = 'idle';
    this.actionQueue = [];
    this.frameIndex = 0;
    this.actionType = null;
  }
}

window.PixelAvatar = PixelAvatar;
