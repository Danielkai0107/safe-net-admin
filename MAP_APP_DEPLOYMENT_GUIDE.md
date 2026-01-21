# 地圖 APP 整合 - 部署指南

## 📦 實作摘要

本次更新為系統新增了完整的地圖 APP 用戶支援，與現有的 Tenant-Elder 系統完全獨立運作。

### ✅ 已完成項目

#### 1. 型別定義更新
- **檔案:** `src/types/index.ts`
- **新增型別:**
  - `PoolType`: 設備池類型 (TENANT | PUBLIC)
  - `MapAppUser`: 地圖 APP 用戶
  - `MapUserNotificationPoint`: 用戶通知點位
  - `MapUserActivity`: 用戶活動記錄
- **調整型別:**
  - `Device`: 新增 `mapAppUserId`, `poolType`
  - `Gateway`: 新增 `poolType`, `tenantId` 改為可選

#### 2. 新增 Cloud Functions APIs (10 個)
- **目錄:** `functions/src/mapApp/`

| API 檔案 | 功能 | HTTP 方法 |
|---------|------|----------|
| `auth.ts` | 用戶註冊/登入 | POST |
| `fcmToken.ts` | FCM Token 管理 | POST |
| `deviceBinding.ts` | 設備綁定/解綁 | POST |
| `gateways.ts` | 公共接收點查詢 | GET |
| `notificationPoints.ts` | 通知點位 CRUD | POST/GET/PUT/DELETE |
| `activities.ts` | 活動歷史查詢 | GET |

#### 3. 擴充現有功能
- **檔案:** `functions/src/beacon/receiveBeaconData.ts`
- **新增函數:** `handleMapUserBeacon()`
- **修改函數:** `processBeacon()` - 支援地圖用戶模式
- **功能:**
  - 偵測地圖用戶綁定的設備
  - 記錄活動到 `mapUserActivities` collection
  - 檢查通知點位並發送 FCM 推播

#### 4. 文檔
- `MAP_APP_API_ENDPOINTS.md`: 完整 API 文檔
- `MAP_APP_DEPLOYMENT_GUIDE.md`: 本部署指南

---

## 🚀 部署步驟

### 步驟 1: 檢查 Git 狀態

```bash
git status
git log -1
```

確認在 `feature/map-app-integration` 分支，並且所有變更已提交。

### 步驟 2: 編譯 Functions

```bash
cd functions
npm run build
```

確認編譯成功，無錯誤訊息。

### 步驟 3: 部署到 Firebase

```bash
# 只部署 Functions
firebase deploy --only functions

# 或者部署所有變更（Functions + Firestore Rules）
firebase deploy
```

**預估部署時間:** 5-10 分鐘

### 步驟 4: 驗證部署

部署完成後，檢查 Firebase Console：

1. **Functions 頁面:** https://console.firebase.google.com/project/safe-net-tw/functions
2. **確認新增的 Functions:**
   - mapUserAuth
   - updateMapUserFcmToken
   - bindDeviceToMapUser
   - unbindDeviceFromMapUser
   - getPublicGateways
   - addMapUserNotificationPoint
   - removeMapUserNotificationPoint
   - getMapUserNotificationPoints
   - updateMapUserNotificationPoint
   - getMapUserActivities

### 步驟 5: 測試 API

#### 5.1 測試接收點查詢（不需認證）

```bash
curl https://us-central1-safe-net-tw.cloudfunctions.net/getPublicGateways | jq
```

**預期結果:** 回傳所有啟用的 Gateway 列表（包括社區專用和公共接收點）

#### 5.2 測試用戶認證（需要 Firebase Auth Token）

```bash
# 先取得 Firebase ID Token (透過前端 Firebase SDK)
TOKEN="YOUR_FIREBASE_ID_TOKEN"

curl -X POST https://us-central1-safe-net-tw.cloudfunctions.net/mapUserAuth \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "action": "register",
    "name": "測試用戶",
    "email": "test@example.com"
  }' | jq
```

---

## 🗄️ Firestore 資料準備

### 1. 設定公共設備池

在 Firestore Console 中，為測試設備新增 `poolType` 欄位：

