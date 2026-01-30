# LINE 通知訊息 - 最終結構設計

## 📱 完整訊息結構（商家版）

```
┌─────────────────────────────────────┐
│  ┌────────────────────────────┐    │
│  │  [Banner 圖片 3:1]         │    │  ← Hero: imageLink
│  └────────────────────────────┘    │
├─────────────────────────────────────┤
│                                     │
│  小明的手環 已經過                  │  ← 第一段：通知主旨
│  星巴克信義店                       │     (特大、青綠色、粗體)
│                                     │
│  ─────────────────────              │  ← 分隔線
│                                     │
│  [🏪]  星巴克信義店                │  ← Logo + 店名（僅商家）
│   48px                              │     (粗體、大字)
│                                     │
│  ─────────────────────              │  ← 分隔線
│                                     │
│  設備：小明的手環                   │  ← 詳細資訊
│  地點：星巴克信義店                 │
│  時間：2026/01/29 14:30            │
│                                     │
│  ┌──────────────────────────┐      │
│  │        查看地圖          │      │  ← 青綠色主按鈕
│  └──────────────────────────┘      │
│                                     │
│  ─────────────────────              │  ← 分隔線
│                                     │
│  商家優惠                           │  ← 商家優惠區塊
│  春節特惠活動                       │
│  全店商品 8 折優惠...              │
│                                     │
│  店家資訊                           │  ← 透明背景、灰色文字
│  (灰色文字連結)                    │
│                                     │
│  此通知由您設定的通知點自動發送     │
│                                     │
└─────────────────────────────────────┘
```

## 📊 訊息區塊說明

### 1️⃣ Hero（最上方）

**內容**：Banner 圖片 (3:1)
**條件**：`isAD && imageLink`

```typescript
hero: {
  type: "image",
  url: data.imageLink,
  aspectRatio: "3:1",
  aspectMode: "cover"
}
```

### 2️⃣ Body 第一段：通知主旨

**內容**：已通過 + 地點名稱
**顯示**：始終顯示

```typescript
{
  type: "text",
  text: `${deviceName} 已經過`,
  weight: "bold",
  size: "md"
},
{
  type: "text",
  text: data.gatewayName,  // location
  size: "xl",
  color: "#4ECDC4",
  weight: "bold"
}
```

### 3️⃣ 分隔線 #1

```typescript
{ type: "separator", margin: "lg" }
```

### 4️⃣ Body 第二段：Logo + 店名（商家專屬）

**內容**：Logo 圖片 + 店家名稱
**條件**：`isAD && storeLogo`

```typescript
{
  type: "box",
  layout: "horizontal",
  contents: [
    {
      type: "image",
      url: data.storeLogo,
      size: "xs",           // 約 48px
      aspectRatio: "1:1"
    },
    {
      type: "text",
      text: data.gatewayName,
      size: "lg",
      weight: "bold",
      gravity: "center"
    }
  ]
}
```

### 5️⃣ 分隔線 #2（商家才有）

**條件**：顯示了 Logo + 店名後才有

```typescript
{ type: "separator", margin: "lg" }
```

### 6️⃣ Body 第三段：詳細資訊

**內容**：設備、地點、時間
**顯示**：始終顯示

```typescript
設備：{deviceName}
地點：{gatewayName}
時間：{timestamp}
```

### 7️⃣ Footer：操作按鈕

**主按鈕**：查看地圖（青綠色）

```typescript
{
  type: "button",
  style: "primary",
  color: "#4ECDC4",
  label: "查看地圖"
}
```

### 8️⃣ Footer：商家優惠區塊（商家專屬）

**條件**：`isAD && (activityTitle || imageLink || websiteLink)`
**內容**：

- 分隔線
- 「商家優惠」小標題
- 優惠標題
- 優惠內容
- 店家資訊按鈕（透明背景、灰色）

```typescript
{
  type: "button",
  action: { label: "店家資訊", uri: websiteLink },
  height: "sm",
  style: "link",       // ← link style = 透明背景
  color: "#999999"     // ← 灰色文字
}
```

### 9️⃣ Footer：底部提示

**內容**：說明文字
**顯示**：始終顯示

```typescript
{
  type: "text",
  text: "此通知由您設定的通知點自動發送",
  size: "xs",
  color: "#999999"
}
```

## 🎨 按鈕樣式說明

### Primary（實心按鈕）

```
┌──────────────────────┐
│    查看地圖          │  ← 青綠色背景、白色文字
└──────────────────────┘
```

### Link（透明按鈕）

```
  店家資訊              ← 透明背景、灰色文字、無邊框
```

## 🔄 不同情境對比

### 情境 A：完整商家（有 Banner + Logo）

