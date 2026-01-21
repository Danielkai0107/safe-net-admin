# 地圖 APP API 端點文檔

## 📋 概述

本文檔列出所有地圖 APP 專用的 Cloud Functions API 端點。這些 API 與現有的 Tenant-Elder 系統完全獨立，不會影響後台和 LIFF 的功能。

**Firebase 專案:** safe-net-tw  
**Region:** us-central1  
**基礎 URL:** `https://us-central1-safe-net-tw.cloudfunctions.net`

---

## 🔐 認證方式

所有需要認證的 API 都使用 **Firebase ID Token**：

```
Authorization: Bearer {FIREBASE_ID_TOKEN}
```

在客戶端使用 Firebase Auth SDK 獲取 ID Token：
```javascript
const user = firebase.auth().currentUser;
const idToken = await user.getIdToken();
```

---

## 📡 API 端點列表

### 1. 用戶認證 API

#### `mapUserAuth` - 註冊/登入用戶

**端點:** `POST /mapUserAuth`  
**認證:** 必需 (Firebase ID Token)

**請求 Body:**
```json
{
  "action": "register" | "login",
  "email": "user@example.com",
  "name": "張三",
  "phone": "0912345678"
}
```

**回應範例 (註冊成功):**
```json
{
  "success": true,
  "user": {
    "id": "firebase_uid_123",
    "email": "user@example.com",
    "name": "張三",
    "phone": "0912345678",
    "isActive": true
  }
}
```

**回應範例 (登入成功):**
```json
{
  "success": true,
  "user": {
    "id": "firebase_uid_123",
    "email": "user@example.com",
    "name": "張三",
    "boundDeviceId": "device_abc123",
    "notificationEnabled": true,
    "isActive": true
  }
}
```

---

### 2. FCM Token 管理

#### `updateMapUserFcmToken` - 更新推播 Token

**端點:** `POST /updateMapUserFcmToken`  
**認證:** 必需

**請求 Body:**
```json
{
  "userId": "firebase_uid_123",
  "fcmToken": "fcm_token_xyz..."
}
```

**回應:**
```json
{
  "success": true,
  "message": "FCM token updated successfully"
}
```

---

### 3. 設備綁定管理

#### `bindDeviceToMapUser` - 綁定設備

**端點:** `POST /bindDeviceToMapUser`  
**認證:** 必需

**請求 Body:**
```json
{
  "userId": "firebase_uid_123",
  "deviceId": "device_abc123",
  "nickname": "媽媽的手環",
  "age": 65
}
```

**欄位說明:**
- `userId` (必需): 用戶 ID
- `deviceId` (必需): 設備 ID
- `nickname` (選填): 設備暱稱（儲存在用戶資料，不與設備綁死）
- `age` (選填): 使用者年齡（儲存在用戶資料，不與設備綁死）

**回應:**
```json
{
  "success": true,
  "device": {
    "id": "device_abc123",
    "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
    "major": 1,
    "minor": 1001,
    "deviceName": "1-1001",
    "nickname": "媽媽的手環",
    "age": 65
  },
  "boundAt": "2026-01-21T10:30:00Z"
}
```

**注意事項:**
- 設備必須標記為 `poolType: "PUBLIC"`
- 每個用戶只能綁定一個設備
- 綁定新設備會自動解綁舊設備
- 暱稱和年齡存在用戶資料中，不會影響設備本身
- 解綁設備時會同時清空暱稱和年齡

---

#### `unbindDeviceFromMapUser` - 解綁設備

**端點:** `POST /unbindDeviceFromMapUser`  
**認證:** 必需

**請求 Body:**
```json
{
  "userId": "firebase_uid_123"
}
```

**回應:**
```json
{
  "success": true,
  "message": "Device unbound successfully"
}
```

---

### 4. 公共接收點查詢

#### `getPublicGateways` - 取得所有接收點列表

**端點:** `GET /getPublicGateways`  
**認證:** 不需要 (公開資料)

**說明:** 回傳所有啟用的接收點（包括社區專用和公共接收點）。對地圖 APP 用戶來說，所有的接收點都是安全網的一部分。

