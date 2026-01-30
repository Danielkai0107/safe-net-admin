# 地點搜尋錯誤處理改進

## 📋 問題描述

### 原問題

在 Gateway 管理頁面的「搜尋地點」功能中：

- ❌ Google Maps API 載入失敗時會一直顯示「載入中...」
- ❌ 用戶無法知道發生了什麼問題
- ❌ 沒有重試機制，只能重新整理頁面

## ✅ 解決方案

### 1. 錯誤檢測機制

#### 載入超時 (15秒)

```typescript
useEffect(() => {
  loadTimeoutRef.current = setTimeout(() => {
    if (isLoading) {
      setLoadError(true);
      setIsLoading(false);
    }
  }, 15000); // 15秒超時

  return () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
  };
}, [isLoading]);
```

#### API 載入錯誤捕獲

```typescript
const handleLoadError = (error: Error) => {
  console.error('Google Maps API 載入失敗:', error);
  setLoadError(true);
  setIsLoading(false);
};

<LoadScript
  onError={handleLoadError}
  ...
/>
```

### 2. 錯誤提示 UI

當載入失敗時顯示友好的錯誤訊息：

```tsx
{
  loadError && (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <svg>⚠️ 圖示</svg>
        <div>
          <p className="text-sm font-medium text-red-800">地圖服務載入失敗</p>
          <p className="text-xs text-red-600 mt-1">
            無法載入 Google Maps，請檢查網路連線或稍後再試
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleRetry}>重新載入</button>
        <input placeholder="或手動輸入地點名稱" />
      </div>
    </div>
  );
}
```

### 3. 改進的載入狀態

添加載入動畫，讓用戶知道系統正在工作：

```tsx
loadingElement={
  <div className="relative">
    <input placeholder="載入地圖服務中..." disabled />
    <div className="absolute right-3 top-1/2">
      <svg className="animate-spin">🔄</svg>
    </div>
  </div>
}
```

### 4. 重試機制

```typescript
const handleRetry = () => {
  setLoadError(false);
  setIsLoading(true);
  window.location.reload(); // 重新載入頁面
};
```

### 5. 備用輸入方案

即使 Google Maps 載入失敗，用戶仍可手動輸入地點名稱：

```tsx
<input
  value={value}
  onChange={(e) => onChange(e.target.value)}
  placeholder="或手動輸入地點名稱"
/>
```

## 🎨 UI 狀態流程

### 狀態 1：正常載入中

```
┌─────────────────────────────┐
│ [載入地圖服務中...] 🔄     │
│ (灰色，禁用)                │
└─────────────────────────────┘
顯示時間：< 15 秒
```

### 狀態 2：載入成功

```
┌─────────────────────────────┐
│ 搜尋地點（例如：台北101）   │
│ [搜尋建議下拉...]           │
└─────────────────────────────┘
正常使用
```

### 狀態 3：載入失敗

```
┌─────────────────────────────────────┐
│ ⚠️ 地圖服務載入失敗                │
│ 無法載入 Google Maps...             │
├─────────────────────────────────────┤
│ [重新載入] [或手動輸入地點名稱...] │
└─────────────────────────────────────┘
用戶可以選擇重試或手動輸入
```

## 💻 代碼變更

### 新增狀態管理

```typescript
const [loadError, setLoadError] = useState(false);
const [isLoading, setIsLoading] = useState(true);
const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
```

### 載入成功處理

```typescript
const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
  autocompleteRef.current = autocomplete;
  setIsLoading(false); // ✅ 停止載入
  setLoadError(false); // ✅ 清除錯誤
  if (loadTimeoutRef.current) {
    clearTimeout(loadTimeoutRef.current); // ✅ 清除超時
  }
};
```

## 🔍 錯誤情境處理

### 情境 A：網路問題

```
用戶操作：打開 Gateway 管理 → 點擊新增
系統狀態：無網路或網路不穩定
結果：
  1. 顯示「載入地圖服務中...」
  2. 15秒後超時
  3. 顯示錯誤訊息
  4. 提供重試和手動輸入選項
```

### 情境 B：API Key 問題

```
用戶操作：打開頁面
系統狀態：Google Maps API Key 無效或超過配額
結果：
  1. LoadScript 的 onError 立即觸發
  2. 顯示錯誤訊息
  3. 提供重試和手動輸入選項
```

### 情境 C：瀏覽器阻擋

```
用戶操作：打開頁面
系統狀態：廣告攔截器或隱私設定阻擋 Google Maps
結果：
  1. 載入超時（15秒）
  2. 顯示錯誤訊息
  3. 建議檢查瀏覽器設定
```

### 情境 D：正常載入

```
用戶操作：打開頁面
系統狀態：網路正常，API 正常
結果：
  1. 短暫顯示載入動畫（< 3秒）
  2. 載入完成
  3. 正常使用搜尋功能
```

