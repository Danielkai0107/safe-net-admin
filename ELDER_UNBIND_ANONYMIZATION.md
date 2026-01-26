# 長者解綁匿名化功能

## 更新時間
2026-01-26

## 問題背景

### 原始問題

在統一通知架構實作過程中發現：
- ❌ MAP_USER 解綁有匿名化活動記錄
- ❌ ELDER 解綁沒有匿名化活動記錄
- ❌ 導致大量幽靈設備（已解綁但保留 activities）
- ❌ 隱私風險和資料累積問題

### 資料庫現況

```
devices (collection)
└─ device_123 (bindingType: "UNBOUND")  ← 已解綁
    └─ activities (subcollection)  ← 但仍有活動記錄
        ├─ activity_001 (boundTo: "elder_xxx")  ← 保留長者關聯
        ├─ activity_002 (boundTo: "elder_xxx")
        └─ ...
```

問題：
1. 隱私風險：activities 仍包含長者 ID
2. 資料累積：activities 無限增長
3. 不一致：與 MAP_USER 處理方式不同

## 解決方案

### 實作內容

#### 1. 前端匿名化工具

**檔案：**
- `src/utils/anonymizeDeviceActivities.ts` (Admin Portal)
- `community-portal/src/utils/anonymizeDeviceActivities.ts` (Community Portal)

**功能：**
```typescript
anonymizeDeviceActivities(deviceId, reason) {
  // 1. 查詢設備的所有活動記錄
  // 2. 分批複製到 anonymousActivities（移除個人資訊）
  // 3. 刪除原始 activities
  // 4. 回傳匿名化數量
}
```

**特點：**
- ✅ 分批處理（每批 500 筆）
- ✅ 使用 Firebase batch 操作
- ✅ 記錄匿名化原因和時間
- ✅ 失敗不影響主流程

#### 2. 整合到解綁流程

**Admin Portal：** `src/services/deviceService.ts`
```typescript
assignToElder(deviceId, null) {
  // 1. 匿名化活動記錄
  await anonymizeDeviceActivities(deviceId, "ELDER_UNBIND");
  
  // 2. 更新設備和長者記錄
  // ...
}
```

**Admin Portal：** `src/services/elderService.ts`
```typescript
delete(elderId) {
  if (elder.deviceId) {
    // 1. 匿名化活動記錄
    await anonymizeDeviceActivities(deviceId, "ELDER_DELETION");
    
    // 2. 解綁設備
    // 3. 軟刪除長者
  }
}
```

**Community Portal：** `community-portal/src/services/elderService.ts`
```typescript
unbindDevice(elderId, deviceId) {
  // 1. 匿名化活動記錄
  await anonymizeDeviceActivities(deviceId, "ELDER_UNBIND");
  
  // 2. 更新設備和長者記錄
  // ...
}

delete(elderId) {
  if (elder.deviceId) {
    // 1. 匿名化活動記錄
    await anonymizeDeviceActivities(deviceId, "ELDER_DELETION");
    
    // 2. 解綁設備
    // 3. 軟刪除長者
  }
}
```

#### 3. Cloud Function（可選）

**檔案：** `functions/src/mapApp/elderBinding.ts`

提供後端 API 供需要時使用：
```
POST /unbindDeviceFromElder
{
  "elderId": "elder_xxx",
  "deviceId": "device_xxx"
}
```

#### 4. 清理幽靈設備腳本

**檔案：** `functions/src/utils/cleanupGhostDeviceActivities.ts`

清理現有的幽靈設備活動記錄：
```bash
# Dry Run（預覽）
npx ts-node src/utils/cleanupGhostDeviceActivities.ts

# 實際執行
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live
```

## 匿名化資料結構

### 原始活動記錄（devices/{deviceId}/activities）

