const { getDatabase, db } = require('../database');

/**
 * 获取好友列表（预留扩展）
 */
function getFriends(userId) {
  const db2 = getDatabase();
  
  const friends = db2.prepare(`
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
  const db2 = getDatabase();
  
  if (userId === friendId) {
    throw new Error('不能添加自己为好友');
  }
  
  // 检查正向关系
  const existing = db2.prepare('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?').get(userId, friendId);
  if (existing) {
    if (existing.status === 'accepted') {
      throw new Error('该用户已是您的好友');
    }
    throw new Error('好友请求已存在');
  }
  
  // 检查对方是否已发送请求给自己
  const reverse = db2.prepare('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?').get(friendId, userId);
  if (reverse) {
    if (reverse.status === 'pending') {
      throw new Error('对方已向您发送好友请求，请先处理');
    }
    throw new Error('该用户已是您的好友');
  }
  
  db2.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)')
    .run(userId, friendId, 'pending');
}

/**
 * 接受好友请求（预留扩展）
 */
function acceptFriendRequest(userId, friendId) {
  const db2 = getDatabase();
  
  const request = db2.prepare(`
    SELECT * FROM friends 
    WHERE user_id = ? AND friend_id = ? AND status = 'pending'
  `).get(friendId, userId);
  
  if (!request) {
    throw new Error('好友请求不存在');
  }
  
  db2.prepare("UPDATE friends SET status = 'accepted' WHERE id = ?").run(request.id);
  
  // 创建双向关系记录
  db2.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)')
    .run(userId, friendId, 'accepted');
}

/**
 * 搜索用户（按用户名模糊匹配）
 * @param {number} userId - 当前用户ID
 * @param {string} query - 搜索关键词
 * @returns {Array} - 匹配的用户列表（排除自己和已是好友的）
 */
function searchUsers(userId, query) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const q = query.trim().toLowerCase();

  // 获取当前用户的好友ID列表
  const friendIds = new Set();
  const userFriends = db.friends.filter(f => f.user_id === userId && (f.status === 'accepted' || f.status === 'pending'));
  for (const f of userFriends) {
    friendIds.add(f.friend_id);
  }

  // 搜索用户（排除自己和好友）
  return db.users
    .filter(u => u.id !== userId && !friendIds.has(u.id) && u.username.toLowerCase().includes(q))
    .map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name
    }));
}

/**
 * 拒绝好友请求
 * @param {number} userId - 当前用户ID
 * @param {number} friendId - 请求发送者ID
 */
function rejectFriendRequest(userId, friendId) {
  // friendId 是请求发送者，查找 (friendId, userId, 'pending')
  const request = db.friends.find(f => f.user_id === friendId && f.friend_id === userId && f.status === 'pending');
  if (!request) {
    throw new Error('好友请求不存在');
  }

  // 删除该请求
  db.friends = db.friends.filter(f => f.id !== request.id);
  const { saveDatabase } = require('../database');
  saveDatabase();
}

/**
 * 删除好友（双向删除）
 * @param {number} userId - 当前用户ID
 * @param {number} friendId - 好友ID
 */
function removeFriend(userId, friendId) {
  // 检查是否为好友
  const friendship = db.friends.find(f => f.user_id === userId && f.friend_id === friendId && f.status === 'accepted');
  if (!friendship) {
    throw new Error('该用户不是您的好友');
  }

  // 双向删除
  db.friends = db.friends.filter(f =>
    !(f.user_id === userId && f.friend_id === friendId) &&
    !(f.user_id === friendId && f.friend_id === userId)
  );
  const { saveDatabase } = require('../database');
  saveDatabase();
}

/**
 * 获取待处理的好友请求（别人发给我的）
 * @param {number} userId - 当前用户ID
 * @returns {Array} - 待处理请求列表，包含请求者信息
 */
function getPendingRequests(userId) {
  const requests = db.friends.filter(f => f.friend_id === userId && f.status === 'pending');
  return requests.map(r => {
    const user = db.users.find(u => u.id === r.user_id);
    return {
      id: r.id,
      user_id: r.user_id,
      username: user ? user.username : '',
      display_name: user ? user.display_name : '',
      created_at: r.created_at
    };
  });
}

/**
 * 发送留言
 * @param {number} senderId - 发送者ID
 * @param {number} receiverId - 接收者ID
 * @param {string} content - 留言内容（最多200字）
 */
function sendMessage(senderId, receiverId, content) {
  // 检查是否为好友
  const friendship = db.friends.find(f => f.user_id === senderId && f.friend_id === receiverId && f.status === 'accepted');
  if (!friendship) {
    throw new Error('只能给好友发送留言');
  }

  if (!content || content.trim().length === 0) {
    throw new Error('留言内容不能为空');
  }

  const trimmed = content.trim();
  if (trimmed.length > 200) {
    throw new Error('留言内容最多200字');
  }

  const db2 = getDatabase();
  db2.prepare("INSERT INTO messages (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, current_timestamp)")
    .run(senderId, receiverId, trimmed);
}

/**
 * 获取与某好友的留言记录
 * @param {number} userId - 当前用户ID
 * @param {number} friendId - 好友ID
 * @returns {Array} - 留言列表
 */
function getMessages(userId, friendId) {
  // 检查是否为好友
  const friendship = db.friends.find(f => f.user_id === userId && f.friend_id === friendId && f.status === 'accepted');
  if (!friendship) {
    throw new Error('只能查看好友的留言');
  }

  return db.messages
    .filter(m =>
      (m.sender_id === userId && m.receiver_id === friendId) ||
      (m.sender_id === friendId && m.receiver_id === userId)
    )
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(m => ({
      id: m.id,
      sender_id: m.sender_id,
      receiver_id: m.receiver_id,
      content: m.content,
      created_at: m.created_at,
      read_at: m.read_at
    }));
}

/**
 * 赠送种子
 * @param {number} senderId - 赠送者ID
 * @param {number} receiverId - 接收者ID
 * @param {number} cropTypeId - 作物类型ID
 * @param {number} quantity - 数量（默认1）
 */
function sendGift(senderId, receiverId, cropTypeId, quantity) {
  const db2 = getDatabase();

  // 检查是否为好友
  const friendship = db2.prepare("SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'accepted'").get(senderId, receiverId);
  if (!friendship) {
    throw new Error('只能给好友赠送种子');
  }

  // 验证作物类型
  const cropType = db2.prepare('SELECT * FROM crop_types WHERE id = ?').get(cropTypeId);
  if (!cropType) {
    throw new Error('作物类型不存在');
  }

  const qty = quantity && quantity > 0 ? quantity : 1;

  db2.prepare("INSERT INTO gifts (sender_id, receiver_id, crop_type_id, quantity, status, created_at) VALUES (?, ?, ?, ?, ?, current_timestamp)")
    .run(senderId, receiverId, cropTypeId, qty, 'pending');
}

module.exports = {
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  searchUsers,
  rejectFriendRequest,
  removeFriend,
  getPendingRequests,
  sendMessage,
  getMessages,
  sendGift
};
