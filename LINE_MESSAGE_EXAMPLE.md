# LINE 通知訊息範例 - 商家優惠

## 📱 訊息示例

### 範例 1：完整商家優惠訊息

```
┌───────────────────────────────────┐
│  ┌──────────────────────────┐    │
│  │                          │    │
│  │   [星巴克 Logo 正方形]   │    │  ← Hero Image (1:1)
│  │                          │    │
│  └──────────────────────────┘    │
├───────────────────────────────────┤
│                                   │
│  小明的手環 已經過                │  ← 粗體
│  星巴克信義店                     │  ← 特大、青綠色、粗體
│                                   │
│  ─────────────────────────        │
│                                   │
│  設備：小明的手環                 │
│  地點：星巴克信義店               │
│  時間：2026/01/29 14:30          │
│                                   │
│  ┌────────────────────────┐      │
│  │      查看地圖          │      │  ← 青綠色按鈕
│  └────────────────────────┘      │
│                                   │
│  ─────────────────────────        │  ← 分隔線
│                                   │
│  商家優惠                         │  ← 小標題（粗體）
│                                   │
│  ┌──────────────────────────┐    │
│  │  [優惠 Banner 3:1]       │    │  ← Banner 圖片
│  └──────────────────────────┘    │
│                                   │
│  聖誕限定飲品特惠                 │  ← 優惠標題（粗體）
│                                   │
│  購買任一聖誕飲品                 │  ← 優惠內容
│  即可獲得限定馬克杯一個           │
│  數量有限，送完為止               │
│                                   │
│  ┌────────────────────────┐      │
│  │   🔗 前往官網          │      │  ← 官網按鈕
│  └────────────────────────┘      │
│                                   │
│  此通知由您設定的通知點自動發送   │
│                                   │
└───────────────────────────────────┘
```

### 範例 2：商家但無 Logo

```
┌───────────────────────────────────┐
│  小明的手環 已經過                │
│  7-11光復門市                     │
│                                   │
│  ─────────────────────────        │
│                                   │
│  設備：小明的手環                 │
│  地點：7-11光復門市               │
│  時間：2026/01/29 14:30          │
│                                   │
│  ┌────────────────────────┐      │
│  │      查看地圖          │      │
│  └────────────────────────┘      │
│                                   │
│  ─────────────────────────        │
│                                   │
│  商家優惠                         │
│  集點活動進行中                   │
│  任何消費都可集點...              │
│                                   │
│  此通知由您設定的通知點自動發送   │
│                                   │
└───────────────────────────────────┘
```

### 範例 3：一般 Gateway（無商家優惠）

```
┌───────────────────────────────────┐
│  小明的手環 已經過                │
│  大安森林公園                     │
│                                   │
│  ─────────────────────────        │
│                                   │
│  設備：小明的手環                 │
│  地點：大安森林公園               │
│  時間：2026/01/29 14:30          │
│                                   │
│  ┌────────────────────────┐      │
│  │      查看地圖          │      │
│  └────────────────────────┘      │
│                                   │
│  此通知由您設定的通知點自動發送   │
│                                   │
└───────────────────────────────────┘
```

## 📊 訊息組成元素

### Hero Image（條件：isAD + storeLogo）

- **圖片來源**：`gateway.storeLogo`
- **比例**：1:1（正方形）
- **顯示**：填滿並裁切
- **用途**：店家品牌識別

### Body（基本資訊）

1. **主標題**：`{設備名稱} 已經過`
2. **地點名稱**：醒目顯示（青綠色、特大）
3. **詳細資訊**：設備、地點、時間

### Footer（操作區）

1. **查看地圖按鈕**：主要 CTA
2. **商家優惠區塊**（條件顯示）：
   - 分隔線
   - 「商家優惠」小標題
   - Banner 圖片（3:1）
   - 優惠標題
   - 優惠內容
   - 官網按鈕
3. **底部提示**：說明文字

## 🎨 視覺層級

