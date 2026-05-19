# 像素农场 - API 接口文档

## 基础信息

- 基础URL: `http://localhost:3000/api`
- 认证方式: Bearer Token (JWT)
- 响应格式: JSON

## 认证接口

### POST /api/auth/register
用户注册

**请求参数:**
```json
{
  "username": "string",      // 必填，用户名
  "password": "string",      // 必填，密码（至少4位）
  "displayName": "string"    // 可选，显示名称
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "farmer1",
      "displayName": " farmer1",
      "coins": 100
    }
  }
}
```

### POST /api/auth/login
用户登录

**请求参数:**
```json
{
  "username": "string",
  "password": "string"
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "farmer1",
      "displayName": "farmer1",
      "coins": 100,
      "experience": 0
    }
  }
}
```

### GET /api/auth/me
获取当前用户信息（需认证）

**请求头:**
```
Authorization: Bearer <token>
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "farmer1",
    "displayName": "farmer1",
    "coins": 100,
    "experience": 0
  }
}
```

## 农场接口

### GET /api/farm
获取当前用户农场数据（需认证）

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "name": "我的农场",
    "width": 8,
    "height": 6,
    "coins": 100,
    "experience": 0,
    "display_name": "farmer1",
    "plots": [
      {
        "plot_id": 1,
        "x": 0,
        "y": 0,
        "status": "empty",
        "planting_id": null,
        "crop_type_id": null,
        "crop_name": null,
        "growth_progress": 0,
        "is_mature": false,
        "is_watered": false
      }
    ]
  }
}
```

### POST /api/farm/plant
种植作物（需认证）

**请求参数:**
```json
{
  "plotId": 1,        // 地块ID
  "cropTypeId": 1     // 作物类型ID
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "种植成功",
  "data": {
    "plotId": 1,
    "cropTypeId": 1,
    "cost": 10
  }
}
```

### POST /api/farm/water
浇水（需认证）

**请求参数:**
```json
{
  "plotId": 1
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "浇水成功",
  "data": {
    "plotId": 1,
    "wateredAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /api/farm/harvest
收获作物（需认证）

**请求参数:**
```json
{
  "plotId": 1
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "收获成功",
  "data": {
    "plotId": 1,
    "cropName": "小麦",
    "earned": 15,
    "experience": 10
  }
}
```

## 作物接口

### GET /api/crops
获取所有作物类型

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "小麦",
      "description": "金黄的小麦，生长迅速",
      "growth_time": 60,
      "sell_price": 15,
      "buy_price": 10,
      "color": "#F4D03F",
      "stages": 4
    }
  ]
}
```

## 好友接口（预留）

### GET /api/friends
获取好友列表（需认证）

### POST /api/friends/request
发送好友请求（需认证）

**请求参数:**
```json
{
  "friendId": 2
}
```

### POST /api/friends/accept
接受好友请求（需认证）

**请求参数:**
```json
{
  "friendId": 2
}
```

## 通知接口（预留）

### GET /api/notifications
获取通知列表（需认证）

### POST /api/notifications/read
标记通知为已读（需认证）

**请求参数:**
```json
{
  "notificationId": 1
}
```

## WebSocket 接口

### 连接地址
```
ws://localhost:3000
```

### 客户端认证消息
```json
{
  "type": "auth",
  "userId": 1
}
```

### 服务端推送消息类型

**作物成熟通知:**
```json
{
  "type": "crop_mature",
  "title": "作物成熟了！",
  "message": "你的 小麦 已经成熟，快去收获吧！",
  "data": {
    "plot_id": 1
  }
}
```

**应用内通知:**
```json
{
  "type": "notification",
  "notification": {
    "id": 1,
    "type": "crop_mature",
    "title": "作物成熟了！",
    "content": "你的 小麦 已经成熟"
  }
}
```

## 错误响应格式

```json
{
  "success": false,
  "message": "错误描述信息"
}
```

**常见错误码:**
- 400: 请求参数错误
- 401: 未认证
- 403: 令牌无效
- 404: 资源不存在
- 409: 资源冲突（如用户名已存在）
- 500: 服务器内部错误