```javascript
{
  id: "activity_123",
  timestamp: "2026-01-26T10:00:00Z",
  gatewayId: "gateway_001",
  gatewayName: "社區大門",
  latitude: 25.0330,
  longitude: 121.5654,
  bindingType: "ELDER",          // 包含綁定類型
  boundTo: "elder_xxx",          // ⚠️ 包含長者 ID
  // ...
}
```

### 匿名化後（anonymousActivities）

```javascript
{
  id: "anonymous_456",
  deviceId: "device_123",        // 保留設備 ID（統計用）
  timestamp: "2026-01-26T10:00:00Z",
  gatewayId: "gateway_001",
  gatewayName: "社區大門",
  latitude: 25.0330,
  longitude: 121.5654,
  bindingType: "ANONYMOUS",      // ✅ 標記為匿名
  boundTo: null,                 // ✅ 移除長者關聯
  anonymizedReason: "ELDER_UNBIND",
  anonymizedAt: "2026-01-26T10:30:00Z",
  archiveSessionId: "session_789",
  originalActivityId: "activity_123",
}
```

### 保留的欄位（統計用）

- ✅ `deviceId` - 設備 ID
- ✅ `timestamp` - 活動時間
- ✅ `gatewayId`, `gatewayName` - 位置資訊
- ✅ `latitude`, `longitude` - 座標
- ✅ `rssi`, `triggeredNotification` - 技術資訊

### 移除的欄位（隱私保護）

- ❌ `boundTo` → `null` - 移除長者/用戶關聯
- ❌ `bindingType` → `"ANONYMOUS"` - 標記為匿名

## 觸發時機

| 操作 | 位置 | 匿名化 | 原因代碼 |
|------|------|--------|---------|
| 解綁長者設備 | Admin Portal | ✅ 是 | `ELDER_UNBIND` |
| 解綁長者設備 | Community Portal | ✅ 是 | `ELDER_UNBIND` |
| 刪除長者 | Admin Portal | ✅ 是 | `ELDER_DELETION` |
| 刪除長者 | Community Portal | ✅ 是 | `ELDER_DELETION` |
| 解綁 MAP_USER 設備 | Cloud Function | ✅ 是 | `MAP_USER_UNBIND` |
| 刪除 MAP_USER 帳號 | Cloud Function | ✅ 是 | `USER_DELETION` |

## 清理現有幽靈設備

### 執行清理腳本

```bash
cd functions

# 1. Dry Run：預覽會處理哪些設備
npx ts-node src/utils/cleanupGhostDeviceActivities.ts

# 輸出範例：
========================================
清理幽靈設備活動記錄
模式: DRY RUN（不會實際寫入）
========================================

找到 150 個已解綁的設備

🔍 發現幽靈設備: ABCDEF1234 (device_001)
   - 活動記錄數: 245
   [DRY RUN] 將匿名化並刪除 245 筆活動記錄

🔍 發現幽靈設備: GHIJKL5678 (device_002)
   - 活動記錄數: 189
   [DRY RUN] 將匿名化並刪除 189 筆活動記錄
...

========================================
清理完成
========================================
統計：
  - 檢查設備數: 150
  - 幽靈設備數: 87
  - 已匿名化記錄: 0 (DRY RUN)
  - 已刪除記錄: 0 (DRY RUN)
  - 錯誤: 0

⚠️  這是 DRY RUN，沒有實際寫入資料
   要執行實際清理，請使用 --live 參數
========================================


# 2. 實際執行清理
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live
```

### 注意事項

⚠️ **清理前必讀：**

1. **備份資料**
   ```bash
   gcloud firestore export gs://[YOUR_BUCKET]/backup-$(date +%Y%m%d)
   ```

2. **先執行 Dry Run**
   - 確認要處理的設備數量合理
   - 檢查是否有錯誤

3. **選擇低峰時段**
   - 建議在夜間或週末執行
   - 避免影響正常使用

4. **監控執行**
   - 觀察 Console 輸出
   - 注意錯誤訊息

## 測試步驟

### 測試 1：解綁長者設備（Admin Portal）

