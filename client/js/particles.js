class Particle {
  constructor(x, y, color, vx, vy, life, size = 2, gravity = 0) {
    this.x = x; this.y = y;
    this.color = color;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size;
    this.gravity = gravity;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity; // 应用重力
    this.life--;
  }
  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawn(scene, x, y) {
    // scene: 'plant' | 'water' | 'harvest' | 'pest' | 'fertilize'
    const configs = {
      plant: { color: '#8B6914', count: [5, 8], life: 30, vx: 1, vy: -1.5, gravity: 0.1, size: 2 },
      water: { color: '#4a9eff', count: [3, 5], life: 48, vx: 0.5, vy: 1.5, gravity: 0.05, size: 2 },
      harvest: { color: '#FFD700', count: [8, 12], life: 60, vx: 2, vy: -2.5, gravity: 0.15, size: 3 },
      pest: { color: '#90EE90', count: [5, 8], life: 36, vx: 1.5, vy: -1, gravity: -0.02, size: 2 },
      fertilize: { color: '#8B4513', count: [6, 10], life: 30, vx: 1, vy: -0.5, gravity: 0.2, size: 2 }
    };
    
    const cfg = configs[scene];
    const count = cfg.count[0] + Math.floor(Math.random() * (cfg.count[1] - cfg.count[0] + 1));
    
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(
        x + Math.random() * 8 - 4,
        y + Math.random() * 4,
        cfg.color,
        (Math.random() - 0.5) * cfg.vx * 2,
        cfg.vy + (Math.random() - 0.5),
        cfg.life,
        cfg.size,
        cfg.gravity
      ));
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
  }

  clear() { this.particles = []; }
}

window.ParticleSystem = ParticleSystem;
