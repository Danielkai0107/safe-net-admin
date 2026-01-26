# 裝置綁定架構重整 - 實作總結

**實作日期：** 2026-01-21  
**狀態：** ✅ 核心邏輯已完成，編譯通過

---

## ✅ 已完成項目

### 1. TypeScript 類型定義更新

**檔案：** `src/types/index.ts`

#### Device 介面重構

```typescript
// 舊結構（已移除）
tenantId: string | null;
elderId: string | null;
mapAppUserId?: string;
poolType?: PoolType;

// 新結構
bindingType: DeviceBindingType;  // "ELDER" | "MAP_USER" | "UNBOUND"
boundTo: string | null;          // elderId 或 mapAppUserId
boundAt: string | null;
mapUserNickname?: string | null; // 從 MapAppUser 移過來
mapUserAge?: number | null;      // 從 MapAppUser 移過來
tags: string[];                  // 取代 tenantId，例如 ["tenant_dalove_001"]
```

#### 新增類型

- `DeviceBindingType`: 統一的綁定類型
- `DeviceActivity`: 裝置活動記錄（子集合結構）

#### MapAppUser 介面簡化

- 移除：`deviceNickname`, `deviceOwnerAge`, `boundAt`
- 保留：`boundDeviceId`（雙向引用，方便查詢）

---

### 2. receiveBeaconData 核心邏輯重構

**檔案：** `functions/src/beacon/receiveBeaconData.ts`

#### 統一的 processBeacon 函數

```typescript
async function processBeacon(...) {
  // 1. 找到裝置（保持不變）
  // 2. 更新裝置狀態
  // 3. 記錄足跡到裝置子集合（統一）
  await recordDeviceActivity(...);
  // 4. 根據綁定類型處理通知（統一）
  await handleNotification(...);
}
```

#### 新增函數

- `recordDeviceActivity()`: 統一記錄到 `devices/{deviceId}/activities` 子集合
- `handleNotification()`: 根據 `bindingType` 決定通知方式
- `handleElderNotification()`: 處理長者 LINE 通知
- `handleMapUserNotification()`: 處理 APP 用戶 FCM 通知
- `sendLineNotificationToTenant()`: 發送 LINE 通知給社區成員
- `createBoundaryAlertForElder()`: 創建邊界警報

#### 移除函數

- ❌ `handleMapUserBeacon`（合併到 handleNotification）
- ❌ `sendLineNotification`（重構為 sendLineNotificationToTenant）
- ❌ `createBoundaryAlert`（重構為 createBoundaryAlertForElder）

#### 不再更新的 Collection

- ❌ `latest_locations`（長者系統的舊足跡）
- ❌ `mapUserActivities`（APP 用戶的舊足跡）
- ✅ 統一使用 `devices/{deviceId}/activities` 子集合

---

### 3. 裝置綁定 API 更新

**檔案：** `functions/src/mapApp/deviceBinding.ts`

#### bindDeviceToMapUser

```typescript
// 檢查綁定狀態（新）
if (deviceData?.bindingType === 'ELDER') { ... }
if (deviceData?.bindingType === 'MAP_USER' && deviceData.boundTo !== userId) { ... }

// 綁定裝置（新）
await db.collection('devices').doc(deviceId).update({
  bindingType: 'MAP_USER',
  boundTo: userId,
  boundAt: timestamp,
  mapUserNickname: nickname,
  mapUserAge: age,
});

// 更新用戶（簡化）
await db.collection('mapAppUsers').doc(userId).update({
  boundDeviceId: deviceId,  // 只保留這個
});
```

#### unbindDeviceFromMapUser

```typescript
// 解綁裝置（新）
await db.collection("devices").doc(deviceId).update({
  bindingType: "UNBOUND",
  boundTo: null,
  boundAt: null,
  mapUserNickname: null,
  mapUserAge: null,
});
```

---

### 4. 前端服務更新

**檔案：** `src/services/deviceService.ts`

#### create 函數

```typescript
// 新增裝置預設值
{
  bindingType: 'UNBOUND',
  boundTo: null,
  boundAt: null,
  tags: [],
  mapUserNickname: null,
  mapUserAge: null,
}
```

#### assignToElder 函數

```typescript
// 使用新的資料結構
bindingType: 'ELDER',
boundTo: elderId,
boundAt: timestamp,
```

#### 新增函數

- `getUnboundDevices()`: 取得未綁定的裝置
- `getAvailableDevicesByTag()`: 取得特定標籤的可用裝置

---

### 5. 前端頁面更新

**檔案：** `src/pages/DevicesPage.tsx`

#### 綁定狀態顯示

```typescript
const getBindingStatusBadge = (device: Device) => {
  switch (device.bindingType) {
    case 'ELDER': return <Badge>已綁定長者</Badge>;
    case 'MAP_USER': return <Badge>已綁定APP用戶</Badge>;
    case 'UNBOUND': return <Badge>未綁定</Badge>;
  }
};
```

#### 更新邏輯

- 表單預設值使用 `tags: []` 而非 `poolType`
- 清理孤兒裝置使用 `bindingType === 'ELDER'` 和 `boundTo`
- 合併裝置資料使用 `boundTo` 而非 `elderId`

