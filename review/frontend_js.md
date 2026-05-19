# 像素农场游戏前端 JavaScript 代码审查报告

> 审查文件：`game.js`、`ui.js`、`network.js`  
> 审查维度：游戏循环、事件绑定、异步处理、状态管理、WebSocket、交互流程、localStorage、输入事件、错误提示

---

## 🔴 严重问题（必须修复）

### 1. XSS 注入漏洞（`ui.js`）

**位置：** `renderSeedList()` 第 269-280 行、`renderNotifList()` 第 381-385 行

**问题描述：** 直接将服务器返回的数据通过 `innerHTML` 插入 DOM，未做 HTML 转义。如果服务器被攻破或返回恶意内容，可导致存储型 XSS。

```javascript
// 问题代码（renderSeedList）
item.innerHTML = `
  <div class="seed-name">${crop.name}</div>
  <div class="seed-desc">${crop.description}</div>
`;

// 问题代码（renderNotifList）
item.innerHTML = `
  <div class="notif-title">${n.title}</div>
  <div class="notif-content">${n.content}</div>
`;
```

**修复建议：**
```javascript
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// renderSeedList 中使用
item.innerHTML = `
  <div class="seed-name">${escapeHtml(crop.name)}</div>
  <div class="seed-desc">${escapeHtml(crop.description)}</div>
`;
```

---

### 2. `disconnect()` 后仍然无限重连（`network.js`）

**位置：** `disconnect()` 第 191-202 行、`onclose` 第 111-122 行

**问题描述：** `disconnect()` 调用 `ws.close()` 是异步操作，`onclose` 事件可能在 `disconnect()` 执行完毕后触发。`onclose` 回调中设置了重连定时器，导致调用 `disconnect()` 后 WebSocket 仍在后台不断重连。

```javascript
// 问题代码
disconnect() {
  if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  if (this.ws) {
    this.ws.close();  // 异步触发 onclose
    this.ws = null;
  }
}

// onclose 仍会被触发
this.ws.onclose = () => {
  this.reconnectTimer = setTimeout(() => {
    this.connectWebSocket();  // 死灰复燃！
  }, this.reconnectInterval);
};
```

**修复建议：**
```javascript
disconnect() {
  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  if (this.ws) {
    // 先移除处理器，防止 close 后触发重连
    this.ws.onclose = null;
    this.ws.onerror = null;
    this.ws.onmessage = null;
    this.ws.onopen = null;
    this.ws.close();
    this.ws = null;
  }
  this.isConnected = false;
  this.hasConnected = false;
}
```

---

### 3. Canvas 事件监听器内存泄漏（`game.js`）

**位置：** `setupInputListeners()` 第 95-130 行

**问题描述：** 通过 `addEventListener` 绑定了 `mousemove`、`click`、`mouseleave`、`touchstart`、`touchend` 共 5 个监听器，但 `stop()` 方法中完全没有移除它们。在重新初始化或 SPA 路由切换时，旧实例的监听器会持续引用 `FarmGame` 实例，导致内存泄漏。

**修复建议：**
```javascript
constructor() {
  // ...
  this._boundMouseMove = null;
  this._boundClick = null;
  this._boundMouseLeave = null;
  this._boundTouchStart = null;
  this._boundTouchEnd = null;
}

setupInputListeners() {
  this._boundMouseMove = (e) => { /* ... */ };
  this._boundClick = (e) => { /* ... */ };
  this._boundMouseLeave = () => { /* ... */ };
  this._boundTouchStart = (e) => { /* ... */ };
  this._boundTouchEnd = (e) => { /* ... */ };

  this.canvas.addEventListener('mousemove', this._boundMouseMove);
  this.canvas.addEventListener('click', this._boundClick);
  this.canvas.addEventListener('mouseleave', this._boundMouseLeave);
  this.canvas.addEventListener('touchstart', this._boundTouchStart, { passive: false });
  this.canvas.addEventListener('touchend', this._boundTouchEnd, { passive: false });
}

stop() {
  // ... 已有代码
  if (this._boundMouseMove) {
    this.canvas.removeEventListener('mousemove', this._boundMouseMove);
    this.canvas.removeEventListener('click', this._boundClick);
    this.canvas.removeEventListener('mouseleave', this._boundMouseLeave);
    this.canvas.removeEventListener('touchstart', this._boundTouchStart);
    this.canvas.removeEventListener('touchend', this._boundTouchEnd);
    this._boundMouseMove = null;
    // ...
  }
}
```

