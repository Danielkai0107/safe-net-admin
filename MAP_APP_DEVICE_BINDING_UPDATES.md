# 地圖 APP 設備綁定功能更新說明

**更新日期:** 2026-01-22  
**更新內容:** 支援產品序號綁定、新增衝突檢查、修復權限問題、解綁時清空足跡紀錄

---

## 📋 更新摘要

### 1. ✅ 支援使用產品序號（deviceName）綁定設備

**變更前:** 只能使用 `deviceId` 綁定設備

**變更後:** 可使用 `deviceId` 或 `deviceName` 綁定設備（兩者擇一）

**原因:** 方便終端用戶使用印在設備上的產品序號綁定，無需知道內部的 device ID

### 2. ⚠️ 新增與老人系統的衝突檢查

**變更前:** 只檢查 `poolType` 和 `mapAppUserId`

**變更後:** 額外檢查 `elderId`，確保設備未被老人系統使用

**原因:** 防止地圖 APP 用戶綁定已經分配給老人系統的設備，避免數據衝突

### 3. 🔐 修復管理員權限問題

**變更前:** 只允許用戶綁定自己的設備

**變更後:** 管理員（SUPER_ADMIN / TENANT_ADMIN）可以為任何用戶綁定/解綁設備

**原因:** 後台管理系統需要管理員為其他用戶管理設備

### 4. 📝 更新前端服務

**變更前:** 前端直接操作 Firestore（繞過安全檢查）

**變更後:** 前端調用 Cloud Function API（經過完整安全檢查）

**原因:** 確保所有綁定操作都經過統一的安全檢查和驗證

### 5. 🗑️ 解綁時清空足跡紀錄（2026-01-22 新增）

**變更前:** 解綁時只清空綁定欄位，保留 `activities` 子集合（足跡紀錄）

**變更後:** 解綁時額外清空 `devices/{deviceId}/activities` 子集合，完全恢復成新登記狀態

**原因:** 保護隱私，確保解綁後裝置不會保留前用戶的歷史定位紀錄

---

## 🔧 技術變更詳情

### 後端 API 變更

**文件:** `functions/src/mapApp/deviceBinding.ts`

#### 變更 1: 請求參數支援 deviceName

```typescript
interface BindDeviceRequest {
  userId: string;
  deviceId?: string; // 與 deviceName 二選一
  deviceName?: string; // 新增：產品序號
  nickname?: string;
  age?: number;
}
```

#### 變更 2: 設備查詢邏輯

```typescript
// 支援兩種查詢方式
if (body.deviceId) {
  // 直接用 ID 查詢
  deviceDoc = await db.collection("devices").doc(body.deviceId).get();
} else if (body.deviceName) {
  // 用產品序號查詢
  const deviceQuery = await db
    .collection("devices")
    .where("deviceName", "==", body.deviceName)
    .limit(1)
    .get();
}
```

#### 變更 3: 新增 elderId 檢查

```typescript
// ⚠️ 檢查設備是否已綁定給老人（避免衝突）
if (deviceData?.elderId) {
  res.status(400).json({
    success: false,
    error: "Device is already bound to an elder in the tenant system",
  });
  return;
}
```

#### 變更 4: 改進 poolType 檢查

```typescript
// 明確要求 poolType 必須為 PUBLIC
if (deviceData?.poolType !== "PUBLIC") {
  res.status(400).json({
    success: false,
    error: "Device is not available in public pool (poolType must be PUBLIC)",
  });
  return;
}
```

#### 變更 5: 管理員權限檢查

```typescript
// 允許管理員為其他用戶綁定設備
if (body.userId !== authenticatedUserId) {
  const adminDoc = await db.collection("users").doc(authenticatedUserId).get();
  const adminData = adminDoc.data();

  if (
    !adminData ||
    (adminData.role !== "SUPER_ADMIN" && adminData.role !== "TENANT_ADMIN")
  ) {
    res.status(403).json({
      success: false,
      error: "Forbidden: Cannot bind device to another user",
    });
    return;
  }
}
```

