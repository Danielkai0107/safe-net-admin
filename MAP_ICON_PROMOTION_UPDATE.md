# 地圖商家優惠圖標更新

## 📋 功能說明

當商家有優惠活動時，地圖上的圖標會顯示為黃色的 campaign（活動/擴音器）圖標，方便用戶一眼識別有優惠的商家。

## 🎨 圖標變化

### 判斷條件

```typescript
gateway.isAD === true && gateway.activityTitle?.trim();
```

- `isAD` 必須為 `true`（商家）
- `activityTitle` 必須有內容（不能是空白或空字串）

### 修改前

所有商家都顯示相同的圖標（根據 type 決定顏色）：

```
星巴克（有優惠）    → 🌐 青綠色 (SAFE_ZONE)
全家（無優惠）      → 🌐 青綠色 (SAFE_ZONE)
```

### 修改後

有優惠的商家顯示黃色 campaign 圖標：

```
星巴克（有優惠）    → 📢 黃色 (Campaign)
全家（無優惠）      → 🌐 青綠色 (SAFE_ZONE)
```

## 💻 技術實現

### 1. 修改顏色判斷邏輯

```typescript
const getGatewayColor = (gateway: Gateway): string => {
  // 優先判斷：商家且有優惠活動
  if (gateway.isAD && gateway.activityTitle?.trim()) {
    return "#FFC107"; // 黃色
  }

  // 其次根據類型
  switch (gateway.type) {
    case "SAFE_ZONE":
      return "#4ECDC4"; // 青綠色
    case "SCHOOL_ZONE":
      return "#FF6A95"; // 粉紅色
    case "OBSERVE_ZONE":
      return "#00CCEA"; // 藍色
    case "INACTIVE":
      return "#C4C4C4"; // 灰色
    default:
      return "#4ECDC4";
  }
};
```

### 2. 修改圖標判斷邏輯

```typescript
const getGatewaySvgPath = (gateway: Gateway): string => {
  // 優先判斷：商家且有優惠活動
  if (gateway.isAD && gateway.activityTitle?.trim()) {
    // Material Symbols: campaign (擴音器/活動圖標)
    return '<path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" fill="white"/>';
  }

  // 根據類型選擇圖標
  switch (gateway.type) {
    case "SCHOOL_ZONE":
      return '<path d="M17 11V4c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1v3H4c-.55 0-1 .45-1 1v13c0 .55.45 1 1 1h7v-4h2v4h7c.55 0 1-.45 1-1V12c0-.55-.45-1-1-1h-3zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm4 4H9v-2h2v2zm0-4H9V9h2v2zm0-4H9V5h2v2zm4 8h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm4 12h-2v-2h2v2zm0-4h-2v-2h2v2z" fill="white"/>';
    default:
      return '<path d="M12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 2c0-3.31-2.69-6-6-6s-6 2.69-6 6c0 2.22 1.21 4.15 3 5.19l1-1.74c-1.19-.7-2-1.97-2-3.45 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.48-.81 2.75-2 3.45l1 1.74c1.79-1.04 3-2.97 3-5.19zM12 3C6.48 3 2 7.48 2 13c0 3.7 2.01 6.92 4.99 8.65l1-1.73C5.61 18.53 4 15.96 4 13c0-4.42 3.58-8 8-8s8 3.58 8 8c0 2.96-1.61 5.53-4 6.92l1 1.73c2.99-1.73 5-4.95 5-8.65 0-5.52-4.48-10-10-10z" fill="white"/>';
  }
};
```

### 3. 更新函數簽名

```typescript
// 修改前
const createGatewayIcon = (type: string) => { ... }

// 修改後
const createGatewayIcon = (gateway: Gateway) => { ... }
```

## 🎨 圖標顏色規範

