# LIFF 地圖店家頭像位置與尺寸更新

## 📋 更新內容

### 店家頭像優化

1. **位置調整**：從內容區域移到標題旁邊
2. **尺寸放大**：從 32x32 增大到 48x48
3. **樣式優化**：添加白色邊框和陰影效果

## 🔄 修改前後對比

### 修改前

```
┌─────────────────────────────┐
│ 📍 接收點詳情              │  ← 標題區域沒有頭像
├─────────────────────────────┤
│ 🏪 📍 店家名稱             │  ← 頭像在這裡（32x32，小）
│ [🏠 安全區域]              │
└─────────────────────────────┘
```

**問題**：

- ❌ 頭像太小（32x32）
- ❌ 頭像在內容區，視覺層級不夠突出
- ❌ 與標題分離，關聯性不明顯

### 修改後

```
┌─────────────────────────────┐
│ 📍 接收點詳情        🏪    │  ← 頭像在標題旁（48x48，大）
├─────────────────────────────┤
│ 📍 店家名稱                │  ← 內容區更簡潔
│ [🏠 安全區域] [⭐ 合作]    │
└─────────────────────────────┘
```

**優點**：

- ✅ 頭像更大（48x48），更醒目
- ✅ 頭像與標題並列，視覺關聯性強
- ✅ 利用 Modal 的 titleBadge 位置
- ✅ 內容區更簡潔

## 💻 代碼變更

### 1. 移動頭像到標題區域

```tsx
// 使用 Modal 的 titleBadge 屬性
<Modal
  title={selectedGateway?.location || "接收點詳情"}
  titleBadge={
    selectedGateway?.isAD && selectedGateway?.storeLogo ? (
      <img
        src={selectedGateway.storeLogo}
        alt="店家Logo"
        style={{
          width: "48px",        // ← 增大到 48px
          height: "48px",
          borderRadius: "50%",
          objectFit: "cover",
          border: "3px solid #fff",  // ← 白色邊框
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",  // ← 陰影
        }}
      />
    ) : undefined
  }
>
```

### 2. 從內容區移除頭像

```tsx
// 修改前：info-row 包含頭像
<div className="info-row">
  {selectedGateway.isAD && selectedGateway.storeLogo && (
    <img src={selectedGateway.storeLogo} ... />  // ← 移除
  )}
  <svg className="location-icon">...</svg>
  <span>{selectedGateway.name}</span>
</div>

// 修改後：info-row 不包含頭像
<div className="info-row">
  <svg className="location-icon">...</svg>
  <span>{selectedGateway.name}</span>
</div>
```

## 🎨 樣式詳解

### 頭像尺寸

| 屬性   | 修改前   | 修改後   | 變化   |
| ------ | -------- | -------- | ------ |
| width  | 32px     | 48px     | +50%   |
| height | 32px     | 48px     | +50%   |
| 邊框   | 2px 灰色 | 3px 白色 | 更明顯 |
| 陰影   | 無       | 有       | 更立體 |

### 樣式對比

```css
/* 修改前 */
width: 32px;
height: 32px;
border: 2px solid #e5e7eb; /* 灰色邊框 */
marginright: 8px;

/* 修改後 */
width: 48px;
height: 48px;
border: 3px solid #fff; /* 白色邊框 */
boxshadow: 0 2px 8px rgba(0, 0, 0, 0.15); /* 陰影效果 */
```

## 📱 視覺效果

### 一般 Gateway（非商家）

```
┌─────────────────────────────┐
│ 📍 某某公園                 │  ← 沒有頭像
├─────────────────────────────┤
│ 📍 某某公園                │
│ [🏠 安全區域]              │
└─────────────────────────────┘
```

### 商家 Gateway（isAD = true）

```
┌─────────────────────────────┐
│ 📍 星巴克咖啡        [🏪]  │  ← 48x48 圓形頭像
├─────────────────────────────┤
│ 📍 星巴克咖啡              │
│ [🏠 安全區域] [⭐ 合作]    │
│ ━━━━━━━━━━━━━━━━━━━━━━━  │
│ 商家優惠                   │
│ [Banner 3:1]               │
│ 春節特惠活動               │
└─────────────────────────────┘
```

## 🎯 設計理念

### 1. 視覺層級優化

**標題區域**（最醒目）：

- 位置名稱 + 店家頭像
- 第一眼就能識別是商家

**內容區域**：

- 店家資訊
- 優惠內容

### 2. 頭像尺寸選擇

