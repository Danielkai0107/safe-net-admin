# 服務 UUID API

## 📋 概述

這個 API 專門用於獲取系統中所有啟用的服務 UUID（beacon_uuids）列表。接收器 App 可以使用這個端點來知道應該掃描哪些 UUID 的 Beacon。

---

## 🔗 API 端點

**URL:**
```
https://getserviceuuids-kmzfyt3t5a-uc.a.run.app
```

**方法:** `GET` 或 `POST`

**認證:** 不需要（公開端點）

---

## 📊 回應格式

### 成功回應

```json
{
  "success": true,
  "uuids": [
    "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
    "FDA50693-A4E2-4FB1-AFCF-C6EB07647825"
  ],
  "count": 2,
  "timestamp": 1737360000000
}
```

### 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| success | boolean | 請求是否成功 |
| uuids | string[] | UUID 字串陣列 |
| count | number | UUID 數量 |
| timestamp | number | 回應時間戳（毫秒） |

---

## 🎯 使用場景

### 1. 接收器初始化

接收器 App 啟動時，獲取應該掃描的 UUID 列表：

```kotlin
class BeaconScanner {
    private val serviceUuids = mutableSetOf<String>()
    
    suspend fun initialize() {
        try {
            val response = apiService.getServiceUuids()
            if (response.success) {
                serviceUuids.clear()
                serviceUuids.addAll(response.uuids) // 直接使用 UUID 字串陣列
                Log.d("Scanner", "Loaded ${serviceUuids.size} service UUIDs")
            }
        } catch (e: Exception) {
            Log.e("Scanner", "Failed to load service UUIDs", e)
        }
    }
    
    fun shouldScan(beaconUuid: String): Boolean {
        return serviceUuids.contains(beaconUuid)
    }
}
```

### 2. 掃描過濾

只掃描指定 UUID 的 Beacon，提升效率：

```kotlin
class BeaconManager {
    private val serviceUuids = listOf(
        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        "FDA50693-A4E2-4FB1-AFCF-C6EB07647825"
    )
    
    fun startScanning() {
        beaconManager.startRangingBeaconsInRegion(
            Region("myBeacons", 
                Identifier.parse(serviceUuids[0]), // 主要 UUID
                null, null
            )
        )
        
        // 如果有多個 UUID，為每個 UUID 創建 Region
        serviceUuids.forEach { uuid ->
            beaconManager.startRangingBeaconsInRegion(
                Region("uuid-$uuid", 
                    Identifier.parse(uuid), 
                    null, null
                )
            )
        }
    }
}
```

---

## 💡 與白名單 API 的區別

### getServiceUuids（本 API）

```json
{
  "uuids": [
    {
      "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      "name": "公司主要 UUID"
    }
  ]
}
```

**用途：** 知道應該掃描哪些 UUID
**頻率：** 初始化時 + 偶爾更新（例如每天一次）
**資料量：** 非常小（通常只有 1-3 個 UUID）

### getDeviceWhitelist

```json
{
  "devices": [
    {
      "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      "major": 1,
      "minor": 1001
    },
    {
      "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      "major": 1,
      "minor": 1002
    }
  ]
}
```

**用途：** 知道應該上傳哪些 Beacon（UUID + Major + Minor）
**頻率：** 定期更新（每 5 分鐘）
**資料量：** 較大（可能有數百個設備）

---

## 🔧 完整實作範例

### Android Kotlin

```kotlin
// 1. API 介面定義
interface BeaconApiService {
    @GET("getServiceUuids")
    suspend fun getServiceUuids(): ServiceUuidResponse
    
    @GET("getDeviceWhitelist")
    suspend fun getDeviceWhitelist(): DeviceWhitelistResponse
}

data class ServiceUuidResponse(
    val success: Boolean,
    val uuids: List<String>,  // 直接就是 UUID 字串陣列
    val count: Int,
    val timestamp: Long
)

// 2. 服務 UUID 管理器
class ServiceUuidManager(private val apiService: BeaconApiService) {
    private val _serviceUuids = MutableStateFlow<Set<String>>(emptySet())
    val serviceUuids: StateFlow<Set<String>> = _serviceUuids.asStateFlow()
    
    suspend fun fetchServiceUuids() {
        try {
            val response = apiService.getServiceUuids()
            if (response.success) {
                _serviceUuids.value = response.uuids.map { it.uuid }.toSet()
                Log.d("UuidManager", "Loaded ${response.count} service UUIDs")
            }
        } catch (e: Exception) {
            Log.e("UuidManager", "Failed to fetch service UUIDs", e)
        }
    }
    
    fun isValidServiceUuid(uuid: String): Boolean {
        return _serviceUuids.value.contains(uuid)
    }
}

// 3. Beacon 掃描器（結合兩個 API）
class BeaconScannerService : Service(), BeaconConsumer {
    private lateinit var beaconManager: BeaconManager
    private lateinit var serviceUuidManager: ServiceUuidManager
    private lateinit var whitelistManager: DeviceWhitelistManager
    
    override fun onCreate() {
        super.onCreate()
        
        // 初始化管理器
        serviceUuidManager = ServiceUuidManager(apiService)
        whitelistManager = DeviceWhitelistManager(apiService)
        
        // 獲取服務 UUID（初始化一次即可）
        lifecycleScope.launch {
            serviceUuidManager.fetchServiceUuids()
            setupBeaconScanning()
        }
        
        // 定期更新白名單（每 5 分鐘）
        lifecycleScope.launch {
            while (isActive) {
                whitelistManager.fetchWhitelist()
                delay(5 * 60 * 1000L)
            }
        }
    }
    
    private fun setupBeaconScanning() {
        beaconManager = BeaconManager.getInstanceForApplication(this)
        
        // 設定掃描的 UUID（從服務 UUID 管理器獲取）
        serviceUuidManager.serviceUuids.value.forEach { uuid ->
            val region = Region("service-$uuid", Identifier.parse(uuid), null, null)
            beaconManager.startRangingBeaconsInRegion(region)
            Log.d("Scanner", "Started ranging for UUID: $uuid")
        }
        
        beaconManager.addRangeNotifier { beacons, region ->
            onBeaconsDetected(beacons)
        }
        
        beaconManager.bind(this)
    }
    
    private fun onBeaconsDetected(beacons: Collection<Beacon>) {
        // 第一層過濾：檢查 UUID 是否在服務 UUID 列表中
        val validServiceBeacons = beacons.filter { beacon ->
            serviceUuidManager.isValidServiceUuid(beacon.id1.toString())
        }
        
        // 第二層過濾：檢查是否在白名單中（UUID + Major + Minor）
        val whitelistedBeacons = validServiceBeacons.filter { beacon ->
            whitelistManager.isInWhitelist(beacon)
        }
        
        if (whitelistedBeacons.isNotEmpty()) {
            Log.d("Scanner", "Found ${whitelistedBeacons.size} whitelisted beacons")
            uploadBeacons(whitelistedBeacons)
        }
    }
    
    private suspend fun uploadBeacons(beacons: Collection<Beacon>) {
        // 上傳到 receiveBeaconData API
        // ...
    }
}
```

