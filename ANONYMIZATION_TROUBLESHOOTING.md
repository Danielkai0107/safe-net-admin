# 匿名化功能排查指南

## 問題：設備 activities 沒有清空

### 可能原因

#### 1. 尚未部署新的前端程式碼

**症狀：**
- 刪除長者後，設備 activities 仍然存在
- 瀏覽器 Console 沒有匿名化相關日誌

**檢查：**
```bash
# 確認是否已部署最新版本
cd /Users/danielkai/Desktop/admin
npm run build
firebase deploy --only hosting:admin,hosting:community-portal
```

**解決：**
部署最新的前端程式碼。

---

#### 2. 匿名化函數執行失敗

**症狀：**
- 瀏覽器 Console 顯示：
  ```
  Anonymizing activities for device device_xxx before elder deletion...
  ❌ 設備 device_xxx 匿名化失敗: [錯誤訊息]
  ```

**可能的錯誤：**

**A. 權限錯誤**
```
FirebaseError: Missing or insufficient permissions
```
→ Firestore 規則不允許刪除 activities

**B. 網路錯誤**
```
FirebaseError: Network request failed
```
→ 網路連線問題

**C. Batch 限制錯誤**
```
FirebaseError: Too many writes in a single batch
```
→ 超過 500 筆限制（不應該發生）

**解決：**
根據錯誤訊息處理。

---

#### 3. Activities 在匿名化過程中持續產生

**症狀：**
- 匿名化完成但仍有記錄
- 記錄的時間戳是最近的

**原因：**
設備仍在活動中，新的活動記錄持續產生。

**解決：**
這是正常的！解綁後的新活動記錄會被標記為 `bindingType: "UNBOUND"`，不會與長者關聯。

---

#### 4. 查詢沒有返回任何記錄

**症狀：**
- Console 顯示：`Archived 0 activities`
- 但 Firestore 中有記錄

**檢查：**
在瀏覽器 Console 執行：
```javascript
// 手動查詢看是否能取得記錄
import { collection, getDocs } from 'firebase/firestore';
import { db } from './config/firebase';

const activitiesRef = collection(db, "devices", "device_xxx", "activities");
const snapshot = await getDocs(activitiesRef);
console.log("Activities count:", snapshot.size);
```

**解決：**
如果查不到記錄，可能是路徑或權限問題。

---

## 排查步驟

### 步驟 1：確認前端已部署

```bash
# 檢查最後部署時間
firebase hosting:channel:list

# 重新部署
cd /Users/danielkai/Desktop/admin
npm run build
firebase deploy --only hosting:admin

cd community-portal
npm run build
firebase deploy --only hosting:community-portal
```

### 步驟 2：檢查瀏覽器 Console

1. 打開 Admin 或 Community Portal
2. 按 F12 打開開發者工具
3. 切換到 Console 標籤
4. 刪除一個已綁定設備的長者
5. 觀察日誌輸出

**預期看到：**
```
Anonymizing activities for device device_xxx before elder deletion...
開始匿名化設備 device_xxx 的活動記錄...
✅ 設備 device_xxx: 已匿名化並刪除 XX 筆活動記錄
Archived XX activities for device device_xxx
Unbound device device_xxx from elder elder_xxx before deletion
```

**如果沒看到：**
- 前端沒有部署或快取未更新
- 按 Ctrl+Shift+R 強制重新整理頁面

**如果看到錯誤：**
- 記下錯誤訊息，根據上面的可能錯誤處理

### 步驟 3：檢查 Firestore

在 Firebase Console 中：

1. **檢查 anonymousActivities 集合**
   - 是否有新的記錄？
   - `anonymizedReason` 是否為 "ELDER_DELETION"？
   - 時間戳是否正確？

2. **檢查 devices/{deviceId}/activities**
   - 子集合是否仍有記錄？
   - 記錄的時間戳是什麼？
   - `bindingType` 是什麼？

### 步驟 4：手動執行清理

如果前端匿名化有問題，可以用後端腳本：

```bash
cd functions
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live
```

## 測試案例

### 測試 1：正常流程

```
1. 長者 elder_001 綁定設備 device_001
2. 設備產生 10 筆活動記錄
3. 刪除長者 elder_001
```

