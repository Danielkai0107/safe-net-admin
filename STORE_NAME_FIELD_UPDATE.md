# 店家管理欄位對應更新

## 📋 更新內容

### 欄位對應調整

將「店家名稱」欄位從對應 Gateway 的 `name` 改為對應 `location`（位置描述）。

## 🔄 修改原因

### 原設計

```
店家名稱 → gateway.name
```

### 問題

- Gateway 的 `name` 欄位通常是技術性名稱
- `location` 欄位才是用戶友好的位置描述
- 店家名稱應該是描述性的，例如「星巴克信義店」

### 新設計

```
店家名稱（位置描述）→ gateway.location
```

## 💻 代碼變更

### 1. StoresPage.tsx

#### 表單初始化 (handleCreate)

```tsx
// 修改前
reset({
  name: "",
  ...
});

// 修改後
reset({
  location: "",
  ...
});
```

#### 表單編輯 (handleEdit)

```tsx
// 修改前
reset({
  name: gateway.name ?? "",
  ...
});

// 修改後
reset({
  location: gateway.location ?? "",
  ...
});
```

#### 表單提交 (onSubmit)

```tsx
// 修改前
const payload: Record<string, string> = {
  name: data.name,
};

// 修改後
const payload: Record<string, string> = {
  location: data.location,
};
```

#### 列表顯示

```tsx
// 修改前
<td>{g.name || "-"}</td>

// 修改後
<td>{g.location || "-"}</td>
```

#### 表單欄位

```tsx
// 修改前
<label className="label">店家名稱 *</label>
<input
  {...register("name", { required: "請填寫店家名稱" })}
  placeholder="對應資料庫 name 欄位"
/>

// 修改後
<label className="label">店家名稱（位置描述）*</label>
<input
  {...register("location", { required: "請填寫店家名稱" })}
  placeholder="例如：星巴克信義店、7-11光復門市"
/>
<p className="text-xs text-gray-500 mt-1">
  此欄位對應 Gateway 的「位置描述」(location)
</p>
```

### 2. StoreDetailPage.tsx

同樣的修改應用到詳情頁面：

- 表單初始化
- 表單提交
- 頁面標題顯示
- 取消編輯時的重置

```tsx
// 頁面標題
<h2>{store.location || "店家詳情"}</h2>
```

## 📊 資料結構

### Gateway 欄位說明

```typescript
interface Gateway {
  // 技術性欄位
  name: string; // 系統用，簡短名稱

  // 用戶友好欄位
  location?: string; // ✅ 店家名稱應該用這個

  // 商家專用欄位
  isAD?: boolean;
  storeLogo?: string;
  imageLink?: string;
  activityTitle?: string;
  activityContent?: string;
  websiteLink?: string;
  storePassword?: string;
}
```

### 範例資料

#### 修改前（使用 name）

```json
{
  "name": "gateway-001",
  "location": "星巴克信義店",
  "isAD": true,
  ...
}
```

❌ 店家管理顯示：「gateway-001」（不友好）

#### 修改後（使用 location）

```json
{
  "name": "gateway-001",
  "location": "星巴克信義店",
  "isAD": true,
  ...
}
```

✅ 店家管理顯示：「星巴克信義店」（友好）

## 🎯 使用範例

### 正確的店家名稱

✅ **好的範例**：

- 星巴克信義店
- 7-11光復門市
- 全家便利商店民生店
- 麥當勞忠孝店
- 誠品書店敦南店

✅ **命名特點**：

- 包含品牌名稱
- 包含分店位置
- 用戶容易識別
- 符合口語表達

❌ **不好的範例**：

- gateway-001（技術性名稱）
- store1（編號）
- GW-TW-001（代碼）

## 📱 UI 顯示效果

### 商店管理列表

```
┌────────────────────────────────────┐
│ 店家名稱           │ Logo  │ ...  │
├────────────────────────────────────┤
│ 星巴克信義店       │ [🏪]  │ ...  │
│ 7-11光復門市       │ [🏪]  │ ...  │
│ 麥當勞忠孝店       │ [🏪]  │ ...  │
└────────────────────────────────────┘
```

