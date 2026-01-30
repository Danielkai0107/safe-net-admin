# LINE 按鈕樣式修正

## 🔧 問題與解決

### 問題

使用 `secondary` style 時，如果指定了 `color`，按鈕會變成該顏色的實心按鈕，而不是白底有色邊框。

### 解決方案

**移除 `color` 屬性**，讓 LINE 使用預設的 secondary 樣式（白底灰框）。

## 💻 代碼修改

### 修改前（錯誤）

```typescript
{
  type: "button",
  style: "secondary",
  color: "#999999",      // ← 這會讓按鈕變成灰色實心
  label: "店家資訊"
}
```

**結果**：灰色實心按鈕 ❌

### 修改後（正確）

```typescript
{
  type: "button",
  style: "secondary",
  // 移除 color 屬性
  label: "店家資訊"
}
```

**結果**：白底灰框按鈕 ✅

## 🎨 LINE Flex Message 按鈕樣式

### Primary（實心）

```typescript
{
  style: "primary",
  color: "#4ECDC4"
}
```

**效果**：

```
┌────────────────┐
│   查看地圖     │  ← 青綠色實心、白字
└────────────────┘
```

### Secondary（邊框）

```typescript
{
  style: "secondary";
  // 不要設定 color！
}
```

**效果**：

```
┌────────────────┐
│  店家資訊      │  ← 白底、灰框、灰字
└────────────────┘
```

### Secondary + Color（錯誤用法）

```typescript
{
  style: "secondary",
  color: "#999999"    // ← 錯誤！
}
```

**效果**：

```
┌────────────────┐
│  店家資訊      │  ← 灰色實心、白字（不是我們要的）
└────────────────┘
```

### Link（透明）

```typescript
{
  style: "link",
  color: "#999999"
}
```

**效果**：

```
  店家資訊          ← 透明背景、無邊框、灰字
```

## 📊 間距調整

### 商家優惠區塊間距

#### 修改前

```typescript
spacing: "md"; // 中等間距
```

#### 修改後

```typescript
spacing: "lg"; // 大間距
```

### 各元素間距對比

| 元素          | 修改前 | 修改後 | 說明             |
| ------------- | ------ | ------ | ---------------- |
| 區塊 spacing  | md     | lg     | 整體間距加大     |
| Banner margin | md     | lg     | 圖片間距加大     |
| 標題 margin   | md     | lg     | 標題間距加大     |
| 內容 margin   | sm     | md     | 內容間距保持適中 |
| 按鈕 margin   | md     | lg     | 按鈕間距加大     |

## 📱 視覺效果

### 修改前（間距小）

```
商家優惠
[Banner]      ← md 間距
春節特惠      ← md 間距
全店8折...    ← sm 間距
[店家資訊]    ← md 間距
```

### 修改後（間距大）

```
商家優惠

[Banner]      ← lg 間距（更大）

春節特惠      ← lg 間距（更大）

全店8折...    ← md 間距（適中）

[店家資訊]    ← lg 間距（更大）
```

## 🎯 改進優勢

### 1. 按鈕樣式正確

- ✅ 白底灰框（符合需求）
- ✅ 視覺層級清晰（主按鈕 vs 次按鈕）

### 2. 閱讀體驗提升

- ✅ 商家優惠區塊更寬鬆
- ✅ 元素之間不擁擠
- ✅ 更容易閱讀

### 3. 視覺呼吸感

- ✅ 適當的留白
- ✅ 不會看起來太緊湊
- ✅ 專業的視覺效果

## 📏 LINE Flex Message 間距規範

### 間距值對應

| 值  | 實際大小 | 用途     |
| --- | -------- | -------- |
| xs  | 極小     | 緊密排列 |
| sm  | 小       | 內容段落 |
| md  | 中       | 一般間距 |
| lg  | 大       | 區塊間距 |
| xl  | 極大     | 重要分隔 |
| xxl | 超大     | 明顯分隔 |

### 我們的使用

```typescript
{
  type: "box",
  spacing: "lg",      // ← 區塊內元素間距
  contents: [
    {
      type: "image",
      margin: "lg",   // ← 此元素的外邊距
    },
    {
      type: "text",
      margin: "lg",   // ← 此元素的外邊距
    },
    {
      type: "text",
      margin: "md",   // ← 此元素的外邊距
    }
  ]
}
```

## ✅ 修改總結

### 1. 店家資訊按鈕

```typescript
// 修改前
{
  style: "secondary",
  color: "#999999",    // ← 移除
}

// 修改後
{
  style: "secondary",
  // 不設定 color，使用預設的白底灰框
}
```

### 2. 商家優惠間距

```typescript
// 修改前
{
  spacing: "md",       // ← 中等間距
  contents: [
    { margin: "md" },  // Banner
    { margin: "md" },  // 標題
    { margin: "sm" },  // 內容
    { margin: "md" },  // 按鈕
  ]
}

// 修改後
{
  spacing: "lg",       // ← 大間距
  contents: [
    { margin: "lg" },  // Banner
    { margin: "lg" },  // 標題
    { margin: "md" },  // 內容
    { margin: "lg" },  // 按鈕
  ]
}
```

## 🎨 最終按鈕對比

### 主按鈕：查看地圖

```
┌──────────────────────┐
│    查看地圖          │  ← 青綠色實心、白字
└──────────────────────┘
style: "primary", color: "#4ECDC4"
```

### 次按鈕：店家資訊

```
┌──────────────────────┐
│    店家資訊          │  ← 白底、灰框、深灰字
└──────────────────────┘
style: "secondary" (無 color 屬性)
```

## 📝 修改的檔案

1. ✅ `functions/src/line/sendMessage.ts`
   - 移除店家資訊按鈕的 `color` 屬性
   - 商家優惠區塊 `spacing` 從 `md` 改為 `lg`
   - Banner `margin` 從 `md` 改為 `lg`
   - 標題 `margin` 從 `md` 改為 `lg`
   - 按鈕 `margin` 從 `md` 改為 `lg`

## ✅ 檢查清單

- [✅] 店家資訊按鈕：白底灰框（移除 color）
- [✅] 商家優惠區塊間距：md → lg
- [✅] Banner 間距：md → lg
- [✅] 標題間距：md → lg
- [✅] 按鈕間距：md → lg
- [✅] TypeScript 編譯通過
- [✅] Functions Build 成功

## 🚀 部署

```bash
cd functions
firebase deploy --only functions:receiveBeaconData
```

現在按鈕是正確的白底灰框，商家優惠區塊的間距也更舒適了！🎉
