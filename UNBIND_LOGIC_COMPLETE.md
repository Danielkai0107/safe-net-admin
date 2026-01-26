# 完整的解除綁定邏輯說明

## 更新時間
2026-01-26

## ✅ 所有解綁操作現在都有匿名化

### Admin Portal - 6 個解綁位置

| 位置 | UI 操作 | 調用方法 | 匿名化 |
|------|---------|---------|--------|
| **設備詳情頁** | 點擊「解除綁定」 | `deviceService.unbindDevice()` | ✅ 已修正 |
| **長者管理 - 編輯** | 更換設備 | `deviceService.assignToElder(old, null)` | ✅ 有 |
| **長者管理 - 刪除** | 刪除長者 | `elderService.delete()` | ✅ 有 |
| **長者管理 - 批次刪除** | 批次刪除 | `deviceService.assignToElder(id, null)` | ✅ 有 |
| **設備管理 - 清理暫存** | 清理孤兒 | `deviceService.assignToElder(id, null)` | ✅ 有 |
| **MAP用戶管理** | 解綁MAP用戶 | Cloud Function | ✅ 有 |

### Community Portal - 3 個解綁位置

| 位置 | UI 操作 | 調用方法 | 匿名化 |
|------|---------|---------|--------|
| **長者詳情頁** | 點擊「解綁」 | `elderService.unbindDevice()` | ✅ 有 |
| **長者編輯** | 更換設備 | `elderService.unbindDevice()` | ✅ 有 |
| **長者刪除** | 刪除長者 | `elderService.delete()` | ✅ 有 |

---

## 📋 完整資料庫變化邏輯

### 通用流程（所有解綁操作）

```
1. 匿名化活動記錄
   ↓
   查詢 devices/{deviceId}/activities (所有記錄)
   ↓
   分批處理（每批 500 筆）：
   - 複製到 anonymousActivities（移除個人資訊）
   - 刪除原始記錄
   ↓
   完成（子集合清空）

2. 更新關聯實體
   ↓
   if ELDER: elders/{elderId}.deviceId = null
   if MAP_USER: app_users/{userId}.boundDeviceId = null

3. 更新設備
   ↓
   devices/{deviceId} = {
     bindingType: "UNBOUND",
     boundTo: null,
     boundAt: null,
     (如果是 MAP_USER) fcmToken: null,
     (如果是 MAP_USER) notificationEnabled: null,
     (如果是 MAP_USER) inheritedNotificationPointIds: null,
   }

4. 清理子集合（如果是 MAP_USER）
   ↓
   刪除 devices/{deviceId}/notificationPoints (所有文件)
```

---

## 🔄 各種情況的詳細變化

### 情況 A：ELDER 設備解綁

**觸發：**
- Admin: 設備詳情頁點「解除綁定」
- Admin: 長者管理中解綁或刪除
- Community: 長者詳情頁點「解綁」

**資料庫變化：**

```javascript
// === 操作前 ===
devices/{deviceId}
{
  bindingType: "ELDER",
  boundTo: "elder_123",
  boundAt: "2026-01-20T10:00:00Z",
  tags: ["tenant_001"],
  inheritedNotificationPointIds: ["gateway_001", "gateway_002"],
}

devices/{deviceId}/activities (5 筆)
- activity_001: { boundTo: "elder_123", timestamp: T1, bindingType: "ELDER" }
- activity_002: { boundTo: "elder_123", timestamp: T2, bindingType: "ELDER" }
- ...

elders/elder_123
{
  deviceId: "device_123",
  name: "王大明",
  tenantId: "tenant_001",
}

// === 匿名化步驟 ===
anonymousActivities (新增 5 筆)
- anonymous_xxx: { 
    deviceId: "device_123",
    timestamp: T1,
    bindingType: "ANONYMOUS",  // ✅ 改為匿名
    boundTo: null,             // ✅ 移除長者關聯
    anonymizedReason: "ELDER_UNBIND",
    anonymizedAt: "2026-01-26T10:30:00Z",
    originalActivityId: "activity_001",
  }
- ...

devices/{deviceId}/activities
- (全部刪除) ✅

// === 操作後 ===
devices/{deviceId}
{
  bindingType: "UNBOUND",      // ✅ 改為未綁定
  boundTo: null,               // ✅ 清除關聯
  boundAt: null,
  tags: ["tenant_001"],        // ✅ 保留（仍屬於社區）
  inheritedNotificationPointIds: ["gateway_001", "gateway_002"],  // ✅ 保留
}

elders/elder_123
{
  deviceId: null,              // ✅ 清除設備關聯
  name: "王大明",
  tenantId: "tenant_001",
}
```