## 📊 用戶體驗改進

### 改進前

```
[載入中...] (禁用)
↓
(一直等待...)
↓
(沒有反饋)
↓
用戶困惑：需要手動重新整理頁面
```

**問題**：

- ❌ 無窮等待
- ❌ 沒有錯誤提示
- ❌ 沒有重試選項
- ❌ 沒有備用方案

### 改進後

```
[載入地圖服務中...] 🔄
↓
(超過 15 秒或發生錯誤)
↓
⚠️ 地圖服務載入失敗
無法載入 Google Maps，請檢查網路連線...
[重新載入] [手動輸入]
↓
用戶可以選擇：
1. 重新載入 → 刷新頁面重試
2. 手動輸入 → 直接輸入地點名稱
```

**優點**：

- ✅ 明確的載入狀態
- ✅ 清楚的錯誤訊息
- ✅ 提供重試選項
- ✅ 提供備用方案

## ⚙️ 技術細節

### 超時時間選擇

- **15 秒**：平衡用戶體驗和網路延遲
- 太短（< 10s）：可能誤判慢速網路
- 太長（> 20s）：用戶等待時間過長

### 載入動畫

```css
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

### 錯誤訊息設計原則

1. **明確**：告訴用戶發生了什麼
2. **指導**：建議可能的解決方案
3. **行動**：提供明確的操作按鈕

## 🧪 測試建議

### 測試案例 1：正常載入

```
步驟：
1. 打開 Gateway 管理
2. 點擊「新增接收點」
3. 觀察地點搜尋欄位

預期結果：
- 顯示載入動畫
- 2-3 秒內載入完成
- 可以正常搜尋地點
```

### 測試案例 2：網路斷線

```
步驟：
1. 關閉網路連線
2. 打開 Gateway 管理
3. 點擊「新增接收點」
4. 等待 15 秒

預期結果：
- 顯示載入動畫
- 15 秒後顯示錯誤訊息
- 顯示重試和手動輸入選項
```

### 測試案例 3：重試功能

```
步驟：
1. 觸發載入失敗
2. 重新連接網路
3. 點擊「重新載入」按鈕

預期結果：
- 頁面重新載入
- 重新嘗試載入 Google Maps
- 如果網路正常，應該成功載入
```

### 測試案例 4：手動輸入

```
步驟：
1. 觸發載入失敗
2. 在「手動輸入」欄位輸入地點
3. 繼續填寫其他欄位
4. 提交表單

預期結果：
- 可以手動輸入地點名稱
- 表單可以正常提交
- 不依賴 Google Maps API
```

## 📝 相關文件

- Google Maps JavaScript API 文檔
- React Google Maps API 使用指南
- 錯誤處理最佳實踐

## 💡 未來改進建議

### 1. 更智能的錯誤提示

```typescript
const getErrorMessage = (error: Error) => {
  if (error.message.includes("quota")) {
    return "API 配額已用完，請聯繫管理員";
  }
  if (error.message.includes("network")) {
    return "網路連線異常，請檢查網路設定";
  }
  return "載入失敗，請稍後再試";
};
```

### 2. 離線地點資料庫

```typescript
// 預先儲存常用地點
const commonPlaces = [
  { name: "台北101", lat: 25.0338, lng: 121.5645 },
  { name: "台北車站", lat: 25.0478, lng: 121.517 },
  // ...
];
```

### 3. 載入進度指示

```typescript
const [loadProgress, setLoadProgress] = useState(0);

useEffect(() => {
  const interval = setInterval(() => {
    setLoadProgress((prev) => Math.min(prev + 10, 90));
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

### 4. 自動重試機制

```typescript
const [retryCount, setRetryCount] = useState(0);
const MAX_RETRIES = 3;

const autoRetry = () => {
  if (retryCount < MAX_RETRIES) {
    setRetryCount((prev) => prev + 1);
    // 重試邏輯
  }
};
```

## ✅ 檢查清單

- [✅] 添加錯誤狀態管理
- [✅] 添加載入超時（15秒）
- [✅] 添加 onError 處理
- [✅] 顯示友好的錯誤訊息
- [✅] 提供重試按鈕
- [✅] 提供手動輸入備用方案
- [✅] 添加載入動畫
- [✅] 清理超時定時器
- [✅] 無 TypeScript 錯誤
- [⏳] 實際測試（待測試）

## 🚀 部署注意事項

1. **Google Maps API Key**：
   - 確保 API Key 有效
   - 檢查配額限制
   - 設定正確的 域名限制

2. **錯誤監控**：
   - 記錄錯誤到日誌系統
   - 追蹤載入失敗率
   - 分析常見錯誤原因

3. **用戶通知**：
   - 如果頻繁失敗，通知用戶
   - 提供替代方案文檔
   - 客服支援資訊

現在用戶不會再被困在「載入中...」的狀態了！🎉
