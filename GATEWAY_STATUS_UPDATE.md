# Gateway 狀態標籤更新

## 📋 更新內容

### 未啟用狀態優化
將 Gateway 的「未啟用」狀態改為更友好的顯示：
- **文案**：「已停用」→ 「新建中」
- **圖標**：無 → 🔧 維修/扳手圖標
- **顏色**：灰色 → 琥珀色（橙黃色）

## 🔄 修改前後對比

### 修改前
```tsx
<span className="bg-gray-100 text-gray-800">
  已停用
</span>
```
- ❌ 灰色，給人「壞掉」的感覺
- ❌ 沒有圖標，視覺效果平淡
- ❌ 「已停用」聽起來是負面的

### 修改後
```tsx
<span className="bg-amber-100 text-amber-800">
  <Wrench className="w-3 h-3" />
  新建中
</span>
```
- ✅ 琥珀色（橙黃色），代表「進行中」
- ✅ 扳手圖標，代表「建置/維護」
- ✅ 「新建中」更積極正面

## 💻 代碼變更

### 1. 導入圖標
```tsx
// 修改前
import { Plus, Search, MapPin, Wifi, Edit, Trash2 } from "lucide-react";

// 修改後
import { Plus, Search, MapPin, Wifi, Edit, Trash2, Wrench } from "lucide-react";
```