```javascript
// 到 Firestore > devices > 選擇一個設備 > 編輯
{
  ...existing fields,
  "poolType": "PUBLIC",
  "mapAppUserId": null
}
```

### 2. 設定接收點（選填）

接收點的 `poolType` 欄位是選填的，因為地圖 APP 會顯示所有接收點：

```javascript
// 到 Firestore > gateways > 選擇一個接收器（選填設定）
{
  ...existing fields,
  "poolType": "PUBLIC",  // 選填：標記為公共接收點
  "tenantId": null       // 選填：公共接收器可設為 null
}
```

**注意:** 不設定 `poolType` 也沒關係，地圖 APP 會自動顯示所有啟用的接收點。

### 3. 新增 Firestore Collections

這些 Collections 會在第一次使用時自動建立：
- `mapAppUsers`
- `mapUserNotificationPoints`
- `mapUserActivities`

---

## 🔒 Firestore Security Rules 更新（可選）

目前使用開發模式規則（允許所有讀寫）。生產環境建議更新為：

```javascript
// 在 firestore.rules 檔案中新增
match /mapAppUsers/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

match /mapUserNotificationPoints/{pointId} {
  allow read, write: if request.auth != null && 
    request.auth.uid == resource.data.mapAppUserId;
}

match /mapUserActivities/{activityId} {
  allow read: if request.auth != null && 
    request.auth.uid == resource.data.mapAppUserId;
  allow write: if false; // Only backend can write
}
```

部署 Rules：
```bash
firebase deploy --only firestore:rules
```

---

## 📱 客戶端整合範例

### React Native / Expo 範例

```javascript
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/messaging';

// 1. 初始化 Firebase
const firebaseConfig = { /* your config */ };
firebase.initializeApp(firebaseConfig);

// 2. 用戶註冊
async function registerUser(email, password, name) {
  // 使用 Firebase Auth 註冊
  const userCredential = await firebase.auth()
    .createUserWithEmailAndPassword(email, password);
  
  // 取得 ID Token
  const idToken = await userCredential.user.getIdToken();
  
  // 註冊到地圖 APP 系統
  const response = await fetch(
    'https://us-central1-safe-net-tw.cloudfunctions.net/mapUserAuth',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        action: 'register',
        name: name,
        email: email
      })
    }
  );
  
  return await response.json();
}

// 3. 更新 FCM Token
async function updateFcmToken() {
  const user = firebase.auth().currentUser;
  const idToken = await user.getIdToken();
  const fcmToken = await firebase.messaging().getToken();
  
  await fetch(
    'https://us-central1-safe-net-tw.cloudfunctions.net/updateMapUserFcmToken',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        userId: user.uid,
        fcmToken: fcmToken
      })
    }
  );
}

// 4. 綁定設備
async function bindDevice(deviceId) {
  const user = firebase.auth().currentUser;
  const idToken = await user.getIdToken();
  
  const response = await fetch(
    'https://us-central1-safe-net-tw.cloudfunctions.net/bindDeviceToMapUser',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        userId: user.uid,
        deviceId: deviceId
      })
    }
  );
  
  return await response.json();
}

// 5. 取得公共接收點
async function getPublicGateways() {
  const response = await fetch(
    'https://us-central1-safe-net-tw.cloudfunctions.net/getPublicGateways'
  );
  return await response.json();
}

// 6. 新增通知點位
async function addNotificationPoint(gatewayId, name, message) {
  const user = firebase.auth().currentUser;
  const idToken = await user.getIdToken();
  
  const response = await fetch(
    'https://us-central1-safe-net-tw.cloudfunctions.net/addMapUserNotificationPoint',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        userId: user.uid,
        gatewayId: gatewayId,
        name: name,
        notificationMessage: message
      })
    }
  );
  
  return await response.json();
}

// 7. 取得活動記錄
async function getActivities(startTime, endTime, limit = 100) {
  const user = firebase.auth().currentUser;
  const idToken = await user.getIdToken();
  
  const params = new URLSearchParams({
    userId: user.uid,
    startTime: startTime.toString(),
    endTime: endTime.toString(),
    limit: limit.toString()
  });
  
  const response = await fetch(
    `https://us-central1-safe-net-tw.cloudfunctions.net/getMapUserActivities?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    }
  );
  
  return await response.json();
}
```

---

## ⚠️ 注意事項

### 1. 相容性保證
- ✅ 現有後台功能完全不受影響
- ✅ LIFF APP 功能完全不受影響
- ✅ Tenant-Elder 系統繼續正常運作
- ✅ 所有現有 API 保持相同行為

### 2. 資料隔離
- 地圖用戶使用獨立的 Collections
- Device 和 Gateway 透過 `poolType` 欄位區分
- 不會有資料混淆或衝突

### 3. receiveBeaconData 行為
- 當設備 `poolType === 'PUBLIC'` 且有 `mapAppUserId`：處理地圖用戶邏輯
- 當設備有 `elderId`：處理 Tenant-Elder 邏輯（原有行為）
- 兩種模式互不干擾

### 4. 效能考量
- 新增的處理邏輯不會影響現有系統效能
- 地圖用戶的 Beacon 處理是獨立分支
- 只在必要時才執行額外查詢

---

## 🧪 測試檢查清單

部署後建議執行以下測試：

### 後端測試
- [ ] 所有新 Functions 都成功部署
- [ ] `getPublicGateways` API 可正常存取
- [ ] 用戶註冊流程正常
- [ ] FCM Token 更新成功
- [ ] 設備綁定/解綁功能正常
- [ ] 通知點位 CRUD 功能正常
- [ ] 活動記錄查詢正常

### 整合測試
- [ ] receiveBeaconData 接收地圖用戶設備時正常記錄
- [ ] 經過通知點位時正確發送 FCM 推播
- [ ] 地圖用戶設備不會觸發 Tenant-Elder 的邏輯
- [ ] Tenant-Elder 設備不會觸發地圖用戶邏輯

### 現有功能驗證
- [ ] 後台管理功能正常
- [ ] LIFF APP 功能正常
- [ ] 長者位置追蹤正常
- [ ] LINE 通知正常
- [ ] 警報系統正常

---

## 📊 監控與日誌

### 查看 Functions 日誌

```bash
# 即時查看所有 Functions 日誌
firebase functions:log

