# LINE 訊息重新設計 - 商家優惠版本

## 📋 設計變更

### 1. Hero 區域：3:1 Banner 圖片

- **修改前**：店家 Logo (1:1)
- **修改後**：店家 Banner (3:1)
- **用途**：更醒目的視覺展示，立即吸引注意

### 2. 標題區域：Logo + 店家名稱

- **修改前**：純文字標題
- **修改後**：左側 Logo + 右側店家名稱（location）
- **用途**：品牌識別 + 地點資訊

### 3. 官網按鈕優化

- **修改前**：🔗 前往官網（link style）
- **修改後**：店家資訊（secondary style，灰色）
- **用途**：更統一的視覺風格

## 📱 新的訊息結構

### 商家完整版

```
┌─────────────────────────────────────┐
│  ┌────────────────────────────┐    │
│  │    [Banner 圖片 3:1]       │    │  ← Hero: imageLink
│  └────────────────────────────┘    │
├─────────────────────────────────────┤
│                                     │
│  [🏪]  星巴克信義店                │  ← Logo + 店家名稱（location）
│   48x48                             │
│                                     │
│  ───────────────────                │
│                                     │
│  設備：小明的手環                   │
│  地點：星巴克信義店                 │
│  時間：2026/01/29 14:30            │
│                                     │
│  ┌──────────────────────────┐      │
│  │        查看地圖          │      │  ← 青綠色主按鈕
│  └──────────────────────────┘      │
│                                     │
│  ───────────────────                │  ← 分隔線
│                                     │
│  商家優惠                           │
│  春節特惠活動                       │
│  全店商品 8 折優惠...              │
│                                     │
│  ┌──────────────────────────┐      │
│  │      店家資訊            │      │  ← 灰色 outline 按鈕
│  └──────────────────────────┘      │
│                                     │
│  此通知由您設定的通知點自動發送     │
│                                     │
└─────────────────────────────────────┘
```

### 一般 Gateway 版本（無商家資訊）

```
┌─────────────────────────────────────┐
│  小明的手環 已經過                  │
│  大安森林公園                       │
│                                     │
│  ───────────────────                │
│                                     │
│  設備：小明的手環                   │
│  地點：大安森林公園                 │
│  時間：2026/01/29 14:30            │
│                                     │
│  ┌──────────────────────────┐      │
│  │        查看地圖          │      │
│  └──────────────────────────┘      │
│                                     │
│  此通知由您設定的通知點自動發送     │
│                                     │
└─────────────────────────────────────┘
```

## 💻 代碼實現

### 1. Hero 改為 3:1 Banner

```typescript
const isStore = data.isAD === true;

// Hero: 3:1 Banner 圖片
...(isStore && data.imageLink
  ? {
      hero: {
        type: "image",
        url: data.imageLink,      // ← 使用 imageLink
        size: "full",
        aspectRatio: "3:1",       // ← 改為 3:1
        aspectMode: "cover",
      },
    }
  : {}),
```

### 2. Body 標題：Logo + 店家名稱

```typescript
// 商家標題：Logo + 店家名稱
...(isStore && data.storeLogo
  ? [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          // Logo
          {
            type: "image",
            url: data.storeLogo,
            size: "xs",              // 小尺寸（約 48px）
            aspectRatio: "1:1",      // 正方形
            aspectMode: "cover",
            flex: 0,                 // 不伸縮
          },
          // 店家名稱
          {
            type: "text",
            text: data.gatewayName,  // location
            size: "xl",
            weight: "bold",
            wrap: true,
            gravity: "center",       // 垂直置中
            margin: "md",
          },
        ],
        spacing: "md",
      },
    ]
  : [
      // 一般 Gateway 標題（保持原樣）
      {
        type: "text",
        text: `${deviceName} 已經過`,
        weight: "bold",
        size: "md",
      },
      {
        type: "text",
        text: data.gatewayName,
        size: "xl",
        color: "#4ECDC4",
        weight: "bold",
      },
    ]),
```

### 3. 官網按鈕改為灰色 Outline

