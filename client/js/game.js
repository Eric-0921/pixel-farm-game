class FarmGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = initRenderer(this.canvas);
    this.ui = initUI();
    this.state = {
      farmData: null,
      hoverPlot: null,
      selectedPlot: null,
      isLoading: false,
      particles: []
    };
    this.mouseX = 0;
    this.mouseY = 0;
    this.animationId = null;
    this.lastUpdate = 0;
    this.refreshInterval = 5000;
    this.refreshTimer = null;
    this.wsListenersAdded = false;
    this.resizeHandler = null;
    this.visibilityHandler = null;
    this.mouseMoveHandler = null;
    this.clickHandler = null;
    this.mouseLeaveHandler = null;
    this.touchStartHandler = null;
    this.touchEndHandler = null;
    this.wsCropMatureHandler = null;
    this.wsNotificationHandler = null;
  }

  async init() {
    this.ui.showLoading(true);
    try {
      await this.refreshFarm();
    } catch (err) {
      console.error('init error:', err);
    }
    this.ui.showLoading(false);
    this.setupInputListeners();
    this.startGameLoop();
    this.startAutoRefresh();
    this.setupVisibilityHandler();
    
    if (!this.wsListenersAdded) {
      this.wsCropMatureHandler = (data) => {
        this.ui.showToast(data.message, 'success');
        this.refreshFarm();
      };
      this.wsNotificationHandler = (data) => {
        this.ui.showToast(data.notification.title, 'info');
        this.ui.showNotifBadge(1);
      };
      network.on('crop_mature', this.wsCropMatureHandler);
      network.on('notification', this.wsNotificationHandler);
      this.wsListenersAdded = true;
    }
    
    this.resizeHandler = () => this.fitCanvas();
    window.addEventListener('resize', this.resizeHandler);
    this.fitCanvas();
    console.log('game initialized');
  }

  fitCanvas() {
    const container = this.canvas.parentElement;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const aspect = this.renderer.gameWidth / this.renderer.gameHeight;
    let w = containerW;
    let h = w / aspect;
    if (h > containerH) {
      h = containerH;
      w = h * aspect;
    }
    this.canvas.style.width = Math.floor(w) + 'px';
    this.canvas.style.height = Math.floor(h) + 'px';
  }

  async refreshFarm() {
    if (this.state.isLoading) return;
    try {
      this.state.isLoading = true;
      const result = await network.get('/api/farm');
      if (result.success) {
        this.state.farmData = result.data;
        this.ui.updatePlayerInfo({
          username: result.data.username,
          displayName: result.data.display_name,
          coins: result.data.coins,
          experience: result.data.experience
        });
        this.ui.updateSeedDisplay();
      } else {
        this.handleAuthError(result.message);
      }
    } catch (err) {
      console.error('refresh farm error:', err);
      // 网络错误或HTTP错误(401/403)
      if (err.message && (err.message.includes('401') || err.message.includes('403'))) {
        this.handleAuthError('登录已过期');
      }
    } finally {
      this.state.isLoading = false;
    }
  }

  handleAuthError(message) {
    this.ui.showToast(message || '登录已过期，请重新登录', 'error');
    setTimeout(() => {
      localStorage.removeItem('farm_token');
      localStorage.removeItem('farm_user_id');
      localStorage.removeItem('farm_username');
      location.reload();
    }, 1500);
  }

  setupInputListeners() {
    this.mouseMoveHandler = (e) => {
      this.updateMousePosition(e);
      this.updateHoverPlot();
      if (this.state.hoverPlot) {
        this.ui.showPlotTooltip(this.state.hoverPlot, e.clientX, e.clientY);
      } else {
        this.ui.hidePlotTooltip();
      }
    };
    this.canvas.addEventListener('mousemove', this.mouseMoveHandler);

    this.clickHandler = (e) => {
      this.updateMousePosition(e);
      this.handlePlotClick();
    };
    this.canvas.addEventListener('click', this.clickHandler);

    this.mouseLeaveHandler = () => {
      this.state.hoverPlot = null;
      this.ui.hidePlotTooltip();
    };
    this.canvas.addEventListener('mouseleave', this.mouseLeaveHandler);

    // touch support
    this.touchStartHandler = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.renderer.gameWidth / rect.width;
      const scaleY = this.renderer.gameHeight / rect.height;
      this.mouseX = (touch.clientX - rect.left) * scaleX;
      this.mouseY = (touch.clientY - rect.top) * scaleY;
      this.updateHoverPlot();
    };
    this.canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });

    this.touchEndHandler = (e) => {
      e.preventDefault();
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.renderer.gameWidth / rect.width;
        const scaleY = this.renderer.gameHeight / rect.height;
        this.mouseX = (touch.clientX - rect.left) * scaleX;
        this.mouseY = (touch.clientY - rect.top) * scaleY;
        this.updateHoverPlot();
      }
      this.handlePlotClick();
    };
    this.canvas.addEventListener('touchend', this.touchEndHandler, { passive: false });
  }

  updateMousePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.renderer.gameWidth / rect.width;
    const scaleY = this.renderer.gameHeight / rect.height;
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;
  }

  updateHoverPlot() {
    if (!this.state.farmData || !this.state.farmData.plots) {
      this.state.hoverPlot = null;
      return;
    }
    const { width, height, plots } = this.state.farmData;
    const plotSize = 28;
    const gap = 2;
    const totalWidth = width * (plotSize + gap);
    const totalHeight = height * (plotSize + gap);
    const offsetX = Math.floor((this.renderer.gameWidth - totalWidth) / 2);
    const offsetY = Math.floor((this.renderer.gameHeight - totalHeight) / 2) + 8;
    
    for (const plot of plots) {
      const px = offsetX + plot.x * (plotSize + gap);
      const py = offsetY + plot.y * (plotSize + gap);
      if (this.mouseX >= px && this.mouseX < px + plotSize &&
          this.mouseY >= py && this.mouseY < py + plotSize) {
        this.state.hoverPlot = plot;
        return;
      }
    }
    this.state.hoverPlot = null;
  }

  async handlePlotClick() {
    if (!this.state.hoverPlot) return;
    const plot = this.state.hoverPlot;
    const tool = this.ui.currentTool;
    this.state.selectedPlot = plot;
    
    try {
      switch (tool) {
        case 'plant': await this.handlePlant(plot); break;
        case 'water': await this.handleWater(plot); break;
        case 'harvest': await this.handleHarvest(plot); break;
        default: this.showPlotInfo(plot); break;
      }
    } catch (err) {
      console.error('plot click error:', err);
    }
  }

  async handlePlant(plot) {
    if (plot.status !== 'empty') {
      this.ui.showToast('该地块已被占用', 'error');
      return;
    }
    if (!this.ui.selectedSeed) {
      this.ui.showToast('请先选择种子', 'error');
      this.ui.showSeedModal();
      return;
    }
    try {
      const result = await network.post('/api/farm/plant', {
        plotId: plot.plot_id,
        cropTypeId: this.ui.selectedSeed
      });
      if (result.success) {
        this.ui.showToast('种植成功！', 'success');
        this.spawnParticles(plot);
        await this.refreshFarm();
      } else {
        this.ui.showToast(result.message, 'error');
      }
    } catch (err) {
      this.ui.showToast('种植失败', 'error');
    }
  }

  async handleWater(plot) {
    if (plot.status !== 'planted') {
      this.ui.showToast('该地块没有作物', 'error');
      return;
    }
    try {
      const result = await network.post('/api/farm/water', { plotId: plot.plot_id });
      if (result.success) {
        this.ui.showToast('浇水成功！生长速度提升', 'success');
        this.spawnParticles(plot);
        await this.refreshFarm();
      } else {
        this.ui.showToast(result.message, 'error');
      }
    } catch (err) {
      this.ui.showToast('浇水失败', 'error');
    }
  }

  async handleHarvest(plot) {
    if (plot.status !== 'planted') {
      this.ui.showToast('该地块没有作物', 'error');
      return;
    }
    if (!plot.is_mature && (plot.growth_progress || 0) < 1.0) {
      this.ui.showToast('作物尚未成熟', 'error');
      return;
    }
    try {
      const result = await network.post('/api/farm/harvest', { plotId: plot.plot_id });
      if (result.success) {
        this.ui.showToast(`收获成功！获得 ${result.data.earned} 金币`, 'success');
        this.spawnParticles(plot);
        await this.refreshFarm();
      } else {
        this.ui.showToast(result.message, 'error');
      }
    } catch (err) {
      this.ui.showToast('收获失败', 'error');
    }
  }

  showPlotInfo(plot) {
    if (plot.status === 'empty') {
      this.ui.showToast('空地 - 可以种植作物', 'info');
    } else if (plot.status === 'planted') {
      const progress = Math.floor((plot.growth_progress || 0) * 100);
      const matureText = plot.is_mature ? '（可收获）' : `(${progress}%)`;
      const waterText = plot.is_watered ? ' [已浇水]' : '';
      this.ui.showToast(`${plot.crop_name || '作物'} ${matureText}${waterText}`, 'info');
    }
  }

  spawnParticles(plot) {
    if (!this.state.farmData) return;
    const { width, height } = this.state.farmData;
    const plotSize = 28;
    const gap = 2;
    const totalWidth = width * (plotSize + gap);
    const totalHeight = height * (plotSize + gap);
    const offsetX = Math.floor((this.renderer.gameWidth - totalWidth) / 2);
    const offsetY = Math.floor((this.renderer.gameHeight - totalHeight) / 2) + 8;
    const x = offsetX + plot.x * (plotSize + gap) + plotSize / 2;
    const y = offsetY + plot.y * (plotSize + gap);
    
    for (let i = 0; i < 6; i++) {
      this.state.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -0.8 - Math.random() * 1.5,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.02,
        color: `hsl(${Math.random() * 60 + 50}, 80%, 65%)`,
        size: 2 + Math.floor(Math.random() * 3)
      });
    }
  }

  updateParticles() {
    for (let i = this.state.particles.length - 1; i >= 0; i--) {
      const p = this.state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) this.state.particles.splice(i, 1);
    }
  }

  startGameLoop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    const loop = (timestamp) => {
      this.update(timestamp);
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  update(timestamp) {
    this.updateParticles();
    if (timestamp - this.lastUpdate > 3000) {
      this.lastUpdate = timestamp;
      if (this.state.farmData && this.state.farmData.plots) {
        this.state.farmData.plots.forEach(plot => {
          if (plot.status === 'planted' && plot.planted_at) {
            const plantedTime = new Date(plot.planted_at).getTime();
            const elapsed = (Date.now() - plantedTime) / 1000;
            let boost = 1.0;
            if (plot.watered_at) {
              const wateredTime = new Date(plot.watered_at).getTime();
              if ((Date.now() - wateredTime) / 1000 < 3600) boost = 1.5;
            }
            plot.growth_progress = Math.min(1.0, (elapsed * boost) / (plot.growth_time || 60));
            plot.is_mature = plot.growth_progress >= 1.0;
          }
        });
      }
    }
  }

  render() {
    if (!this.renderer) return;
    this.renderer.renderFarm(this.state.farmData, this.state);
    if (this.state.particles.length > 0) {
      this.renderer.drawParticles(this.state.particles);
    }
  }

  startAutoRefresh() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.refreshFarm(), this.refreshInterval);
  }

  pauseAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  resumeAutoRefresh() {
    if (!this.refreshTimer) {
      this.refreshFarm();
      this.startAutoRefresh();
    }
  }

  setupVisibilityHandler() {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pauseAutoRefresh();
      } else {
        this.resumeAutoRefresh();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.mouseMoveHandler) {
      this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
    }
    if (this.clickHandler) {
      this.canvas.removeEventListener('click', this.clickHandler);
    }
    if (this.mouseLeaveHandler) {
      this.canvas.removeEventListener('mouseleave', this.mouseLeaveHandler);
    }
    if (this.touchStartHandler) {
      this.canvas.removeEventListener('touchstart', this.touchStartHandler);
    }
    if (this.touchEndHandler) {
      this.canvas.removeEventListener('touchend', this.touchEndHandler);
    }
    if (this.wsListenersAdded) {
      if (this.wsCropMatureHandler) network.off('crop_mature', this.wsCropMatureHandler);
      if (this.wsNotificationHandler) network.off('notification', this.wsNotificationHandler);
      this.wsListenersAdded = false;
    }
    network.disconnect();
  }
}

let game = null;
document.addEventListener('DOMContentLoaded', () => {
  game = new FarmGame();
  window.game = game;
  const token = localStorage.getItem('farm_token');
  if (token) {
    ui.showGameScreen();
  }
  window.addEventListener('beforeunload', () => {
    if (game) game.stop();
  });
});