```
[Banner 3:1]              ← Hero
已通過 星巴克
─────────
[Logo] 星巴克信義店      ← 商家專屬區塊
─────────
設備、地點、時間
[查看地圖]
─────────
商家優惠...
店家資訊                  ← 透明背景
```

### 情境 B：商家（有 Logo 但無 Banner）

```
已通過 7-11               ← 無 Hero
─────────
[Logo] 7-11光復門市      ← 商家專屬區塊
─────────
設備、地點、時間
[查看地圖]
─────────
商家優惠...
店家資訊
```

### 情境 C：商家（有 Banner 但無 Logo）

```
[Banner 3:1]              ← Hero
已通過 全家便利商店
─────────                 ← 無商家專屬區塊（因為沒 Logo）
設備、地點、時間
[查看地圖]
─────────
商家優惠...
店家資訊
```

### 情境 D：一般 Gateway

```
已通過 大安森林公園      ← 無 Hero
─────────                 ← 無商家專屬區塊
設備、地點、時間
[查看地圖]                ← 無商家優惠區塊
```

## 💻 關鍵代碼片段

### Logo + 店名區塊（條件渲染）

```typescript
// 分隔線之後
{
  type: "separator",
  margin: "lg",
},

// 商家才顯示：Logo + 店名
...(isStore && data.storeLogo ? [
  {
    type: "box",
    layout: "horizontal",
    margin: "lg",
    spacing: "md",
    contents: [
      // Logo 圖片
      {
        type: "image",
        url: data.storeLogo,
        size: "xs",              // 48x48
        aspectRatio: "1:1",
        aspectMode: "cover",
        flex: 0,                 // 固定寬度
      },
      // 店家名稱
      {
        type: "text",
        text: data.gatewayName,  // location
        size: "lg",
        weight: "bold",
        wrap: true,
        gravity: "center",       // 垂直置中
      },
    ],
  },
  // 再一條分隔線
  {
    type: "separator",
    margin: "lg",
  },
] : []),

// 詳細資訊（設備、地點、時間）
{
  type: "box",
  layout: "vertical",
  contents: [...]
}
```

### 店家資訊按鈕（透明背景）

```typescript
{
  type: "button",
  action: {
    type: "uri",
    label: "店家資訊",      // 無 emoji
    uri: data.websiteLink,
  },
  height: "sm",
  style: "link",           // ← 透明背景
  color: "#999999",        // ← 灰色文字
  margin: "md",
}
```

## 🎯 設計邏輯

### 分隔線使用

```
已通過 location
─────────────── (分隔線 #1: 永遠顯示)
[商家專屬] Logo + 店名
─────────────── (分隔線 #2: 商家才有)
詳細資訊
```

**目的**：

- 分隔線 #1：區隔「通知主旨」和「詳細內容」
- 分隔線 #2：區隔「商家識別」和「詳細資訊」

### Logo 位置選擇

#### 為什麼不放在標題旁？

```
❌ 已通過 [Logo] 星巴克
   ↑ Logo 和「已通過」擠在一起，不美觀
```

#### 為什麼獨立一行？

```
✅ 已通過 星巴克
   ─────────
   [Logo] 星巴克信義店
   ↑ Logo 獨立顯示，更清晰
```

## 📏 視覺規範

### 文字大小

| 元素               | 尺寸 | 字重   |
| ------------------ | ---- | ------ |
| 已通過...          | md   | bold   |
| 地點名稱（第一次） | xl   | bold   |
| Logo + 店名        | lg   | bold   |
| 詳細資訊標籤       | sm   | normal |
| 詳細資訊內容       | sm   | normal |
| 優惠標題           | md   | bold   |
| 優惠內容           | sm   | normal |
| 底部提示           | xs   | normal |

### 間距

| 位置         | 間距 |
| ------------ | ---- |
| 地點名稱上方 | md   |
| 分隔線上下   | lg   |
| Logo + 店名  | lg   |
| 詳細資訊區   | lg   |
| 商家優惠區   | lg   |
| 按鈕之間     | sm   |

### 顏色

| 元素             | 顏色    |
| ---------------- | ------- |
| 地點名稱（醒目） | #4ECDC4 |
| 一般文字         | #111111 |
| 標籤文字         | #999999 |
| 內容文字         | #666666 |
| 主按鈕           | #4ECDC4 |
| 次按鈕文字       | #999999 |

## 🔍 結構對比

### 舊結構（之前）

```
Hero: Logo 1:1
─────────
已通過 location
─────────
設備、地點、時間
[查看地圖]
商家優惠...
🔗 前往官網
```

### 新結構（現在）

```
Hero: Banner 3:1          ← 更醒目
─────────
已通過 location           ← 清晰的通知主旨
─────────
[Logo] 店名               ← 獨立的商家識別區
─────────
設備、地點、時間          ← 詳細資訊
[查看地圖]                ← 主操作
─────────
商家優惠...               ← 優惠內容
店家資訊                  ← 透明背景、專業
```