```typescript
// 官網連結按鈕
...(data.websiteLink
  ? [
      {
        type: "button",
        style: "secondary",      // ← 改為 secondary（outline）
        color: "#999999",        // ← 灰色
        action: {
          type: "uri",
          label: "店家資訊",     // ← 移除 emoji
          uri: data.websiteLink,
        },
        margin: "md",
      },
    ]
  : []),
```

### 4. 使用 location 而非 name

```typescript
// 在 receiveBeaconData.ts
gatewayName: gateway.location || gateway.name || "通知點",
```

## 🎨 設計理念

### 視覺層級優化

#### 修改前

```
1. Hero: Logo 1:1（正方形）
   ↓ 不夠吸引人
2. 標題：純文字
   ↓ 缺少品牌識別
3. 按鈕：前往官網（link style）
   ↓ 不夠明顯
```

#### 修改後

```
1. Hero: Banner 3:1（橫向）
   ↓ 更醒目，立即抓住注意力
2. 標題：Logo + 店名
   ↓ 品牌識別清晰
3. 按鈕：店家資訊（outline style）
   ↓ 視覺層級更清晰
```

### 顏色系統

| 元素               | 顏色           | 用途       |
| ------------------ | -------------- | ---------- |
| Hero Banner        | -              | 商家宣傳圖 |
| 主按鈕（查看地圖） | #4ECDC4 青綠色 | 主要操作   |
| 次按鈕（店家資訊） | #999999 灰色   | 次要操作   |
| 標題文字           | 預設黑色       | 強調重要性 |
| 說明文字           | #666666 灰色   | 輔助資訊   |

### 按鈕層級

#### Primary（主按鈕）

```typescript
{
  style: "primary",
  color: "#4ECDC4",
  label: "查看地圖"
}
```

- 最重要的操作
- 醒目的青綠色
- 實心按鈕

#### Secondary（次按鈕）

```typescript
{
  style: "secondary",
  color: "#999999",
  label: "店家資訊"
}
```

- 次要操作
- 低調的灰色
- Outline 按鈕

## 📊 不同情境的訊息

### 情境 A：完整商家（有 Banner）

```
┌──────────────────────────┐
│ [Banner 3:1]             │  ← imageLink
└──────────────────────────┘
[Logo] 星巴克信義店          ← storeLogo + location
───────────
設備、地點、時間
[查看地圖]                   ← 青綠色
───────────
商家優惠
春節特惠活動
全店商品 8 折
[店家資訊]                   ← 灰色 outline
```

### 情境 B：商家但無 Banner

```
[Logo] 7-11光復門市          ← storeLogo + location（無 Hero）
───────────
設備、地點、時間
[查看地圖]
───────────
商家優惠
集點活動
[店家資訊]
```

### 情境 C：商家但無 Logo

```
┌──────────────────────────┐
│ [Banner 3:1]             │  ← imageLink（有 Hero）
└──────────────────────────┘
全家便利商店                  ← 純文字標題（無 Logo）
───────────
設備、地點、時間
[查看地圖]
───────────
商家優惠
新品上市
```

### 情境 D：一般 Gateway

```
您的設備 已經過              ← 原始標題格式
大安森林公園
───────────
設備、地點、時間
[查看地圖]
（無商家優惠區塊）
```

## 🎯 設計優勢

### 1. Hero 使用 Banner 的優勢

- ✅ 3:1 橫向比例更適合展示活動內容
- ✅ 視覺衝擊力更強
- ✅ 可以放置文字和圖片組合
- ✅ 與 LIFF 地圖彈窗的 Banner 一致

### 2. 標題加入 Logo 的優勢

- ✅ 品牌識別更清晰
- ✅ Logo 和店名一起出現，關聯性強
- ✅ 48x48 大小適中，不會太小也不會太大

### 3. 按鈕樣式改進

- ✅ 主次關係清晰（查看地圖 > 店家資訊）
- ✅ 灰色 outline 不搶主按鈕風采
- ✅ 移除 emoji 更專業

## 📏 尺寸規範

### Hero Banner