---

### 4. WebSocket 事件监听器在 network 单例中累积（`game.js` + `network.js`）

**位置：** `game.js` `init()` 第 35-45 行

**问题描述：** `network.on()` 将回调存储在 `NetworkManager` 单例的 `listeners` Map 中。`FarmGame` 实例被替换时（如重新登录），旧的 `crop_mature` / `notification` 监听器不会被移除，仍然持有对旧 `FarmGame` 实例的引用，造成内存泄漏。`wsListenersAdded` 标志只防同一个实例的重复添加，不防跨实例泄漏。

**修复建议：**
```javascript
async init() {
  // ... 在 init 前清理旧的 WS 监听
  network.offAll('crop_mature');
  network.offAll('notification');

  network.on('crop_mature', (data) => {
    this.ui.showToast(data.message, 'success');
    this.refreshFarm();
  });
  network.on('notification', (data) => {
    this.ui.showToast(data.notification.title, 'info');
    this.ui.showNotifBadge(1);
  });
  // 移除 wsListenersAdded 标志，每次都先清理再注册
}

stop() {
  // ... 已有代码
  network.offAll('crop_mature');
  network.offAll('notification');
}
```

---

## 🟠 高危问题（建议尽快修复）

### 5. `game.init()` 可能在初始化失败后继续运行（`game.js`）

**位置：** `init()` 第 23-51 行

**问题描述：** `refreshFarm()` 失败时（如网络断开），catch 仅打印日志，随后仍然调用 `setupInputListeners`、`startGameLoop`、`startAutoRefresh`。这会导致游戏循环在 `farmData` 为空的情况下运行，渲染空白农场，且自动刷新也会持续执行失败的请求。

**修复建议：**
```javascript
async init() {
  this.ui.showLoading(true);
  try {
    await this.refreshFarm();
  } catch (err) {
    console.error('init error:', err);
    this.ui.showLoading(false);
    this.ui.showToast('加载农场失败，请刷新页面重试', 'error');
    return;  // 初始化失败时中止后续流程
  }
  this.ui.showLoading(false);
  this.setupInputListeners();
  this.startGameLoop();
  this.startAutoRefresh();
  // ...
}
```

---

### 6. `DOMContentLoaded` 中 `game.init()` 被重复调用（`game.js`）

**位置：** 第 362-372 行

**问题描述：** 页面加载时 `new FarmGame()` 创建了实例，随后如果 `token` 存在，调用 `ui.showGameScreen()`，该方法内部又会调用 `window.game.init()`。这意味着有 token 的用户在页面加载时 `init()` 会被调用一次（通过 showGameScreen）。如果用户登出再登录，`showGameScreen` 又会调用 `init()`。

**修复建议：** 在 `showGameScreen()` 中检查游戏是否已初始化，或仅在 DOMContentLoaded 中统一管理初始化流程。

```javascript
// game.js
async init() {
  if (this._initialized) return;
  this._initialized = true;
  // ...
}

// ui.js showGameScreen()
showGameScreen() {
  this.screens.auth.classList.add('hidden');
  this.screens.game.classList.remove('hidden');
  network.connectWebSocket();
  if (window.game && !window.game._initialized) {
    window.game.init();
  }
}
```

---

### 7. WebSocket 无限重连无上限（`network.js`）

**位置：** `onclose` 第 111-122 行