| 狀態           | 顏色代碼  | 顏色名稱 | 圖標類型    | 條件                               |
| -------------- | --------- | -------- | ----------- | ---------------------------------- |
| **有優惠商家** | `#FFC107` | 黃色     | 📢 Campaign | `isAD=true` + `activityTitle` 有值 |
| 安全區         | `#4ECDC4` | 青綠色   | 🌐 Wifi     | `type=SAFE_ZONE`                   |
| 學區           | `#FF6A95` | 粉紅色   | 🏫 Building | `type=SCHOOL_ZONE`                 |
| 觀察區         | `#00CCEA` | 藍色     | 🌐 Wifi     | `type=OBSERVE_ZONE`                |
| 新建中         | `#C4C4C4` | 灰色     | 🌐 Wifi     | `type=INACTIVE`                    |

## 📍 地圖顯示效果

### 情境 A：有優惠的商家

```
Gateway 資料：
{
  isAD: true,
  activityTitle: "春節特惠活動",
  type: "SAFE_ZONE",
  ...
}

地圖圖標：
┌────────┐
│        │
│   📢   │  ← 黃色圓圈 + 擴音器圖標
│        │
└────────┘
```

### 情境 B：無優惠的商家

```
Gateway 資料：
{
  isAD: true,
  activityTitle: "",  // 空白
  type: "SAFE_ZONE",
  ...
}

地圖圖標：
┌────────┐
│        │
│   🌐   │  ← 青綠色圓圈 + Wifi 圖標
│        │
└────────┘
```

### 情境 C：商家但 activityTitle 為空白字串

```
Gateway 資料：
{
  isAD: true,
  activityTitle: "   ",  // 只有空白
  type: "SAFE_ZONE",
  ...
}

地圖圖標：
┌────────┐
│        │
│   🌐   │  ← 青綠色圓圈（.trim() 後為空）
│        │
└────────┘
```

### 情境 D：一般 Gateway

```
Gateway 資料：
{
  isAD: false,
  type: "SAFE_ZONE",
  ...
}

地圖圖標：
┌────────┐
│        │
│   🌐   │  ← 青綠色圓圈 + Wifi 圖標
│        │
└────────┘
```

## 🎯 優先級邏輯

圖標選擇優先級（由高到低）：

1. **商家有優惠**：`isAD=true` + `activityTitle` 有內容 → 📢 黃色 Campaign
2. **學區**：`type=SCHOOL_ZONE` → 🏫 粉紅色 Building
3. **其他**：根據 type 決定 → 🌐 對應顏色 Wifi

## 🔍 判斷邏輯詳解

### activityTitle 判斷

```typescript
gateway.activityTitle?.trim();
```

**為真的情況**：

- ✅ `"春節特惠活動"` → 有內容
- ✅ `"限時優惠"` → 有內容
- ✅ `"新品上市"` → 有內容

**為假的情況**：

- ❌ `undefined` → 沒有這個欄位
- ❌ `null` → 空值
- ❌ `""` → 空字串
- ❌ `"   "` → 只有空白（trim 後為空）

### 完整判斷

```typescript
if (gateway.isAD && gateway.activityTitle?.trim()) {
  // 兩個條件都必須滿足
  return "黃色 + Campaign 圖標";
}
```

## 📱 使用者體驗

### 視覺識別

用戶在地圖上可以：

1. **快速識別有優惠的商家**：黃色圖標特別醒目
2. **區分商家類型**：
   - 黃色 📢 = 有優惠活動
   - 其他顏色 = 一般商家或 Gateway
3. **優先查看優惠**：用戶會優先點擊黃色圖標

### 互動流程

```
用戶看到地圖
  ↓
發現黃色 📢 圖標
  ↓
點擊圖標
  ↓
彈窗顯示：
- 店家 Logo
- [⭐ 合作友善商家]
- 商家優惠區塊
  - Banner 圖片
  - 優惠標題
  - 優惠內容
  - 官網連結
```

## 🎨 圖標設計細節

### SVG 結構