- **比例**：3:1
- **寬度**：填滿
- **高度**：自動（根據 3:1 計算）
- **裁切**：cover（保持比例，裁切超出部分）

### Logo（標題中）

- **尺寸**：xs（約 48x48）
- **比例**：1:1
- **位置**：標題左側
- **間距**：md

## 🔄 圖片使用邏輯

### Banner（Hero）

```
優先級：高
用途：吸引注意力
條件：isAD && imageLink
位置：最上方
```

### Logo（標題中）

```
優先級：中
用途：品牌識別
條件：isAD && storeLogo
位置：標題左側
```

### 組合情況

| Banner | Logo  | 效果                  |
| ------ | ----- | --------------------- |
| ✅ 有  | ✅ 有 | 完整版（最佳）        |
| ✅ 有  | ❌ 無 | 有 Hero 但標題無 Logo |
| ❌ 無  | ✅ 有 | 無 Hero 但標題有 Logo |
| ❌ 無  | ❌ 無 | 一般版（純文字）      |

## 📝 修改的檔案

### 1. functions/src/line/sendMessage.ts

- ✅ Hero 改為 imageLink (3:1)
- ✅ Body 標題加入 Logo
- ✅ 條件渲染邏輯
- ✅ 官網按鈕改為「店家資訊」
- ✅ 按鈕樣式改為 secondary（灰色 outline）

### 2. functions/src/beacon/receiveBeaconData.ts

- ✅ gatewayName 改用 location 優先

## 🎨 按鈕樣式對比

### Primary（主按鈕）

```
┌──────────────────────┐
│    查看地圖          │  ← 實心，青綠色
└──────────────────────┘
```

### Secondary（次按鈕）

```
┌──────────────────────┐
│    店家資訊          │  ← Outline，灰色邊框
└──────────────────────┘
```

### Link（已移除）

```
🔗 前往官網              ← 純文字連結（已不使用）
```

## 🔍 技術細節

### Flex Message 結構

```typescript
{
  type: "bubble",

  // Hero: Banner 3:1（條件顯示）
  hero: {
    type: "image",
    url: data.imageLink,
    aspectRatio: "3:1",
  },

  // Body: Logo + 標題 + 資訊
  body: {
    contents: [
      // 如果是商家且有 Logo
      {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "image", url: storeLogo, size: "xs" },
          { type: "text", text: location, size: "xl" }
        ]
      },
      // 或一般標題
      { type: "text", text: "已經過" },
      { type: "text", text: location },

      // 分隔線 + 詳細資訊
      { type: "separator" },
      // 設備、地點、時間
    ]
  },

  // Footer: 按鈕 + 商家優惠
  footer: {
    contents: [
      // 主按鈕：查看地圖
      { type: "button", style: "primary" },

      // 商家優惠區塊
      { type: "separator" },
      { type: "text", text: "商家優惠" },
      { type: "text", text: activityTitle },
      { type: "text", text: activityContent },

      // 次按鈕：店家資訊
      { type: "button", style: "secondary", color: "#999999" },

      // 底部提示
      { type: "text", text: "此通知由..." }
    ]
  }
}
```

## 📊 視覺對比

### 修改前的問題

```
[Logo 1:1]               ← Hero 太小，浪費空間
您的設備 已經過
星巴克信義店             ← 純文字，缺少品牌識別
...
🔗 前往官網              ← emoji 不專業
```

### 修改後的優勢

```
[Banner 3:1]             ← Hero 更大更醒目
[Logo] 星巴克信義店      ← Logo + 店名，品牌清晰
...
[店家資訊]               ← 專業，清晰
```

## 🎯 用戶體驗改善

### 1. 第一印象

- **修改前**：看到 Logo（1:1），不太醒目
- **修改後**：看到 Banner（3:1），立即吸引注意

### 2. 品牌識別

- **修改前**：Hero 是 Logo，但標題沒有 Logo
- **修改後**：Hero 是 Banner，標題有 Logo，更一致

### 3. 操作清晰

- **修改前**：兩個按鈕都是藍色系，難以區分主次
- **修改後**：青綠色主按鈕 + 灰色次按鈕，層級清晰

