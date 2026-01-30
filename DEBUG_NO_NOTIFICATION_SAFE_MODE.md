# 診斷：Safe 模式未收到通知

## 🔍 問題描述

設備 major 0 minor 0 應該要發送通知到 safe LINE OA，但是沒有收到。

## 📊 日誌分析

### 關鍵日誌

```
Device 7KPBZfVMMYr8zyYdFolk belongs to tenant TRBWWmryGVfyLrURfxkh
Tenant TRBWWmryGVfyLrURfxkh BU_type: safe
Safe mode: checking notification points []          ← 空陣列！
Gateway gyJgRggT8qD0Dw4C4Wcl is not in notification points, no notification
```

### 診斷結果

✅ **正常的部分**：

- 設備已綁定
- 設備屬於 Tenant `TRBWWmryGVfyLrURfxkh`
- Tenant 的 `BU_type` 是 `"safe"`
- Gateway 接收到訊號

❌ **問題**：

- `inheritedNotificationPointIds` 是空陣列 `[]`
- Gateway `gyJgRggT8qD0Dw4C4Wcl` 不在通知點列表中
- 系統判斷為「不發送通知」（**這是正確的行為**）

## 🎯 根本原因

**Safe 模式的設計邏輯**：

```typescript
// Safe 模式必須檢查通知點
if (buType === "safe") {
  const notificationPointIds = deviceData.inheritedNotificationPointIds || [];

  // 只有在通知點列表中的 Gateway 才發送通知
  if (!notificationPointIds.includes(gateway.id)) {
    console.log("Gateway is not in notification points, no notification");
    return { triggered: false };
  }
}
```

**這不是 Bug，這是 Feature！**

Safe 模式的目的是：

- 避免過多通知
- 讓用戶自己選擇哪些地點要通知
- 例如：只在「學校大門」和「補習班門口」通知，其他地方不通知

## ✅ 解決方案

### 步驟 1：確認設備資訊

檢查 Firestore：

```
Collection: devices
Document: 7KPBZfVMMYr8zyYdFolk

查看欄位：
{
  "bindingType": "LINE_USER",
  "boundTo": "U...",  // LINE User ID
  "tags": ["TRBWWmryGVfyLrURfxkh"],
  "inheritedNotificationPointIds": []  ← 這裡是空的！
}
```

### 步驟 2：設定通知點

有三種方法：

#### 方法 A：使用 LIFF App（推薦）

1. **用 LINE 登入 LIFF App**
   - 使用綁定設備的 LINE 帳號
2. **打開地圖頁面**

3. **點擊要設為通知點的 Gateway**
   - 例如：麥味登 新店建國店

4. **在彈窗中點擊「設為通知點」按鈕**
   - 系統會調用 API：`addLineUserNotificationPoint`
   - 將 Gateway ID 加入 `inheritedNotificationPointIds`

5. **確認設定成功**
   - 彈窗會顯示成功訊息
   - 按鈕會變成「移除通知點」

#### 方法 B：手動修改 Firestore（測試用）

1. 前往 Firebase Console
2. 進入 `devices` collection
3. 找到設備：`7KPBZfVMMYr8zyYdFolk`
4. 點擊編輯
5. 添加/修改欄位：
   ```json
   {
     "inheritedNotificationPointIds": ["gyJgRggT8qD0Dw4C4Wcl"]
   }
   ```
6. 儲存

#### 方法 C：使用 Cloud Function API（程式化）

```bash
curl -X POST https://us-central1-safe-net-tw.cloudfunctions.net/addLineUserNotificationPoint \
  -H "Content-Type: application/json" \
  -d '{
    "lineUserId": "U...",
    "gatewayId": "gyJgRggT8qD0Dw4C4Wcl"
  }'
```

### 步驟 3：驗證設定

再次觸發訊號後，應該看到：

```
Safe mode: checking notification points ["gyJgRggT8qD0Dw4C4Wcl"]
Gateway gyJgRggT8qD0Dw4C4Wcl is in notification points, proceeding
✓ Sent LINE notification to U... via tenant TRBWWmryGVfyLrURfxkh
```

## 🔄 完整流程對比

### 目前的情況（沒有通知）

```
設備經過 Gateway
  ↓
系統檢查：通知點列表 = []
  ↓
判斷：Gateway 不在列表中
  ↓
結果：❌ 不發送通知
```

### 設定通知點後（會有通知）

```
設備經過 Gateway
  ↓
系統檢查：通知點列表 = ["gyJgRggT8qD0Dw4C4Wcl"]
  ↓
判斷：Gateway 在列表中 ✓
  ↓
檢查冷卻時間（3分鐘）✓
  ↓
結果：✅ 發送通知
```

## 📋 檢查清單

請檢查以下項目：

### 1. 設備是否已綁定？

```
✅ Device 7KPBZfVMMYr8zyYdFolk belongs to tenant TRBWWmryGVfyLrURfxkh
```

