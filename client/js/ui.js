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
      btnPushToggle: document.getElementById('btn-push-toggle'),
      btnFontToggle: document.getElementById('btn-font-toggle'),
      btnContrastToggle: document.getElementById('btn-contrast-toggle'),
      btnVoiceToggle: document.getElementById('btn-voice-toggle'),
      btnNotifications: document.getElementById('btn-notifications'),
      btnCheckin: document.getElementById('btn-checkin'),
      btnAchievements: document.getElementById('btn-achievements'),
      btnFriends: document.getElementById('btn-friends'),
      notifBadge: document.getElementById('notif-badge'),
      checkinModal: document.getElementById('checkin-modal'),
      checkinCalendar: document.getElementById('checkin-calendar'),
      checkinStreakCount: document.getElementById('checkin-streak-count'),
      checkinStatusText: document.getElementById('checkin-status-text'),
      checkinReward: document.getElementById('checkin-reward'),
      checkinExtraReward: document.getElementById('checkin-extra-reward'),
      btnDoCheckin: document.getElementById('btn-do-checkin'),
      achievementModal: document.getElementById('achievement-modal'),
      achievementList: document.getElementById('achievement-list'),
      achievementProgress: document.getElementById('achievement-progress'),
      toolBtns: document.querySelectorAll('.tool-btn'),
      currentHint: document.getElementById('current-hint'),
      selectedSeedDisplay: document.getElementById('selected-seed-display'),
      modalCoins: document.getElementById('modal-coins'),
      seedModal: document.getElementById('seed-modal'),
      seedList: document.getElementById('seed-list'),
      notifModal: document.getElementById('notif-modal'),
      notifList: document.getElementById('notif-list'),
      friendModal: document.getElementById('friend-modal'),
      friendList: document.getElementById('friend-list-container'),
      friendRequestsContainer: document.getElementById('friend-requests-container'),
      friendSearchInput: document.getElementById('friend-search-input'),
      friendSearchBtn: document.getElementById('friend-search-btn'),
      friendSearchResults: document.getElementById('friend-search-results'),
      friendRequestBadge: document.getElementById('friend-request-badge'),
      friendTabBtns: document.querySelectorAll('[data-friend-tab]'),
      messageModal: document.getElementById('message-modal'),
      messageList: document.getElementById('message-list'),
      messageInput: document.getElementById('message-input'),
      messageSendBtn: document.getElementById('message-send-btn'),
      messageModalClose: document.getElementById('message-modal-close'),
      giftModal: document.getElementById('gift-modal'),
      giftSeedList: document.getElementById('gift-seed-list'),
      giftModalClose: document.getElementById('gift-modal-close'),
      btnBackMyFarm: document.getElementById('btn-back-my-farm'),
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
    this.currentMessageFriendId = null;
    this.currentGiftFriendId = null;
    this.friendListData = [];
    this.pendingRequestsData = [];
    this.initListeners();
    this.initKeyboard();
    this.initPushStatus();
    this.initAccessibility();
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
    this.elements.btnCheckin.addEventListener('click', () => this.showCheckinModal());
    this.elements.btnAchievements.addEventListener('click', () => this.showAchievementModal());
    this.elements.btnFriends.addEventListener('click', () => this.showFriendModal());
    this.elements.btnPushToggle.addEventListener('click', () => this.handlePushToggle());
    this.elements.btnFontToggle.addEventListener('click', () => this.toggleFontSize());
    this.elements.btnContrastToggle.addEventListener('click', () => this.toggleHighContrast());
    this.elements.btnVoiceToggle.addEventListener('click', () => this.toggleVoice());

    // 好友搜索
    this.elements.friendSearchBtn.addEventListener('click', () => this.handleSearchUsers());
    this.elements.friendSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSearchUsers();
    });

    // 好友标签切换
    this.elements.friendTabBtns.forEach(btn => {
      btn.addEventListener('click', () => this.switchFriendTab(btn.dataset.friendTab));
    });

    // 留言弹窗
    this.elements.messageModalClose.addEventListener('click', () => this.hideMessageModal());
    this.elements.messageSendBtn.addEventListener('click', () => {
      if (this.currentMessageFriendId) this.handleSendMessage(this.currentMessageFriendId);
    });
    this.elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && this.currentMessageFriendId) {
        this.handleSendMessage(this.currentMessageFriendId);
      }
    });

    // 赠送种子弹窗
    this.elements.giftModalClose.addEventListener('click', () => this.hideGiftModal());

    // 返回我的农场
    this.elements.btnBackMyFarm.addEventListener('click', () => {
      if (window.game) window.game.loadMyFarm();
    });

    const setupModalClose = (modalId) => {
      const modal = document.getElementById(modalId);
      modal.querySelector('.close-btn')?.addEventListener('click', () => modal.classList.add('hidden'));
      modal.querySelector('.modal-overlay')?.addEventListener('click', () => modal.classList.add('hidden'));
    };
    setupModalClose('seed-modal');
    setupModalClose('notif-modal');
    setupModalClose('friend-modal');
    setupModalClose('checkin-modal');
    setupModalClose('achievement-modal');
  }

  initKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tagName = e.target.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
      if (e.target.isContentEditable) return;
      const keyMap = { '1': 'cursor', '2': 'plant', '3': 'water', '4': 'harvest' };
      if (keyMap[e.key]) {
        e.preventDefault();
        const tool = keyMap[e.key];
        // 好友农场模式下禁止切换到种植/收获工具
        if (window.game && window.game.state.viewingFriendFarm && (tool === 'plant' || tool === 'harvest')) {
          return;
        }
        this.selectTool(tool);
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

  hideMessageModal() {
    this.elements.messageModal.classList.add('hidden');
    this.currentMessageFriendId = null;
    this.elements.messageInput.value = '';
  }

  hideGiftModal() {
    this.elements.giftModal.classList.add('hidden');
    this.currentGiftFriendId = null;
  }

  hideCheckinModal() {
    this.elements.checkinModal.classList.add('hidden');
  }

  hideAchievementModal() {
    this.elements.achievementModal.classList.add('hidden');
  }

  hideAllModals() {
    this.hideSeedModal();
    this.hideNotifModal();
    this.hideFriendModal();
    this.hideMessageModal();
    this.hideGiftModal();
    this.hideCheckinModal();
    this.hideAchievementModal();
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

  /* ==================== 好友系统 ==================== */

  async showFriendModal() {
    this.elements.friendModal.classList.remove('hidden');
    this.switchFriendTab('friends');
    await this.refreshFriendData();
  }

  async refreshFriendData() {
    try {
      const [friendsResult, requestsResult] = await Promise.all([
        network.get('/api/friends'),
        network.get('/api/friends/requests')
      ]);
      this.friendListData = friendsResult.success ? friendsResult.data : [];
      this.pendingRequestsData = requestsResult.success ? requestsResult.data : [];
      this.renderFriendList(this.friendListData);
      this.renderPendingRequests(this.pendingRequestsData);
      this.updateFriendRequestBadge(this.pendingRequestsData.length);
    } catch (err) {
      this.showToast('获取好友数据失败', 'error');
    }
  }

  updateFriendRequestBadge(count) {
    const badge = this.elements.friendRequestBadge;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  switchFriendTab(tab) {
    this.elements.friendTabBtns.forEach(btn => {
      const isActive = btn.dataset.friendTab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
    if (tab === 'friends') {
      this.elements.friendList.classList.remove('hidden');
      this.elements.friendRequestsContainer.classList.add('hidden');
    } else {
      this.elements.friendList.classList.add('hidden');
      this.elements.friendRequestsContainer.classList.remove('hidden');
    }
  }

  renderFriendList(friends) {
    const list = this.elements.friendList;
    list.innerHTML = '';
    if (!friends || friends.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.className = 'empty-text';
      emptyP.textContent = '暂无好友，去搜索添加吧！';
      list.appendChild(emptyP);
      return;
    }
    friends.forEach(f => {
      const item = document.createElement('div');
      item.className = 'friend-item';

      const avatar = document.createElement('div');
      avatar.className = 'friend-avatar';
      avatar.textContent = '👤';

      const info = document.createElement('div');
      info.className = 'friend-info';
      const name = document.createElement('div');
      name.className = 'friend-name';
      name.textContent = f.display_name || f.username;
      const meta = document.createElement('div');
      meta.className = 'friend-meta';
      meta.textContent = f.username;
      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'friend-actions';

      const btnFarm = document.createElement('button');
      btnFarm.className = 'pixel-btn small';
      btnFarm.textContent = '🏠 农场';
      btnFarm.addEventListener('click', () => this.showFriendFarm(f.id));

      const btnMessage = document.createElement('button');
      btnMessage.className = 'pixel-btn small';
      btnMessage.textContent = '💬 留言';
      btnMessage.addEventListener('click', () => this.showMessageModal(f.id, f.display_name || f.username));

      const btnGift = document.createElement('button');
      btnGift.className = 'pixel-btn small';
      btnGift.textContent = '🎁 赠种';
      btnGift.addEventListener('click', () => this.showGiftModal(f.id));

      const btnRemove = document.createElement('button');
      btnRemove.className = 'pixel-btn small danger';
      btnRemove.textContent = '✕';
      btnRemove.title = '删除好友';
      btnRemove.addEventListener('click', () => this.handleRemoveFriend(f.id));

      actions.appendChild(btnFarm);
      actions.appendChild(btnMessage);
      actions.appendChild(btnGift);
      actions.appendChild(btnRemove);

      item.appendChild(avatar);
      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  renderPendingRequests(requests) {
    const list = this.elements.friendRequestsContainer;
    list.innerHTML = '';
    if (!requests || requests.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.className = 'empty-text';
      emptyP.textContent = '暂无好友请求';
      list.appendChild(emptyP);
      return;
    }
    requests.forEach(r => {
      const item = document.createElement('div');
      item.className = 'request-item';

      const avatar = document.createElement('div');
      avatar.className = 'friend-avatar';
      avatar.textContent = '👤';

      const info = document.createElement('div');
      info.className = 'friend-info';
      const name = document.createElement('div');
      name.className = 'friend-name';
      name.textContent = r.display_name || r.username;
      const meta = document.createElement('div');
      meta.className = 'friend-meta';
      meta.textContent = r.username;
      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'friend-actions';

      const btnAccept = document.createElement('button');
      btnAccept.className = 'pixel-btn small primary';
      btnAccept.textContent = '✓ 接受';
      btnAccept.addEventListener('click', () => this.handleAcceptRequest(r.user_id));

      const btnReject = document.createElement('button');
      btnReject.className = 'pixel-btn small';
      btnReject.textContent = '✕ 拒绝';
      btnReject.addEventListener('click', () => this.handleRejectRequest(r.user_id));

      actions.appendChild(btnAccept);
      actions.appendChild(btnReject);

      item.appendChild(avatar);
      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  async handleSearchUsers() {
    const query = this.elements.friendSearchInput.value.trim();
    if (!query) {
      this.showToast('请输入搜索关键词', 'error');
      return;
    }
    const resultsContainer = this.elements.friendSearchResults;
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('hidden');

    const loading = document.createElement('p');
    loading.className = 'empty-text';
    loading.textContent = '搜索中...';
    resultsContainer.appendChild(loading);

    try {
      const result = await network.get('/api/friends/search?q=' + encodeURIComponent(query));
      resultsContainer.innerHTML = '';
      if (result.success && result.data && result.data.length > 0) {
        result.data.forEach(u => {
          const item = document.createElement('div');
          item.className = 'friend-item';

          const avatar = document.createElement('div');
          avatar.className = 'friend-avatar';
          avatar.textContent = '👤';

          const info = document.createElement('div');
          info.className = 'friend-info';
          const name = document.createElement('div');
          name.className = 'friend-name';
          name.textContent = u.display_name || u.username;
          const meta = document.createElement('div');
          meta.className = 'friend-meta';
          meta.textContent = u.username;
          info.appendChild(name);
          info.appendChild(meta);

          const actions = document.createElement('div');
          actions.className = 'friend-actions';
          const btnAdd = document.createElement('button');
          btnAdd.className = 'pixel-btn small primary';
          btnAdd.textContent = '+ 添加';
          btnAdd.addEventListener('click', () => this.handleSendRequest(u.id));
          actions.appendChild(btnAdd);

          item.appendChild(avatar);
          item.appendChild(info);
          item.appendChild(actions);
          resultsContainer.appendChild(item);
        });
      } else {
        const emptyP = document.createElement('p');
        emptyP.className = 'empty-text';
        emptyP.textContent = '未找到用户';
        resultsContainer.appendChild(emptyP);
      }
    } catch (err) {
      resultsContainer.innerHTML = '';
      const errP = document.createElement('p');
      errP.className = 'empty-text';
      errP.textContent = '搜索失败';
      resultsContainer.appendChild(errP);
      this.showToast('搜索失败: ' + err.message, 'error');
    }
  }

  async handleSendRequest(friendId) {
    try {
      const result = await network.post('/api/friends/request', { friendId });
      if (result.success) {
        this.showToast('好友请求已发送', 'success');
        this.elements.friendSearchResults.classList.add('hidden');
        this.elements.friendSearchInput.value = '';
      } else {
        this.showToast(result.message, 'error');
      }
    } catch (err) {
      this.showToast('发送请求失败: ' + err.message, 'error');
    }
  }

  async handleAcceptRequest(friendId) {
    try {
      const result = await network.post('/api/friends/accept', { friendId });
      if (result.success) {
        this.showToast('已接受好友请求', 'success');
        await this.refreshFriendData();
      } else {
        this.showToast(result.message, 'error');
      }
    } catch (err) {
      this.showToast('接受请求失败: ' + err.message, 'error');
    }
  }

  async handleRejectRequest(friendId) {
    try {
      const result = await network.post('/api/friends/reject', { friendId });
      if (result.success) {
        this.showToast('已拒绝好友请求', 'success');
        await this.refreshFriendData();
      } else {
        this.showToast(result.message, 'error');
      }
    } catch (err) {
      this.showToast('拒绝请求失败: ' + err.message, 'error');
    }
  }

  async handleRemoveFriend(friendId) {
    if (!confirm('确定要删除这位好友吗？')) return;
    try {
      const result = await network.delete('/api/friends/' + friendId);
      if (result.success) {
        this.showToast('已删除好友', 'success');
        await this.refreshFriendData();
      } else {
        this.showToast(result.message, 'error');
      }
    } catch (err) {
      this.showToast('删除好友失败: ' + err.message, 'error');
    }
  }

  async showFriendFarm(friendId) {
    this.hideFriendModal();
    if (window.game) {
      await window.game.loadFriendFarm(friendId);
    }
  }

  async showMessageModal(friendId, friendName) {
    this.currentMessageFriendId = friendId;
    const title = document.getElementById('message-modal-title');
    title.textContent = '💬 与 ' + friendName + ' 的留言';
    this.elements.messageModal.classList.remove('hidden');
    await this.loadMessages(friendId);
  }

  async loadMessages(friendId) {
    const list = this.elements.messageList;
    list.innerHTML = '';
    try {
      const result = await network.get('/api/friends/messages/' + friendId);
      if (result.success && result.data && result.data.length > 0) {
        result.data.forEach(m => {
          const item = document.createElement('div');
          item.className = 'message-item';
          const isMe = m.sender_id === parseInt(localStorage.getItem('farm_user_id') || '0');
          item.classList.add(isMe ? 'message-mine' : 'message-theirs');

          const content = document.createElement('div');
          content.className = 'message-content';
          content.textContent = m.content;

          const time = document.createElement('div');
          time.className = 'message-time';
          time.textContent = new Date(m.created_at).toLocaleString();

          item.appendChild(content);
          item.appendChild(time);
          list.appendChild(item);
        });
        list.scrollTop = list.scrollHeight;
      } else {
        const emptyP = document.createElement('p');
        emptyP.className = 'empty-text';
        emptyP.textContent = '暂无留言，发送一条吧！';
        list.appendChild(emptyP);
      }
    } catch (err) {
      const errP = document.createElement('p');
      errP.className = 'empty-text';
      errP.textContent = '获取留言失败';
      list.appendChild(errP);
      this.showToast('获取留言失败: ' + err.message, 'error');
    }
  }

  async handleSendMessage(friendId) {
    const content = this.elements.messageInput.value.trim();
    if (!content) {
      this.showToast('请输入留言内容', 'error');
      return;
    }
    try {
      const result = await network.post('/api/friends/message', { friendId, content });
      if (result.success) {
        this.elements.messageInput.value = '';
        await this.loadMessages(friendId);
      } else {
        this.showToast(result.message, 'error');
      }
    } catch (err) {
      this.showToast('发送留言失败: ' + err.message, 'error');
    }
  }

  async showGiftModal(friendId) {
    this.currentGiftFriendId = friendId;
    this.elements.giftModal.classList.remove('hidden');
    const list = this.elements.giftSeedList;
    list.innerHTML = '';

    if (!this.cropTypes || this.cropTypes.length === 0) {
      try {
        const result = await network.get('/api/crops');
        if (result.success) this.cropTypes = result.data;
      } catch (err) {
        this.showToast('获取种子列表失败', 'error');
        this.hideGiftModal();
        return;
      }
    }

    this.cropTypes.forEach(crop => {
      const item = document.createElement('div');
      item.className = 'seed-item';

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
      seedPrice.className = 'seed-price';
      seedPrice.textContent = `${crop.buy_price}💰`;
      seedMeta.appendChild(seedPrice);
      item.appendChild(seedMeta);

      item.addEventListener('click', () => this.handleSendGift(friendId, crop.id, crop.name));
      list.appendChild(item);
    });
  }

  async handleSendGift(friendId, cropTypeId, cropName) {
    try {
      const result = await network.post('/api/friends/gift', { friendId, cropTypeId, quantity: 1 });
      if (result.success) {
        this.showToast(`已赠送 ${cropName} 种子`, 'success');
        this.hideGiftModal();
      } else {
        this.showToast(result.message, 'error');
      }
    } catch (err) {
      this.showToast('赠送种子失败: ' + err.message, 'error');
    }
  }

  /* ==================== 签到系统 ==================== */

  async showCheckinModal() {
    try {
      const result = await network.get('/api/checkin/status');
      if (result.success) {
        const data = result.data;
        this.elements.checkinStreakCount.textContent = data.consecutiveDays;
        this.elements.checkinStatusText.textContent = data.checkedInToday ? '今日已签到 ✓' : '今日未签到';
        this.elements.checkinStatusText.className = data.checkedInToday ? 'checkin-status checked-in' : 'checkin-status';
        this.elements.checkinReward.textContent = data.todayReward;
        this.elements.checkinExtraReward.style.display = (data.consecutiveDays + (data.checkedInToday ? 0 : 1)) >= 7 ? 'block' : 'none';
        this.elements.btnDoCheckin.disabled = data.checkedInToday;
        this.elements.btnDoCheckin.textContent = data.checkedInToday ? '今日已签到' : '立即签到';
        this.renderCheckinCalendar(data.recentCheckins || []);
        this.elements.checkinModal.classList.remove('hidden');

        // 绑定签到按钮事件（先移除旧事件避免重复）
        const newBtn = this.elements.btnDoCheckin.cloneNode(true);
        this.elements.btnDoCheckin.parentNode.replaceChild(newBtn, this.elements.btnDoCheckin);
        this.elements.btnDoCheckin = newBtn;
        newBtn.addEventListener('click', () => this.handleDoCheckin());
      } else {
        this.showToast('获取签到状态失败', 'error');
      }
    } catch (err) {
      this.showToast('获取签到状态失败: ' + err.message, 'error');
    }
  }

  renderCheckinCalendar(checkins) {
    const container = this.elements.checkinCalendar;
    container.innerHTML = '';
    checkins.forEach(item => {
      const dayEl = document.createElement('div');
      dayEl.className = `checkin-day ${item.checkedIn ? 'checked' : ''} ${item.isToday ? 'today' : ''}`;

      const dateLabel = document.createElement('div');
      dateLabel.className = 'checkin-day-label';
      const d = new Date(item.date);
      dateLabel.textContent = `${d.getMonth() + 1}/${d.getDate()}`;

      const statusIcon = document.createElement('div');
      statusIcon.className = 'checkin-day-icon';
      statusIcon.textContent = item.checkedIn ? '✓' : '·';

      dayEl.appendChild(dateLabel);
      dayEl.appendChild(statusIcon);
      container.appendChild(dayEl);
    });
  }

  async handleDoCheckin() {
    const btn = this.elements.btnDoCheckin;
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '签到中...';
    try {
      const result = await network.post('/api/checkin');
      if (result.success) {
        const data = result.data;
        this.showToast(data.message, 'success');
        if (data.extraReward) {
          setTimeout(() => {
            this.showToast(`额外奖励: ${data.extraReward}种子！`, 'success');
          }, 800);
        }
        // 金币飞入动画
        this.animateCoinFly();
        await this.showCheckinModal();
        // 刷新农场数据以更新金币显示
        if (window.game) await window.game.refreshFarm();
      } else {
        this.showToast(result.message, 'error');
      }
    } catch (err) {
      this.showToast('签到失败: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  animateCoinFly() {
    const toast = this.elements.toast;
    const coin = document.createElement('div');
    coin.textContent = '💰';
    coin.style.position = 'fixed';
    coin.style.left = '50%';
    coin.style.top = '50%';
    coin.style.fontSize = '32px';
    coin.style.zIndex = '3000';
    coin.style.pointerEvents = 'none';
    coin.style.transition = 'all 0.8s ease-out';
    document.body.appendChild(coin);

    requestAnimationFrame(() => {
      const targetRect = this.elements.playerCoins.getBoundingClientRect();
      coin.style.left = targetRect.left + 'px';
      coin.style.top = targetRect.top + 'px';
      coin.style.transform = 'scale(0.5)';
      coin.style.opacity = '0';
    });

    setTimeout(() => {
      coin.remove();
    }, 900);
  }

  /* ==================== 成就系统 ==================== */

  async showAchievementModal() {
    try {
      const result = await network.get('/api/achievements');
      if (result.success) {
        this.renderAchievementList(result.data);
        this.elements.achievementModal.classList.remove('hidden');
      } else {
        this.showToast('获取成就列表失败', 'error');
      }
    } catch (err) {
      this.showToast('获取成就列表失败: ' + err.message, 'error');
    }
  }

  renderAchievementList(achievements) {
    const list = this.elements.achievementList;
    const progress = this.elements.achievementProgress;
    list.innerHTML = '';

    if (!achievements || achievements.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.className = 'empty-text';
      emptyP.textContent = '暂无成就数据';
      list.appendChild(emptyP);
      progress.textContent = '已解锁: 0 / 0';
      return;
    }

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    progress.textContent = `已解锁: ${unlockedCount} / ${achievements.length}`;

    achievements.forEach(ach => {
      const item = document.createElement('div');
      item.className = `achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}`;

      const icon = document.createElement('div');
      icon.className = 'achievement-icon';
      icon.textContent = ach.unlocked ? '🏆' : '🔒';

      const info = document.createElement('div');
      info.className = 'achievement-info';

      const nameRow = document.createElement('div');
      nameRow.className = 'achievement-name-row';
      const name = document.createElement('span');
      name.className = 'achievement-name';
      name.textContent = ach.name;
      const reward = document.createElement('span');
      reward.className = 'achievement-reward';
      reward.textContent = `+${ach.reward}💰`;
      nameRow.appendChild(name);
      nameRow.appendChild(reward);

      const desc = document.createElement('div');
      desc.className = 'achievement-desc';
      desc.textContent = ach.description;

      const progressBar = document.createElement('div');
      progressBar.className = 'achievement-progress-bar';
      const progressFill = document.createElement('div');
      progressFill.className = 'achievement-progress-fill';
      const pct = ach.progress.target > 0
        ? Math.min(100, Math.round((ach.progress.current / ach.progress.target) * 100))
        : 0;
      progressFill.style.width = pct + '%';
      const progressText = document.createElement('span');
      progressText.className = 'achievement-progress-text';
      progressText.textContent = ach.unlocked ? '已完成' : `${ach.progress.current} / ${ach.progress.target}`;
      progressBar.appendChild(progressFill);
      progressBar.appendChild(progressText);

      info.appendChild(nameRow);
      info.appendChild(desc);
      info.appendChild(progressBar);

      item.appendChild(icon);
      item.appendChild(info);
      list.appendChild(item);
    });
  }

  /* ==================== 无障碍功能（老年人专属） ==================== */

  initAccessibility() {
    // 大字体
    const isLargeFont = localStorage.getItem('farm_large_font') === 'true';
    if (isLargeFont) document.body.classList.add('large-font');
    // 高对比度
    const isHighContrast = localStorage.getItem('farm_high_contrast') === 'true';
    if (isHighContrast) document.body.classList.add('high-contrast');
    // 语音播报
    this.updateFontToggleUI();
    this.updateContrastToggleUI();
    this.updateVoiceToggleUI();
  }

  toggleFontSize() {
    const isLarge = document.body.classList.toggle('large-font');
    localStorage.setItem('farm_large_font', isLarge);
    this.updateFontToggleUI();
    this.showToast(isLarge ? '已切换大字体模式' : '已切换正常字体');
  }

  updateFontToggleUI() {
    const btn = this.elements.btnFontToggle;
    if (!btn) return;
    const isLarge = document.body.classList.contains('large-font');
    btn.textContent = isLarge ? '🔤 大字 ✓' : '🔤 大字';
    btn.classList.toggle('active', isLarge);
    btn.title = isLarge ? '点击关闭大字体模式' : '点击开启大字体模式';
  }

  toggleHighContrast() {
    const isHigh = document.body.classList.toggle('high-contrast');
    localStorage.setItem('farm_high_contrast', isHigh);
    this.updateContrastToggleUI();
    this.showToast(isHigh ? '已开启高对比度模式' : '已关闭高对比度模式');
  }

  updateContrastToggleUI() {
    const btn = this.elements.btnContrastToggle;
    if (!btn) return;
    const isHigh = document.body.classList.contains('high-contrast');
    btn.textContent = isHigh ? '👁 对比 ✓' : '👁 对比';
    btn.classList.toggle('active', isHigh);
    btn.title = isHigh ? '点击关闭高对比度模式' : '点击开启高对比度模式';
  }

  toggleVoice() {
    if (typeof voiceManager === 'undefined') {
      this.showToast('语音功能暂不可用', 'error');
      return;
    }
    const enabled = voiceManager.toggle();
    this.updateVoiceToggleUI();
    this.showToast(enabled ? '语音播报已开启' : '语音播报已关闭');
    if (enabled) voiceManager.speak('语音播报已开启');
  }

  updateVoiceToggleUI() {
    const btn = this.elements.btnVoiceToggle;
    if (!btn || typeof voiceManager === 'undefined') return;
    const enabled = voiceManager.enabled;
    btn.textContent = enabled ? '🔊 语音 ✓' : '🔊 语音';
    btn.classList.toggle('active', enabled);
    btn.title = enabled ? '点击关闭语音播报' : '点击开启语音播报';
  }

  /* ==================== 推送通知 ==================== */

  async initPushStatus() {
    try {
      const status = await getPushStatus();
      this.pushStatus = status;
      this.updatePushToggleUI();
    } catch (err) {
      console.error('初始化推送状态失败:', err);
    }
  }

  updatePushToggleUI() {
    const btn = this.elements.btnPushToggle;
    if (!btn) return;

    if (this.pushStatus === 'unsupported') {
      btn.textContent = '🔕 不支持';
      btn.disabled = true;
      btn.classList.add('disabled');
      btn.title = '当前浏览器不支持推送通知';
    } else if (this.pushStatus === 'denied') {
      btn.textContent = '🔕 已拒绝';
      btn.disabled = true;
      btn.classList.add('disabled');
      btn.title = '通知权限已被拒绝，请在浏览器设置中开启';
    } else if (this.pushStatus === 'granted') {
      btn.textContent = '🔔 已开启';
      btn.disabled = false;
      btn.classList.remove('disabled');
      btn.classList.add('active');
      btn.title = '点击关闭推送通知';
    } else {
      btn.textContent = '🔔 推送通知';
      btn.disabled = false;
      btn.classList.remove('disabled', 'active');
      btn.title = '点击开启推送通知';
    }
  }

  async handlePushToggle() {
    if (this.pushStatus === 'unsupported' || this.pushStatus === 'denied') {
      return;
    }

    try {
      if (this.pushStatus === 'granted') {
        // 取消订阅
        await unsubscribeFromPush();
        this.pushStatus = 'default';
        this.showToast('已关闭推送通知', 'info');
      } else {
        // 请求权限并订阅
        this.elements.btnPushToggle.textContent = '⏳ 请求中...';
        this.elements.btnPushToggle.disabled = true;

        const permissionGranted = await requestNotificationPermission();
        if (!permissionGranted) {
          this.pushStatus = 'denied';
          this.showToast('通知权限被拒绝', 'error');
        } else {
          await subscribeToPush();
          this.pushStatus = 'granted';
          this.showToast('推送通知已开启', 'success');
        }
      }
    } catch (err) {
      console.error('切换推送通知失败:', err);
      this.showToast('操作失败: ' + (err.message || '未知错误'), 'error');
    } finally {
      this.updatePushToggleUI();
    }
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
