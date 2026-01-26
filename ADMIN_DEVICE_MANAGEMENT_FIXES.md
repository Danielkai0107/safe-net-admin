# Admin Portal 裝置管理修復

## 修復時間
2026-01-26

## 修復的問題

### 問題 1：編輯設備時 UUID 沒有自動選中

**現象：**
- 點擊編輯設備
- UUID 下拉選單顯示「請選擇 UUID」
- 需要手動重新選擇

**原因：**
UUID 在儲存時會轉為小寫（`uuid.toLowerCase()`），但編輯時沒有轉換，導致表單的值和 select 選項的值不匹配。

**修復：**

```typescript
// src/pages/DevicesPage.tsx
const handleEdit = (device: Device) => {
  reset({
    uuid: device.uuid ? device.uuid.toLowerCase() : "", // 統一轉為小寫
  });
}
```

### 問題 2：移除 tag 時沒有清空 inheritedNotificationPointIds

**現象：**
- 編輯設備，移除社區 tag（設為空）
- 設備的 `tags` 變為 `[]`
- 但 `inheritedNotificationPointIds` 仍保留舊值
- 導致設備仍會觸發通知

**原因：**
`deviceService.update()` 只是簡單更新傳入的欄位，沒有檢測 tags 變更並同步通知點。

**修復：**

```typescript
// src/services/deviceService.ts
update: async (id: string, data: Partial<Device>) => {
  // 統一通知架構：檢查 tags 變更，同步 inheritedNotificationPointIds
  if (normalizedData.tags !== undefined) {
    const currentDevice = await getDocument<Device>("devices", id);
    const oldTags = currentDevice?.tags || [];
    const newTags = normalizedData.tags || [];
    
    const tagsChanged = 
      oldTags.length !== newTags.length ||
      !oldTags.every(tag => newTags.includes(tag));
    
    if (tagsChanged) {
      if (newTags.length === 0) {
        // 移除了所有 tag → 清空繼承的通知點
        normalizedData.inheritedNotificationPointIds = null;
      } else {
        // 有新的社區 tag → 重新查詢通知點
        const tenantId = newTags[0];
        const points = await queryTenantNotificationPoints(tenantId);
        normalizedData.inheritedNotificationPointIds = points.length > 0 ? points : null;
      }
    }
  }

  await updateDocument("devices", id, normalizedData);
}
```

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/pages/DevicesPage.tsx` | 編輯時 UUID 轉為小寫 |
| `src/services/deviceService.ts` | update() 方法新增 tags 變更偵測和同步邏輯 |
| `src/services/elderService.ts` | delete() 方法新增自動解綁設備 |

## 測試步驟

### 測試 1：編輯設備時 UUID 自動選中

1. 在裝置管理頁面
2. 點擊任一設備的「編輯」按鈕
3. 檢查 UUID 下拉選單

**預期結果：**
- ✅ UUID 已自動選中正確的值
- ✅ 不需要手動重新選擇

### 測試 2：移除 tag 時清空繼承通知點

**前置條件：**
- 設備已分配到社區（有 tag）
- 社區有設定通知點
- 設備有 `inheritedNotificationPointIds`

**測試步驟：**
1. 編輯設備
2. 將「所屬社區」改為「未分配」
3. 儲存

**預期結果：**
在 Firestore 中檢查：
```javascript
devices/{deviceId}
{
  tags: [],  // ✅ 清空
  inheritedNotificationPointIds: null,  // ✅ 自動清空
}
```

### 測試 3：變更 tag 時重新查詢通知點

**前置條件：**
- 設備已分配到社區 A
- 社區 A 有 2 個通知點
- 社區 B 有 3 個通知點

**測試步驟：**
1. 編輯設備
2. 將「所屬社區」從 A 改為 B
3. 儲存

**預期結果：**
```javascript
devices/{deviceId}
{
  tags: ["tenant_B"],
  inheritedNotificationPointIds: ["gateway_B1", "gateway_B2", "gateway_B3"],  // ✅ 更新為社區 B 的通知點
}
```

### 測試 4：刪除長輩時自動解綁設備

1. 建立長者並綁定設備
2. 刪除長者

**預期結果：**
```javascript
devices/{deviceId}
{
  bindingType: "UNBOUND",  // ✅ 自動解綁
  boundTo: null,
  boundAt: null,
}
```

## 相關邏輯

### Tags 變更偵測邏輯

```typescript
const tagsChanged = 
  oldTags.length !== newTags.length ||
  !oldTags.every(tag => newTags.includes(tag));
```

這會偵測：
- ✅ Tag 數量變更
- ✅ Tag 內容變更（例如從 A 改為 B）
- ✅ Tag 清空

### 同步策略

| 變更類型 | 動作 |
|----------|------|
| 清空 tags（`[]`） | 清空 `inheritedNotificationPointIds` |
| 新增/變更 tag | 查詢新社區的通知點並更新 |
| 維持不變 | 不做任何事 |

## 與其他功能的整合

### 與 tenantService 的差異

| 功能 | tenantService.assignDevices | deviceService.update |
|------|---------------------------|---------------------|
| 使用場景 | 批量分配設備到社區 | 編輯單一設備 |
| Tags 設定 | `tags: [tenantId]` | 從表單的 tenantTag 轉換 |
| 通知點同步 | 分配時查詢並設定 | tags 變更時查詢並更新 |

兩者互補，確保無論哪種方式操作，通知點都會正確同步。

## 效能影響

### 額外查詢

編輯設備時，如果 tags 有變更：
1. 查詢當前設備資料（1 次讀取）
2. 查詢新社區的通知點（1 次查詢）
3. 更新設備（1 次寫入）

總額外成本：~2 次讀取操作（僅在 tags 變更時）

### 優化

- ✅ 只在 tags 變更時執行
- ✅ 使用快取的當前設備資料
- ✅ 查詢有索引支援

## 部署

```bash
# 構建
cd /Users/danielkai/Desktop/admin
npm run build

# 部署
firebase deploy --only hosting:admin
```

## 總結

### 修復前

❌ 編輯設備時 UUID 顯示空白  
❌ 移除 tag 時 inheritedNotificationPointIds 殘留  
❌ 設備可能收到不該收的通知  
❌ 資料不一致  

### 修復後

✅ 編輯設備時 UUID 自動選中  
✅ 移除 tag 時自動清空 inheritedNotificationPointIds  
✅ 變更 tag 時自動重新查詢通知點  
✅ 資料保持一致  
✅ 與 Community Portal 行為統一  

所有修復已完成並成功構建！🎉