---

## 📝 測試

### 使用 curl 測試

```bash
# GET 請求
curl https://getserviceuuids-kmzfyt3t5a-uc.a.run.app

# 格式化輸出
curl https://getserviceuuids-kmzfyt3t5a-uc.a.run.app | jq

# POST 請求（也支援）
curl -X POST https://getserviceuuids-kmzfyt3t5a-uc.a.run.app
```

### 預期回應

```json
{
  "success": true,
  "uuids": [
    "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"
  ],
  "count": 1,
  "timestamp": 1737360123456
}
```

---

## 🎯 最佳實踐

### 1. 更新策略

```kotlin
class ServiceUuidManager {
    // 初始化時立即獲取
    init {
        lifecycleScope.launch {
            fetchServiceUuids()
        }
    }
    
    // 每天更新一次（服務 UUID 很少變動）
    fun startPeriodicUpdate() {
        lifecycleScope.launch {
            while (isActive) {
                fetchServiceUuids()
                delay(24 * 60 * 60 * 1000L) // 24 小時
            }
        }
    }
}
```

### 2. 錯誤處理

```kotlin
suspend fun fetchServiceUuids() {
    try {
        val response = withTimeout(10_000) {
            apiService.getServiceUuids()
        }
        
        if (response.success && response.uuids.isNotEmpty()) {
            _serviceUuids.value = response.uuids.map { it.uuid }.toSet()
            saveToCache(response.uuids) // 快取到本地
        } else {
            loadFromCache() // 從快取載入
        }
    } catch (e: TimeoutException) {
        Log.e("UuidManager", "Timeout fetching UUIDs")
        loadFromCache()
    } catch (e: Exception) {
        Log.e("UuidManager", "Error fetching UUIDs", e)
        loadFromCache()
    }
}
```

### 3. 快取機制

```kotlin
private fun saveToCache(uuids: List<String>) {
    val json = Gson().toJson(uuids)
    sharedPreferences.edit()
        .putString("service_uuids", json)
        .putLong("service_uuids_timestamp", System.currentTimeMillis())
        .apply()
}

private fun loadFromCache() {
    val json = sharedPreferences.getString("service_uuids", null)
    if (json != null) {
        val uuids = Gson().fromJson<List<String>>(json)
        _serviceUuids.value = uuids.toSet()
        Log.d("UuidManager", "Loaded ${uuids.size} UUIDs from cache")
    }
}
```

---

## 📊 效能優化

### 為什麼需要這個 API？

**沒有這個 API：**
- 接收器掃描所有 UUID 的 Beacon
- 需要下載完整的白名單（可能很大）
- 再過濾出不需要的 Beacon
- 浪費電量和網路

**有這個 API：**
- 接收器只掃描指定 UUID 的 Beacon
- 大幅減少掃描和處理的 Beacon 數量
- 省電、省網路、提升效能

### 範例對比

```
無過濾：
掃描到 100 個 Beacon
  → 下載白名單（100KB）
  → 比對 100 個
  → 只有 5 個在白名單中
  → 上傳 5 個

有 UUID 過濾：
只掃描我們的 UUID
  → 掃描到 8 個 Beacon
  → 下載白名單（100KB）
  → 比對 8 個
  → 5 個在白名單中
  → 上傳 5 個
```

---

## 🔗 相關連結

- **API 端點：** https://getserviceuuids-kmzfyt3t5a-uc.a.run.app
- **白名單 API：** https://getdevicewhitelist-kmzfyt3t5a-uc.a.run.app
- **上傳 API：** https://receivebeacondata-kmzfyt3t5a-uc.a.run.app
- **Firebase Console：** https://console.firebase.google.com/project/safe-net-tw/functions

---

**創建日期：** 2026-01-20  
**Function 名稱：** getServiceUuids  
**版本：** v1.0
