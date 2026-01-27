# LINE 通知簡化邏輯說明

## 核心改變

### 之前的複雜邏輯
- 需要判斷 gateway.isAD
- 需要查詢用戶在多個 tenant 的 membership
- 需要處理多個 tenant 發送通知
- 不同的冷卻時間（5 分鐘）

### 現在的簡化邏輯
- **直接從 device.tags[0] 取得唯一的 tenantId**
- **根據 tenant.BU_type 決定通知方式**
- **統一 3 分鐘冷卻時間**

## 通知判斷流程

### 流程圖

```
收到 Beacon 資料
  ↓
檢查 Gateway 類型（跳過 OBSERVE_ZONE/INACTIVE）
  ↓
獲取 Device 資料
  ↓
從 device.tags[0] 取得 tenantId
  ↓
查詢 tenant.BU_type
  ↓
根據 BU_type 決定：

┌─────────────────────────────────────────────────┐
│ BU_type = "card"                                 │
│   ✓ 單發給 device.boundTo                       │
│   ✓ 不檢查通知點（每次都通知）                  │
│   ✓ 3 分鐘冷卻時間                               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ BU_type = "safe"                                 │
│   ✓ 單發給 device.boundTo                       │
│   ✓ 檢查 inheritedNotificationPointIds          │
│   ✓ 3 分鐘冷卻時間                               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ BU_type = "group"                                │
│   ✓ 群發給 elder 所屬社區的所有成員              │
│   ✓ 檢查 inheritedNotificationPointIds          │
│   ✓ 3 分鐘冷卻時間                               │
│   ✓ 只有 bindingType=ELDER 才觸發                │
└─────────────────────────────────────────────────┘
```

## 詳細邏輯

### 1. LINE_USER 設備（BU_type: card 或 safe）

#### Card 模式
```typescript
// 條件
device.bindingType === "LINE_USER"
device.tags[0] 對應的 tenant.BU_type === "card"

// 行為
1. 不檢查 inheritedNotificationPointIds
2. 每個訊號都觸發通知
3. 單發給 device.boundTo（LINE_USER）
4. 3 分鐘冷卻時間

// 使用場景
- 行銷通知
- 活動提醒
- 即時通知需求
```

#### Safe 模式
```typescript
// 條件
device.bindingType === "LINE_USER"
device.tags[0] 對應的 tenant.BU_type === "safe"

// 行為
1. 檢查 device.inheritedNotificationPointIds
2. 只有當 gateway.id 在列表中才通知
3. 單發給 device.boundTo（LINE_USER）
4. 3 分鐘冷卻時間

// 使用場景
- 家屬監控
- 安全通知
- 指定地點通知
```

### 2. ELDER 設備（BU_type: group）

#### Group 模式
```typescript
// 條件
device.bindingType === "ELDER"
device.tags[0] 對應的 tenant.BU_type === "group"

// 行為
1. 檢查 device.inheritedNotificationPointIds
2. 只有當 gateway.id 在列表中才通知
3. 群發給 elder.tenantId 社區的所有 APPROVED 成員
4. 3 分鐘冷卻時間

// 使用場景
- 社區照護
- 長輩監護
- 群發通知需求

// 特殊處理
- 首次活動通知（優先級最高）：不需要檢查通知點
```

## 資料結構

### Device
```javascript
{
  id: "device_001",
  bindingType: "LINE_USER" | "ELDER",
  boundTo: "line_user_doc_id" | "elder_id",
  tags: ["tenant_001"],  // ← 直接是 tenantId
  inheritedNotificationPointIds: ["gateway_001", "gateway_002"],
  // ...
}
```

### Tenant
```javascript
{
  id: "tenant_001",
  name: "大愛社區",
  BU_type: "card" | "safe" | "group",  // ← 決定通知方式
  lineChannelAccessToken: "xxx",
  // ...
}
```