```svg
<svg width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="18"
    fill="#FFC107"       <!-- 黃色背景 -->
    stroke="white"
    stroke-width="3"     <!-- 白色邊框 -->
  />
  <g transform="translate(8, 8)">
    <!-- Campaign 圖標路徑（白色） -->
    <path d="..." fill="white"/>
  </g>
</svg>
```

### 圖標尺寸

- **寬度**：40px
- **高度**：40px
- **圓圈半徑**：18px
- **邊框**：3px 白色
- **圖標**：24x24（居中）

### 顏色對比

```
背景：#FFC107 (黃色)
圖標：#FFFFFF (白色)
邊框：#FFFFFF (白色)

對比度：高（易於辨識）
```

## 📊 地圖圖標總覽

### 完整的圖標系統

| Gateway 類型    | 條件                             | 顏色              | 圖標        | 用途           |
| --------------- | -------------------------------- | ----------------- | ----------- | -------------- |
| 🎯 **優惠商家** | `isAD=true` + 有 `activityTitle` | 🟡 黃色 `#FFC107` | 📢 Campaign | 有活動的商家   |
| 🏪 **一般商家** | `isAD=true` + 無 `activityTitle` | 🔵 青綠 `#4ECDC4` | 🌐 Wifi     | 沒有活動的商家 |
| 🏫 **學區**     | `type=SCHOOL_ZONE`               | 🔴 粉紅 `#FF6A95` | 🏫 Building | 學校周邊       |
| 🛡️ **安全區**   | `type=SAFE_ZONE`                 | 🔵 青綠 `#4ECDC4` | 🌐 Wifi     | 安全區域       |
| 👁️ **觀察區**   | `type=OBSERVE_ZONE`              | 🔵 藍色 `#00CCEA` | 🌐 Wifi     | 觀察區域       |
| 🔧 **新建中**   | `type=INACTIVE`                  | ⚪ 灰色 `#C4C4C4` | 🌐 Wifi     | 建置中         |

## 🎯 視覺層級

優先級由高到低：

1. **黃色 📢**：最醒目，優先吸引注意
2. **粉紅 🏫**：次醒目，學區重要
3. **青綠/藍 🌐**：一般區域
4. **灰色 🌐**：最不醒目，新建中

## 🔄 動態更新

### 情境：商家新增優惠活動

```
1. 初始狀態（無優惠）
   圖標：🔵 青綠色 Wifi

2. 管理員在後台新增優惠活動
   填寫 activityTitle: "春節特惠"

3. Firestore 即時更新

4. 地圖重新渲染
   圖標：🟡 黃色 Campaign ✨
```

### 情境：優惠活動結束

```
1. 初始狀態（有優惠）
   圖標：🟡 黃色 Campaign

2. 管理員移除優惠活動
   清空 activityTitle

3. Firestore 即時更新

4. 地圖重新渲染
   圖標：🔵 青綠色 Wifi
```

## 📝 修改的檔案

### liff/src/hooks/useMapMarkers.ts

**修改內容**：

1. ✅ `getGatewayColor` - 參數從 `type: string` 改為 `gateway: Gateway`
2. ✅ 添加商家優惠判斷邏輯
3. ✅ `getGatewaySvgPath` - 參數從 `type: string` 改為 `gateway: Gateway`
4. ✅ 添加 Campaign 圖標 SVG path
5. ✅ `createGatewayIcon` - 參數從 `type: string` 改為 `gateway: Gateway`
6. ✅ 更新所有調用處（兩處）

## 🧪 測試建議

### 測試案例 1：有優惠的商家

```javascript
{
  id: "gw-001",
  isAD: true,
  activityTitle: "春節特惠活動",
  type: "SAFE_ZONE",
  latitude: 25.033,
  longitude: 121.565
}

預期結果：
- 圖標顏色：黃色
- 圖標形狀：Campaign（擴音器）
```

### 測試案例 2：無優惠的商家