# 查看特定 Function
firebase functions:log --only mapUserAuth

# 在 Console 查看
# https://console.firebase.google.com/project/safe-net-tw/functions/logs
```

### 關鍵日誌訊息

成功的地圖用戶 Beacon 處理會看到：
```
Processing beacon for map app user {userId}
Recorded map user activity: {activityId} for user {userId}
Sent FCM notification to map user {userId} for point {pointName}
```

---

## 🔄 回滾方案

如果部署後發現問題，可以回滾到上一個版本：

```bash
# 切換回 main 分支
git checkout main

# 重新部署舊版本的 Functions
cd functions
npm run build
firebase deploy --only functions
```

**注意:** 回滾不會刪除已建立的 Firestore 資料。

---

## 📞 技術支援

### 相關文檔
- API 文檔: `MAP_APP_API_ENDPOINTS.md`
- 現有 API 文檔: `API_ENDPOINTS.md`
- Firebase Console: https://console.firebase.google.com/project/safe-net-tw

### 常見問題

**Q: 地圖用戶的設備會不會被 Tenant 用戶看到？**  
A: 不會。後台和 LIFF 只查詢有 `tenantId` 的資源，地圖用戶的設備不會出現在這些列表中。

**Q: 如何將設備從 Tenant 池移到公共池？**  
A: 在後台編輯設備，將 `poolType` 改為 "PUBLIC"，並清空 `tenantId` 和 `elderId`。

**Q: receiveBeaconData 的效能會受影響嗎？**  
A: 不會。新增的邏輯只在檢測到地圖用戶設備時執行，不影響現有 Tenant-Elder 流程。

**Q: FCM 推播失敗怎麼辦？**  
A: 檢查用戶的 `fcmToken` 是否正確更新，以及 `notificationEnabled` 是否為 true。查看 Functions 日誌了解詳細錯誤。

---

**建立日期:** 2026-01-21  
**Git 分支:** feature/map-app-integration  
**Commit:** 9c12240  
**狀態:** ✅ 準備部署