**回應:**
```json
{
  "success": true,
  "gateways": [
    {
      "id": "gateway_001",
      "name": "台北車站東門",
      "location": "台北車站",
      "latitude": 25.047908,
      "longitude": 121.517315,
      "type": "GENERAL",
      "serialNumber": "SN12345",
      "tenantId": null,
      "poolType": "PUBLIC"
    },
    {
      "id": "gateway_002",
      "name": "信義區邊界",
      "location": "信義區",
      "latitude": 25.033964,
      "longitude": 121.564468,
      "type": "BOUNDARY",
      "serialNumber": "SN67890",
      "tenantId": "tenant_abc",
      "poolType": "TENANT"
    }
  ],
  "count": 2,
  "timestamp": 1737446400000
}
```

**欄位說明:**
- `tenantId`: 若為社區專用接收點，會顯示所屬社區 ID；公共接收點為 `null`
- `poolType`: `"PUBLIC"` 為公共接收點，`"TENANT"` 為社區專用接收點

---

### 5. 通知點位管理

#### `addMapUserNotificationPoint` - 新增通知點位

**端點:** `POST /addMapUserNotificationPoint`  
**認證:** 必需

**請求 Body:**
```json
{
  "userId": "firebase_uid_123",
  "gatewayId": "gateway_001",
  "name": "我的家",
  "notificationMessage": "已到達家門口"
}
```

**回應:**
```json
{
  "success": true,
  "notificationPoint": {
    "id": "point_xyz123",
    "mapAppUserId": "firebase_uid_123",
    "gatewayId": "gateway_001",
    "name": "我的家",
    "notificationMessage": "已到達家門口",
    "isActive": true,
    "createdAt": "2026-01-21T10:30:00Z"
  }
}
```

---

#### `getMapUserNotificationPoints` - 取得通知點位列表

**端點:** `GET /getMapUserNotificationPoints?userId={userId}`  
**認證:** 必需

**回應:**
```json
{
  "success": true,
  "notificationPoints": [
    {
      "id": "point_xyz123",
      "name": "我的家",
      "gatewayId": "gateway_001",
      "notificationMessage": "已到達家門口",
      "isActive": true,
      "createdAt": "2026-01-21T10:30:00Z",
      "gateway": {
        "id": "gateway_001",
        "name": "台北車站東門",
        "location": "台北車站",
        "latitude": 25.047908,
        "longitude": 121.517315
      }
    }
  ],
  "count": 1
}
```

---

#### `updateMapUserNotificationPoint` - 更新通知點位

**端點:** `PUT /updateMapUserNotificationPoint`  
**認證:** 必需

**請求 Body:**
```json
{
  "pointId": "point_xyz123",
  "name": "我的公司",
  "notificationMessage": "已到達公司",
  "isActive": true
}
```

**回應:**
```json
{
  "success": true,
  "message": "Notification point updated successfully"
}
```

---

#### `removeMapUserNotificationPoint` - 刪除通知點位

**端點:** `DELETE /removeMapUserNotificationPoint` 或 `POST /removeMapUserNotificationPoint`  
**認證:** 必需

**請求 Body:**
```json
{
  "pointId": "point_xyz123"
}
```

**回應:**
```json
{
  "success": true,
  "message": "Notification point removed successfully"
}
```

---

### 6. 活動歷史查詢

#### `getMapUserActivities` - 取得設備活動記錄

**端點:** `GET /getMapUserActivities`  
**認證:** 必需

**Query 參數:**
- `userId` (必需): 用戶 ID
- `startTime` (選填): 開始時間 (timestamp in milliseconds)
- `endTime` (選填): 結束時間 (timestamp in milliseconds)
- `limit` (選填): 最多回傳筆數 (預設 100, 最大 1000)

**範例:**
```
GET /getMapUserActivities?userId=firebase_uid_123&startTime=1737360000000&endTime=1737446400000&limit=50
```