```javascript
{
  id: "gw-002",
  isAD: true,
  activityTitle: "",  // 空白
  type: "SAFE_ZONE",
  latitude: 25.034,
  longitude: 121.566
}

預期結果：
- 圖標顏色：青綠色
- 圖標形狀：Wifi
```

### 測試案例 3：activityTitle 只有空白

```javascript
{
  id: "gw-003",
  isAD: true,
  activityTitle: "   ",  // 只有空白
  type: "SAFE_ZONE",
  latitude: 25.035,
  longitude: 121.567
}

預期結果：
- 圖標顏色：青綠色（trim 後為空）
- 圖標形狀：Wifi
```

### 測試案例 4：一般 Gateway

```javascript
{
  id: "gw-004",
  isAD: false,
  type: "SAFE_ZONE",
  latitude: 25.036,
  longitude: 121.568
}

預期結果：
- 圖標顏色：青綠色
- 圖標形狀：Wifi
```

### 測試案例 5：學區（優先級測試）

```javascript
{
  id: "gw-005",
  isAD: true,
  activityTitle: "課後輔導",
  type: "SCHOOL_ZONE",
  latitude: 25.037,
  longitude: 121.569
}

預期結果：
- 圖標顏色：黃色（商家優惠優先）
- 圖標形狀：Campaign
```

## 🎨 視覺對比圖

### 地圖上的顯示

```
        🟡           🔵          🔵
       📢          🌐         🌐
    星巴克        全家      7-11
   (有優惠)    (無優惠)   (一般)


        🔴          🔵
       🏫         🌐
     國小        公園
    (學區)    (安全區)
```

## ✨ 用戶價值

### 1. 快速識別優惠

- 黃色圖標在地圖上特別醒目
- 用戶一眼就能看到哪裡有優惠

### 2. 提升點擊率

- 醒目的顏色吸引用戶點擊
- 增加商家曝光度

### 3. 改善體驗

- 不需要逐個點擊查看
- 節省用戶時間

### 4. 商業價值

- 有活動的商家更容易被發現
- 促進商家參與度
- 提升平台活躍度

## 💡 未來擴展建議

### 1. 更多圖標變化

```typescript
// 限時優惠
if (isLimitedTimeOffer) {
  return "🔥 紅色 + 火焰圖標";
}

// 新商家
if (isNewStore) {
  return "🌟 紫色 + 星星圖標";
}

// 熱門商家
if (isPopular) {
  return "❤️ 紅色 + 愛心圖標";
}
```

### 2. 動畫效果

```typescript
// 脈動動畫
const pulseAnimation = {
  duration: 1000,
  easing: "ease-in-out",
  iterations: Infinity,
};
```

### 3. 圖標優先級

```typescript
const getIconPriority = (gateway: Gateway) => {
  if (gateway.isAD && gateway.activityTitle) return 1;
  if (gateway.type === "SCHOOL_ZONE") return 2;
  return 3;
};
```

### 4. 用戶偏好設定

```typescript
// 允許用戶自訂是否顯示優惠圖標
const showPromotionIcons = userSettings.showPromotionIcons ?? true;
```

## ✅ 檢查清單

- [✅] 修改 `getGatewayColor` 函數
- [✅] 修改 `getGatewaySvgPath` 函數
- [✅] 修改 `createGatewayIcon` 函數簽名
- [✅] 更新所有調用處（2處）
- [✅] 添加 Campaign 圖標 SVG
- [✅] 添加優惠判斷邏輯（trim）
- [✅] 無 TypeScript 錯誤
- [⏳] 地圖測試（待測試）
- [⏳] 不同情境測試（待測試）

## 🚀 部署後效果

用戶打開 LIFF 地圖時會看到：

- 🟡 黃色 📢 = 有優惠活動的商家（醒目！）
- 🔵 其他顏色 🌐/🏫 = 一般 Gateway 或商家

一眼就能找到有優惠的店家！🎉