```
重要性排序（從上到下）：
1. [Hero] 店家 Logo        ← 品牌識別
2. [Body] 主要通知資訊     ← 核心內容
3. [CTA] 查看地圖按鈕      ← 主要操作
4. [Bonus] 商家優惠        ← 附加價值
5. [Info] 底部說明         ← 輔助資訊
```

## 🔄 數據傳遞流程

```
Firestore Gateway Document
{
  isAD: true,
  storeLogo: "https://...",
  imageLink: "https://...",
  activityTitle: "春節特惠",
  activityContent: "全店8折...",
  websiteLink: "https://..."
}
  ↓
receiveBeaconData.ts
傳遞所有商家欄位給通知函數
  ↓
sendNotificationPointAlert()
根據資料構建 Flex Message
  ↓
LINE Messaging API
  ↓
用戶的 LINE App
顯示完整的商家優惠訊息
```

## ⚙️ 條件邏輯

### Hero Image 顯示條件

```typescript
const isStore = data.isAD && data.storeLogo;

if (isStore && data.storeLogo) {
  // 添加 hero 區塊
}
```

### 商家優惠區塊顯示條件

```typescript
if (data.isAD && (data.activityTitle || data.imageLink || data.websiteLink)) {
  // 添加商家優惠區塊
}
```

### 各元素顯示條件

- Banner 圖片：`data.imageLink` 存在
- 優惠標題：`data.activityTitle` 存在
- 優惠內容：`data.activityContent` 存在
- 官網按鈕：`data.websiteLink` 存在

## 📏 圖片規範

### storeLogo（Hero）

```json
{
  "type": "image",
  "url": "https://...",
  "size": "full", // 填滿寬度
  "aspectRatio": "1:1", // 正方形
  "aspectMode": "cover" // 裁切填滿
}
```

- **建議尺寸**：400x400 或更高
- **檔案大小**：< 1MB

### imageLink（Banner）

```json
{
  "type": "image",
  "url": "https://...",
  "size": "full", // 填滿寬度
  "aspectRatio": "3:1", // 橫向矩形
  "aspectMode": "cover", // 裁切填滿
  "margin": "md"
}
```

- **建議尺寸**：1200x400 或 3:1 比例
- **檔案大小**：< 1MB

## 🎯 用戶體驗流程

### 流程 1：經過一般商家（無優惠）

```
用戶經過 7-11
  ↓
收到 LINE 通知
  ↓
看到：
- 基本通知資訊
- 查看地圖按鈕
  ↓
點擊查看地圖（如需要）
```

### 流程 2：經過有優惠的商家

```
用戶經過星巴克（有聖誕優惠）
  ↓
收到 LINE 通知
  ↓
看到：
- ★ 星巴克 Logo（Hero）
- 基本通知資訊
- 查看地圖按鈕
- ─────────
- ★ 商家優惠區塊
  - Banner 圖片
  - 聖誕特惠標題
  - 優惠詳情
  - 官網按鈕
  ↓
可能的操作：
1. 查看地圖（確認位置）
2. 前往官網（了解更多）
3. 直接到店消費（領取優惠）
```

## 💡 商業價值

### 1. 增加商家曝光

- 用戶經過商家時自動收到優惠資訊
- Logo 和 Banner 增強品牌印象
- 不需要主動搜尋就能獲得優惠資訊

### 2. 提升轉換率

- 優惠內容直接呈現在通知中
- 降低用戶行動門檻
- 即時性強（剛好在店家附近）

### 3. 定位行銷

- 基於位置的精準推播
- 用戶就在商家附近，轉換率高
- LBS（Location-Based Service）應用

### 4. 數據收集

可追蹤：

- 通知發送次數
- 官網連結點擊率
- 地圖查看率
- 優惠訊息轉換率

## 🧪 測試建議

### 測試案例 1：完整商家資訊

```javascript
設定通知點：星巴克信義店
商家資訊：
- storeLogo: "https://.../logo.png"
- imageLink: "https://.../banner.jpg"
- activityTitle: "聖誕特惠"
- activityContent: "購買飲品送馬克杯"
- websiteLink: "https://starbucks.com"

測試步驟：
1. 帶著綁定的設備經過星巴克
2. 檢查 LINE 是否收到通知
3. 確認訊息包含：
   - Hero: Logo 圖片
   - Body: 基本資訊
   - 查看地圖按鈕
   - 商家優惠區塊（完整）
```

