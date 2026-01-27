# LINE 通知診斷指南

## 修改摘要

### 1. 新增功能
- Gateway 新增 `isAD` 欄位（行銷點標記）
- Tenant 使用 `BU_type` 欄位（"card" | "safe"）決定通知目標
- 新增 5 分鐘冷卻時間，防止重複通知

### 2. 通知邏輯

#### LINE_USER 設備
- **isAD=true**：每個訊號都觸發，發送到所有 `BU_type="card"` 的 tenant（無冷卻時間）
- **isAD=false**：檢查 `inheritedNotificationPointIds`，發送到所有 `BU_type="safe"` 的 tenant（有 5 分鐘冷卻時間）

#### ELDER 設備
- 檢查設備的 `inheritedNotificationPointIds`
- 群發給 elder 所屬社區的所有成員
- 有 5 分鐘冷卻時間，防止重複通知

## 診斷步驟：LINE_USER 沒收到通知

### 步驟 1：檢查設備資料
```javascript
// 在 Firebase Console 中查看設備
db.collection('devices').doc('YOUR_DEVICE_ID').get()
```

確認：
- `bindingType` 是 `"LINE_USER"`
- `boundTo` 有值（line_users document ID）
- `inheritedNotificationPointIds` 包含您要測試的 gateway ID

### 步驟 2：檢查 Gateway 資料
```javascript
// 在 Firebase Console 中查看 gateway
db.collection('gateways').doc('YOUR_GATEWAY_ID').get()
```

確認：
- `isActive` 是 `true`
- `type` 不是 `"OBSERVE_ZONE"` 或 `"INACTIVE"`
- `isAD` 的值（如果是 false 或未設定，需要檢查通知點）

### 步驟 3：檢查 LINE User 資料
```javascript
// 在 Firebase Console 中查看 line_users
db.collection('line_users').doc('YOUR_LINE_USER_DOC_ID').get()
```

確認：
- `lineUserId` 有值
- 文檔存在

### 步驟 4：檢查 Tenant 資料
```javascript
// 在 Firebase Console 中查看 tenants
db.collection('tenants').where('BU_type', '==', 'safe').get()
```

確認：
- 至少有一個 tenant 的 `BU_type` 是 `"safe"`
- 該 tenant 的 `isActive` 是 `true`
- 該 tenant 有 `lineChannelAccessToken`

### 步驟 5：檢查 Membership
```javascript
// 在 Firebase Console 中查看 membership
db.collection('tenants').doc('YOUR_TENANT_ID')
  .collection('members')
  .where('appUserId', '==', 'YOUR_LINE_USER_DOC_ID')
  .where('status', '==', 'APPROVED')
  .get()
```

確認：
- LINE_USER 在該 tenant 中有 APPROVED 的 membership

### 步驟 6：查看 Cloud Functions 日誌
```bash
firebase functions:log --only receiveBeaconData
```

查找關鍵日誌：
```
Finding tenants for LINE user xxx with BU_type=safe...
Total tenants to check: X
Checking tenant xxx: BU_type=safe, isActive=true
Tenant xxx matches BU_type=safe, checking membership...
Membership check for tenant xxx: found=true, hasToken=true
✓ Added tenant xxx to matching list
Found X matching tenant(s) for LINE user xxx with BU_type=safe
```

## 診斷步驟：ELDER 重複通知

### 問題
ELDER 群發通知連續出現兩次。

### 可能原因
1. 短時間內收到兩次相同的 beacon 資料
2. 冷卻時間邏輯未生效

### 解決方案
已加入 5 分鐘冷卻時間邏輯：
- 使用 `notification_cooldowns` 集合記錄最後發送時間
- Key 格式：`elder_{elderId}_gateway_{gatewayId}`
- 5 分鐘內不會重複發送相同的通知

### 驗證
查看 `notification_cooldowns` 集合：
```javascript
db.collection('notification_cooldowns')
  .where('elderId', '==', 'YOUR_ELDER_ID')
  .get()
```

應該看到最後發送時間和冷卻記錄。

## 常見問題

### Q1：LINE_USER 設定了 inheritedNotificationPointIds 但沒收到通知
**可能原因：**
- Tenant 的 `BU_type` 不是 `"safe"`（請檢查是否拼寫正確）
- LINE_USER 沒有在該 tenant 中的 APPROVED membership
- Tenant 沒有設定 `lineChannelAccessToken`

**解決方法：**
1. 檢查 tenant 資料，確認 `BU_type` 欄位
2. 檢查 membership 狀態
3. 查看 Cloud Functions 日誌，找出詳細錯誤訊息

### Q2：ELDER 通知重複發送
**可能原因：**
- 在 5 分鐘內收到多次相同的 beacon 資料
- 冷卻時間邏輯未生效

**解決方法：**
- 查看 `notification_cooldowns` 集合
- 檢查 Cloud Functions 日誌中的冷卻時間檢查記錄
- 如果需要調整冷卻時間，修改代碼中的 `cooldownPeriod` 值

### Q3：如何測試 isAD=true 的行銷點通知？
1. 在 Firestore 中設定 gateway 的 `isAD: true`
2. 確保 tenant 的 `BU_type` 是 `"card"`
3. 發送 beacon 資料，應該每個訊號都觸發通知（無冷卻時間）

## 部署
修改完成後，需要重新部署 Cloud Functions：
```bash
cd functions
npm run build
firebase deploy --only functions:receiveBeaconData
```

## 日誌輸出關鍵字

查找這些關鍵字可以快速診斷問題：

### LINE_USER 通知
- `Finding tenants for LINE user`
- `Device xxx inheritedNotificationPointIds:`
- `Gateway xxx is in LINE user's notification points`
- `Found X matching tenant(s)`
- `Sent LINE notification to xxx via tenant`

### ELDER 通知
- `Elder xxx passed through notification point`
- `Skipping notification for elder xxx (cooldown:`
- `Updated cooldown for elder`

### 錯誤
- `Error finding tenants`
- `Failed to send LINE notification`
- `No matching tenants found`