**问题描述：** 没有最大重试次数限制。服务器永久不可用或网络断开时，会每隔 3 秒无限重试，消耗客户端资源和服务器连接池。

**修复建议：**
```javascript
constructor() {
  // ...
  this.maxReconnectAttempts = 10;
  this.reconnectAttempts = 0;
}

connectWebSocket() {
  // ...
  this.ws.onopen = () => {
    this.reconnectAttempts = 0;  // 连接成功后重置
    // ...
  };

  this.ws.onclose = () => {
    this.isConnected = false;
    this.ws = null;
    this.emit('disconnected', {});

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.reconnectTimer = setTimeout(() => {
        if (!this.isConnected && document.visibilityState !== 'hidden') {
          this.connectWebSocket();
        }
      }, this.reconnectInterval);
    } else {
      this.emit('max_reconnect_exceeded', {});
    }
  };
}
```

---

### 8. 触摸事件处理不完整（`game.js`）

**位置：** `setupInputListeners()` 第 115-129 行

**问题描述：**
1. `touchstart` 中调用了 `e.preventDefault()` 阻止了默认滚动，但没有处理 `touchmove`，用户在 canvas 上滑动仍可能导致页面滚动。
2. `touchend` 直接调用 `handlePlotClick()`，但没有在 `touchend` 时重新计算坐标。如果用户手指移动过，`touchstart` 时的坐标已经不准确。
3. 缺少 `touchcancel` 处理。

**修复建议：**
```javascript
setupInputListeners() {
  // ... mouse 事件 ...

  this.canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    this.updateTouchPosition(touch);
    this.updateHoverPlot();
  }, { passive: false });

  this.canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    this.updateTouchPosition(touch);
    this.updateHoverPlot();
  }, { passive: false });

  this.canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    // touchend 时 touches 已为空，改用 changedTouches
    const touch = e.changedTouches[0];
    this.updateTouchPosition(touch);
    this.updateHoverPlot();
    this.handlePlotClick();
  }, { passive: false });

  this.canvas.addEventListener('touchcancel', () => {
    this.state.hoverPlot = null;
    this.ui.hidePlotTooltip();
  });
}

updateTouchPosition(touch) {
  const rect = this.canvas.getBoundingClientRect();
  const scaleX = this.renderer.gameWidth / rect.width;
  const scaleY = this.renderer.gameHeight / rect.height;
  this.mouseX = (touch.clientX - rect.left) * scaleX;
  this.mouseY = (touch.clientY - rect.top) * scaleY;
}
```

---

### 9. `refreshFarm` 按钮无错误处理导致 loading 卡死（`ui.js`）

**位置：** `initListeners()` 第 80-85 行

**问题描述：** 点击刷新按钮时 `refreshFarm().then(() => this.showLoading(false))` 没有 `.catch()`。虽然 `refreshFarm` 内部有 try-catch，但如果 `network.get()` 抛出非预期的异常（如 `TypeError`），loading 状态将永远不会消失。

**修复建议：**
```javascript
this.elements.btnRefresh.addEventListener('click', async () => {
  if (window.game) {
    this.showLoading(true);
    try {
      await window.game.refreshFarm();
    } catch (err) {
      this.showToast('刷新失败', 'error');
    } finally {
      this.showLoading(false);
    }
  }
});
```

---

### 10. `post()` 方法 400 状态码处理有隐患（`network.js`）

**位置：** `post()` 第 57-62 行

**问题描述：** `if (!response.ok && response.status !== 400)` 将 400 视为"非错误"直接返回 `response.json()`。但如果服务器 400 返回的是 HTML 错误页面（如 Nginx 502/400 页面），`response.json()` 会 reject，抛出 `SyntaxError`，调用方难以区分是业务错误还是解析错误。

