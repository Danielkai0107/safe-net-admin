# 統一通知架構部署指南

## 變更總覽

本次更新統一了 App 和社區型裝置的通知架構，將通知相關資料集中到 `devices` 集合，實現以下目標：

1. ✅ 通知點記錄在設備中，而非用戶或社區
2. ✅ FCM Token 存儲在設備上
3. ✅ 設備通過 tag 繼承社區通知點
4. ✅ 通知發送優先使用設備 token，其次查詢綁定用戶
5. ✅ 向後相容，不影響現有功能

## 變更檔案清單

### 類型定義

| 檔案 | 變更 |
|------|------|
| `src/types/index.ts` | 新增 `Device` 的通知欄位和 `DeviceNotificationPoint` 介面 |

### Cloud Functions

| 檔案 | 變更 |
|------|------|
| `functions/src/mapApp/fcmToken.ts` | 更新 FCM token 時同步到設備 |
| `functions/src/mapApp/deviceBinding.ts` | 綁定時同步 token，解綁時清除通知欄位和子集合 |
| `functions/src/mapApp/notificationPoints.ts` | 4 個通知點 API 改為操作設備子集合 |
| `functions/src/beacon/receiveBeaconData.ts` | 通知發送優先使用設備 token，支援設備子集合和繼承通知點 |

### 前端服務層

| 檔案 | 變更 |
|------|------|
| `src/services/tenantService.ts` | 設備分配/移除時同步繼承通知點 |

### 遷移腳本

| 檔案 | 說明 |
|------|------|
| `functions/src/migrations/migrateNotificationArchitecture.ts` | 資料遷移腳本 |

### 文檔

| 檔案 | 說明 |
|------|------|
| `NOTIFICATION_ARCHITECTURE_TEST_GUIDE.md` | 測試指南 |
| `NOTIFICATION_ARCHITECTURE_DEPLOYMENT.md` | 本文檔 |

## 資料結構變更

### devices 集合

新增欄位：

```typescript
{
  // ... 現有欄位 ...
  
  // 新增：通知相關欄位
  fcmToken?: string | null;                     // FCM 推送 token
  notificationEnabled?: boolean;                // 是否啟用通知
  inheritedNotificationPointIds?: string[];     // 從社區繼承的通知點 gateway IDs
}
```

### devices/{deviceId}/notificationPoints 子集合（新）

取代 `appUserNotificationPoints` 集合：

```typescript
{
  id: string;
  gatewayId: string;
  name: string;
  notificationMessage?: string | null;
  isActive: boolean;
  createdAt: string;
}
```

## 部署步驟

### 步驟 1：備份資料（強烈建議）

```bash
# 備份 Firestore
gcloud firestore export gs://[YOUR_BUCKET]/backup-$(date +%Y%m%d)
```

### 步驟 2：部署程式碼

```bash
# 1. 安裝依賴（如有更新）
cd functions
npm install

# 2. 編譯 TypeScript
npm run build

# 3. 部署 Cloud Functions
firebase deploy --only functions

# 4. 如有前端變更，部署前端
cd ../community-portal
npm run build
firebase deploy --only hosting
```

### 步驟 3：執行資料遷移

#### 3.1 Dry Run（預覽）

```bash
cd functions
npx ts-node src/migrations/migrateNotificationArchitecture.ts
```

輸出範例：
```
========================================
統一通知架構資料遷移
模式: DRY RUN（不會實際寫入）
========================================

步驟 1：遷移 FCM Token from app_users to devices...
找到 25 個已綁定的 MAP_USER 設備

✅ 設備 device_001: 遷移 fcmToken 成功
✅ 設備 device_002: 遷移 fcmToken 成功
...

步驟 1 完成：
  - 已遷移: 20
  - 已跳過: 5

步驟 2：遷移 appUserNotificationPoints to devices/{deviceId}/notificationPoints...
...

步驟 3：設定社區設備繼承通知點...
...

========================================
遷移完成！
========================================
統計：
  FCM Token 遷移: 20 成功, 5 跳過
  通知點遷移: 35 成功, 2 跳過
  繼承通知點設定: 50
  錯誤: 0

⚠️  這是 DRY RUN，沒有實際寫入資料
   要執行實際遷移，請使用 dryRun = false
========================================
```

#### 3.2 檢查 Dry Run 結果

確認：
- 遷移的數量符合預期
- 沒有錯誤
- 跳過的項目原因合理

#### 3.3 執行實際遷移

```bash
npx ts-node src/migrations/migrateNotificationArchitecture.ts --live
```

⚠️ **注意**：
- 遷移是冪等的（可重複執行）
- 已遷移的項目會被自動跳過
- 建議先在測試環境執行

### 步驟 4：驗證遷移結果

#### 4.1 檢查 Firestore

在 Firebase Console 中檢查：