**結果**：✅ 已綁定

### 2. Tenant BU_type 是否為 safe？

```
✅ Tenant TRBWWmryGVfyLrURfxkh BU_type: safe
```

**結果**：✅ 是 safe

### 3. 是否設定了通知點？

```
❌ Safe mode: checking notification points []
```

**結果**：❌ 沒有設定（**這是問題所在**）

### 4. 是否在冷卻時間內？

```
不適用（因為根本沒有進入發送通知的邏輯）
```

## 🎯 為什麼需要設定通知點？

### Safe 模式 vs Card 模式

| 模式     | 檢查通知點  | 通知頻率     | 適用情境       |
| -------- | ----------- | ------------ | -------------- |
| **Card** | ❌ 不檢查   | 每次都通知   | 需要頻繁追蹤   |
| **Safe** | ✅ 必須檢查 | 只在指定地點 | 只關心特定地點 |

### Safe 模式的使用情境

**範例 1：家長追蹤孩子**

```
設定通知點：
- 學校大門 ✓
- 補習班門口 ✓

結果：
- 經過學校 → 發送通知 ✓
- 經過便利商店 → 不通知
- 經過補習班 → 發送通知 ✓
- 經過公園 → 不通知

優點：不會收到太多通知，只關心重要地點
```

**範例 2：長輩關懷**

```
設定通知點：
- 社區大門 ✓
- 醫院 ✓

結果：
- 出門/回家 → 發送通知 ✓
- 在附近散步 → 不通知
- 去醫院 → 發送通知 ✓
```

## 💡 如果要所有地方都通知怎麼辦？

### 選項 1：改用 Card 模式

將 Tenant 的 `BU_type` 從 `"safe"` 改為 `"card"`：

- Card 模式不檢查通知點
- 每次經過都通知（有 3 分鐘冷卻）

### 選項 2：設定多個通知點

在 LIFF App 中將所有重要的 Gateway 都設為通知點：

- 可以設定多個通知點
- 陣列會包含所有設定的 Gateway ID

### 選項 3：修改邏輯（不建議）

修改 Functions 代碼，讓 major 0 minor 0 的設備跳過通知點檢查：

```typescript
// 不建議這樣做，破壞了 safe 模式的設計
if (buType === "safe") {
  if (major === 0 && minor === 0) {
    // 特殊情況：跳過通知點檢查
  } else {
    // 正常檢查通知點
  }
}
```

## 📱 LIFF App 操作指南

### 如何設定通知點

#### 1. 打開 LIFF 地圖

```
https://liff.line.me/{LIFF_ID}/
```

#### 2. 確認綁定狀態

- 畫面下方應該顯示設備資訊
- 確認已綁定設備

#### 3. 設定通知點

```
地圖操作：
1. 點擊地圖上的 Gateway 圖標
   ↓
2. 彈窗出現，顯示 Gateway 資訊
   ↓
3. 點擊「設為通知點」按鈕
   ↓
4. 看到成功訊息
   ↓
5. 按鈕變成「移除通知點」
```

#### 4. 查看已設定的通知點

- 點擊畫面右上角的「通知點」按鈕
- 查看已設定的通知點列表

#### 5. 測試通知

- 設定完成後
- 實際經過該 Gateway（或模擬訊號）
- 應該會收到 LINE 通知

## 🔧 快速修復（測試用）

如果要立即測試，最快的方法是直接修改 Firestore：

### 使用 Firebase Console

```
1. 前往 https://console.firebase.google.com/project/safe-net-tw/firestore
2. 進入 devices collection
3. 找到 7KPBZfVMMYr8zyYdFolk
4. 添加欄位：
   {
     "inheritedNotificationPointIds": ["gyJgRggT8qD0Dw4C4Wcl"]
   }
5. 儲存
6. 再次觸發訊號
7. 檢查日誌，應該看到：
   "Gateway gyJgRggT8qD0Dw4C4Wcl is in notification points, proceeding"
   "✓ Sent LINE notification to ..."
```

## 📊 預期的日誌變化

### 設定前（目前）

```
Safe mode: checking notification points []
Gateway gyJgRggT8qD0Dw4C4Wcl is not in notification points, no notification
Recorded activity ... - notification: false
```

### 設定後（預期）

```
Safe mode: checking notification points ["gyJgRggT8qD0Dw4C4Wcl"]
Gateway gyJgRggT8qD0Dw4C4Wcl is in notification points, proceeding
✓ Sent LINE notification to U... via tenant TRBWWmryGVfyLrURfxkh (BU_type=safe)
Recorded activity ... - notification: true
```

## ❓ 常見問題

### Q1：為什麼 Safe 模式需要設定通知點？

**A**：這是設計上的考量，避免過多通知。如果每個地方都通知，用戶會覺得很煩。

### Q2：如果我想要所有地方都通知怎麼辦？

