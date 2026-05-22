class WeatherEffects {
  constructor(gameWidth, gameHeight) {
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
    this.weather = 'sunny'; // 'sunny' | 'rainy' | 'drought'
    this.raindrops = [];
    this.targetRainCount = 18;
    this.frameCount = 0;
    this.grassColor = '#5a8f3c';
  }

  setWeather(weather) {
    this.weather = weather;
    if (weather !== 'rainy') this.raindrops = [];
  }

  update() {
    this.frameCount++;
    if (this.weather === 'rainy') {
      // 维持雨滴数量
      while (this.raindrops.length < this.targetRainCount) {
        this.raindrops.push({
          x: Math.random() * this.gameWidth,
          y: -4 - Math.random() * 20,
          speed: 3 + Math.random(),
          length: 2 + Math.floor(Math.random() * 3)
        });
      }
      // 更新雨滴位置
      for (let i = this.raindrops.length - 1; i >= 0; i--) {
        const d = this.raindrops[i];
        d.y += d.speed;
        if (d.y > this.gameHeight) {
          this.raindrops.splice(i, 1);
        }
      }
    }
  }

  drawBackground(ctx) {
    // 绘制天气背景覆盖层
    if (this.weather === 'rainy') {
      ctx.fillStyle = 'rgba(30, 60, 100, 0.15)';
      ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
    } else if (this.weather === 'drought') {
      ctx.fillStyle = 'rgba(200, 150, 50, 0.1)';
      ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
    }
  }

  drawRain(ctx) {
    if (this.weather !== 'rainy') return;
    ctx.fillStyle = '#4a9eff';
    this.raindrops.forEach(d => {
      ctx.fillRect(Math.floor(d.x), Math.floor(d.y), 2, d.length);
    });
  }

  getGrassColor() {
    return this.weather === 'rainy' ? '#4a7c6b' : '#5a8f3c';
  }

  isRainy() { return this.weather === 'rainy'; }
  isDrought() { return this.weather === 'drought'; }
}

window.WeatherEffects = WeatherEffects;