1. 在長者管理中選擇一個已綁定設備的長者
2. 解綁設備
3. 檢查瀏覽器 Console：
   ```
   Anonymizing activities for device device_xxx before unbinding...
   ✅ 設備 device_xxx: 已匿名化並刪除 XX 筆活動記錄
   Archived XX activities for device device_xxx
   ```
4. 在 Firestore Console 檢查：
   - `devices/{deviceId}/activities` 應該為空
   - `anonymousActivities` 應該有新記錄

### 測試 2：解綁長者設備（Community Portal）

同上，在 Community Portal 執行。

### 測試 3：刪除長者

1. 選擇一個已綁定設備的長者
2. 刪除長者
3. 檢查是否匿名化活動記錄

### 測試 4：清理幽靈設備

```bash
# 先 Dry Run
cd functions
npx ts-node src/utils/cleanupGhostDeviceActivities.ts

# 確認結果合理後執行
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live
```

## 效能影響

### 前端操作時間

| 活動記錄數 | 預估時間 | 用戶體驗 |
|-----------|---------|---------|
| < 100 | < 2 秒 | 無感 |
| 100-500 | 2-5 秒 | 可接受 |
| > 500 | 5-10 秒 | 顯示載入中 |

### 優化建議

如果長者設備活動記錄特別多（> 1000 筆）：
1. 可以改用 Cloud Function `unbindDeviceFromElder`
2. 或在背景執行清理腳本

### 清理腳本效能

- 處理速度：約 50-100 設備/分鐘
- 建議分批執行大型清理

## 驗證清單

### 功能驗證

- [ ] Admin Portal 解綁長者設備會匿名化
- [ ] Community Portal 解綁長者設備會匿名化
- [ ] Admin Portal 刪除長者會匿名化
- [ ] Community Portal 刪除長者會匿名化
- [ ] 匿名化後原始 activities 被刪除
- [ ] anonymousActivities 正確保留統計資訊
- [ ] 匿名化後 boundTo 為 null

### 資料驗證

**解綁前：**
```javascript
devices/{deviceId}
{
  bindingType: "ELDER",
  boundTo: "elder_xxx",
}

devices/{deviceId}/activities/{activityId}
{
  boundTo: "elder_xxx",  // 包含長者 ID
  // ...
}
```

**解綁後：**
```javascript
devices/{deviceId}
{
  bindingType: "UNBOUND",
  boundTo: null,
}

devices/{deviceId}/activities  // ✅ 子集合為空

anonymousActivities/{newId}
{
  deviceId: "device_123",
  boundTo: null,  // ✅ 已移除長者關聯
  bindingType: "ANONYMOUS",
  anonymizedReason: "ELDER_UNBIND",
  anonymizedAt: "2026-01-26T...",
  // ...
}
```

## 與 MAP_USER 對比

| 項目 | MAP_USER | ELDER |
|------|----------|-------|
| 匿名化時機 | 解綁/刪除用戶 | 解綁/刪除長者 ✅ |
| 實作方式 | Cloud Function | 前端工具函數 ✅ |
| 刪除原始記錄 | ✅ 是 | ✅ 是 |
| 匿名化資訊 | boundTo → null | boundTo → null ✅ |
| 保留統計資料 | ✅ 是 | ✅ 是 |

## 修改的檔案

| 檔案 | 變更內容 |
|------|----------|
| `src/utils/anonymizeDeviceActivities.ts` | 新建匿名化工具（Admin） |
| `community-portal/src/utils/anonymizeDeviceActivities.ts` | 新建匿名化工具（Community） |
| `src/services/deviceService.ts` | assignToElder 加入匿名化 |
| `src/services/elderService.ts` | delete 加入匿名化 |
| `community-portal/src/services/elderService.ts` | unbindDevice 和 delete 加入匿名化 |
| `functions/src/mapApp/elderBinding.ts` | 新建 Cloud Function（可選） |
| `functions/src/utils/cleanupGhostDeviceActivities.ts` | 清理腳本 |
| `functions/src/index.ts` | 註冊新的 Cloud Function |

