/**
 * 网络通信模块
 * 处理 HTTP API 请求和 WebSocket 连接
 */
class NetworkManager {
  constructor() {
    this.baseUrl = '';
    this.ws = null;
    this.reconnectInterval = 3000;
    this.listeners = new Map();
    this.isConnected = false;
    this.reconnectTimer = null;
    this.hasConnected = false;
    this.intentionallyClosed = false;
  }

  /**
   * HTTP GET 请求
   */
  async get(endpoint, auth = true) {
    const options = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (auth) {
      const token = localStorage.getItem('farm_token');
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return response.json();
  }

  /**
   * HTTP POST 请求
   */
  async post(endpoint, data, auth = true) {
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
    
    if (auth) {
      const token = localStorage.getItem('farm_token');
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return response.json();
  }

  /**
   * 连接 WebSocket（避免重复连接）
   */
  connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket 已连接或正在连接，跳过');
      return;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.intentionallyClosed = false;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('WebSocket 创建失败:', err);
      return;
    }
    
    this.ws.onopen = () => {
      console.log('🔌 WebSocket 已连接');
      this.isConnected = true;
      this.hasConnected = true;
      
      const token = localStorage.getItem('farm_token');
      if (token) {
        this.send({ type: 'auth', token });
      }
      
      this.emit('connected', {});
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
      } catch (err) {
        console.error('WebSocket 消息解析失败:', err);
      }
    };
    
    this.ws.onclose = () => {
      console.log('🔌 WebSocket 已断开');
      this.isConnected = false;
      this.ws = null;
      this.emit('disconnected', {});
      
      if (this.intentionallyClosed) {
        this.intentionallyClosed = false;
        return;
      }
      
      this.reconnectTimer = setTimeout(() => {
        if (!this.isConnected && document.visibilityState !== 'hidden') {
          this.connectWebSocket();
        }
      }, this.reconnectInterval);
    };
    
    this.ws.onerror = (err) => {
      console.error('WebSocket 错误:', err);
      this.emit('error', err);
    };
  }

  /**
   * 发送 WebSocket 消息
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  /**
   * 注册事件监听器
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 移除某个事件的所有监听器
   */
  offAll(event) {
    if (this.listeners.has(event)) {
      this.listeners.delete(event);
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('事件处理错误:', err);
        }
      });
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.intentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.hasConnected = false;
  }
}

// 全局网络管理器实例
const network = new NetworkManager();
