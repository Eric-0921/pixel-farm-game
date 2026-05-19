/**
 * 浏览器推送通知管理模块
 */

/**
 * 检查浏览器是否支持 Push API
 */
function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * 请求推送通知权限
 * @returns {Promise<boolean>} — 是否获得权限
 */
async function requestNotificationPermission() {
  if (!isPushSupported()) return false;
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('请求通知权限失败:', err);
    return false;
  }
}

/**
 * 获取 VAPID 公钥
 */
async function getVapidPublicKey() {
  try {
    const result = await network.get('/api/notifications/vapid-public-key');
    if (result.success) {
      return result.publicKey;
    }
  } catch (err) {
    console.error('获取 VAPID 公钥失败:', err);
  }
  return null;
}

/**
 * 将 Base64 字符串转换为 Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 订阅推送通知
 * 1. 获取 VAPID 公钥
 * 2. 注册 Service Worker
 * 3. 订阅 Push
 * 4. 将订阅信息发送到后端
 */
async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error('浏览器不支持推送通知');
  }
  
  try {
    // 1. 获取 VAPID 公钥
    const publicKey = await getVapidPublicKey();
    if (!publicKey) {
      throw new Error('无法获取 VAPID 公钥');
    }
    
    // 2. 注册 Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    
    // 3. 订阅 Push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    
    // 4. 将订阅信息发送到后端
    await network.post('/api/notifications/subscribe', { subscription });
    
    return true;
  } catch (err) {
    console.error('订阅推送通知失败:', err);
    throw err;
  }
}

/**
 * 取消订阅推送通知
 */
async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }
    
    await network.post('/api/notifications/unsubscribe', {});
  } catch (err) {
    console.error('取消订阅推送通知失败:', err);
    throw err;
  }
}

/**
 * 检查当前推送订阅状态
 * @returns {Promise<string>} — 'granted' | 'denied' | 'default' | 'unsupported'
 */
async function getPushStatus() {
  if (!isPushSupported()) {
    return 'unsupported';
  }
  
  try {
    // 检查通知权限
    if (Notification.permission === 'denied') {
      return 'denied';
    }
    
    // 检查是否已有 Push 订阅
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        return 'granted';
      }
    }
    
    return Notification.permission; // 'default' or 'granted'
  } catch (err) {
    console.error('检查推送状态失败:', err);
    return 'default';
  }
}