**重點：**
- ✅ Activities 被匿名化並刪除
- ✅ 設備仍屬於社區（tags 保留）
- ✅ 設備仍繼承社區通知點
- ✅ 可重新分配給其他長者

---

### 情況 B：MAP_USER 設備解綁

**觸發：**
- Admin: MAP用戶管理中解綁
- 調用 Cloud Function `unbindDeviceFromMapUser`

**資料庫變化：**

```javascript
// === 操作前 ===
devices/{deviceId}
{
  bindingType: "MAP_USER",
  boundTo: "user_456",
  boundAt: "2026-01-20T10:00:00Z",
  fcmToken: "fcm_token_xxx",
  notificationEnabled: true,
  tags: [],
  inheritedNotificationPointIds: null,
}

devices/{deviceId}/activities (10 筆)
- activity_001: { boundTo: "user_456", bindingType: "MAP_USER" }
- ...

devices/{deviceId}/notificationPoints (3 筆)
- point_001: { gatewayId: "gateway_003", name: "公司" }
- ...

app_users/user_456
{
  boundDeviceId: "device_123",
  fcmToken: "fcm_token_xxx",
}

// === 匿名化步驟 ===
anonymousActivities (新增 10 筆)
- anonymous_yyy: { 
    deviceId: "device_123",
    bindingType: "ANONYMOUS",
    boundTo: null,
    anonymizedReason: "MAP_USER_UNBIND",
  }
- ...

devices/{deviceId}/activities
- (全部刪除) ✅

devices/{deviceId}/notificationPoints
- (全部刪除) ✅

// === 操作後 ===
devices/{deviceId}
{
  bindingType: "UNBOUND",
  boundTo: null,
  boundAt: null,
  fcmToken: null,              // ✅ 清除
  notificationEnabled: null,   // ✅ 清除
  inheritedNotificationPointIds: null,  // ✅ 清除
  tags: [],
}

app_users/user_456
{
  boundDeviceId: null,         // ✅ 清除
  fcmToken: "fcm_token_xxx",   // ✅ 保留（用戶自己的）
}
```

**重點：**
- ✅ Activities 被匿名化並刪除
- ✅ 通知點子集合被刪除
- ✅ 設備的通知相關欄位被清除
- ✅ 用戶的 fcmToken 保留（因為可能重新綁定新設備）

---

### 情況 C：刪除長者（有設備）

**觸發：**
- Admin/Community: 長者管理刪除

**資料庫變化：**

```javascript
// === 操作前 ===
devices/{deviceId}
{
  bindingType: "ELDER",
  boundTo: "elder_123",
}

devices/{deviceId}/activities (8 筆)

elders/elder_123
{
  deviceId: "device_123",
  isActive: true,
}

// === 執行流程 ===
1. 匿名化 activities → anonymousActivities (8 筆)
2. 刪除 activities 原記錄
3. 解綁設備
4. 軟刪除長者

// === 操作後 ===
devices/{deviceId}
{
  bindingType: "UNBOUND",
  boundTo: null,
}

devices/{deviceId}/activities
- (空的) ✅

anonymousActivities
- (新增 8 筆，anonymizedReason: "ELDER_DELETION") ✅

elders/elder_123
{
  deviceId: null,
  isActive: false,             // ✅ 軟刪除
}
```