### 測試案例 2：只有部分資訊

```javascript
設定通知點：便利商店
商家資訊：
- storeLogo: null
- imageLink: null
- activityTitle: "集點活動"
- activityContent: "消費集點..."
- websiteLink: null

預期結果：
❌ Hero: 無
✅ Body: 基本資訊
✅ 查看地圖按鈕
✅ 商家優惠：
   - 小標題
   - 優惠標題
   - 優惠內容
   ❌ Banner: 無
   ❌ 官網: 無
```

### 測試案例 3：一般 Gateway

```javascript
設定通知點：大安公園
Gateway 資訊：
- isAD: false

預期結果：
❌ Hero: 無
✅ Body: 基本資訊
✅ 查看地圖按鈕
❌ 商家優惠區塊: 無
```

## 📝 修改的檔案

1. ✅ `functions/src/beacon/receiveBeaconData.ts`
   - 更新 GatewayInfo interface
   - 傳遞商家資訊到通知函數

2. ✅ `functions/src/line/sendMessage.ts`
   - 更新 NotificationPointData interface
   - 修改 sendNotificationPointAlert 函數
   - 添加 Hero Image
   - 添加商家優惠區塊

3. ✅ `LINE_NOTIFICATION_STORE_PROMOTION.md`
   - 完整功能說明

4. ✅ `LINE_MESSAGE_EXAMPLE.md`
   - 訊息範例（本文件）

## ✅ 檢查結果

- ✅ TypeScript 類型定義完整
- ✅ Functions Build 成功
- ✅ Admin Build 成功
- ✅ 無編譯錯誤
- ⏳ 實際通知測試（待部署後測試）

## 🚀 部署步驟

### 1. 部署 Functions

```bash
cd functions
firebase deploy --only functions:receiveBeaconData
```

### 2. 測試流程

1. 在 Admin 後台設定一個測試商家：
   - 啟用 isAD
   - 上傳 storeLogo
   - 上傳 imageLink
   - 填寫 activityTitle 和 activityContent
   - 填寫 websiteLink

2. 在 LIFF App 中：
   - 綁定測試設備
   - 設定該商家為通知點

3. 觸發通知：
   - 實際經過商家（或模擬訊號）
   - 檢查 LINE 是否收到通知
   - 確認訊息格式正確

4. 驗證功能：
   - Hero Image 是否顯示
   - 商家優惠區塊是否正確
   - Banner 比例是否正確（3:1）
   - 按鈕是否可點擊
   - 連結是否正確

### 3. 監控日誌

```bash
firebase functions:log --only receiveBeaconData
```

查找：

- `✓ Sent LINE notification to ...`
- 檢查是否有錯誤

## 💡 實際使用案例

### 案例：咖啡店優惠通知

```
用戶：小明
設備：AirTag（已綁定）
設定：星巴克信義店為通知點

場景：
1. 小明帶著 AirTag 經過星巴克
2. Gateway 接收到訊號
3. 系統檢查：
   - 是通知點 ✓
   - 3分鐘冷卻已過 ✓
4. 發送 LINE 通知給小明
5. 小明收到通知：
   - 看到星巴克 Logo
   - 看到「聖誕限定飲品」優惠
   - 看到精美的活動 Banner
   - 點擊「前往官網」了解更多
6. 小明決定進店消費

轉換成功！✨
```

## 🎉 最終效果

現在 BU_type = "safe" 的 LINE 通知訊息：

- ✅ 商家 Logo 顯示在最上方（Hero）
- ✅ 基本通知資訊（設備經過地點）
- ✅ 查看地圖按鈕（主要操作）
- ✅ 商家優惠完整資訊（與地圖彈窗一致）
- ✅ 官網連結（方便查看更多）

用戶體驗大幅提升！🎊