### Notification Cooldown
```javascript
// LINE_USER
{
  id: "device_{deviceId}_gateway_{gatewayId}",
  deviceId: "device_001",
  gatewayId: "gateway_001",
  tenantId: "tenant_001",
  buType: "card" | "safe",
  lastSentAt: Timestamp,
  updatedAt: Timestamp
}

// ELDER
{
  id: "elder_{elderId}_gateway_{gatewayId}",
  elderId: "elder_001",
  gatewayId: "gateway_001",
  tenantId: "tenant_001",
  buType: "group",
  lastSentAt: Timestamp,
  updatedAt: Timestamp
}
```

## 使用範例

### 範例 1：家屬監控（Safe 模式）
```javascript
// 設定
device = {
  bindingType: "LINE_USER",
  boundTo: "line_user_wang",
  tags: ["tenant_dalove"],  // 大愛社區
  inheritedNotificationPointIds: ["gateway_entrance", "gateway_exit"]
}

tenant_dalove = {
  BU_type: "safe",
  lineChannelAccessToken: "xxx"
}

// 結果
- 只有通過 gateway_entrance 或 gateway_exit 時才通知
- 單發給王先生（LINE_USER）
- 3 分鐘內不重複通知
```

### 範例 2：行銷通知（Card 模式）
```javascript
// 設定
device = {
  bindingType: "LINE_USER",
  boundTo: "line_user_chen",
  tags: ["tenant_marketing"]
}

tenant_marketing = {
  BU_type: "card",
  lineChannelAccessToken: "yyy"
}

// 結果
- 通過任何 gateway 都通知
- 不需要設定 inheritedNotificationPointIds
- 單發給陳小姐（LINE_USER）
- 3 分鐘內不重複通知
```

### 範例 3：社區照護（Group 模式）
```javascript
// 設定
device = {
  bindingType: "ELDER",
  boundTo: "elder_li",
  tags: ["tenant_dalove"],  // 設備所屬社區（用於查詢 BU_type）
  inheritedNotificationPointIds: ["gateway_entrance"]
}

elder_li = {
  tenantId: "tenant_dalove"  // 李奶奶所屬社區
}

tenant_dalove = {
  BU_type: "group",
  lineChannelAccessToken: "zzz"
}

// 結果
- 只有通過 gateway_entrance 時才通知
- 群發給大愛社區的所有 APPROVED 成員
- 3 分鐘內不重複通知
```

## 診斷問題

### 問題：LINE_USER 沒收到通知

**檢查清單：**

1. **Device 資料**
   ```
   - tags: ["tenant_xxx"] ← 是否有值？
   - bindingType: "LINE_USER" ← 是否正確？
   - boundTo: "xxx" ← 是否有值？
   - inheritedNotificationPointIds: [...] ← 如果是 safe 模式，是否包含該 gateway？
   ```

2. **Tenant 資料**
   ```
   - BU_type: "card" 或 "safe" ← 是否有設定？（注意大小寫）
   - isActive: true ← 是否啟用？
   - lineChannelAccessToken: "xxx" ← 是否有設定？
   ```

3. **LINE_USER 資料**
   ```
   - lineUserId: "U123..." ← 是否有值？
   ```

4. **Gateway 資料**
   ```
   - type: 不是 "OBSERVE_ZONE" 或 "INACTIVE"
   - isActive: true
   ```

5. **查看 Cloud Functions 日誌**
   ```bash
   firebase functions:log --only receiveBeaconData
   ```
   
   關鍵日誌：
   - `Device xxx belongs to tenant yyy`
   - `Tenant yyy BU_type: safe`
   - `Safe mode: checking notification points [...]`
   - `Gateway xxx is in notification points, proceeding`
   - `✓ Sent LINE notification to Uxxx via tenant yyy`

### 問題：ELDER 重複通知

**已修復：**
- 加入 3 分鐘冷卻時間
- 使用 `notification_cooldowns` 集合記錄

**驗證：**
```javascript
// 查看冷卻記錄
db.collection('notification_cooldowns')
  .where('elderId', '==', 'YOUR_ELDER_ID')
  .get()
```

應該看到 `lastSentAt` 和冷卻時間記錄。

## 部署

```bash
cd functions
npm run build
firebase deploy --only functions:receiveBeaconData
```

部署後，所有修改將生效：
- 簡化的通知邏輯
- 統一的 3 分鐘冷卻時間
- 詳細的診斷日誌