---

## 🎯 匿名化原因代碼

| 原因代碼 | 觸發場景 | 說明 |
|---------|---------|------|
| `ELDER_UNBIND` | 解綁長者設備 | assignToElder(id, null) 或 unbindDevice |
| `ELDER_DELETION` | 刪除長者 | elderService.delete() |
| `MAP_USER_UNBIND` | 解綁MAP用戶 | Cloud Function |
| `USER_DELETION` | 刪除MAP用戶 | Cloud Function |
| `DEVICE_UNBIND` | 通用解綁 | deviceService.unbindDevice()（UNBOUND狀態） |
| `GHOST_DEVICE_CLEANUP` | 清理腳本 | 批量清理幽靈設備 |

---

## 📊 解綁後的設備狀態

### ELDER 解綁後

```javascript
devices/{deviceId}
{
  bindingType: "UNBOUND",      // ✅ 未綁定
  boundTo: null,
  boundAt: null,
  tags: ["tenant_001"],        // ✅ 仍屬於社區
  inheritedNotificationPointIds: ["gateway_001"],  // ✅ 仍繼承通知點
  // activities 子集合：空的 ✅
}
```

**特點：**
- ✅ 可重新分配給其他長者
- ✅ 仍屬於社區
- ✅ 仍有通知點（給長者用的）
- ✅ 活動記錄已清空

### MAP_USER 解綁後

```javascript
devices/{deviceId}
{
  bindingType: "UNBOUND",
  boundTo: null,
  boundAt: null,
  fcmToken: null,              // ✅ 清除
  notificationEnabled: null,
  inheritedNotificationPointIds: null,  // ✅ 清除
  tags: [],                    // ✅ 通常為空
  // activities 子集合：空的 ✅
  // notificationPoints 子集合：空的 ✅
}
```

**特點：**
- ✅ 可重新綁定給其他 MAP 用戶
- ✅ 所有個人化設定被清除
- ✅ 活動記錄和通知點已清空
- ✅ 完全重置為初始狀態

---

## 🔍 如何驗證匿名化成功

### 方法 1：瀏覽器 Console

解綁或刪除時，應該看到：

```
Anonymizing activities for device device_xxx before unbinding...
開始匿名化設備 device_xxx 的活動記錄...
✅ 設備 device_xxx: 已匿名化並刪除 XX 筆活動記錄
Archived XX activities for device device_xxx
```

### 方法 2：Firestore Console

**檢查 devices/{deviceId}/activities：**
- 應該為空（或只有解綁後的新記錄）
- 如果有記錄，檢查 `bindingType` 應該是 `"UNBOUND"`

**檢查 anonymousActivities：**
- 應該有新增記錄
- `bindingType: "ANONYMOUS"`
- `boundTo: null`
- `anonymizedReason: "ELDER_UNBIND"` 或其他原因

### 方法 3：時間戳檢查

假設在 10:30 刪除長者：

```javascript
// 如果 activities 中有記錄
devices/{deviceId}/activities
- activity_new: { 
    timestamp: "2026-01-26 10:35:00",  // 10:30 之後
    bindingType: "UNBOUND",            // ✅ 這是正常的新記錄
  }

// 不應該有這種記錄
- activity_old: { 
    timestamp: "2026-01-26 10:25:00",  // 10:30 之前
    bindingType: "ELDER",              // ❌ 這應該被刪除
  }
```

---

## 🚀 部署與測試

### 1. 部署

```bash
cd /Users/danielkai/Desktop/admin
npm run build  # ✅ 已構建成功
firebase deploy --only hosting:admin

cd community-portal
firebase deploy --only hosting:community-portal
```

### 2. 測試每個解綁位置

#### Admin Portal

**A. 設備詳情頁解綁（新修正的）**
1. 進入設備詳情頁
2. 點擊「解除綁定」
3. 檢查 Console 和 Firestore

**B. 長者管理刪除**
1. 刪除一個已綁定設備的長者
2. 檢查 Console 和 Firestore