### 4. 專業度

- **修改前**：「🔗 前往官網」有 emoji，較不正式
- **修改後**：「店家資訊」無 emoji，更專業

## 📱 實際範例

### 星巴克聖誕活動

```
Alt Text: 通知點警報：星巴克信義店

┌─────────────────────────────────┐
│ [聖誕飲品活動 Banner 3:1]      │  ← 紅綠色主視覺
├─────────────────────────────────┤
│ [星巴克Logo] 星巴克信義店       │
│ ─────────────────              │
│ 設備：小明的手環                │
│ 地點：星巴克信義店              │
│ 時間：2026/01/29 14:30         │
│ [查看地圖] 青綠色               │
│ ─────────────────              │
│ 商家優惠                        │
│ 聖誕限定飲品                    │
│ 購買任一聖誕飲品送馬克杯        │
│ [店家資訊] 灰色                 │
│ 此通知由您設定的通知點自動發送  │
└─────────────────────────────────┘
```

### 7-11 集點活動

```
┌─────────────────────────────────┐
│ [集點卡 Banner 3:1]             │
├─────────────────────────────────┤
│ [7-11Logo] 7-11光復門市         │
│ ─────────────────              │
│ 設備：您的設備                  │
│ 地點：7-11光復門市              │
│ 時間：2026/01/29 15:00         │
│ [查看地圖]                      │
│ ─────────────────              │
│ 商家優惠                        │
│ 集點送好禮                      │
│ 消費滿額即可集點...            │
│ [店家資訊]                      │
│ 此通知由您設定的通知點自動發送  │
└─────────────────────────────────┘
```

## ✅ 檢查清單

- [✅] Hero 改為 imageLink (3:1)
- [✅] 標題加入 Logo 圖片
- [✅] 使用 location 而非 name
- [✅] Logo 使用 horizontal box 排版
- [✅] Logo size 設為 xs（約 48px）
- [✅] 官網按鈕改為「店家資訊」
- [✅] 移除 emoji
- [✅] 按鈕改為 secondary style
- [✅] 按鈕顏色改為灰色
- [✅] TypeScript 編譯通過
- [✅] Functions Build 成功
- [⏳] 實際訊息測試（待部署測試）

## 🚀 部署步驟

### 1. 部署 Functions

```bash
cd functions
firebase deploy --only functions:receiveBeaconData
```

### 2. 測試通知

```
1. 在 Firestore 設定通知點
2. 觸發訊號
3. 檢查 LINE 訊息格式
4. 確認：
   - Hero 是 Banner (3:1)
   - 標題有 Logo
   - 按鈕是灰色的「店家資訊」
```

### 3. 驗證 Flex Message

- 使用 LINE Flex Simulator 驗證格式
- https://developers.line.biz/flex-simulator/

## 💡 設計思考

### 為什麼 Hero 用 Banner 而不是 Logo？

**Banner 的優勢**：

- 更大的展示空間（3:1 vs 1:1）
- 可以放置活動主視覺
- 更吸引注意力
- 商家可以在 Banner 上設計吸睛的圖片

**Logo 的作用**：

- 放在標題旁做品牌識別
- 不需要太大（48x48 剛好）
- 輔助作用

### 為什麼按鈕要分主次？

**視覺層級**：

- 查看地圖：主要功能（確認位置）
- 店家資訊：次要功能（了解更多）

**用戶行為**：

- 大部分用戶：查看地圖 → 確認位置
- 有興趣的用戶：店家資訊 → 深入了解

**引導邏輯**：

- 主按鈕醒目 → 引導主要操作
- 次按鈕低調 → 提供選項但不強迫

## 🎉 最終效果

現在 LINE 通知訊息：

- ✅ Hero 使用 3:1 Banner（更醒目）
- ✅ 標題左側顯示 Logo（品牌識別）
- ✅ 標題使用 location（描述性名稱）
- ✅ 「店家資訊」灰色 outline 按鈕（專業、清晰）
- ✅ 視覺層級更分明

商家優惠通知升級完成！🎊