### 詳情頁面標題

```
┌────────────────────────────────────┐
│ ← 星巴克信義店            [編輯]   │
│   序號：g-26-01-0001              │
├────────────────────────────────────┤
│ [圖片預覽區域]                    │
└────────────────────────────────────┘
```

### LIFF 地圖彈窗

```
┌────────────────────────────────────┐
│ 📍 星巴克信義店           [🏪]    │
├────────────────────────────────────┤
│ 📍 星巴克信義店                   │
│ [🏠 安全區域] [⭐ 合作友善商家]   │
└────────────────────────────────────┘
```

## 🔍 影響範圍

### 修改的檔案

1. ✅ `src/pages/StoresPage.tsx`
   - 表單初始化
   - 表單編輯
   - 表單提交
   - 列表顯示
   - 表單欄位

2. ✅ `src/pages/StoreDetailPage.tsx`
   - 表單初始化
   - 表單提交
   - 頁面標題
   - 取消重置
   - 表單欄位

### 不受影響的部分

- ❌ LIFF 地圖（因為彈窗標題使用 `selectedGateway?.location`，本來就正確）
- ❌ Gateway 管理（使用各自的欄位）
- ❌ 資料庫結構（不需要遷移）

## ⚠️ 注意事項

### 1. 現有資料

如果之前有店家資料使用 `name` 欄位：

```javascript
// 舊資料可能長這樣
{
  name: "星巴克信義店",
  location: null  // 或未設置
}

// 需要手動遷移或更新
{
  name: "gateway-001",  // 可以改成技術性名稱
  location: "星巴克信義店"  // 用戶友好名稱
}
```

### 2. Gateway 管理

在 Gateway 管理頁面：

- `name` 欄位：保持原樣（技術用途）
- `location` 欄位：描述性名稱（用戶用途）

### 3. 欄位驗證

```tsx
{...register("location", {
  required: "請填寫店家名稱",
  minLength: {
    value: 2,
    message: "店家名稱至少 2 個字"
  }
})}
```

## 📝 資料遷移建議

如果需要遷移現有資料：

```javascript
// Firebase Cloud Function 或腳本
const migrateStoreNames = async () => {
  const stores = await getStoresWithIsAD();

  for (const store of stores) {
    if (store.name && !store.location) {
      await updateDoc(doc(db, "gateways", store.id), {
        location: store.name, // 將 name 複製到 location
        name: `gateway-${store.serialNumber}`, // 設置技術性名稱
      });
    }
  }
};
```

## ✅ 測試檢查清單

- [✅] 新增店家時輸入 location
- [✅] 編輯店家時修改 location
- [✅] 列表正確顯示 location
- [✅] 詳情頁標題顯示 location
- [✅] 表單驗證正常運作
- [✅] 無 TypeScript 錯誤
- [✅] Build 成功
- [⏳] 實際新增/編輯測試（待測試）

## 🚀 部署注意事項

1. **向下相容**：
   - 修改後的代碼會使用 `location` 欄位
   - 如果 `location` 為空，會顯示 "-"
   - 舊資料可能需要手動更新

2. **文檔更新**：
   - 更新使用說明
   - 更新 API 文檔
   - 更新培訓資料

3. **用戶溝通**：
   - 通知管理員欄位變更
   - 說明正確的命名方式
   - 提供範例

## 💡 未來改進建議

1. **欄位說明增強**

   ```tsx
   <input
     placeholder="例如：星巴克信義店"
     helperText="請包含品牌名稱和分店位置"
   />
   ```

2. **自動完成**

   ```tsx
   <Autocomplete options={popularBrands} freeSolo />
   ```

3. **命名驗證**

   ```tsx
   validate: (value) => {
     if (value.length < 4) {
       return "店家名稱過短，建議包含品牌和分店資訊";
     }
     return true;
   };
   ```

4. **資料遷移工具**
   - 提供一鍵遷移功能
   - 批量更新現有資料
   - 匯出/匯入功能

## 📚 相關文檔

- Gateway 資料結構說明
- 店家管理使用指南
- LIFF 地圖整合文檔
- 資料遷移腳本