## ✨ 改進重點

### 1. 結構更清晰

- ✅ 通知主旨（已通過）
- ✅ 商家識別（Logo + 店名）
- ✅ 詳細資訊
- ✅ 操作區
- ✅ 優惠區

### 2. 視覺更吸引

- ✅ Hero 用 3:1 Banner（更大）
- ✅ Logo 獨立顯示（更清晰）

### 3. 操作更明確

- ✅ 主按鈕：實心青綠色
- ✅ 次按鈕：透明背景灰色

### 4. 更專業

- ✅ 移除 emoji
- ✅ 統一的視覺語言

## 🧪 測試案例

### 完整測試 JSON

```json
{
  "gatewayName": "星巴克信義店",
  "deviceNickname": "小明的手環",
  "latitude": 25.033,
  "longitude": 121.565,
  "timestamp": "2026-01-29T14:30:00.000Z",
  "isAD": true,
  "storeLogo": "https://example.com/starbucks-logo.png",
  "imageLink": "https://example.com/christmas-banner.jpg",
  "activityTitle": "聖誕限定飲品",
  "activityContent": "購買任一聖誕飲品即可獲得限定馬克杯",
  "websiteLink": "https://www.starbucks.com.tw"
}
```

### 預期顯示

```
[Hero] 聖誕活動 Banner (3:1)
已通過 星巴克信義店
─────────
[Logo 48x48] 星巴克信義店
─────────
設備：小明的手環
地點：星巴克信義店
時間：2026/01/29 14:30
[查看地圖] 青綠色
─────────
商家優惠
聖誕限定飲品
購買任一聖誕飲品...
店家資訊 (透明、灰色)
此通知由您設定的通知點自動發送
```

## 📝 修改總結

### 檔案變更

1. ✅ `functions/src/line/sendMessage.ts`
   - Hero 改為 imageLink (3:1)
   - 調整 Body 結構順序
   - Logo + 店名獨立區塊
   - 店家資訊按鈕透明背景

2. ✅ `functions/src/beacon/receiveBeaconData.ts`
   - gatewayName 使用 location 優先
   - GatewayInfo 類型添加商家欄位

### 關鍵改動

| 項目         | 修改前      | 修改後                |
| ------------ | ----------- | --------------------- |
| Hero         | Logo (1:1)  | Banner (3:1)          |
| Logo 位置    | Hero        | 分隔線後獨立區塊      |
| 標題顯示     | 純文字      | 純文字（第一段）      |
| 店名顯示     | -           | Logo + 店名（第二段） |
| 官網按鈕文字 | 🔗 前往官網 | 店家資訊              |
| 官網按鈕樣式 | link        | link (透明)           |
| 按鈕背景     | 預設        | 透明                  |

## 🎨 Flex Message 類型說明

### Button Style 類型

#### Primary（實心）

```typescript
style: "primary";
color: "#4ECDC4";
```

效果：青綠色實心按鈕，白色文字

#### Secondary（邊框）

```typescript
style: "secondary";
color: "#999999";
```

效果：灰色邊框，灰色文字，白色背景

#### Link（透明）

```typescript
style: "link";
color: "#999999";
```

效果：**透明背景**，灰色文字，無邊框

## ✅ 完成檢查

- [✅] Hero 使用 Banner (3:1)
- [✅] 第一段：已通過 location
- [✅] 分隔線
- [✅] 第二段：Logo + 店名（商家專屬）
- [✅] 再一條分隔線（商家專屬）
- [✅] 第三段：詳細資訊
- [✅] 主按鈕：查看地圖（青綠色）
- [✅] 商家優惠區塊
- [✅] 次按鈕：店家資訊（透明背景、灰色）
- [✅] TypeScript 編譯通過
- [✅] Functions Build 成功

## 🚀 部署準備

### 部署指令

```bash
cd functions
firebase deploy --only functions:receiveBeaconData
```

### 測試清單

- [ ] 商家完整資訊（Banner + Logo + 優惠）
- [ ] 商家部分資訊（只有 Logo 或只有 Banner）
- [ ] 一般 Gateway（無商家資訊）
- [ ] Banner 圖片 3:1 比例正確
- [ ] Logo 圖片 1:1 比例正確
- [ ] 店家資訊按鈕透明背景
- [ ] 所有連結可點擊

## 🎉 設計完成

新的 LINE 訊息結構：

- ✅ Hero: 醒目的 3:1 Banner
- ✅ 清晰的訊息層級
- ✅ 獨立的商家識別區（Logo + 店名）
- ✅ 專業的按鈕設計（主次分明）
- ✅ 完整的商家優惠內容
- ✅ 透明背景的次要按鈕

準備好部署測試了！🚀