**修复建议：**
```javascript
async post(endpoint, data, auth = true) {
  // ... 构建 options ...
  const response = await fetch(`${this.baseUrl}${endpoint}`, options);

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    const text = isJson ? await response.text() : await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  if (!isJson) {
    throw new Error(`Unexpected response format: ${contentType}`);
  }
  return response.json();
}
```

---

## 🟡 中等问题（建议修复）

### 11. 登录/注册按钮无 loading 状态（`ui.js`）

**位置：** `handleLogin()` 第 127-145 行、`handleRegister()` 第 147-172 行

**问题描述：** 用户点击登录/注册后，网络请求期间按钮仍可点击，可能导致重复提交。

**修复建议：**
```javascript
async handleLogin() {
  if (this._authLoading) return;
  this._authLoading = true;
  this.elements.loginBtn.disabled = true;
  this.elements.loginBtn.textContent = '登录中...';

  try {
    // ... 原有逻辑 ...
  } catch (err) {
    this.showAuthMessage('登录失败: ' + err.message, 'error');
  } finally {
    this._authLoading = false;
    this.elements.loginBtn.disabled = false;
    this.elements.loginBtn.textContent = '登录';
  }
}
```

---

### 12. `initKeyboard` 未过滤 TEXTAREA 和 contenteditable（`ui.js`）

**位置：** `initKeyboard()` 第 100-110 行

**问题描述：** 仅过滤了 `<input>` 元素，用户在 `<textarea>` 或 `contenteditable` 元素中输入时，按 `Escape` 或数字键仍会被拦截。

**修复建议：**
```javascript
initKeyboard() {
  document.addEventListener('keydown', (e) => {
    const isInput = e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'TEXTAREA' ||
                    e.target.isContentEditable;
    if (isInput) return;
    // ...
  });
}
```

---

### 13. `update()` 方法直接修改服务端数据（`game.js`）

**位置：** `update()` 第 309-329 行

**问题描述：** 游戏循环每 3 秒直接修改 `this.state.farmData.plots` 中 plot 对象的 `growth_progress` 和 `is_mature` 属性。这些对象引用来自服务端数据，直接修改会导致：
1. 本地计算与服务端状态不一致（如用户在其他设备上浇水）
2. `refreshFarm()` 获取新数据替换 `farmData` 时，update 可能正在遍历旧数组

**修复建议：** 将本地生长计算与服务器数据分离，或使用不可变更新：
```javascript
update(timestamp) {
  this.updateParticles();
  if (timestamp - this.lastUpdate > 3000) {
    this.lastUpdate = timestamp;
    if (this.state.farmData && this.state.farmData.plots) {
      this.state.farmData.plots = this.state.farmData.plots.map(plot => {
        if (plot.status !== 'planted' || !plot.planted_at) return plot;
        const plantedTime = new Date(plot.planted_at).getTime();
        const elapsed = (Date.now() - plantedTime) / 1000;
        let boost = 1.0;
        if (plot.watered_at) {
          const wateredTime = new Date(plot.watered_at).getTime();
          if ((Date.now() - wateredTime) / 1000 < 3600) boost = 1.5;
        }
        const progress = Math.min(1.0, (elapsed * boost) / (plot.growth_time || 60));
        return { ...plot, growth_progress: progress, is_mature: progress >= 1.0 };
      });
    }
  }
}
```

---

### 14. `autoRefresh` 无退避机制且未清理（`game.js`）

**位置：** `startAutoRefresh()` 第 339-342 行

**问题描述：**
1. 固定 5 秒间隔，网络异常时不会退避
2. 每次调用 `startAutoRefresh()` 都会创建新定时器，虽然会先清除旧的，但如果调用方不小心多次调用仍有问题
3. 页面 `visibilitychange` 时没有暂停/恢复刷新

