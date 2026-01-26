# 統一通知架構變更總結

## 執行完成時間

2026-01-26

## 目標達成

✅ 統一 App 和社區型裝置的資料結構和通知邏輯  
✅ 將通知點記錄在 devices 集合裡面  
✅ 社區中被標註 tag 的設備通知點會帶入，移除 tag 會解除  
✅ App 綁定後通知點紀錄在裝置下而非用戶下  
✅ 解除綁定後變成匿名資料，重新設定  
✅ 在不影響目前通知功能和前端操作下完成修改  

## 主要變更

### 1. 資料結構

#### devices 集合新增欄位

```typescript
interface Device {
  // ... 現有欄位 ...
  
  // 新增：通知相關欄位
  fcmToken?: string | null;                     // FCM 推送 token（從 app_users 移過來）
  notificationEnabled?: boolean;                // 是否啟用通知
  inheritedNotificationPointIds?: string[];     // 從社區繼承的通知點 gateway IDs
}
```

#### devices/{deviceId}/notificationPoints 子集合（新）

```typescript
interface DeviceNotificationPoint {
  id: string;
  gatewayId: string;
  name: string;
  notificationMessage?: string | null;
  isActive: boolean;
  createdAt: string;
}
```

### 2. 通知邏輯變更

#### 優先級順序

1. **優先**：使用設備的 `fcmToken`（如果有且 `notificationEnabled = true`）
2. **其次**：fallback 到綁定用戶的 `fcmToken`（向後相容）
3. **ELDER 設備**：查詢社區成員的 LINE 發送（不變）

#### 通知點查詢順序

1. 設備的 `notificationPoints` 子集合
2. 設備的 `inheritedNotificationPointIds`（從社區繼承）
3. 舊的 `appUserNotificationPoints` 集合（向後相容）

### 3. 設備綁定/解綁

#### 綁定時

- 從用戶的 `fcmToken` 同步到設備
- 設定 `notificationEnabled = true`

#### 解綁時

- 清除設備的通知相關欄位：`fcmToken = null`, `notificationEnabled = null`, `inheritedNotificationPointIds = null`
- 刪除設備的 `notificationPoints` 子集合中的所有文件
- 活動記錄複製到 `anonymousActivities`（現有機制）

### 4. 社區設備分配

#### 分配時

- 設定 `tags = [tenantId]`（新架構）
- 保留 `tenantId`（舊架構，向後相容）
- 查詢社區的 `tenantNotificationPoints`，設定 `inheritedNotificationPointIds`

#### 移除時

- 清除 `tags = []`
- 清除 `tenantId = null`
- 清除 `inheritedNotificationPointIds = null`

## 修改的檔案

### 類型定義 (1 個檔案)

- `src/types/index.ts` - 新增 Device 通知欄位和 DeviceNotificationPoint 介面

### Cloud Functions (4 個檔案)

1. `functions/src/mapApp/fcmToken.ts`
   - 更新時同步到設備的 `fcmToken`
   - 支援 `deviceId` 參數（可選，向後相容）

2. `functions/src/mapApp/deviceBinding.ts`
   - 綁定時從用戶同步 `fcmToken` 到設備
   - 解綁時清除通知欄位並刪除 `notificationPoints` 子集合

3. `functions/src/mapApp/notificationPoints.ts`
   - 4 個 API 改為操作設備子集合
   - 支援 `deviceId` 參數（可選，向後相容）
   - 雙寫機制（同時寫入舊集合）

4. `functions/src/beacon/receiveBeaconData.ts`
   - 優先使用設備 `fcmToken`
   - 支援設備 `notificationPoints` 子集合
   - 支援 `inheritedNotificationPointIds`
   - fallback 到舊邏輯（向後相容）

### 前端服務層 (1 個檔案)

- `src/services/tenantService.ts`
  - 分配設備時設定 `tags` 和 `inheritedNotificationPointIds`
  - 移除設備時清除這些欄位

### 遷移腳本 (1 個檔案)

