const { getDatabase } = require('../database');

/**
 * 获取好友列表（预留扩展）
 */
function getFriends(userId) {
  const db = getDatabase();
  
  const friends = db.prepare(`
    SELECT 
      u.id,
      u.username,
      u.display_name,
      f.status,
      f.created_at
    FROM friends f
    JOIN users u ON f.friend_id = u.id
    WHERE f.user_id = ? AND f.status = 'accepted'
  `).all(userId);
  
  return friends;
}

/**
 * 发送好友请求（预留扩展）
 */
function sendFriendRequest(userId, friendId) {
  const db = getDatabase();
  
  if (userId === friendId) {
    throw new Error('不能添加自己为好友');
  }
  
  // 检查是否已存在关系
  const existing = db.prepare('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?').get(userId, friendId);
  if (existing) {
    throw new Error('好友请求已存在');
  }
  
  db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)')
    .run(userId, friendId, 'pending');
}

/**
 * 接受好友请求（预留扩展）
 */
function acceptFriendRequest(userId, friendId) {
  const db = getDatabase();
  
  const request = db.prepare(`
    SELECT * FROM friends 
    WHERE user_id = ? AND friend_id = ? AND status = 'pending'
  `).get(friendId, userId);
  
  if (!request) {
    throw new Error('好友请求不存在');
  }
  
  db.prepare("UPDATE friends SET status = 'accepted' WHERE id = ?").run(request.id);
  
  // 创建双向关系记录
  db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)')
    .run(userId, friendId, 'accepted');
}

module.exports = {
  getFriends,
  sendFriendRequest,
  acceptFriendRequest
};