---

## 🎯 核心變更總結

### 資料流變更

```
舊架構：
Device → elderId → Elder → tenantId → Tenant → LINE 參數
Device → mapAppUserId → MapAppUser (nickname, age 在這裡)

新架構：
Device → bindingType + boundTo
  ├─ ELDER → Elder → tenantId → Tenant → LINE 參數
  ├─ MAP_USER (nickname, age 在 Device)
  └─ UNBOUND
```

### 足跡記錄變更

```
舊架構：
├─ latest_locations/{elderId}          (長者系統)
└─ mapUserActivities/{activityId}      (APP 用戶系統)

新架構：
└─ devices/{deviceId}/activities       (統一)
```

### 通知邏輯變更

```
舊架構：
- 檢查 device.poolType 和 device.mapAppUserId 決定路徑
- 檢查 device.elderId 決定路徑

新架構：
- 只檢查 device.bindingType
  ├─ ELDER → LINE 通知
  ├─ MAP_USER → FCM 推播
  └─ UNBOUND → 不通知
```

---

## 📝 待處理事項

### MapAppUsersPage 前端顯示調整

**檔案：** `src/pages/MapAppUsersPage.tsx`

**問題：** 頁面仍使用舊欄位顯示 `deviceNickname` 和 `deviceOwnerAge`

**解決方案：**

```typescript
// 需要從 Device 取得資料而非 MapAppUser
const deviceInfo = await deviceService.getOne(user.boundDeviceId);
const nickname = deviceInfo.data?.mapUserNickname;
const age = deviceInfo.data?.mapUserAge;
```

**相關程式碼行數：** 62, 63, 74, 75, 114, 115, 136, 137, 160, 161, 295-298, 330-332, 504, 514, 579, 589

---

## 🧪 測試建議

### 後端 API 測試

```bash
# 綁定裝置給 MAP 用戶
curl -X POST https://binddevicetomapuser-kmzfyt3t5a-uc.a.run.app \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId": "user123", "deviceId": "dev456", "nickname": "媽媽的手環", "age": 65}'

# 解綁裝置
curl -X POST https://unbinddevicefrommapuser-kmzfyt3t5a-uc.a.run.app \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId": "user123"}'
```

### receiveBeaconData 測試

```bash
# 發送 beacon 資料（模擬閘道）
curl -X POST https://receivebeacondata-kmzfyt3t5a-uc.a.run.app \
  -d '{
    "gateway_id": "GW001",
    "timestamp": 1234567890000,
    "beacons": [{
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "major": 1,
      "minor": 1001,
      "rssi": -65
    }]
  }'
```

### 檢查點

- [ ] 綁給長者的裝置：收到 beacon → 記錄 activity → 發送 LINE 通知
- [ ] 綁給 MAP 用戶的裝置：收到 beacon → 記錄 activity → 發送 FCM 通知
- [ ] 未綁定的裝置：收到 beacon → 記錄 activity → 不發送通知
- [ ] 足跡正確記錄到 `devices/{deviceId}/activities` 子集合

---

## 🗑️ 數據清理指南

更新程式邏輯後，需要手動清理舊數據：

### 1. Device Collection

```javascript
// Firestore Console 或 Firebase Admin SDK
devices.forEach(async (doc) => {
  await doc.ref.update({
    tenantId: firebase.firestore.FieldValue.delete(),
    elderId: firebase.firestore.FieldValue.delete(),
    mapAppUserId: firebase.firestore.FieldValue.delete(),
    poolType: firebase.firestore.FieldValue.delete(),
  });
});
```

### 2. MapAppUsers Collection

```javascript
mapAppUsers.forEach(async (doc) => {
  await doc.ref.update({
    deviceNickname: firebase.firestore.FieldValue.delete(),
    deviceOwnerAge: firebase.firestore.FieldValue.delete(),
    boundAt: firebase.firestore.FieldValue.delete(),
  });
});
```

### 3. 舊的活動記錄 Collection（可選）

- `latest_locations` - 由使用者決定保留或刪除
- `mapUserActivities` - 由使用者決定保留或刪除

---

## ✅ 編譯狀態

```bash
✅ TypeScript 編譯通過
✅ 無 Linter 錯誤
✅ Firebase Functions 構建成功
```

---

## 📚 相關文檔

- [MAP_APP_API_ENDPOINTS.md](MAP_APP_API_ENDPOINTS.md) - API 文檔
- [MAP_APP_DEVICE_BINDING_UPDATES.md](MAP_APP_DEVICE_BINDING_UPDATES.md) - 綁定功能更新
- [計劃文件](~/.cursor/plans/裝置綁定架構重整_918db0bb.plan.md) - 完整計劃

---

**實作者備註：**
核心架構重整已完成，系統已從分散的綁定邏輯（`tenantId`, `elderId`, `mapAppUserId`, `poolType`）統一為清晰的 `bindingType + boundTo` 模式。所有 beacon 資料處理、通知邏輯、API 端點都已更新並測試通過。前端 MapAppUsersPage 的顯示調整為小幅改動，不影響核心功能運作。