**回應:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "activity_001",
      "deviceId": "device_abc123",
      "gatewayId": "gateway_001",
      "gatewayName": "台北車站東門",
      "gatewayLocation": "台北車站",
      "timestamp": "2026-01-21T10:30:00Z",
      "rssi": -65,
      "latitude": 25.047908,
      "longitude": 121.517315,
      "triggeredNotification": true,
      "notificationPointId": "point_xyz123"
    },
    {
      "id": "activity_002",
      "deviceId": "device_abc123",
      "gatewayId": "gateway_002",
      "gatewayName": "信義區邊界",
      "gatewayLocation": "信義區",
      "timestamp": "2026-01-21T11:15:00Z",
      "rssi": -72,
      "latitude": 25.033964,
      "longitude": 121.564468,
      "triggeredNotification": false
    }
  ],
  "count": 2,
  "timestamp": 1737446400000
}
```

---

### 7. 用戶資料查詢

#### `getMapUserProfile` - 取得用戶完整資料

**端點:** `GET /getMapUserProfile?userId={userId}`  
**認證:** 必需

**用途:** 取得用戶完整資料，包含基本資訊、綁定設備、通知點位列表（用於個人資料頁）

**Query 參數:**
- `userId` (必需): 用戶 ID

**範例:**
```
GET /getMapUserProfile?userId=firebase_uid_123
```

**回應:**
```json
{
  "success": true,
  "user": {
    "id": "firebase_uid_123",
    "email": "user@example.com",
    "name": "張三",
    "phone": "0912345678",
    "avatar": "https://...",
    "notificationEnabled": true
  },
  "boundDevice": {
    "id": "device_abc123",
    "deviceName": "1-1001",
    "nickname": "媽媽的手環",
    "age": 65,
    "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
    "major": 1,
    "minor": 1001,
    "boundAt": "2026-01-21T10:30:00Z"
  },
  "notificationPoints": [
    {
      "id": "point_xyz123",
      "name": "我的家",
      "gatewayId": "gateway_001",
      "notificationMessage": "已到達家門口",
      "isActive": true,
      "createdAt": "2026-01-21T09:00:00Z",
      "gateway": {
        "name": "台北車站東門",
        "location": "台北車站",
        "latitude": 25.047908,
        "longitude": 121.517315
      }
    }
  ],
  "timestamp": 1737446400000
}
```

**回應欄位說明:**
- `user`: 用戶基本資訊
- `boundDevice`: 綁定的設備詳情（如果有綁定），包含暱稱和年齡
- `notificationPoints`: 通知點位列表，每個點位包含對應的 Gateway 資訊

**注意事項:**
- 如果用戶沒有綁定設備，`boundDevice` 為 `null`
- 只回傳 `isActive: true` 的通知點位
- 用戶只能查詢自己的資料

---

## 🔄 完整使用流程

### 1. 用戶註冊/登入
```javascript
// 使用 Firebase Auth 登入
const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
const idToken = await userCredential.user.getIdToken();

// 註冊到地圖 APP 系統
const response = await fetch('https://us-central1-safe-net-tw.cloudfunctions.net/mapUserAuth', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    action: 'register',
    name: '張三',
    email: 'user@example.com'
  })
});
```

### 2. 更新 FCM Token
```javascript
// 獲取 FCM Token
const fcmToken = await firebase.messaging().getToken();

// 更新到後端
await fetch('https://us-central1-safe-net-tw.cloudfunctions.net/updateMapUserFcmToken', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    userId: firebase.auth().currentUser.uid,
    fcmToken: fcmToken
  })
});
```

### 3. 綁定設備
```javascript
// 用戶輸入設備 ID、暱稱、年齡後綁定
await fetch('https://us-central1-safe-net-tw.cloudfunctions.net/bindDeviceToMapUser', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    userId: firebase.auth().currentUser.uid,
    deviceId: 'device_abc123',
    nickname: '媽媽的手環',  // 選填：設備暱稱
    age: 65                   // 選填：使用者年齡
  })
});
```

### 4. 取得公共接收點並選擇通知點位
```javascript
// 取得所有接收點（包括社區的點，形成完整的安全網）
const gateways = await fetch('https://us-central1-safe-net-tw.cloudfunctions.net/getPublicGateways')
  .then(res => res.json());

