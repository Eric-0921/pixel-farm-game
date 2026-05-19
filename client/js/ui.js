class UIManager {
  constructor() {
    this.screens = {
      auth: document.getElementById('auth-screen'),
      game: document.getElementById('game-screen')
    };
    this.elements = {
      loginForm: document.getElementById('login-form'),
      registerForm: document.getElementById('register-form'),
      loginUsername: document.getElementById('login-username'),
      loginPassword: document.getElementById('login-password'),
      registerUsername: document.getElementById('register-username'),
      registerDisplay: document.getElementById('register-display'),
      registerPassword: document.getElementById('register-password'),
      loginBtn: document.getElementById('login-btn'),
      registerBtn: document.getElementById('register-btn'),
      authMessage: document.getElementById('auth-message'),
      tabBtns: document.querySelectorAll('.tab-btn'),
      playerName: document.getElementById('player-name'),
      playerCoins: document.getElementById('player-coins'),
      playerExp: document.getElementById('player-exp'),
      playerLevel: document.getElementById('player-level'),
      btnSeeds: document.getElementById('btn-seeds'),
      btnRefresh: document.getElementById('btn-refresh'),
      btnLogout: document.getElementById('btn-logout'),
      btnNotifications: document.getElementById('btn-notifications'),
      btnFriends: document.getElementById('btn-friends'),
      notifBadge: document.getElementById('notif-badge'),
      toolBtns: document.querySelectorAll('.tool-btn'),
      currentHint: document.getElementById('current-hint'),
      selectedSeedDisplay: document.getElementById('selected-seed-display'),
      modalCoins: document.getElementById('modal-coins'),
      seedModal: document.getElementById('seed-modal'),
      seedList: document.getElementById('seed-list'),
      notifModal: document.getElementById('notif-modal'),
      notifList: document.getElementById('notif-list'),
      friendModal: document.getElementById('friend-modal'),
      friendList: document.getElementById('friend-list'),
      toast: document.getElementById('notification-toast'),
      toastMessage: document.getElementById('toast-message'),
      plotTooltip: document.getElementById('plot-tooltip'),
      tooltipTitle: document.getElementById('tooltip-title'),
      tooltipContent: document.getElementById('tooltip-content')
    };
    this.currentTool = 'cursor';
    this.selectedSeed = null;
    this.selectedSeedName = '';
    this.cropTypes = [];
    this.currentCoins = 100;
    this.notifications = [];
    this.isSubmitting = false;
    this.initListeners();
    this.initKeyboard();
  }

  initListeners() {
    this.elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
    this.elements.loginBtn.addEventListener('click', () => this.handleLogin());
    this.elements.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });
    this.elements.loginUsername.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.elements.loginPassword.focus();
    });
    this.elements.loginPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });
    this.elements.registerBtn.addEventListener('click', () => this.handleRegister());
    this.elements.registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });
    this.elements.registerUsername.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.elements.registerDisplay.focus();
    });
    this.elements.registerDisplay.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.elements.registerPassword.focus();
    });
    this.elements.registerPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleRegister();
    });
    this.elements.toolBtns.forEach(btn => {
      btn.addEventListener('click', () => this.selectTool(btn.dataset.tool));
    });
    this.elements.btnSeeds.addEventListener('click', () => this.showSeedModal());
    this.elements.btnRefresh.addEventListener('click', () => {
      if (window.game) {
        this.showLoading(true);
        window.game.refreshFarm()
          .then(() => this.showLoading(false))
          .catch(() => this.showLoading(false));
      }
    });
    this.elements.btnLogout.addEventListener('click', () => this.handleLogout());
    this.elements.btnNotifications.addEventListener('click', () => this.showNotifModal());
    this.elements.btnFriends.addEventListener('click', () => this.showFriendModal());
    
    const setupModalClose = (modalId) => {
      const modal = document.getElementById(modalId);
      modal.querySelector('.close-btn')?.addEventListener('click', () => modal.classList.add('hidden'));
      modal.querySelector('.modal-overlay')?.addEventListener('click', () => modal.classList.add('hidden'));
    };
    setupModalClose('seed-modal');
    setupModalClose('notif-modal');
    setupModalClose('friend-modal');
  }

  initKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tagName = e.target.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
      if (e.target.isContentEditable) return;
      const keyMap = { '1': 'cursor', '2': 'plant', '3': 'water', '4': 'harvest' };
      if (keyMap[e.key]) {
        e.preventDefault();
        this.selectTool(keyMap[e.key]);
      }
      if (e.key === 'Escape') this.hideAllModals();
    });
  }

  switchTab(tab) {
    this.elements.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (tab === 'login') {
      this.elements.loginForm.classList.remove('hidden');
      this.elements.registerForm.classList.add('hidden');
    } else {
      this.elements.loginForm.classList.add('hidden');
      this.elements.registerForm.classList.remove('hidden');
    }
    this.elements.authMessage.textContent = '';
    this.elements.authMessage.className = 'auth-message';
  }

  async handleLogin() {
    if (this.isSubmitting) return;
    const username = this.elements.loginUsername.value.trim();
    const password = this.elements.loginPassword.value;
    if (!username || !password) {
      this.showAuthMessage('请输入用户名和密码', 'error');
      return;
    }
    this.isSubmitting = true;
    this.elements.loginBtn.disabled = true;
    this.elements.loginBtn.textContent = '登录中...';
    try {
      const result = await network.post('/api/auth/login', { username, password }, false);
      if (result.success) {
        this.saveAuth(result.data);
        this.showGameScreen();
      } else {
        this.showAuthMessage(result.message, 'error');
      }
    } catch (err) {
      this.showAuthMessage('登录失败: ' + err.message, 'error');
    } finally {
      this.isSubmitting = false;
      this.elements.loginBtn.disabled = false;
      this.elements.loginBtn.textContent = '开始游戏';
    }
  }

  async handleRegister() {
    if (this.isSubmitting) return;
    const username = this.elements.registerUsername.value.trim();
    const displayName = this.elements.registerDisplay.value.trim();
    const password = this.elements.registerPassword.value;
    if (!username || !password) {
      this.showAuthMessage('请输入用户名和密码', 'error');
      return;
    }
    if (password.length < 4) {
      this.showAuthMessage('密码至少需要4位', 'error');
      return;
    }
    this.isSubmitting = true;
    this.elements.registerBtn.disabled = true;
    this.elements.registerBtn.textContent = '创建中...';
    try {
      const result = await network.post('/api/auth/register', {
        username, password, displayName: displayName || username
      }, false);
      if (result.success) {
        this.saveAuth(result.data);
        this.showGameScreen();
      } else {
        this.showAuthMessage(result.message, 'error');
      }
    } catch (err) {
      this.showAuthMessage('注册失败: ' + err.message, 'error');
    } finally {
      this.isSubmitting = false;
      this.elements.registerBtn.disabled = false;
      this.elements.registerBtn.textContent = '创建农场';
    }
  }

  saveAuth(data) {
    localStorage.setItem('farm_token', data.token);
    localStorage.setItem('farm_user_id', data.user.id);
    localStorage.setItem('farm_username', data.user.username);
  }

  handleLogout() {
    localStorage.removeItem('farm_token');
    localStorage.removeItem('farm_user_id');
    localStorage.removeItem('farm_username');
    network.disconnect();
    this.showAuthScreen();
    this.selectedSeed = null;
    this.selectedSeedName = '';
    this.updateSeedDisplay();
  }

  showAuthScreen() {
    this.screens.auth.classList.remove('hidden');
    this.screens.game.classList.add('hidden');
  }

  showGameScreen() {
    this.screens.auth.classList.add('hidden');
    this.screens.game.classList.remove('hidden');
    network.connectWebSocket();
    if (window.game) window.game.init();
  }

  showAuthMessage(message, type) {
    this.elements.authMessage.textContent = message;
    this.elements.authMessage.className = `auth-message ${type}`;
  }

  updatePlayerInfo(user) {
    this.elements.playerName.textContent = user.displayName || user.username;
    this.elements.playerCoins.textContent = user.coins;
    this.currentCoins = user.coins || 0;
    this.elements.playerExp.textContent = user.experience || 0;
    const level = Math.floor((user.experience || 0) / 100) + 1;
    this.elements.playerLevel.textContent = level;
  }

  selectTool(tool) {
    this.currentTool = tool;
    this.elements.toolBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    const hints = {
      cursor: '点击地块查看详情 (按1)',
      plant: '选择种子后点击空地块种植 (按2)',
      water: '点击已种植的地块浇水加速 (按3)',
      harvest: '点击成熟作物收获 (按4)'
    };
    this.elements.currentHint.textContent = hints[tool] || '点击地块进行操作';
  }

  async showSeedModal() {
    try {
      const result = await network.get('/api/crops');
      if (result.success) {
        this.cropTypes = result.data;
        this.elements.modalCoins.textContent = this.currentCoins;
        this.renderSeedList();
        this.elements.seedModal.classList.remove('hidden');
      }
    } catch (err) {
      this.showToast('获取种子列表失败', 'error');
    }
  }

  hideSeedModal() {
    this.elements.seedModal.classList.add('hidden');
  }

  hideNotifModal() {
    this.elements.notifModal.classList.add('hidden');
  }

  hideFriendModal() {
    this.elements.friendModal.classList.add('hidden');
  }

  hideAllModals() {
    this.hideSeedModal();
    this.hideNotifModal();
    this.hideFriendModal();
  }

  renderSeedList() {
    this.elements.seedList.innerHTML = '';
    this.cropTypes.forEach(crop => {
      const affordable = this.currentCoins >= crop.buy_price;
      const item = document.createElement('div');
      item.className = `seed-item ${this.selectedSeed === crop.id ? 'selected' : ''} ${affordable ? 'affordable' : 'unaffordable'}`;

      const seedIcon = document.createElement('div');
      seedIcon.className = 'seed-icon';
      seedIcon.style.backgroundColor = crop.color;
      item.appendChild(seedIcon);

      const seedInfo = document.createElement('div');
      seedInfo.className = 'seed-info';
      const seedName = document.createElement('div');
      seedName.className = 'seed-name';
      seedName.textContent = crop.name;
      const seedDesc = document.createElement('div');
      seedDesc.className = 'seed-desc';
      seedDesc.textContent = crop.description;
      seedInfo.appendChild(seedName);
      seedInfo.appendChild(seedDesc);
      item.appendChild(seedInfo);

      const seedMeta = document.createElement('div');
      seedMeta.className = 'seed-meta';
      const seedPrice = document.createElement('div');
      seedPrice.className = `seed-price ${affordable ? '' : 'unaffordable'}`;
      seedPrice.textContent = `${affordable ? '' : '❌ '}${crop.buy_price}💰`;
      const seedTime = document.createElement('div');
      seedTime.className = 'seed-time';
      seedTime.textContent = this.formatTime(crop.growth_time);
      const seedSell = document.createElement('div');
      seedSell.className = 'seed-time';
      seedSell.textContent = `卖${crop.sell_price}💰`;
      seedMeta.appendChild(seedPrice);
      seedMeta.appendChild(seedTime);
      seedMeta.appendChild(seedSell);
      item.appendChild(seedMeta);

      item.addEventListener('click', () => {
        if (!affordable) {
          this.showToast('金币不足！', 'error');
          return;
        }
        this.selectedSeed = crop.id;
        this.selectedSeedName = crop.name;
        this.renderSeedList();
        this.hideSeedModal();
        this.selectTool('plant');
        this.updateSeedDisplay();
        this.showToast(`已选择: ${crop.name}`, 'success');
      });
      this.elements.seedList.appendChild(item);
    });
  }

  updateSeedDisplay() {
    const display = this.elements.selectedSeedDisplay;
    display.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'seed-label';
    if (this.selectedSeed && this.selectedSeedName) {
      span.textContent = `🌱 ${this.selectedSeedName}`;
      display.classList.add('has-seed');
    } else {
      span.textContent = '未选择种子';
      display.classList.remove('has-seed');
    }
    display.appendChild(span);
  }

  formatTime(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    return `${Math.floor(seconds / 3600)}小时`;
  }

  showToast(message, type = 'info') {
    this.elements.toastMessage.textContent = message;
    this.elements.toast.className = `toast ${type}`;
    this.elements.toast.classList.remove('hidden');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.elements.toast.classList.add('hidden');
    }, 3000);
  }

  showLoading(show) {
    const el = document.getElementById('game-loading');
    if (el) el.classList.toggle('hidden', !show);
  }

  showPlotTooltip(plot, screenX, screenY) {
    const tooltip = this.elements.plotTooltip;
    const title = this.elements.tooltipTitle;
    const content = this.elements.tooltipContent;
    
    if (!plot || plot.status === 'empty') {
      tooltip.classList.add('hidden');
      return;
    }
    
    if (plot.status === 'planted') {
      const progress = Math.floor((plot.growth_progress || 0) * 100);
      const isMature = plot.is_mature || progress >= 100;
      title.textContent = plot.crop_name || '作物';
      let info = isMature ? '✅ 已成熟，可收获！' : `⏳ 生长中 ${progress}%`;
      if (plot.is_watered) info += '\n💧 浇水加速中';
      content.textContent = info;
      tooltip.classList.remove('hidden');
      tooltip.style.left = screenX + 15 + 'px';
      tooltip.style.top = screenY + 15 + 'px';
    } else {
      tooltip.classList.add('hidden');
    }
  }

  hidePlotTooltip() {
    this.elements.plotTooltip.classList.add('hidden');
  }

  async showNotifModal() {
    try {
      const result = await network.get('/api/notifications');
      this.notifications = result.success ? result.data : [];
      this.renderNotifList();
      this.elements.notifModal.classList.remove('hidden');
      this.elements.notifBadge.classList.add('hidden');
    } catch (err) {
      this.showToast('获取通知失败', 'error');
    }
  }

  renderNotifList() {
    const list = this.elements.notifList;
    if (!this.notifications || this.notifications.length === 0) {
      list.innerHTML = '';
      const emptyP = document.createElement('p');
      emptyP.className = 'empty-text';
      emptyP.textContent = '暂无通知';
      list.appendChild(emptyP);
      return;
    }
    list.innerHTML = '';
    this.notifications.forEach(n => {
      const item = document.createElement('div');
      item.className = `notif-item ${n.read_at ? '' : 'unread'}`;
      const title = document.createElement('div');
      title.className = 'notif-title';
      title.textContent = n.title;
      const content = document.createElement('div');
      content.className = 'notif-content';
      content.textContent = n.content;
      const time = document.createElement('div');
      time.className = 'notif-time';
      time.textContent = new Date(n.sent_at).toLocaleString();
      item.appendChild(title);
      item.appendChild(content);
      item.appendChild(time);
      list.appendChild(item);
    });
  }

  showFriendModal() {
    this.elements.friendModal.classList.remove('hidden');
  }

  showNotifBadge(count) {
    const badge = this.elements.notifBadge;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

let ui = null;
function initUI() {
  ui = new UIManager();
  return ui;
}