**A**：改用 Card 模式（`BU_type = "card"`），Card 模式不檢查通知點，每次都會通知。

### Q3：可以設定多少個通知點？

**A**：沒有限制，可以設定任意多個通知點。

### Q4：如何查看目前設定了哪些通知點？

**A**：

1. 在 LIFF App 中點擊「通知點」按鈕
2. 或在 Firestore 查看 device 的 `inheritedNotificationPointIds` 欄位
3. 或調用 API：`getLineUserNotificationPoints`

### Q5：通知點會同步嗎？

**A**：

- LINE_USER 的通知點儲存在 `devices` collection
- 透過 `inheritedNotificationPointIds` 欄位
- 即時生效，設定後立即可用

## 🔄 與 Group 模式的對比

### Group 模式（ELDER 設備）

從日誌可以看到：

```
Elder 王宗愷 passed through notification point 麥味登 新店建國店 (群發通知)
Sent notification point alert to member Ua5790e21ff9a5ff056a7f4ab44770d5a
Sent notification point alert to member Ua42b215d61908d4b506905c04801c4ac
Sent notification point alert to member U0706c065d8b73158b6142952255e0c57
```

**差異**：

- ELDER 設備使用 Group 模式
- 也檢查通知點
- 但是會群發給所有社區成員
- 同一個 Gateway，ELDER 有通知，LINE_USER 沒通知

**為什麼**：

- ELDER 的 `inheritedNotificationPointIds` 可能包含該 Gateway
- LINE_USER 的 `inheritedNotificationPointIds` 是空的

## 🎯 建議做法

### 情境 A：測試用途

**建議**：手動在 Firestore 添加通知點

- 快速、直接
- 適合開發和測試

### 情境 B：正式使用

**建議**：引導用戶在 LIFF App 中設定

- 符合產品設計
- 用戶自主控制
- 更好的用戶體驗

### 情境 C：需要所有地方都通知

**建議**：改用 Card 模式

- 修改 Tenant 的 `BU_type` 為 `"card"`
- 不需要設定通知點
- 每次經過都通知（3分鐘冷卻）

## 📝 操作步驟（推薦）

### 快速修復（用於測試）

**使用 Firebase Console**：

1. 前往 https://console.firebase.google.com/project/safe-net-tw/firestore
2. 點擊 `devices` collection
3. 搜尋或找到：`7KPBZfVMMYr8zyYdFolk`
4. 點擊文件進入編輯
5. 添加欄位：
   - 欄位名稱：`inheritedNotificationPointIds`
   - 類型：array
   - 值：`["gyJgRggT8qD0Dw4C4Wcl"]`
6. 點擊「更新」
7. 完成！

**預期結果**：
下次設備經過該 Gateway 時，就會發送 LINE 通知了。

### 驗證設定

觸發訊號後，查看日誌：

```bash
firebase functions:log --only receiveBeaconData
```

應該看到：

```
Safe mode: checking notification points ["gyJgRggT8qD0Dw4C4Wcl"]
Gateway gyJgRggT8qD0Dw4C4Wcl is in notification points, proceeding
✓ Sent LINE notification to U...
```

## 🎓 理解 Safe 模式

### 設計理念

```
Card 模式：
- 適合：需要知道所有行蹤（例如：物流追蹤）
- 特點：每個地方都通知
- 缺點：通知頻繁

Safe 模式：
- 適合：只關心特定地點（例如：到校/回家）
- 特點：只在指定地點通知
- 優點：通知精準、不打擾

Group 模式：
- 適合：社區關懷（例如：長輩照護）
- 特點：群發給所有成員
- 優點：團隊協作
```

### 使用場景

**Safe 模式最適合**：

- 家長追蹤孩子上下學
- 員工考勤（到公司/離開）
- 特定地點提醒（例如：吃藥提醒在醫院附近）

**不適合 Safe 模式**：

- 需要完整路徑追蹤
- 需要所有地點都通知
- 測試階段（不想設定通知點）

## 🚀 後續建議

### 1. 產品端

- 在 LIFF App 中添加「快速設定」功能
- 提供「推薦通知點」建議
- 添加設定引導流程

### 2. 開發端

- 在 Admin 後台顯示設備的通知點設定
- 提供批量設定通知點的功能
- 添加通知點測試工具

### 3. 文檔端

- 更新使用者手冊
- 添加視頻教學
- 常見問題 FAQ

## 📌 總結

**問題原因**：

```
Safe mode: checking notification points []
```

設備沒有設定任何通知點。

**解決方法**：

1. 在 LIFF App 點擊 Gateway → 設為通知點
2. 或手動在 Firestore 添加 `inheritedNotificationPointIds`
3. 或改用 Card 模式（不需要設定通知點）

**這不是 Bug**：

- Safe 模式的設計就是需要設定通知點
- 這是刻意的功能，不是錯誤
- 目的是減少不必要的通知

設定通知點後就可以正常收到通知了！✅