#### 變更 6: 解綁時清空足跡紀錄（2026-01-22 新增）

```typescript
// 1. 清空 activities 子集合（足跡紀錄）
const activitiesRef = db
  .collection("devices")
  .doc(deviceId)
  .collection("activities");
const activitiesSnapshot = await activitiesRef.get();

// 使用 batch 刪除所有 activities（最多 500 筆）
const batch = db.batch();
activitiesSnapshot.docs.forEach((doc) => {
  batch.delete(doc.ref);
});

if (activitiesSnapshot.size > 0) {
  await batch.commit();
}

// 如果超過 500 筆，需要分批刪除
if (activitiesSnapshot.size === 500) {
  let remainingActivities = await activitiesRef.limit(500).get();
  while (!remainingActivities.empty) {
    const deleteBatch = db.batch();
    remainingActivities.docs.forEach((doc) => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    remainingActivities = await activitiesRef.limit(500).get();
  }
}

// 2. 清空裝置綁定資料
await db.collection("devices").doc(deviceId).update({
  bindingType: "UNBOUND",
  boundTo: null,
  boundAt: null,
  mapUserNickname: null,
  mapUserAge: null,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
```

### 前端服務變更

**文件:** `src/services/mapAppUserService.ts`

#### 變更: 改為調用 Cloud Function API

```typescript
// 變更前：直接操作 Firestore
await updateDocument("mapAppUsers", id, {
  boundDeviceId: deviceId,
  // ...
});

// 變更後：調用 Cloud Function API
const idToken = await auth.currentUser.getIdToken();
const response = await fetch(
  "https://binddevicetomapuser-kmzfyt3t5a-uc.a.run.app",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ userId: id, deviceId, nickname, age }),
  },
);
```

### API 文檔更新

**文件:** `MAP_APP_API_ENDPOINTS.md`

- 更新 `bindDeviceToMapUser` API 說明
- 新增產品序號綁定範例
- 新增常見錯誤訊息說明
- 更新注意事項

---

## 使用方式

### 方式一：使用設備 ID 綁定（後台管理系統）

```typescript
await mapAppUserService.bindDevice(
  "user_id_123",
  "device_id_abc",
  "媽媽的手環",
  65,
);
```

### 方式二：使用產品序號綁定（地圖 APP）

```javascript
// 用戶輸入設備上印的序號（例如 "1-1001"）
const response = await fetch(
  "https://binddevicetomapuser-kmzfyt3t5a-uc.a.run.app",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      userId: currentUser.uid,
      deviceName: "1-1001", // 產品序號
      nickname: "媽媽的手環",
      age: 65,
    }),
  },
);
```

---

## ⚠️ 重要注意事項

### 設備綁定條件（必須全部滿足）

1. ✅ 設備必須存在於 `devices` collection
2. ✅ 設備的 `poolType` 必須為 `"PUBLIC"`
3. ✅ 設備的 `elderId` 必須為 `null`（不可綁定給老人）
4. ✅ 設備未被其他地圖用戶綁定（或綁定的是同一用戶）

### 常見錯誤訊息

| 錯誤訊息                                                           | 原因                   | 解決方法                                |
| ------------------------------------------------------------------ | ---------------------- | --------------------------------------- |
| `Device with deviceName 'xxx' not found`                           | 找不到該產品序號的設備 | 檢查產品序號是否正確                    |
| `Device is already bound to an elder in the tenant system`         | 設備已綁定給老人系統   | 先在老人系統解綁，或選擇其他設備        |
| `Device is not available in public pool (poolType must be PUBLIC)` | 設備不在公共池中       | 在設備管理中將 `poolType` 改為 `PUBLIC` |
| `Device is already bound to another map app user`                  | 設備已被其他用戶綁定   | 等待該用戶解綁，或選擇其他設備          |