- `functions/src/migrations/migrateNotificationArchitecture.ts`
  - 遷移 FCM Token
  - 遷移通知點
  - 設定繼承通知點
  - 支援 Dry Run

### 文檔 (3 個檔案)

1. `NOTIFICATION_ARCHITECTURE_TEST_GUIDE.md` - 測試指南
2. `NOTIFICATION_ARCHITECTURE_DEPLOYMENT.md` - 部署指南
3. `NOTIFICATION_ARCHITECTURE_CHANGES_SUMMARY.md` - 本文檔

## 向後相容

### 雙寫機制

- FCM Token：同時寫入 `devices.fcmToken` 和 `app_users.fcmToken`
- 通知點：同時寫入子集合和 `appUserNotificationPoints`

### Fallback 機制

- 通知發送：設備無 token 時 fallback 到用戶 token
- 通知點查詢：優先設備子集合，其次舊集合
- API 參數：`deviceId` 可選，自動從 `app_users.boundDeviceId` 查找

### 保留的舊資料

- `app_users.fcmToken` - 保留
- `appUserNotificationPoints` - 保留
- `tenantNotificationPoints` - 保留（社區管理員仍使用）

## 新功能

### 1. 設備獨立的通知設定

- 通知點存儲在設備上，不再依賴用戶
- 設備解綁後，通知設定自動清除
- 設備重新綁定時，從新用戶同步設定

### 2. 社區通知點繼承

- 設備加入社區時自動繼承通知點
- 設備移除時自動清除繼承的通知點
- 無需手動設定

### 3. 通知優先級

- 優先使用設備 token（更精準）
- fallback 機制確保向後相容
- 日誌記錄 token 來源便於排查

## 測試建議

詳見 `NOTIFICATION_ARCHITECTURE_TEST_GUIDE.md`，主要測試場景：

1. FCM Token 同步測試
2. 通知點管理測試
3. 社區通知點繼承測試
4. 通知發送優先級測試
5. 向後相容測試
6. 社區長者通知測試

## 部署步驟

詳見 `NOTIFICATION_ARCHITECTURE_DEPLOYMENT.md`：

1. 備份資料
2. 部署程式碼
3. 執行資料遷移（先 Dry Run）
4. 驗證遷移結果
5. 監控

## 效能影響

### 正面影響

- ✅ 通知點查詢從全域查詢改為子集合查詢，效能提升
- ✅ 繼承通知點使用陣列包含查詢，效能良好
- ✅ 減少跨集合查詢

### 注意事項

- ⚠️ 資料遷移可能需要數分鐘（一次性）
- ⚠️ 雙寫機制增加寫入次數（過渡期）
- ⚠️ 子集合增加儲存成本（輕微）

## 風險評估

### 低風險

- ✅ 完全向後相容
- ✅ 可安全回滾
- ✅ 舊資料保留
- ✅ 雙寫機制

### 需注意

- ⚠️ 遷移腳本需仔細測試
- ⚠️ 監控日誌確認無錯誤
- ⚠️ 建議先在測試環境部署

## 後續計劃

### 短期（1-2 週）

- 監控生產環境
- 收集用戶反饋
- 修復問題（如有）

### 中期（1 個月後）

- 確認新架構穩定
- 考慮清理舊集合
- 移除雙寫機制

### 長期

- Map App 更新 API 調用
- 移除 fallback 邏輯
- 完全淘汰舊架構

## 結論

本次更新成功實現了統一通知架構的目標：

1. ✅ 設備與通知資料解耦
2. ✅ 支援社區通知點繼承
3. ✅ 優先使用設備 token
4. ✅ 完全向後相容
5. ✅ 可安全回滾

所有變更都經過仔細設計，確保不影響現有功能。建議按照部署指南逐步執行，並在生產環境部署前進行充分測試。

---

**實施者備註**：所有程式碼變更已完成，測試指南和部署指南已準備就緒。建議先在測試環境執行資料遷移的 Dry Run，確認無誤後再部署到生產環境。
