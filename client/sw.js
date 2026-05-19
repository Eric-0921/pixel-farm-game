/**
 * 像素农场 Service Worker
 * 处理浏览器推送通知
 */

// 监听 push 事件
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: '像素农场',
      body: event.data ? event.data.text() : '您有一条新消息'
    };
  }
  
  const title = data.title || '像素农场';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction !== false,
    data: data.data || { url: '/' },
    vibrate: [100, 50, 100]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 监听 notificationclick 事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // 如果已有窗口打开，聚焦到该窗口
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            return client.focus();
          }
        }
        // 否则打开新窗口
        return clients.openWindow(url);
      })
      .catch((err) => {
        console.error('处理通知点击失败:', err);
      })
  );
});

// 监听 pushsubscriptionchange 事件
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push 订阅已变更');
  event.waitUntil(
    (async () => {
      try {
        // 获取 VAPID 公钥
        const keyRes = await fetch('/api/notifications/vapid-public-key');
        const keyData = await keyRes.json();
        const publicKey = keyData.publicKey || keyData.data?.publicKey;
        
        if (!publicKey) {
          console.error('无法获取 VAPID 公钥');
          return;
        }
        
        // Base64 转换
        const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
        const base64 = (publicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = self.atob(base64);
        const applicationServerKey = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          applicationServerKey[i] = rawData.charCodeAt(i);
        }
        
        // 重新订阅
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
        
        // 通知后端
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
        
        console.log('Push 订阅已更新并同步到后端');
      } catch (err) {
        console.error('处理 pushsubscriptionchange 失败:', err);
      }
    })()
  );
});

// Service Worker 安装
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Service Worker 激活
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
