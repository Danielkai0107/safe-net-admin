# LIFF 地圖商家優惠顯示功能

## 功能說明

在 LIFF 地圖頁面上，當用戶點擊 Gateway 標記並打開彈窗時，如果該 Gateway 的 `isAD` 為 `true`（行銷點），則會在彈窗中顯示商家優惠資訊。

## 實現內容

### 1. 彈窗標題與標籤優化

- **店家 Logo 顯示**：在標題下方內容區顯示圓形的店家頭像（使用 `storeLogo`）
  - 尺寸：32x32 像素
  - 樣式：圓形，帶邊框
  - 位置：名稱左側

- **合作友善商家標籤**：當 `isAD` 為 `true` 時顯示
  - 位置：Type Badge 旁邊
  - 顏色：綠色背景（#dcfce7），綠色文字（#16a34a）
  - 圖示：⭐ 星星圖標
  - 文字：「合作友善商家」

- **序號顯示調整**：移到內容最後
  - 樣式：灰色小字（12px，#9ca3af）
  - 位置：操作按鈕上方，獨立區塊
  - 格式：「接收點序號：g-XX-XX-XXXX」

### 2. 商家優惠區塊

在 type badge 下方添加分隔線後，顯示完整的商家優惠資訊：

#### 區塊結構

```
標題: 「商家優惠」（小標靠左）
  ↓
Banner 圖片（imageLink）
  - 寬度：填滿容器
  - 高度：自動（保持原始比例）
  - 圓角：8px
  ↓
優惠標題（activityTitle）
  - 字體大小：16px
  - 字重：600
  - 顏色：深灰色
  ↓
優惠內容（activityContent）
  - 字體大小：14px
  - 行高：1.6
  - 顏色：中灰色
  - 支持多行文字
  ↓
官網連結（websiteLink）
  - 藍色連結
  - 帶圖示
  - 在新視窗開啟
```

### 3. 顯示邏輯

- **條件**：`selectedGateway.isAD === true`
- **欄位處理**：所有欄位都是可選的，只顯示有值的欄位
- **分隔線**：在顯示商家優惠區塊前添加分隔線

## 修改的檔案

### 1. `/liff/src/screens/map/MapScreen.tsx`

- **位置**：Gateway Modal 內容區（約 line 1107-1200）
- **主要修改**：
  - 在 `info-row` 中添加店家 Logo 顯示
  - 在 `gateway-info` 後添加商家優惠區塊
  - 使用條件渲染（`{selectedGateway.isAD && ...}`）

### 2. `/liff/src/types/index.ts`

- **位置**：Gateway interface 定義（約 line 111-132）
- **添加欄位**：
  ```typescript
  isAD?: boolean;          // 是否為行銷點
  storeLogo?: string;      // 店家 Logo
  imageLink?: string;      // 店家圖片/Banner
  activityTitle?: string;  // 活動標題
  activityContent?: string; // 活動內容
  websiteLink?: string;    // 官網連結
  storePassword?: string;  // 商家密碼
  ```

## UI 設計詳情

### 店家 Logo

```css
width: 32px;
height: 32px;
border-radius: 50%;
object-fit: cover;
margin-right: 8px;
border: 2px solid #e5e7eb;
```

### 分隔線

```css
border-top: 1px solid #e5e7eb;
margin: 16px 0;
```

### 商家優惠小標

```css
font-size: 14px;
font-weight: 600;
color: #374151;
margin-bottom: 12px;
text-align: left;
```

### Banner 圖片容器

```css
width: 100%;
margin-bottom: 12px;
border-radius: 8px;
overflow: hidden;
```

### 優惠標題

```css
font-size: 16px;
font-weight: 600;
color: #111827;
margin-bottom: 8px;
text-align: left;
```

### 優惠內容

```css
font-size: 14px;
color: #6b7280;
line-height: 1.6;
text-align: left;
white-space: pre-wrap; /* 保留換行 */
```

### 官網連結

```css
display: inline-flex;
align-items: center;
margin-top: 12px;
color: #3b82f6;
font-size: 14px;
text-decoration: none;
```

## 使用情境

### 場景 1：一般 Gateway（isAD = false）

- 顯示標準的 Gateway 資訊
- 不顯示商家優惠區塊
- 只顯示通知點設置按鈕（如適用）

### 場景 2：商家 Gateway（isAD = true）

- 標題旁顯示店家 Logo
- 顯示 Gateway 基本資訊
- **分隔線**
- 顯示「商家優惠」區塊：
  - Banner 圖片（如有）
  - 優惠標題（如有）
  - 優惠內容（如有）
  - 官網連結（如有）
- 顯示通知點設置按鈕（如適用）

### 場景 3：部分資訊的商家

- 只顯示有值的欄位
- 例如：只有標題沒有內容，則只顯示標題
- 例如：沒有 Banner 圖片，則不顯示圖片區塊

## 資料來源

所有商家資訊都從 Firestore 的 `gateways` collection 獲取，欄位包括：

- `isAD`：布林值，標記是否為行銷點
- `storeLogo`：字串，店家 Logo 圖片 URL
- `imageLink`：字串，店家 Banner 圖片 URL
- `activityTitle`：字串，優惠活動標題
- `activityContent`：字串，優惠活動內容
- `websiteLink`：字串，官網連結

## 響應式設計

- **圖片寬度**：100% 填滿容器
- **圖片高度**：自動，保持原始比例
- **文字換行**：`white-space: pre-wrap` 支持多行文字和換行符
- **連結**：可點擊，在新視窗開啟

## 注意事項

1. **圖片加載**：
   - 建議使用適當尺寸的圖片（建議 Banner 尺寸：1200x400 或 3:1 比例）
   - 圖片應該優化過，避免載入時間過長

2. **文字長度**：
   - 優惠內容支持多行
   - 使用 `pre-wrap` 保留換行格式

3. **連結安全**：
   - 使用 `target="_blank"` 和 `rel="noopener noreferrer"`
   - 防止安全風險

4. **TypeScript 類型**：
   - 所有新增欄位都是可選的（使用 `?`）
   - 需要進行 null/undefined 檢查

## 未來可擴展功能

- [ ] 多張圖片輪播
- [ ] 優惠券功能
- [ ] 收藏商家功能
- [ ] 分享到 LINE
- [ ] 顯示營業時間
- [ ] 顯示聯絡電話
- [ ] 顯示距離資訊
- [ ] 導航到店家

## 測試建議

1. **基本顯示測試**：
   - 測試 isAD = false 的 Gateway（不顯示商家優惠）
   - 測試 isAD = true 且有完整資訊的 Gateway
   - 測試 isAD = true 但缺少部分資訊的 Gateway

2. **圖片測試**：
   - 測試不同尺寸的圖片
   - 測試圖片加載失敗的情況
   - 測試沒有圖片的情況

3. **連結測試**：
   - 測試官網連結是否正確開啟
   - 測試沒有官網連結的情況

4. **文字測試**：
   - 測試長文字內容的顯示
   - 測試包含換行的文字
   - 測試特殊字元

## 開發時間線

- ✅ 更新 Gateway 類型定義
- ✅ 修改 MapScreen 彈窗內容
- ✅ 添加店家 Logo 顯示
- ✅ 添加商家優惠區塊
- ✅ 樣式調整和優化
- ⏳ 測試和驗證（待開發環境測試）
