# 統一通知架構測試指南

## 概述

本指南說明如何測試統一通知架構的所有功能，確保新舊設備都能正常運作，並且向後相容。

## 前置準備

### 1. 部署變更

```bash
# 1. 編譯 TypeScript
cd functions
npm run build

# 2. 部署 Cloud Functions
firebase deploy --only functions

# 3. 部署前端（如有變更）
cd ../community-portal
npm run build
firebase deploy --only hosting
```

### 2. 執行資料遷移（建議先 Dry Run）

```bash
# Dry Run：預覽遷移但不實際寫入
cd functions
npx ts-node src/migrations/migrateNotificationArchitecture.ts

# 實際遷移
npx ts-node src/migrations/migrateNotificationArchitecture.ts --live
```

## 測試場景

### 場景 1：FCM Token 同步測試

#### 測試目標
驗證 FCM token 在用戶、設備間正確同步。

#### 測試步驟

1. **新用戶綁定設備**
   - Map App 登入新用戶
   - 綁定一個設備
   - 系統應自動將用戶的 fcmToken 同步到設備

2. **驗證資料**
   ```javascript
   // Firestore Console 檢查
   devices/{deviceId}
   - fcmToken: 應與 app_users/{userId}.fcmToken 相同
   - notificationEnabled: true
   - bindingType: "MAP_USER"
   - boundTo: userId
   ```

3. **更新 FCM Token**
   - Map App 調用 `updateMapUserFcmToken` API
   - 傳入新的 fcmToken
   - 驗證 `app_users` 和 `devices` 都更新了

4. **解綁設備**
   - Map App 解綁設備
   - 驗證設備的通知欄位被清除：
     ```javascript
     devices/{deviceId}
     - fcmToken: null
     - notificationEnabled: null
     - inheritedNotificationPointIds: null
     ```

### 場景 2：通知點管理測試（App 用戶）

#### 測試目標
驗證 App 用戶的通知點存儲在設備子集合中。

#### 測試步驟

1. **新增通知點**
   - Map App 新增通知點（選擇一個 gateway）
   - 調用 `addMapUserNotificationPoint` API

2. **驗證資料**
   ```javascript
   // Firestore Console 檢查
   devices/{deviceId}/notificationPoints/{pointId}
   - gatewayId: gateway ID
   - name: 通知點名稱
   - notificationMessage: 自訂訊息
   - isActive: true
   ```

3. **查詢通知點**
   - Map App 調用 `getMapUserNotificationPoints` API
   - 應返回所有設備的通知點

4. **更新通知點**
   - Map App 修改通知點名稱或訊息
   - 調用 `updateMapUserNotificationPoint` API
   - 驗證子集合中的資料已更新

5. **刪除通知點**
   - Map App 刪除通知點
   - 調用 `removeMapUserNotificationPoint` API
   - 驗證子集合中的文件已刪除

### 場景 3：社區通知點繼承測試

#### 測試目標
驗證設備加入社區時自動繼承通知點。

#### 測試步驟

1. **設定社區通知點**
   - Community Portal 為社區設定通知點
   - 選擇多個 gateway

2. **分配設備到社區**
   - Community Portal 分配設備到社區
   - 調用 `tenantService.assignDevices`

3. **驗證資料**
   ```javascript
   // Firestore Console 檢查
   devices/{deviceId}
   - tags: ["tenant_xxx"]
   - inheritedNotificationPointIds: [gatewayId1, gatewayId2, ...]
   ```

4. **移除設備**
   - Community Portal 從社區移除設備
   - 調用 `tenantService.removeDevice`
   - 驗證 `tags` 和 `inheritedNotificationPointIds` 被清除

### 場景 4：通知發送測試（優先級）

#### 測試目標
驗證通知發送優先使用設備 token，其次使用用戶 token。

#### 測試步驟

1. **設備有 token 的情況**
   - 設備已綁定並有 fcmToken
   - 設備經過通知點
   - 系統應使用設備 token 發送通知
   - 檢查 Cloud Functions 日誌：
     ```
     Using device FCM token for device {deviceId}
     Sent FCM notification (token source: device)
     ```

2. **設備無 token，用戶有 token**
   - 手動清除設備的 fcmToken（測試用）
   - 確保用戶有 fcmToken
   - 設備經過通知點
   - 系統應 fallback 到用戶 token
   - 檢查日誌：
     ```
     Fallback to user FCM token for user {userId}
     Sent FCM notification (token source: user)
     ```

3. **都沒有 token**
   - 清除設備和用戶的 fcmToken
   - 設備經過通知點
   - 系統不發送通知但記錄通知點
   - 檢查日誌：
     ```
     No FCM token available (device or user)
     ```