1. **設備的 FCM token**
   ```
   devices/{deviceId}
   - fcmToken: 應與 app_users/{userId}.fcmToken 相同（如有綁定）
   - notificationEnabled: true
   ```

2. **設備的通知點子集合**
   ```
   devices/{deviceId}/notificationPoints/{pointId}
   - gatewayId: xxx
   - name: xxx
   - isActive: true
   ```

3. **設備的繼承通知點**
   ```
   devices/{deviceId}
   - tags: ["tenant_xxx"]
   - inheritedNotificationPointIds: [gatewayId1, gatewayId2, ...]
   ```

#### 4.2 測試通知功能

參考 `NOTIFICATION_ARCHITECTURE_TEST_GUIDE.md` 執行測試。

### 步驟 5：監控

#### 5.1 Cloud Functions 日誌

```bash
# 查看通知相關日誌
firebase functions:log --only receiveBeaconData

# 查看 API 日誌
firebase functions:log --only updateMapUserFcmToken,addMapUserNotificationPoint
```

關注以下日誌訊息：
- `Using device FCM token for device {deviceId}` - 使用設備 token
- `Fallback to user FCM token for user {userId}` - fallback 到用戶 token
- `Found device notification point: {name}` - 找到設備通知點
- `Found legacy notification point: {name}` - fallback 到舊通知點

#### 5.2 錯誤監控

在 Firebase Console > Functions > Logs 中監控錯誤率。

## 向後相容策略

### 雙寫機制

以下操作同時寫入新舊集合（過渡期）：

1. **FCM Token**
   - 新：`devices.fcmToken`
   - 舊：`app_users.fcmToken`（保留）

2. **通知點**
   - 新：`devices/{deviceId}/notificationPoints`
   - 舊：`appUserNotificationPoints`（保留，新增時同時寫入）

### Fallback 機制

通知發送邏輯的 fallback 順序：

1. 優先：設備的 `fcmToken` + `notificationEnabled`
2. 其次：用戶的 `fcmToken` + `notificationEnabled`（向後相容）
3. 通知點查詢順序：
   - 設備的 `notificationPoints` 子集合
   - 設備的 `inheritedNotificationPointIds`
   - 舊的 `appUserNotificationPoints`（向後相容）

### API 向後相容

所有 API 支援舊參數格式：
- `deviceId` 為可選參數
- 若未提供，自動從 `app_users.boundDeviceId` 查找
- 確保現有 App 無需立即更新

## 回滾計劃

如果出現問題需要回滾：

### 1. 程式碼回滾

```bash
# 回滾到上一個版本
git revert <commit-hash>
firebase deploy --only functions
```

### 2. 資料回滾

資料無需回滾，因為：
- 舊集合（`app_users.fcmToken`、`appUserNotificationPoints`）仍保留
- 新欄位不影響舊邏輯
- 可直接切回舊程式碼

### 3. 清理新欄位（可選）

如需完全清除新架構：

```javascript
// 批量清除設備的新欄位
const devicesSnapshot = await db.collection('devices').get();
const batch = db.batch();

devicesSnapshot.docs.forEach(doc => {
  batch.update(doc.ref, {
    fcmToken: admin.firestore.FieldValue.delete(),
    notificationEnabled: admin.firestore.FieldValue.delete(),
    inheritedNotificationPointIds: admin.firestore.FieldValue.delete()
  });
});

await batch.commit();
```

## 效能影響

### 查詢效能

- ✅ **設備通知點查詢**：從 O(全域) 改為 O(子集合)，效能提升
- ✅ **繼承通知點**：陣列包含查詢，效能良好
- ⚠️ **資料遷移**：一次性操作，可能需要數分鐘

### 儲存成本

- ➕ 新增設備子集合（`notificationPoints`）
- ➕ 新增設備欄位（`fcmToken`、`notificationEnabled`、`inheritedNotificationPointIds`）
- ➖ 舊集合暫時保留（雙寫），待確認穩定後可清理

## 後續工作

### 短期（部署後 1-2 週）

1. 監控日誌和錯誤率
2. 收集用戶反饋
3. 完成所有測試場景

### 中期（1 個月後）

1. 確認新架構穩定
2. 考慮清理舊集合（`appUserNotificationPoints`）
3. 移除雙寫機制

### 長期

1. Map App 更新 API 調用，明確傳入 `deviceId`
2. 移除 fallback 邏輯，簡化程式碼
3. 完全淘汰舊架構

## 聯絡與支援

如有問題：
1. 查看 `NOTIFICATION_ARCHITECTURE_TEST_GUIDE.md`
2. 檢查 Cloud Functions 日誌
3. 參考本文檔的回滾計劃

## 結論

本次更新實現了統一通知架構，主要優勢：

- ✅ 設備與通知資料解耦，減少關聯性
- ✅ 通知邏輯更清晰，優先順序明確
- ✅ 支援社區通知點繼承
- ✅ 完全向後相容
- ✅ 可安全回滾

祝部署順利！ 🚀