**修复建议：**
```javascript
constructor() {
  // ...
  this.refreshInterval = 5000;
  this.refreshTimer = null;
  this._boundVisibilityChange = () => this.handleVisibilityChange();
}

startAutoRefresh() {
  if (this.refreshTimer) clearInterval(this.refreshTimer);
  this.refreshTimer = setInterval(() => this.refreshFarm(), this.refreshInterval);
  document.addEventListener('visibilitychange', this._boundVisibilityChange);
}

handleVisibilityChange() {
  if (document.hidden) {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  } else {
    this.refreshFarm();  // 立即刷新一次
    this.startAutoRefresh();
  }
}

stop() {
  // ...
  document.removeEventListener('visibilitychange', this._boundVisibilityChange);
}
```

---

### 15. 通知模态框 API 失败静默处理（`ui.js`）

**位置：** `showNotifModal()` 第 359-369 行

**问题描述：** API 返回 `success: false` 时，`this.notifications` 被设为 `[]`，用户看到空列表而不知道请求失败。

**修复建议：**
```javascript
async showNotifModal() {
  try {
    const result = await network.get('/api/notifications');
    if (result.success) {
      this.notifications = result.data;
      this.renderNotifList();
      this.elements.notifModal.classList.remove('hidden');
      this.elements.notifBadge.classList.add('hidden');
    } else {
      this.showToast(result.message || '获取通知失败', 'error');
    }
  } catch (err) {
    this.showToast('获取通知失败', 'error');
  }
}
```

---

### 16. 好友模态框功能完全缺失（`ui.js`）

**位置：** `showFriendModal()` 第 390-392 行

**问题描述：** 仅显示空模态框，没有加载好友列表、添加好友、删除好友等任何功能。

**修复建议：** 补充好友列表加载逻辑，或暂时隐藏好友按钮：
```javascript
async showFriendModal() {
  this.elements.friendModal.classList.remove('hidden');
  try {
    const result = await network.get('/api/friends');
    if (result.success) {
      this.renderFriendList(result.data);
    } else {
      this.elements.friendList.innerHTML = '<p class="empty-text">加载好友列表失败</p>';
    }
  } catch (err) {
    this.elements.friendList.innerHTML = '<p class="empty-text">加载好友列表失败</p>';
  }
}
```

---

### 17. WebSocket URL 缺少路径（`network.js`）

**位置：** `connectWebSocket()` 第 79-80 行

**问题描述：** WebSocket URL 为 `ws://host` 或 `wss://host`，没有指定 WebSocket 服务端点路径。如果后端 WebSocket 不在根路径（如 `/ws` 或 `/socket`），连接会失败。