### 2. 狀態顯示
```tsx
// 修改前
<span className={`... ${gateway.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
  {gateway.isActive ? "運作中" : "已停用"}
</span>

// 修改後
<span className={`inline-flex items-center gap-1 ... ${gateway.isActive ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
  {gateway.isActive ? (
    <>
      <Wifi className="w-3 h-3" />
      運作中
    </>
  ) : (
    <>
      <Wrench className="w-3 h-3" />
      新建中
    </>
  )}
</span>
```

## 🎨 視覺效果

### 狀態 1：運作中（isActive = true）
```
┌─────────────────┐
│ 📶 運作中       │  綠色背景
└─────────────────┘
```
- 圖標：📶 Wifi（訊號）
- 背景：`bg-green-100`（淡綠色）
- 文字：`text-green-800`（深綠色）
- 語義：正常運作，接收訊號中

### 狀態 2：新建中（isActive = false）
```
┌─────────────────┐
│ 🔧 新建中       │  琥珀色背景
└─────────────────┘
```
- 圖標：🔧 Wrench（扳手）
- 背景：`bg-amber-100`（淡琥珀色）
- 文字：`text-amber-800`（深琥珀色）
- 語義：正在建置中，即將啟用

## 📊 狀態語義說明

### 原設計問題
| 狀態 | 文案 | 顏色 | 問題 |
|------|------|------|------|
| Active | 運作中 | 綠色 | ✅ 正面 |
| Inactive | 已停用 | 灰色 | ❌ 負面，像是壞掉 |

### 新設計優勢
| 狀態 | 文案 | 顏色 | 圖標 | 語義 |
|------|------|------|------|------|
| Active | 運作中 | 綠色 | 📶 Wifi | 正常運作 |
| Inactive | 新建中 | 琥珀色 | 🔧 Wrench | 建置中，即將完成 |

## 🎯 使用情境

### 情境 A：新增 Gateway
```
步驟：
1. 管理員新增 Gateway
2. 預設 isActive = true（運作中）
3. 顯示：[📶 運作中]

或者：
1. 管理員新增 Gateway
2. 取消勾選「啟用此接收點」
3. isActive = false
4. 顯示：[🔧 新建中]
```

### 情境 B：暫時停用
```
步驟：
1. Gateway 需要維護
2. 管理員編輯，取消「啟用此接收點」
3. 顯示：[🔧 新建中]
4. 維護完成後重新啟用
```

### 情境 C：列表篩選
```
用戶可以在列表上方篩選：
- 全部狀態
- 運作中（綠色）
- 新建中（琥珀色）
```

## 🎨 顏色規範

### 綠色系（運作中）
```css
background: #dcfce7;  /* bg-green-100 */
color: #166534;       /* text-green-800 */
```

### 琥珀色系（新建中）
```css
background: #fef3c7;  /* bg-amber-100 */
color: #92400e;       /* text-amber-800 */
```

## 📱 UI 顯示

### Gateway 列表
```
┌──────────────────────────────────────────────────┐
│ 序號      │ 位置     │ 類型    │ 狀態          │
├──────────────────────────────────────────────────┤
│ g-26-01-001│ 台北101 │ 安全區  │ [📶 運作中]  │
│ g-26-01-002│ 大安公園│ 學區    │ [🔧 新建中]  │
│ g-26-01-003│ 信義商圈│ 安全區  │ [📶 運作中]  │
└──────────────────────────────────────────────────┘
```

### 圖標說明
- **Wifi（📶）**：
  - 代表訊號接收
  - 表示 Gateway 正在工作
  - 綠色，正向
  
- **Wrench（🔧）**：
  - 代表建置/維護
  - 表示 Gateway 正在設定
  - 琥珀色，中性但積極

## ✅ 改進優點

### 1. 心理學優勢
- ❌ 「已停用」→ 感覺壞掉、不能用
- ✅ 「新建中」→ 感覺正在準備、即將可用

### 2. 視覺辨識
- ❌ 灰色 → 容易忽略
- ✅ 琥珀色 → 醒目但不刺眼

### 3. 圖標輔助
- ❌ 無圖標 → 純文字
- ✅ 扳手圖標 → 一眼辨識

### 4. 語義清晰
- 運作中：正在接收訊號 ✅
- 新建中：正在設定建置 ✅

## 🔍 其他頁面

### 已檢查的頁面
其他頁面（Users, Devices 等）也有類似的狀態顯示，但語義不同：
- Users: isActive = false → 「已停用」（合理，表示帳號停用）
- Devices: isActive = false → 「已停用」（合理，表示設備停用）
- **Gateways**: isActive = false → 「新建中」（✅ 已更新）

### 為什麼只改 Gateway？
- Gateway 的「未啟用」通常是暫時性的（新建、維護）
- User/Device 的「已停用」是管理性的（帳號停用、設備停用）
- 語義不同，應該區別對待

## 📝 相關文件

- Gateway 管理使用說明
- 狀態管理規範
- UI 組件庫

## 💡 未來擴展建議

### 更多狀態
可以考慮添加更多狀態：
```typescript
type GatewayStatus = 
  | "ACTIVE"      // 運作中 - 綠色 - Wifi
  | "SETUP"       // 新建中 - 琥珀色 - Wrench
  | "MAINTENANCE" // 維護中 - 藍色 - Tool
  | "ERROR"       // 故障 - 紅色 - AlertTriangle
  | "OFFLINE";    // 離線 - 灰色 - WifiOff
```

### 自動切換
```typescript
// 根據最後活動時間自動判斷
const getStatus = (gateway: Gateway) => {
  if (!gateway.isActive) return "SETUP";
  if (hasRecentActivity(gateway)) return "ACTIVE";
  return "OFFLINE";
};
```

### 狀態提示
```tsx
<Tooltip content="此接收點正在建置中，尚未開始接收訊號">
  <span>[🔧 新建中]</span>
</Tooltip>
```

## ✅ 檢查清單

- [✅] 導入 Wrench 圖標
- [✅] 修改狀態顯示邏輯
- [✅] 添加圖標到兩個狀態
- [✅] 調整顏色（灰色 → 琥珀色）
- [✅] 修改文案（已停用 → 新建中）
- [✅] 添加 gap-1 spacing
- [✅] TypeScript 編譯通過
- [✅] Build 成功
- [⏳] UI 測試（待測試）

## 🚀 部署後效果

管理員在 Gateway 管理頁面會看到：
- 綠色標籤「📶 運作中」- 正常的 Gateway
- 琥珀色標籤「🔧 新建中」- 正在設定的 Gateway

更直觀、更友好！🎉