---

## 🔄 部署步驟

### 1. 編譯函數

```bash
cd functions
npm run build
```

### 2. 部署到 Firebase（可選）

```bash
firebase deploy --only functions:bindDeviceToMapUser,functions:unbindDeviceFromMapUser
```

### 3. 更新前端（已完成）

前端代碼已更新，無需額外操作。

---

## 🧪 測試清單

### 後端 API 測試

- [ ] 使用 `deviceId` 綁定設備
- [ ] 使用 `deviceName` 綁定設備
- [ ] 嘗試綁定已有 `elderId` 的設備（應被拒絕）
- [ ] 嘗試綁定 `poolType !== 'PUBLIC'` 的設備（應被拒絕）
- [ ] 管理員為其他用戶綁定設備
- [ ] 非管理員嘗試為其他用戶綁定（應被拒絕）
- [ ] 解綁設備後檢查 `activities` 子集合是否被清空 新增
- [ ] 解綁有大量足跡紀錄（>500 筆）的設備

### 前端測試

- [ ] 後台管理頁面綁定設備功能
- [ ] 後台管理頁面解綁設備功能
- [ ] 錯誤訊息正確顯示
- [ ] 綁定後數據即時更新
- [ ] 解綁後裝置恢復成新登記狀態 新增

---

## 📚 相關文檔

- `MAP_APP_API_ENDPOINTS.md` - 完整 API 文檔
- `MAP_APP_USERS_GUIDE.md` - 地圖 APP 用戶管理指南
- `MAP_APP_DEPLOYMENT_GUIDE.md` - 部署指南

---

## ✅ 後台管理介面更新（2026-01-21 補充）

### 新增 poolType 欄位到設備管理頁面

**文件:** `src/pages/DevicesPage.tsx`

#### 變更內容：

1. **新增/編輯表單中新增 poolType 下拉選單**
   - 預設值：`TENANT`（社區專用）
   - 選項：`TENANT` 或 `PUBLIC`（地圖 APP 公用）
   - 必填欄位

2. **設備列表新增「池類型」欄位**
   - 🌍 PUBLIC - 綠色標籤
   - 🏢 TENANT - 藍色標籤
   - ❓ 未設定 - 灰色標籤

3. **預設值設定**
   - 新增設備時預設為 `PUBLIC`
   - 編輯設備時保留原有值，若無則預設為 `PUBLIC`

#### 效果截圖位置：

**新增設備表單：**

```
設備類型: [iBeacon ▼]
池類型: [TENANT（社區專用）▼] *
   PUBLIC 設備可被地圖 APP 用戶綁定
電量: [___] %
```

**設備列表：**

```
| 綁定狀態 | 池類型 | 類型 | 電量 |
| -------- | ------ | ---- | ---- |
| 已綁定長者 | 🏢 TENANT | iBeacon | 85% |
| 未分配 | 🌍 PUBLIC | iBeacon | 92% |
```

---

## 🐛 已知問題與限制

1. **產品序號唯一性:** 目前假設 `deviceName` 是唯一的。如果有重複，會返回第一個匹配的設備。
2. **舊設備 poolType 補充:** ~~舊設備可能沒有 `poolType` 欄位，需要手動補上。~~ ✅ 已在後台新增管理介面，可直接編輯
3. **Firestore Rules:** 目前使用開發模式（允許所有讀寫），生產環境需啟用嚴格的規則。

---

## 🔮 未來改進建議

1. **產品序號索引:** 為 `deviceName` 欄位建立 Firestore 索引以提升查詢效能
2. **批量設定 poolType:** 提供批量工具為現有設備設定 `poolType`
3. **綁定歷史記錄:** 記錄設備綁定/解綁的歷史
4. **綁定通知:** 設備綁定成功後發送通知給用戶

---

**文檔版本:** 1.0.0  
**最後更新:** 2026-01-21
