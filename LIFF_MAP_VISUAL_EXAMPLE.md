# LIFF 地圖商家優惠彈窗 - 視覺示例

## 彈窗佈局示意圖

```
┌─────────────────────────────────────────┐
│  ┌──────────────────────────────────┐   │
│  │   拖拽手柄 (Drag Handle)        │   │
│  └──────────────────────────────────┘   │
│                                          │
│  📍 接收點詳情                           │  ← 移除序號標籤
│                                          │
├─────────────────────────────────────────┤
│                                          │
│  ┌────┐                                 │
│  │ 🏪 │ 📍 [店家名稱]                  │  ← 店家Logo (32x32, 圓形)
│  └────┘                                 │
│                                          │
│  [🏠 安全區域] [⭐ 合作友善商家]        │  ← Type Badge + 商家標籤
│                                          │
├─────────────────────────────────────────┤  ← 分隔線
│                                          │
│  商家優惠                                │  ← 小標題 (靠左)
│                                          │
│  ┌─────────────────────────────────┐   │
│  │                                  │   │
│  │      [優惠活動 Banner 圖片]      │   │  ← Banner (填滿寬度)
│  │         (3:1 比例)               │   │
│  │                                  │   │
│  └─────────────────────────────────┘   │
│                                          │
│  春節特惠活動                            │  ← 活動標題
│                                          │
│  全店商品 8 折優惠                       │  ← 活動內容
│  凡購買滿 $1000 元                       │     (支持多行)
│  即可獲得精美禮品一份                    │
│                                          │
│  🔗 前往官網                            │  ← 官網連結
│                                          │
├─────────────────────────────────────────┤  ← 分隔線
│                                          │
│  接收點序號：g-26-01-0001               │  ← 灰色小字序號
│                                          │
├─────────────────────────────────────────┤
│                                          │
│  [✓ 設為通知點]  [關閉]                 │  ← 操作按鈕
│                                          │
└─────────────────────────────────────────┘
```

## 代碼結構

### 1. 標題區域（包含 Logo）

```jsx
<div className="info-row">
  {selectedGateway.isAD && selectedGateway.storeLogo && (
    <img
      src={selectedGateway.storeLogo}
      alt="店家Logo"
      className="store-logo-avatar"
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        objectFit: "cover",
        marginRight: "8px",
        border: "2px solid #e5e7eb",
      }}
    />
  )}
  <svg className="location-icon">...</svg>
  <span>{selectedGateway.name}</span>
</div>
```

### 2. Type Badge

```jsx
<div className="gateway-badges">
  <span className={`badge badge-${selectedGateway.type}`}>
    <svg>...</svg>
    {getGatewayTypeLabel(selectedGateway.type)}
  </span>
</div>
```

### 3. 分隔線

```jsx
{selectedGateway.isAD && (
  <>
    <div style={{
      borderTop: "1px solid #e5e7eb",
      margin: "16px 0",
    }} />
```

### 4. 商家優惠區塊

```jsx
    <div className="store-promotion-section">
      {/* 小標題 */}
      <h3 style={{
        fontSize: "14px",
        fontWeight: "600",
        color: "#374151",
        marginBottom: "12px",
        textAlign: "left",
      }}>
        商家優惠
      </h3>

      {/* Banner 圖片 */}
      {selectedGateway.imageLink && (
        <div style={{
          width: "100%",
          marginBottom: "12px",
          borderRadius: "8px",
          overflow: "hidden",
        }}>
          <img
            src={selectedGateway.imageLink}
            alt="優惠活動"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
            }}
          />
        </div>
      )}

      {/* 活動標題 */}
      {selectedGateway.activityTitle && (
        <h4 style={{
          fontSize: "16px",
          fontWeight: "600",
          color: "#111827",
          marginBottom: "8px",
          textAlign: "left",
        }}>
          {selectedGateway.activityTitle}
        </h4>
      )}

      {/* 活動內容 */}
      {selectedGateway.activityContent && (
        <p style={{
          fontSize: "14px",
          color: "#6b7280",
          lineHeight: "1.6",
          textAlign: "left",
          whiteSpace: "pre-wrap",
        }}>
          {selectedGateway.activityContent}
        </p>
      )}

      {/* 官網連結 */}
      {selectedGateway.websiteLink && (
        <a
          href={selectedGateway.websiteLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginTop: "12px",
            color: "#3b82f6",
            fontSize: "14px",
            textDecoration: "none",
          }}
        >
          <svg style={{
            width: "16px",
            height: "16px",
            marginRight: "4px",
          }}>...</svg>
          前往官網
        </a>
      )}
    </div>
  </>
)}
```

## 不同情境的顯示效果