### 場景 5：向後相容測試

#### 測試目標
驗證未遷移的舊設備和通知點仍能正常運作。

#### 測試步驟

1. **舊通知點**
   - 不執行遷移
   - 使用舊的 `appUserNotificationPoints` 集合
   - 設備經過通知點
   - 系統應能從舊集合讀取並發送通知
   - 檢查日誌：
     ```
     Found legacy notification point: {name}
     ```

2. **舊設備（無新欄位）**
   - 檢查沒有 `fcmToken`、`inheritedNotificationPointIds` 欄位的設備
   - 系統應 fallback 到用戶 token
   - 通知應正常發送

3. **雙寫驗證**
   - 新增通知點時
   - 驗證同時寫入新集合（子集合）和舊集合
   - 確保向後相容

### 場景 6：社區長者通知測試

#### 測試目標
驗證社區長者通知（LINE）不受影響。

#### 測試步驟

1. **長者設備經過通知點**
   - 設備綁定到長者（`bindingType: "ELDER"`）
   - 設備經過社區通知點
   - 系統應發送 LINE 通知給社區成員

2. **驗證資料**
   - 檢查 `handleElderNotification` 函數運作正常
   - LINE 通知正常發送
   - 不受新架構影響

## 驗證清單

### 功能驗證

- [ ] FCM token 在綁定時同步到設備
- [ ] FCM token 更新時同步到設備
- [ ] 解綁時清除設備的通知相關欄位
- [ ] 通知點新增到設備子集合
- [ ] 通知點查詢從設備子集合讀取
- [ ] 通知點更新/刪除操作正確
- [ ] 設備分配到社區時繼承通知點
- [ ] 設備移除時清除繼承的通知點
- [ ] 通知優先使用設備 token
- [ ] 設備無 token 時 fallback 到用戶 token
- [ ] 舊通知點（appUserNotificationPoints）仍能運作
- [ ] 社區長者通知（LINE）不受影響

### 向後相容驗證

- [ ] 未遷移的設備能正常接收通知
- [ ] 未遷移的通知點能正常觸發
- [ ] 舊 API 參數（不傳 deviceId）仍能運作
- [ ] 雙寫機制正常運作

### 效能驗證

- [ ] 通知點查詢效能正常（子集合查詢）
- [ ] 通知發送延遲在可接受範圍內
- [ ] 資料遷移腳本執行時間合理

## 常見問題排查

### 問題 1：設備收不到通知

**可能原因：**
1. 設備的 `fcmToken` 為空或過期
2. `notificationEnabled` 為 false
3. 通知點未正確設定

**排查步驟：**
1. 檢查 Firestore 中設備的 `fcmToken` 和 `notificationEnabled`
2. 檢查設備的 `notificationPoints` 子集合或 `inheritedNotificationPointIds`
3. 檢查 Cloud Functions 日誌

### 問題 2：通知點查詢失敗

**可能原因：**
1. deviceId 未正確傳入
2. 設備未綁定到用戶
3. 子集合為空

**排查步驟：**
1. 確認 API 調用傳入正確的 deviceId
2. 驗證設備的 `bindingType` 和 `boundTo`
3. 檢查子集合是否存在文件

### 問題 3：社區通知點未繼承

**可能原因：**
1. 設備的 tags 陣列為空
2. 社區沒有通知點
3. 分配邏輯未執行

**排查步驟：**
1. 檢查設備的 `tags` 欄位
2. 檢查 `tenantNotificationPoints` 集合
3. 重新分配設備到社區

## 回滾計劃

如果出現嚴重問題需要回滾：

1. **資料回滾**
   - 舊集合（`appUserNotificationPoints`）仍保留
   - 用戶的 `fcmToken` 仍在 `app_users` 中
   - 可切回使用舊邏輯

2. **程式碼回滾**
   - 使用 Git 回滾到舊版本
   - 重新部署 Cloud Functions

3. **清理新欄位**（可選）
   ```javascript
   // 批量清除設備的新欄位
   devices.forEach(device => {
     device.update({
       fcmToken: admin.firestore.FieldValue.delete(),
       notificationEnabled: admin.firestore.FieldValue.delete(),
       inheritedNotificationPointIds: admin.firestore.FieldValue.delete()
     });
   });
   ```

## 結論

完成所有測試場景後，確認：
- ✅ 所有功能正常運作
- ✅ 向後相容性良好
- ✅ 效能可接受
- ✅ 無重大 bug

即可將新架構部署到生產環境。