**預期結果：**
```javascript
// Firestore 前
devices/device_001/activities (10 筆記錄)

// Firestore 後
devices/device_001/activities (0 筆記錄) ✅
anonymousActivities (新增 10 筆記錄) ✅
```

### 測試 2：解綁後新活動

```
1. 長者 elder_001 綁定設備 device_001
2. 產生 5 筆活動記錄
3. 解綁設備（activities 被匿名化）
4. 設備繼續活動，產生 3 筆新記錄
```

**預期結果：**
```javascript
devices/device_001/activities
- 3 筆記錄 (bindingType: "UNBOUND", boundTo: null) ✅

anonymousActivities
- 新增 5 筆記錄 (bindingType: "ANONYMOUS") ✅
```

**說明：** 解綁後的新活動仍會記錄，但不與長者關聯。這是正常的！

## 常見誤解

### ❌ 誤解：activities 應該完全清空

**實際：** 
- 解綁時的舊記錄會被匿名化並刪除 ✅
- 解綁後的新記錄會繼續記錄（但不與長者關聯）✅

### ✅ 正確理解

activities 子集合的內容：
- **解綁前的記錄** → 匿名化到 anonymousActivities，原記錄刪除
- **解綁後的記錄** → 保留在 activities（bindingType: "UNBOUND"）

## 驗證方法

### 方法 1：時間戳檢查

1. 記下刪除長者的時間（例如 2026-01-26 10:30）
2. 檢查 `devices/{deviceId}/activities` 中剩餘記錄的時間戳
3. 如果都是 10:30 **之後**的記錄 → ✅ 正常（這是解綁後的新活動）
4. 如果有 10:30 **之前**的記錄 → ❌ 問題（應該被刪除）

### 方法 2：bindingType 檢查

檢查 `devices/{deviceId}/activities` 中剩餘記錄的 `bindingType`：
- 如果都是 `"UNBOUND"` → ✅ 正常（解綁後的新活動）
- 如果有 `"ELDER"` → ❌ 問題（應該被刪除）

### 方法 3：Count 對比

```javascript
// 刪除前記錄數量
devices/{deviceId}/activities: 100 筆

// 刪除後
anonymousActivities: 新增 100 筆 ✅
devices/{deviceId}/activities: 5 筆 (都是新的 UNBOUND 記錄) ✅
```

## 如果確實有問題

### 臨時解決方案

使用清理腳本手動處理：

```bash
cd functions
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live
```

這會：
1. 找出所有 `bindingType: "UNBOUND"` 的設備
2. 檢查是否有 activities
3. 匿名化並刪除

### 永久解決方案

如果前端匿名化持續失敗，可以：

**選項 1：** 改用 Cloud Function
- 前端調用 `unbindDeviceFromElder` API
- 後端處理匿名化（更可靠）

**選項 2：** 建立定期清理任務
- Cloud Scheduler 每天執行清理腳本
- 自動處理遺漏的記錄

## 快速診斷指令

```bash
# 1. 檢查是否有幽靈設備
cd functions
npx ts-node src/utils/cleanupGhostDeviceActivities.ts

# 2. 如果有問題，執行清理
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live

# 3. 檢查 Cloud Functions 日誌
firebase functions:log --only receiveBeaconData --limit 50
```

## 需要提供的資訊

如果問題持續，請提供：

1. **瀏覽器 Console 的完整日誌**
   - 匿名化相關的所有訊息
   - 錯誤訊息（如果有）

2. **Firestore 資料截圖**
   - 設備的 activities 子集合
   - 記錄的 `bindingType` 和 `timestamp`
   - anonymousActivities 集合是否有新記錄

3. **操作步驟**
   - 在哪個 Portal 操作？
   - 是解綁還是刪除？
   - 操作前設備有幾筆 activities？

這樣我可以更精確地診斷問題。

## 暫時的手動清理步驟

如果急需清理現有的幽靈記錄：

```bash
cd /Users/danielkai/Desktop/admin/functions

# 1. 先預覽
npx ts-node src/utils/cleanupGhostDeviceActivities.ts

# 2. 確認後執行
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live
```

輸出會顯示：
- 找到多少幽靈設備
- 每個設備有多少活動記錄
- 匿名化和刪除的進度

這是最可靠的清理方法！