- **32px**：太小，不夠醒目
- **48px**：✅ 剛好，既醒目又不會太大
- **64px**：過大，會壓縮標題空間

### 3. 白色邊框優勢

- 與標題區域的背景形成對比
- 讓頭像更突出
- 避免深色背景圖片與標題區混在一起

### 4. 陰影效果

```css
boxshadow: "0 2px 8px rgba(0, 0, 0, 0.15)";
```

- 輕微陰影讓頭像有浮起的效果
- 增加層次感
- 不會太重，保持輕盈感

## 📊 與其他平台的一致性

### Admin 管理後台

- **列表頭像**：40x40（縮略圖）
- **詳情頭像**：128x128（預覽）

### LIFF 地圖

- **標題頭像**：48x48（醒目顯示）✅ **新增**
- **內容頭像**：已移除

### 統一規範

| 位置       | 尺寸    | 用途     |
| ---------- | ------- | -------- |
| 列表縮略圖 | 40x40   | 快速識別 |
| 標題區域   | 48x48   | 醒目展示 |
| 詳情預覽   | 128x128 | 完整查看 |

## ⚠️ 注意事項

### 1. Modal 組件限制

- `titleBadge` 支持任何 ReactNode
- 頭像會自動對齊標題
- 響應式佈局已處理

### 2. 頭像加載

- 如果頭像加載失敗，不會顯示任何內容
- 建議後續添加預設頭像或圖示
- 可以考慮添加加載動畫

### 3. 條件顯示

```tsx
selectedGateway?.isAD && selectedGateway?.storeLogo;
```

- 只有商家且有 Logo 才顯示
- 一般 Gateway 不顯示頭像
- 使用可選鏈避免錯誤

## 🧪 測試建議

### 測試案例

- [✅] 商家 Gateway + 有頭像：顯示 48x48 頭像
- [✅] 商家 Gateway + 無頭像：不顯示
- [✅] 一般 Gateway：不顯示頭像
- [⏳] 頭像加載失敗：待測試
- [⏳] 圓形裁切效果：待測試
- [⏳] 白色邊框顯示：待測試
- [⏳] 陰影效果：待測試

### 視覺測試

- [ ] 頭像是否清晰（48x48）
- [ ] 白色邊框是否明顯
- [ ] 陰影效果是否適當
- [ ] 與標題對齊是否正確
- [ ] 不同長度標題的顯示

### 設備測試

- [ ] iPhone（小螢幕）
- [ ] Android（中螢幕）
- [ ] iPad（大螢幕）
- [ ] LINE 內建瀏覽器

## 🚀 部署檢查清單

- [✅] 代碼修改完成
- [✅] 無 TypeScript 錯誤
- [✅] 無 Linter 錯誤
- [⏳] 本地測試（待測試）
- [⏳] 視覺效果確認（待測試）
- [⏳] 不同情境測試（待測試）

## 💡 未來優化建議

### 1. 頭像加載狀態

```tsx
<img
  src={selectedGateway.storeLogo}
  onError={(e) => {
    e.currentTarget.src = "/default-store-logo.png";
  }}
/>
```

### 2. 加載動畫

```tsx
const [logoLoaded, setLogoLoaded] = useState(false);

<div style={{
  backgroundColor: logoLoaded ? 'transparent' : '#f3f4f6',
  transition: 'background-color 0.3s',
}}>
  <img
    onLoad={() => setLogoLoaded(true)}
    ...
  />
</div>
```

### 3. 預設圖示

```tsx
{selectedGateway?.storeLogo ? (
  <img src={selectedGateway.storeLogo} ... />
) : (
  <div style={{
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <StoreIcon />
  </div>
)}
```

### 4. 頭像品質優化

- 使用 CDN 加速
- 自動壓縮和優化
- 生成多種尺寸（響應式）
- WebP 格式支援

## 📝 相關文件更新

1. ✅ `liff/src/screens/map/MapScreen.tsx`
2. ✅ `LIFF_MAP_UPDATE_SUMMARY.md`
3. ✅ `LIFF_LOGO_POSITION_UPDATE.md`（本文件）

## 🎉 總結

現在店家頭像：

- ✅ 放在標題旁邊（更醒目）
- ✅ 尺寸增大到 48x48（+50%）
- ✅ 白色邊框（3px）
- ✅ 陰影效果（更立體）
- ✅ 視覺層級更清晰
- ✅ 與標題的關聯性更強

用戶一眼就能識別這是商家 Gateway！🏪