## 部署步驟

### 1. 部署前端

```bash
# Admin Portal
cd /Users/danielkai/Desktop/admin
npm run build
firebase deploy --only hosting:admin

# Community Portal
cd community-portal
npm run build
firebase deploy --only hosting:community-portal
```

### 2. 部署 Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### 3. 清理現有幽靈設備

```bash
cd functions

# Dry Run
npx ts-node src/utils/cleanupGhostDeviceActivities.ts

# 確認無誤後執行
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live
```

## 監控與日誌

### 前端日誌

在瀏覽器 Console（F12）查看：
```
Anonymizing activities for device device_xxx before unbinding...
✅ 設備 device_xxx: 已匿名化並刪除 XX 筆活動記錄
Archived XX activities for device device_xxx
```

### 後端日誌（Cloud Function）

```bash
firebase functions:log --only unbindDeviceFromElder
```

### Firestore 監控

在 Firebase Console 監控：
- `devices/{deviceId}/activities` 子集合應該為空（解綁後）
- `anonymousActivities` 集合持續增長
- 沒有異常的寫入錯誤

## 常見問題

### Q: 匿名化失敗怎麼辦？

**現象：** Console 顯示 "Failed to anonymize activities"

**處理：**
1. 解綁仍會繼續執行（不影響主功能）
2. 可稍後手動執行清理腳本
3. 檢查 Firestore 權限設定

### Q: 清理腳本執行很慢？

**正常情況：**
- 100 個幽靈設備，每個 200 筆記錄 ≈ 5-10 分鐘

**優化建議：**
- 選擇低峰時段執行
- 可以暫停後繼續（腳本是冪等的）

### Q: 匿名化後可以還原嗎？

**答：** 可以，但需要 `originalActivityId`

匿名化記錄保留了 `originalActivityId`，可用於追溯，但**不建議還原**（違背匿名化目的）。

### Q: 會影響通知功能嗎？

**答：** 不會。

- 通知功能基於設備的即時偵測
- 不依賴歷史活動記錄
- 匿名化只處理歷史資料

## 資料保留政策建議

### 活動記錄保留

1. **已綁定設備：** 保留在 `devices/{deviceId}/activities`
2. **解綁後：** 立即匿名化到 `anonymousActivities`
3. **匿名化後：** 可設定保留期限（例如 1 年後刪除）

### 未來改進

可考慮建立定期清理任務：
```javascript
// Cloud Scheduler 每月執行
export const monthlyCleanup = onSchedule('0 0 1 * *', async () => {
  // 1. 清理幽靈設備
  await cleanupGhostDeviceActivities(false);
  
  // 2. 清理超過 1 年的匿名化記錄
  await deleteOldAnonymousActivities(365);
});
```

## 隱私影響評估

### 改善前

- ❌ 解綁後活動記錄仍包含長者 ID
- ❌ 可透過設備 ID 追溯到長者
- ❌ 資料無限累積

### 改善後

- ✅ 解綁後立即匿名化
- ✅ 移除所有個人識別資訊
- ✅ 保留統計價值
- ✅ 符合隱私保護原則

## 總結

### 實作內容

✅ **前端工具函數** - 匿名化活動記錄  
✅ **整合到解綁流程** - 自動執行  
✅ **Cloud Function** - 提供後端選項  
✅ **清理腳本** - 處理現有問題  

### 效果

✅ **隱私保護** - 移除個人識別資訊  
✅ **資料清理** - 刪除原始活動記錄  
✅ **統計保留** - 保留分析所需資料  
✅ **統一行為** - ELDER 和 MAP_USER 一致  

### 部署就緒

- ✅ Admin Portal 構建成功
- ✅ Community Portal 構建成功
- ✅ Cloud Functions 構建成功
- ✅ 清理腳本已準備

可以開始部署了！🚀