**修复建议：**
```javascript
const wsUrl = `${protocol}//${window.location.host}/ws`;
```

---

### 18. `beforeunload` 使用匿名函数无法移除（`game.js`）

**位置：** 第 369-371 行

**问题描述：** 匿名函数作为监听器，无法在需要时（如 SPA 路由切换）移除。

**修复建议：**
```javascript
document.addEventListener('DOMContentLoaded', () => {
  game = new FarmGame();
  window.game = game;
  const token = localStorage.getItem('farm_token');
  if (token) {
    ui.showGameScreen();
  }
  window._beforeUnloadHandler = () => { if (game) game.stop(); };
  window.addEventListener('beforeunload', window._beforeUnloadHandler);
});
```

---

### 19. `showGameScreen` 中 `game.init()` 无错误处理（`ui.js`）

**位置：** `showGameScreen()` 第 196-201 行

**问题描述：** `network.connectWebSocket()` 和 `window.game.init()` 都没有 try-catch，任何异常都会导致未处理的 Promise rejection。

**修复建议：**
```javascript
async showGameScreen() {
  this.screens.auth.classList.add('hidden');
  this.screens.game.classList.remove('hidden');
  try {
    network.connectWebSocket();
    if (window.game) await window.game.init();
  } catch (err) {
    console.error('进入游戏失败:', err);
    this.showToast('进入游戏失败，请重试', 'error');
  }
}
```

---

### 20. `get()` 方法没有处理 400 状态码（`network.js`）

**位置：** `get()` 第 32-37 行

**问题描述：** 与 `post()` 不同，`get()` 中所有 `!response.ok` 都会抛异常，包括 400。如果业务逻辑需要通过 JSON 返回 400 错误信息（如参数校验失败），`get()` 会直接抛 HTTP 错误而不是返回 JSON。

**修复建议：** 统一 `get()` 和 `post()` 的错误处理逻辑，使行为一致。

---

## 🟢 低危/优化建议

### 21. `mousemove` 事件频繁更新 DOM（`game.js`）

**位置：** `setupInputListeners()` 第 96-104 行

**问题描述：** 鼠标在 canvas 上移动时，每帧都会调用 `showPlotTooltip` 或 `hidePlotTooltip`，即使 hoverPlot 没有变化。虽然现代浏览器 DOM 操作很快，但仍可做简单的位置变化检测优化。

**修复建议：**
```javascript
this.canvas.addEventListener('mousemove', (e) => {
  this.updateMousePosition(e);
  const prevHover = this.state.hoverPlot;
  this.updateHoverPlot();
  if (this.state.hoverPlot !== prevHover) {
    if (this.state.hoverPlot) {
      this.ui.showPlotTooltip(this.state.hoverPlot, e.clientX, e.clientY);
    } else {
      this.ui.hidePlotTooltip();
    }
  } else if (this.state.hoverPlot) {
    // 仅更新位置
    this.ui.updateTooltipPosition(e.clientX, e.clientY);
  }
});
```

---

### 22. `localStorage` 数据未验证即使用（多处）

**位置：** `game.js` 第 365-368 行、`network.js` 第 26-29 行等

**问题描述：** 直接读取 `localStorage.getItem('farm_token')` 并用于请求头，没有验证 token 格式或过期时间。如果 localStorage 中的数据被篡改（如 JSON 字符串被当作 token），可能导致无效请求。

**修复建议：** 添加简单的 token 格式校验，或在 API 返回 401 时统一清理 localStorage。

---

### 23. `saveAuth` 未防御性编程（`ui.js`）

**位置：** `saveAuth()` 第 174-178 行

**问题描述：** 假设 `data.token` 和 `data.user` 一定存在，如果后端响应格式变化，会导致 `Cannot read properties of undefined`。

**修复建议：**
```javascript
saveAuth(data) {
  if (!data?.token || !data?.user?.id) {
    console.error('Invalid auth data:', data);
    return;
  }
  localStorage.setItem('farm_token', data.token);
  localStorage.setItem('farm_user_id', data.user.id);
  localStorage.setItem('farm_username', data.user.username);
}
```

---

### 24. `handleLogin` / `handleRegister` 未清空旧错误消息（`ui.js`）

**位置：** `handleLogin()`、`handleRegister()`

**问题描述：** 用户看到错误后再次点击按钮，旧错误消息会一直显示到新的网络请求返回。应在新请求开始时清空旧消息。

**修复建议：**
```javascript
async handleLogin() {
  this.showAuthMessage('', '');  // 清空旧消息
  // ... 原有逻辑
}
```

---

### 25. `showNotifBadge` 参数类型未校验（`ui.js`）

**位置：** `showNotifBadge()` 第 394-402 行

**问题描述：** 传入非数字或负数时行为未定义。如 `showNotifBadge('1')` 会导致 `count > 99` 比较异常。

**修复建议：**
```javascript
showNotifBadge(count) {
  const num = parseInt(count, 10) || 0;
  const badge = this.elements.notifBadge;
  if (num > 0) {
    badge.textContent = num > 99 ? '99+' : num;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}
```

---

### 26. `PixelRenderer` 颜色解析无防御（`renderer.js`）

**位置：** `darkenColor()` 第 363-368 行

**问题描述：** 假设输入一定是 `#RRGGBB` 格式。如果 `cropColor` 为 `rgb(...)`、`hsl(...)` 或 `undefined`，`parseInt` 会返回 `NaN`，最终渲染异常颜色。

**修复建议：** 使用 `getComputedStyle` 或 canvas 的 `fillStyle` 自动解析，或增加格式校验：
```javascript
darkenColor(hex, factor) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#4a7c32';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#4a7c32';
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
}
```

---

### 27. `formatTime` 小时显示精度丢失（`ui.js`）

**位置：** `formatTime()` 第 309-313 行

**问题描述：** 7200 秒（2 小时）显示为 `2小时`，但 3601 秒也显示为 `1小时`，用户无法区分 1 小时 1 分钟和 1 小时 59 分钟。

**修复建议：** 使用更精确的时间格式化，或添加分钟余数：
```javascript
formatTime(seconds) {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}小时${m}分` : `${h}小时`;
}
```

---

## 📊 问题汇总表

| 编号 | 文件 | 严重级别 | 问题类别 | 简述 |
|------|------|----------|----------|------|
| 1 | ui.js | 🔴 严重 | 安全 | XSS 注入漏洞（innerHTML 未转义） |
| 2 | network.js | 🔴 严重 | 逻辑 | disconnect() 后仍无限重连 |
| 3 | game.js | 🔴 严重 | 内存泄漏 | Canvas 事件监听器未移除 |
| 4 | game.js | 🔴 严重 | 内存泄漏 | WS 监听器在 network 单例中累积 |
| 5 | game.js | 🟠 高危 | 健壮性 | init() 失败后继续初始化 |
| 6 | game.js | 🟠 高危 | 健壮性 | game.init() 可能被重复调用 |
| 7 | network.js | 🟠 高危 | 健壮性 | WS 无限重连无上限 |
| 8 | game.js | 🟠 高危 | 交互 | 触摸事件处理不完整 |
| 9 | ui.js | 🟠 高危 | 交互 | 刷新按钮无错误处理导致 loading 卡死 |
| 10 | network.js | 🟠 高危 | 健壮性 | post() 400 响应可能非 JSON |
| 11 | ui.js | 🟡 中等 | 交互 | 登录/注册按钮无 loading 状态 |
| 12 | ui.js | 🟡 中等 | 交互 | 键盘快捷键未过滤 textarea/contenteditable |
| 13 | game.js | 🟡 中等 | 状态管理 | update() 直接修改服务端数据 |
| 14 | game.js | 🟡 中等 | 性能 | autoRefresh 无退避和可见性管理 |
| 15 | ui.js | 🟡 中等 | 交互 | 通知模态框 API 失败静默处理 |
| 16 | ui.js | 🟡 中等 | 功能缺失 | 好友模态框功能完全缺失 |
| 17 | network.js | 🟡 中等 | 功能 | WS URL 缺少路径 |
| 18 | game.js | 🟡 中等 | 代码质量 | beforeunload 使用匿名函数 |
| 19 | ui.js | 🟡 中等 | 健壮性 | showGameScreen 中 init 无错误处理 |
| 20 | network.js | 🟡 中等 | 一致性 | get() 未处理 400 状态码 |
| 21-27 | 多处 | 🟢 低危 | 优化建议 | 详见上文 |

---

## ✅ 修复优先级建议

**P0（立即修复）：**
- 问题 1（XSS 漏洞）
- 问题 2（disconnect 后无限重连）
- 问题 3（Canvas 事件泄漏）
- 问题 4（WS 监听器累积泄漏）

**P1（本周修复）：**
- 问题 5（init 失败后继续运行）
- 问题 6（init 重复调用）
- 问题 7（WS 无限重连）
- 问题 8（触摸事件不完整）
- 问题 9（刷新按钮 loading 卡死）
- 问题 10（400 响应解析错误）

**P2（下个迭代修复）：**
- 问题 11-20（交互、状态管理、健壮性）

**P3（技术债）：**
- 问题 21-27（性能优化、防御性编程）
