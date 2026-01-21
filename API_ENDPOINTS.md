# API 端點總覽

## 📋 所有 Cloud Functions 端點

### 🔹 接收器相關 API

| 功能 | 端點 | 用途 | 頻率 |
|------|------|------|------|
| **獲取服務 UUID** | [getServiceUuids](#1-getserviceuuids) | 獲取應該掃描的 UUID 列表 | 初始化 + 每天一次 |
| **獲取設備白名單** | [getDeviceWhitelist](#2-getdevicewhitelist) | 獲取應該上傳的設備列表 | 每 5 分鐘 |
| **上傳 Beacon 數據** | [receiveBeaconData](#3-receivebeacondata) | 上傳掃描到的 Beacon 訊號 | 即時 |

### 🔹 LINE 通知相關 API

| 功能 | 端點 | 用途 |
|------|------|------|
| **LINE Webhook** | [lineWebhook](#4-linewebhook) | 處理 LINE 回調事件 |
| **驗證用戶社區** | [verifyUserTenant](#5-verifyusertenant) | 驗證 LINE 用戶所屬社區 |
| **獲取社區追蹤者** | [getTenantFollowers](#6-gettenantfollowers) | 獲取社區 LINE 追蹤者列表 |

### 🔹 警報管理相關 API

| 功能 | 端點 | 用途 |
|------|------|------|
| **分配警報** | [assignAlert](#7-assignalert) | 分配警報給成員 |
| **接受警報** | [acceptAlertAssignment](#8-acceptalertassignment) | 成員接受警報 |
| **拒絕警報** | [declineAlertAssignment](#9-declinealertassignment) | 成員拒絕警報 |
| **完成警報** | [completeAlert](#10-completealert) | 標記警報完成 |
| **檢查無活動長輩** | [checkInactiveElders](#11-checkinactiveelders) | 定時檢查無活動長輩 |

---

## 🔗 詳細 API 說明

### 1. getServiceUuids
**獲取服務 UUID 列表**

```
URL: https://getserviceuuids-kmzfyt3t5a-uc.a.run.app
方法: GET / POST
認證: 不需要
```

**回應範例:**
```json
{
  "success": true,
  "uuids": [
    "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"
  ],
  "count": 1,
  "timestamp": 1737360000000
}
```

**用途:**
- 接收器初始化時獲取應該掃描的 UUID
- 只掃描指定 UUID 的 Beacon，提升效能

**文檔:** [SERVICE_UUID_API.md](SERVICE_UUID_API.md)

---

### 2. getDeviceWhitelist
**獲取設備白名單**

```
URL: https://getdevicewhitelist-kmzfyt3t5a-uc.a.run.app
方法: GET / POST
認證: 不需要
```

**回應範例:**
```json
{
  "success": true,
  "devices": [
    {
      "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      "major": 1,
      "minor": 1001,
      "deviceName": "1-1001",
      "macAddress": "AA:BB:CC:DD:EE:FF"
    }
  ],
  "count": 1,
  "timestamp": 1737360000000
}
```

**用途:**
- 接收器定期獲取應該上傳的設備列表
- 用 UUID + Major + Minor 比對掃描到的 Beacon

**文檔:** [RECEIVER_WHITELIST_GUIDE.md](RECEIVER_WHITELIST_GUIDE.md)

---

### 3. receiveBeaconData
**接收 Beacon 數據**

```
URL: https://receivebeacondata-kmzfyt3t5a-uc.a.run.app
方法: POST
認證: 不需要（但接收器需註冊）
```

**請求範例:**
```json
{
  "gateway_id": "IMEI_123456",
  "lat": 25.033,
  "lng": 121.565,
  "timestamp": 1737360000000,
  "beacons": [
    {
      "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      "major": 1,
      "minor": 1001,
      "rssi": -65,
      "batteryLevel": 85
    }
  ]
}
```

**欄位說明:**
- `gateway_id` (必需): 接收器識別碼（MAC Address 或 IMEI）
- `lat` (選填): 緯度（移動接收器建議提供）
- `lng` (選填): 經度（移動接收器建議提供）
- `timestamp` (必需): 時間戳記（毫秒）
- `beacons` (必需): Beacon 陣列
  - `uuid` (必需): 服務識別碼
  - `major` (必需): 群組編號
  - `minor` (必需): 設備編號
  - `rssi` (必需): 信號強度
  - `batteryLevel` (選填): 電量百分比 (0-100)

**回應範例:**
```json
{
  "success": true,
  "received": 1,
  "updated": 1,
  "ignored": 0,
  "timestamp": 1737360000000
}
```

**用途:**
- 接收器上傳掃描到的 Beacon 訊號
- 更新長者位置
- 觸發 LINE 通知

---

### 4. lineWebhook
**LINE Webhook**

```
URL: https://us-central1-safe-net-tw.cloudfunctions.net/lineWebhook
方法: POST
認證: LINE Signature 驗證
```

**用途:**
- 處理 LINE 事件（Follow、Unfollow、Message）
- 處理 Postback 互動（接受/拒絕警報）

---

### 5. verifyUserTenant
**驗證用戶社區**

```
URL: https://us-central1-safe-net-tw.cloudfunctions.net/verifyUserTenant
方法: POST
認證: 需要
```

**用途:**
- LIFF App 驗證用戶所屬社區
- 確認用戶有權限訪問社區資料

---

### 6. getTenantFollowers
**獲取社區追蹤者**

```
URL: https://us-central1-safe-net-tw.cloudfunctions.net/getTenantFollowers
方法: POST
認證: 需要
```

**用途:**
- 獲取社區的 LINE 追蹤者列表
- 用於推送通知

---

### 7. assignAlert
**分配警報**

```
URL: https://us-central1-safe-net-tw.cloudfunctions.net/assignAlert
方法: POST
認證: 需要
```

**用途:**
- 管理員分配警報給成員
- 發送 LINE 通知（含互動按鈕）

---

### 8. acceptAlertAssignment
**接受警報**

```
URL: https://us-central1-safe-net-tw.cloudfunctions.net/acceptAlertAssignment
方法: POST
認證: 需要
```

**用途:**
- 成員接受警報分配
- 更新警報狀態

---

### 9. declineAlertAssignment
**拒絕警報**

```
URL: https://us-central1-safe-net-tw.cloudfunctions.net/declineAlertAssignment
方法: POST
認證: 需要
```

**用途:**
- 成員拒絕警報分配
- 返回待分配狀態

---

### 10. completeAlert
**完成警報**

```
URL: https://us-central1-safe-net-tw.cloudfunctions.net/completeAlert
方法: POST
認證: 需要
```

**用途:**
- 標記警報為已完成
- 結束警報處理流程

---

### 11. checkInactiveElders
**檢查無活動長輩**

```
URL: https://us-central1-safe-net-tw.cloudfunctions.net/checkInactiveElders
方法: 定時觸發（00:00, 12:00, 18:00）
認證: 內部調用
```

**用途:**
- 定時檢查無活動長輩
- 發送注意通知給管理員

---

## 🔄 接收器 App 完整流程

```
1. 初始化
   ├─ 調用 getServiceUuids
   │  └─ 獲取: ["E2C56DB5-...", "FDA50693-..."]
   └─ 調用 getDeviceWhitelist
      └─ 獲取設備列表

2. 開始掃描
   └─ 只掃描步驟 1 獲取的 UUID

3. 掃描到 Beacon
   ├─ 檢查: UUID 是否在服務 UUID 列表中？
   │  └─ 否 → 忽略
   │  └─ 是 → 繼續
   └─ 檢查: UUID+Major+Minor 是否在白名單中？
      └─ 否 → 忽略
      └─ 是 → 上傳

4. 上傳數據
   └─ 調用 receiveBeaconData
      └─ 包含: gateway_id, GPS, beacons[]

5. 定期更新（背景執行）
   ├─ 每天更新一次 getServiceUuids
   └─ 每 5 分鐘更新一次 getDeviceWhitelist
```

---

## 📊 API 調用頻率建議

| API | 建議頻率 | 原因 |
|-----|---------|------|
| getServiceUuids | 初始化 + 每天一次 | UUID 很少變動 |
| getDeviceWhitelist | 每 5 分鐘 | 設備可能新增/停用 |
| receiveBeaconData | 即時上傳 | 及時更新位置 |

---

## 🔧 快速測試腳本

### 測試服務 UUID API
```bash
curl https://getserviceuuids-kmzfyt3t5a-uc.a.run.app | jq
```

### 測試白名單 API
```bash
curl https://getdevicewhitelist-kmzfyt3t5a-uc.a.run.app | jq
```

### 測試上傳 API
```bash
curl -X POST https://receivebeacondata-kmzfyt3t5a-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d '{
    "gateway_id": "TEST_001",
    "lat": 25.033964,
    "lng": 121.564468,
    "timestamp": '$(date +%s000)',
    "beacons": [
      {
        "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        "major": 1,
        "minor": 1001,
        "rssi": -65
      }
    ]
  }' | jq
```

---

## 📞 相關文檔

- **服務 UUID API:** [SERVICE_UUID_API.md](SERVICE_UUID_API.md)
- **白名單使用指南:** [RECEIVER_WHITELIST_GUIDE.md](RECEIVER_WHITELIST_GUIDE.md)
- **Beacon 硬體指南:** [BEACON_HARDWARE_GUIDE.md](BEACON_HARDWARE_GUIDE.md)
- **通知功能說明:** [NOTIFICATION_FEATURES.md](NOTIFICATION_FEATURES.md)
- **UUID 管理:** [UUID_MANAGEMENT.md](UUID_MANAGEMENT.md)

---

## 🎯 Firebase Console 連結

- **專案總覽:** https://console.firebase.google.com/project/safe-net-tw/overview
- **Functions:** https://console.firebase.google.com/project/safe-net-tw/functions
- **Functions 日誌:** https://console.firebase.google.com/project/safe-net-tw/functions/logs
- **Firestore:** https://console.firebase.google.com/project/safe-net-tw/firestore
- **前端網站:** https://safe-net-tw.web.app

---

**更新日期:** 2026-01-20  
**專案:** safe-net-tw  
**總 Functions 數:** 11
