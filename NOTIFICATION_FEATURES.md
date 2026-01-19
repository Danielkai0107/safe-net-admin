# LINE 通知功能說明

## 最新更新

### 1. 首次活動通知文案優化 ✅

**修改前**：
- 所有位置更新都顯示「位置更新」

**修改後**：
- **今日首次偵測**：顯示「今日首次活動」
- **後續更新**：顯示「位置更新」
- **邊界警報**：顯示「邊界警報」（不變）

### 2. 移除 Emoji ✅

所有 Flex Message 中的 emoji 已移除：
- ~~⚠️ 邊界警報~~ → **邊界警報**
- ~~📍 位置更新~~ → **位置更新** 或 **今日首次活動**

### 3. 位置更新通知開關 ✅

新增環境變數控制位置更新通知是否發送。

#### 環境變數設定

在 Firebase Console 設定環境變數：

```bash
ENABLE_LOCATION_UPDATE_NOTIFICATION=true   # 啟用位置更新通知
ENABLE_LOCATION_UPDATE_NOTIFICATION=false  # 停用位置更新通知（預設）
```

**重要**：
- ✅ **邊界警報**永遠發送，不受開關影響
- ✅ **今日首次活動**永遠發送，不受開關影響（重要通知）
- ✅ 只控制「**位置更新**」（5分鐘冷卻後的後續通知）

#### 如何設定環境變數

```bash
# 方法 1：使用 Firebase CLI
firebase functions:config:set notification.location_update=true

# 方法 2：在 Firebase Console 
# Functions → 選擇 receiveBeaconData → 編輯 → 環境變數
# 添加：ENABLE_LOCATION_UPDATE_NOTIFICATION=true
```

### 4. 注意通知（無活動長輩檢查）✅

#### 功能說明

系統會在以下時段自動檢查並通知：

| 時段 | 檢查時間 | 檢查範圍 | 通知對象 |
|------|---------|---------|---------|
| 早上 | 12:00 | 00:00-12:00 | 所有管理員 |
| 下午 | 18:00 | 12:00-18:00 | 所有管理員 |
| 晚上 | 00:00 | 18:00-00:00 | 所有管理員 |

#### 檢查邏輯

- ✅ 檢查所有**活躍狀態**的長輩
- ✅ 如果該時段內**完全沒有訊號**，列入通知清單
- ✅ **重要**：如果之前時段已偵測到活動，就不會列入
- ✅ 一條訊息列出所有無活動長輩

#### 通知訊息範例

```
⚠️ 注意通知（早上時段）

以下長輩今日尚未偵測到活動：
• 王奶奶
• 李爺爺
• 張奶奶

請關注其安全狀況
```

#### Cloud Scheduler 設定

系統已自動部署排程任務：
- **Function 名稱**：`checkInactiveElders`
- **執行頻率**：每天 00:00、12:00、18:00
- **時區**：Asia/Taipei

可在 Firebase Console 查看：
```
Cloud Scheduler → checkInactiveElders
```

---

## 通知類型總覽

### 即時通知（由 Beacon 觸發）

1. **邊界警報**（紅色）
   - 觸發：長輩出現在邊界閘道器
   - 發送：立即發送給所有成員
   - 狀態：永遠啟用

2. **今日首次活動**（藍色）
   - 觸發：當天第一次偵測到長輩活動
   - 發送：根據環境變數決定
   - 狀態：可控制開關

3. **位置更新**（藍色）
   - 觸發：5 分鐘冷卻期後再次偵測
   - 發送：根據環境變數決定
   - 狀態：可控制開關

### 定時通知（由 Scheduler 觸發）

4. **注意通知（無活動長輩）**
   - 觸發：每天 3 次定時檢查
   - 發送：給所有管理員
   - 狀態：永遠啟用

### 人工觸發通知（由管理員操作）

5. **警報分配通知**
   - 觸發：管理員分配警報
   - 發送：給指定成員
   - 含互動按鈕（接受/拒絕/地圖）

---

## 部署狀態

✅ **已部署的 Functions**：
- `receiveBeaconData` - Beacon 數據處理（含首次活動判斷）
- `checkInactiveElders` - 定時檢查無活動長輩（新增）
- `assignAlert` - 警報分配
- `acceptAlertAssignment` - 接受警報
- `declineAlertAssignment` - 拒絕警報
- `completeAlert` - 完成警報
- `lineWebhook` - LINE Webhook 處理
- `verifyUserTenant` - 驗證用戶社區
- `getTenantFollowers` - 獲取社區追蹤者

✅ **部署時間**：2026-01-20

---

## 測試建議

### 測試位置更新通知開關

```bash
# 1. 啟用位置更新通知
firebase functions:config:set notification.location_update=true
firebase deploy --only functions:receiveBeaconData

# 2. 發送測試 Beacon 數據，應該收到通知

# 3. 停用位置更新通知
firebase functions:config:set notification.location_update=false
firebase deploy --only functions:receiveBeaconData

# 4. 再次發送 Beacon 數據，應該不收到通知（邊界除外）
```

### 測試注意通知

```bash
# 方法 1：等待定時執行（12:00, 18:00, 00:00）

# 方法 2：手動觸發測試
# 在 Firebase Console → Cloud Scheduler → checkInactiveElders
# 點擊「立即執行」按鈕
```

---

## 故障排除

### 位置更新通知沒有發送

1. 檢查環境變數是否設定為 `true`
2. 檢查是否為首次活動（應該顯示「今日首次活動」）
3. 檢查是否在 5 分鐘冷卻期內

### 注意通知沒有收到

1. 檢查 Cloud Scheduler 是否已啟用
2. 檢查執行日誌：`firebase functions:log --only checkInactiveElders`
3. 確認有長輩在該時段內無活動
4. 確認管理員有綁定 LINE 帳號

### 首次活動判斷不正確

- 系統以 `latest_locations` 集合中的文檔存在與否判斷
- 每天 00:00 後第一次偵測才算首次活動
- 如需重置，刪除對應的 `latest_locations` 文檔

---

## 未來擴展建議

1. **自訂檢查時段**
   - 允許每個社區設定自己的檢查時間
   
2. **通知偏好設定**
   - 讓管理員選擇想收到哪些通知
   
3. **警報升級機制**
   - 如果長輩連續多個時段無活動，提升警報等級

4. **統計報表**
   - 每週/每月活動統計報表