// 用戶選擇後新增通知點位
await fetch('https://us-central1-safe-net-tw.cloudfunctions.net/addMapUserNotificationPoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    userId: firebase.auth().currentUser.uid,
    gatewayId: 'gateway_001',
    name: '我的家',
    notificationMessage: '已到達家門口'
  })
});
```

### 5. 查看活動記錄
```javascript
// 取得最近 24 小時的活動
const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
const activities = await fetch(
  `https://us-central1-safe-net-tw.cloudfunctions.net/getMapUserActivities?userId=${userId}&startTime=${oneDayAgo}&limit=100`,
  {
    headers: {
      'Authorization': `Bearer ${idToken}`
    }
  }
).then(res => res.json());
```

### 6. 載入用戶資料頁
```javascript
// 取得用戶完整資料（用於個人資料頁）
const userId = firebase.auth().currentUser.uid;
const profile = await fetch(
  `https://us-central1-safe-net-tw.cloudfunctions.net/getMapUserProfile?userId=${userId}`,
  {
    headers: {
      'Authorization': `Bearer ${idToken}`
    }
  }
).then(res => res.json());

// profile.user - 用戶基本資訊
// profile.boundDevice - 綁定的設備（含暱稱、年齡）
// profile.notificationPoints - 通知點位列表
```

---

## 🔔 推播通知格式

當用戶的設備經過設定的通知點位時，會收到 FCM 推播：

```json
{
  "notification": {
    "title": "位置通知",
    "body": "已到達家門口"
  },
  "data": {
    "type": "LOCATION_ALERT",
    "gatewayId": "gateway_001",
    "gatewayName": "台北車站東門",
    "notificationPointId": "point_xyz123",
    "latitude": "25.047908",
    "longitude": "121.517315"
  }
}
```

---

## ⚠️ 錯誤碼說明

| HTTP 狀態碼 | 說明 |
|------------|------|
| 200 | 成功 |
| 400 | 請求參數錯誤 |
| 401 | 未授權 (Token 無效或缺少) |
| 403 | 禁止存取 (試圖存取其他用戶的資源) |
| 404 | 資源不存在 |
| 405 | HTTP 方法不允許 |
| 500 | 伺服器內部錯誤 |

**錯誤回應格式:**
```json
{
  "success": false,
  "error": "錯誤訊息描述"
}
```

---

## 📊 API 摘要表

| 功能 | API 名稱 | HTTP 方法 | 認證 |
|------|---------|----------|------|
| 註冊/登入 | mapUserAuth | POST | 必需 |
| 更新 FCM Token | updateMapUserFcmToken | POST | 必需 |
| 綁定設備 | bindDeviceToMapUser | POST | 必需 |
| 解綁設備 | unbindDeviceFromMapUser | POST | 必需 |
| 取得公共接收點 | getPublicGateways | GET | 不需要 |
| 新增通知點位 | addMapUserNotificationPoint | POST | 必需 |
| 取得通知點位 | getMapUserNotificationPoints | GET | 必需 |
| 更新通知點位 | updateMapUserNotificationPoint | PUT | 必需 |
| 刪除通知點位 | removeMapUserNotificationPoint | DELETE/POST | 必需 |
| 取得活動記錄 | getMapUserActivities | GET | 必需 |
| 取得用戶完整資料 | getMapUserProfile | GET | 必需 |

---

## 🎯 與現有系統的關係

### 不受影響的現有 API
- 所有 Tenant 相關 API
- 所有 Elder 相關 API
- 所有 Alert 相關 API
- 所有 LINE 相關 API
- 後台管理 API

### 共用的 API
- `receiveBeaconData`: 已擴充支援地圖用戶，同時保持原有 Tenant-Elder 功能。現已支援電量更新（batteryLevel 欄位）
- `getServiceUuids`: 地圖用戶的接收器也需要此 API
- `getDeviceWhitelist`: 可選擇性使用

### 資料隔離
- 地圖用戶使用獨立的 Collections: `mapAppUsers`, `mapUserNotificationPoints`, `mapUserActivities`
- Device 和 Gateway 透過 `poolType` 欄位區分
- 不會影響現有的 Tenant-Elder 資料

---

**更新日期:** 2026-01-21  
**版本:** 1.0.0  
**專案:** safe-net-tw