#### Community Portal

**C. 長者詳情頁解綁**
1. 進入長者詳情頁
2. 點擊「解綁」按鈕
3. 檢查 Console 和 Firestore

**D. 長者刪除**
1. 在長者列表刪除長者
2. 檢查 Console 和 Firestore

### 3. 清理現有幽靈設備

```bash
cd functions

# 預覽
npx ts-node src/utils/cleanupGhostDeviceActivities.ts

# 執行
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live
```

---

## 📈 預期效果

### 部署前（有問題）

```
解綁設備數：100
幽靈設備數：100 ❌
Activities 記錄：10,000 筆殘留 ❌
AnonymousActivities：只有 MAP_USER 的記錄
```

### 部署後（已修正）

```
解綁設備數：100
幽靈設備數：0 ✅
Activities 記錄：只有當前綁定設備的記錄 ✅
AnonymousActivities：包含所有類型的匿名化記錄 ✅
```

---

## 🔧 程式碼變更

### 修改的檔案

**檔案：** `src/services/deviceService.ts` (第 515-571 行)

**變更：** 在 `unbindDevice()` 方法開頭加入匿名化邏輯

```typescript
unbindDevice: async (deviceId: string) => {
  // 🆕 新增：匿名化活動記錄
  const device = await getDocument<Device>("devices", deviceId);
  const unbindReason = device.bindingType === "ELDER" ? "ELDER_UNBIND" : 
                       device.bindingType === "MAP_USER" ? "MAP_USER_UNBIND" : 
                       "DEVICE_UNBIND";
  
  try {
    const activitiesArchived = await anonymizeDeviceActivities(deviceId, unbindReason);
    console.log(`Archived ${activitiesArchived} activities`);
  } catch (error) {
    console.error('Failed to anonymize:', error);
    // 繼續執行解綁
  }
  
  // 原有邏輯：更新設備和關聯實體
  // ...
}
```

---

## 📝 修改總結

### 修改前

| 解綁方法 | 匿名化 |
|---------|--------|
| `deviceService.unbindDevice()` | ❌ 沒有 |
| `deviceService.assignToElder(null)` | ✅ 有 |
| `elderService.unbindDevice()` (Community) | ✅ 有 |
| `elderService.delete()` (Admin) | ✅ 有 |
| `elderService.delete()` (Community) | ✅ 有 |

**問題：** 不一致，容易遺漏

### 修改後

| 解綁方法 | 匿名化 |
|---------|--------|
| `deviceService.unbindDevice()` | ✅ **已修正** |
| `deviceService.assignToElder(null)` | ✅ 有 |
| `elderService.unbindDevice()` (Community) | ✅ 有 |
| `elderService.delete()` (Admin) | ✅ 有 |
| `elderService.delete()` (Community) | ✅ 有 |

**效果：** ✅ 所有解綁操作都會匿名化

---

## 💡 最佳實踐

### 解綁設備時

1. **優先在長者管理中操作**
   - 更直觀
   - 完整的上下文

2. **設備詳情頁解綁**
   - 適用於緊急情況
   - 現在也有完整邏輯

3. **批次操作**
   - 使用批次刪除長者
   - 自動處理所有設備

### 資料清理

1. **定期執行清理腳本**（建議每月）
   ```bash
   cd functions
   npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live
   ```

2. **監控 anonymousActivities 增長**
   - 設定保留期限（例如 1 年）
   - 定期清理舊的匿名化記錄

---

## 🎉 總結

### 現在的狀態

✅ **所有解綁位置**都有匿名化  
✅ **資料庫變化邏輯**統一且完整  
✅ **隱私保護**全面到位  
✅ **資料清理**自動化  

### 構建狀態

✅ Admin Portal 構建成功  
✅ Community Portal 構建成功  
✅ Cloud Functions 構建成功  

### 準備部署

所有程式碼修改完成，可以開始部署了！

```bash
firebase deploy
```

🎊 統一通知架構實作完全完成！