### 情境 A：完整商家資訊

```
✅ isAD = true
✅ storeLogo = "https://..."
✅ imageLink = "https://..."
✅ activityTitle = "春節特惠活動"
✅ activityContent = "全店商品8折..."
✅ websiteLink = "https://..."

顯示：
- 店家 Logo ✓
- 分隔線 ✓
- 商家優惠標題 ✓
- Banner 圖片 ✓
- 活動標題 ✓
- 活動內容 ✓
- 官網連結 ✓
```

### 情境 B：部分商家資訊

```
✅ isAD = true
✅ storeLogo = "https://..."
❌ imageLink = null
✅ activityTitle = "春節特惠活動"
✅ activityContent = "全店商品8折..."
❌ websiteLink = null

顯示：
- 店家 Logo ✓
- 分隔線 ✓
- 商家優惠標題 ✓
- Banner 圖片 ✗ (不顯示)
- 活動標題 ✓
- 活動內容 ✓
- 官網連結 ✗ (不顯示)
```

### 情境 C：非商家 Gateway

```
❌ isAD = false

顯示：
- 一般 Gateway 資訊
- 不顯示商家優惠區塊
```

## 顏色規範

| 元素      | 顏色      | 用途             |
| --------- | --------- | ---------------- |
| 小標題    | `#374151` | 商家優惠標題     |
| 活動標題  | `#111827` | 深色，強調重點   |
| 活動內容  | `#6b7280` | 中灰色，易讀     |
| 官網連結  | `#3b82f6` | 藍色，表示可點擊 |
| 分隔線    | `#e5e7eb` | 淡灰色           |
| Logo 邊框 | `#e5e7eb` | 淡灰色           |

## 字體規範

| 元素     | 大小 | 字重 |
| -------- | ---- | ---- |
| 商家優惠 | 14px | 600  |
| 活動標題 | 16px | 600  |
| 活動內容 | 14px | 400  |
| 官網連結 | 14px | 400  |

## 間距規範

| 元素         | 間距 |
| ------------ | ---- |
| 分隔線上下   | 16px |
| 小標題下方   | 12px |
| Banner 下方  | 12px |
| 標題下方     | 8px  |
| 官網連結上方 | 12px |
| Logo 右側    | 8px  |

## 實際使用案例

### 案例 1：咖啡店

```javascript
{
  id: "gateway-001",
  name: "星巴克咖啡（信義店）",
  isAD: true,
  storeLogo: "https://.../starbucks-logo.png",
  imageLink: "https://.../christmas-promo.jpg",
  activityTitle: "聖誕限定飲品",
  activityContent: "購買任一聖誕飲品\n即可獲得限定馬克杯一個\n數量有限，送完為止",
  websiteLink: "https://www.starbucks.com.tw"
}
```

### 案例 2：書店

```javascript
{
  id: "gateway-002",
  name: "誠品書店（敦南店）",
  isAD: true,
  storeLogo: "https://.../eslite-logo.png",
  imageLink: "https://.../book-fair.jpg",
  activityTitle: "年度書展",
  activityContent: "全館書籍79折起\n滿額贈精美書籤\n活動期間：1/1 - 1/31",
  websiteLink: "https://www.eslite.com"
}
```

### 案例 3：餐廳（無 Banner）

```javascript
{
  id: "gateway-003",
  name: "鼎泰豐（信義店）",
  isAD: true,
  storeLogo: "https://.../dintaifung-logo.png",
  imageLink: null,  // 沒有 Banner
  activityTitle: "午間套餐優惠",
  activityContent: "平日11:00-14:00\n套餐優惠價 NT$280",
  websiteLink: "https://www.dintaifung.com.tw"
}
```

## 開發檢查清單

- [✓] 更新 Gateway interface 添加商家欄位
- [✓] 修改 MapScreen 彈窗佈局
- [✓] 添加店家 Logo 顯示
- [✓] 添加分隔線
- [✓] 添加商家優惠區塊
- [✓] 添加條件渲染邏輯
- [✓] 確保所有欄位都是可選的
- [✓] 添加內聯樣式
- [✓] 測試不同情境
- [✓] 編寫文檔

## 後續優化建議

1. **性能優化**
   - 圖片懶加載
   - 圖片 CDN 優化
   - 圖片尺寸自動調整

2. **用戶體驗**
   - 添加加載動畫
   - 圖片點擊放大
   - 分享功能
   - 收藏功能

3. **數據分析**
   - 追蹤點擊率
   - 追蹤官網連結點擊
   - 追蹤用戶停留時間

4. **A/B 測試**
   - 測試不同的佈局
   - 測試不同的文案
   - 測試不同的 CTA 按鈕
