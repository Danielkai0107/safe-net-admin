# 接收器白名單使用指南

## 📋 概述

接收器（Android App）使用白名單來過濾應該上傳哪些 Beacon 訊號。只有在白名單中的設備才會被上傳到伺服器。

---

## 🔄 工作流程

```
接收器掃描 Beacon
  ↓
獲取白名單（定期更新）
  ↓
比對 UUID + Major + Minor
  ↓
在白名單中？
  ├─ 是 → 上傳到 receiveBeaconData
  └─ 否 → 忽略
```

---

## 📡 API 端點

### 獲取白名單

**URL:** `https://getdevicewhitelist-kmzfyt3t5a-uc.a.run.app`

**方法:** `GET` 或 `POST`

**回應格式:**
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

---

## 💡 核心識別邏輯

### ⭐ 識別方式（修改後）

**使用組合鍵：UUID + Major + Minor**

```kotlin
// Kotlin 範例
data class BeaconIdentifier(
    val uuid: String,
    val major: Int,
    val minor: Int
) {
    fun matches(beacon: Beacon): Boolean {
        return this.uuid.equals(beacon.id1.toString(), ignoreCase = true) &&
               this.major == beacon.id2.toInt() &&
               this.minor == beacon.id3.toInt()
    }
}
```

### ❌ 不要使用 MAC Address

**原因：**
- Beacon 的 MAC 會隨機變化（BLE 隱私保護）
- 不可靠，會導致比對失敗

---

## 🔧 接收器端實作建議

### 1. 白名單資料結構

```kotlin
data class WhitelistDevice(
    val uuid: String,
    val major: Int,
    val minor: Int,
    val deviceName: String? = null
)

class DeviceWhitelist {
    private val devices = mutableSetOf<WhitelistDevice>()
    
    fun update(newDevices: List<WhitelistDevice>) {
        devices.clear()
        devices.addAll(newDevices)
        Log.d("Whitelist", "Updated whitelist: ${devices.size} devices")
    }
    
    fun isInWhitelist(beacon: Beacon): Boolean {
        val uuid = beacon.id1.toString()
        val major = beacon.id2.toInt()
        val minor = beacon.id3.toInt()
        
        return devices.any { device ->
            device.uuid.equals(uuid, ignoreCase = true) &&
            device.major == major &&
            device.minor == minor
        }
    }
    
    fun getDeviceInfo(beacon: Beacon): WhitelistDevice? {
        val uuid = beacon.id1.toString()
        val major = beacon.id2.toInt()
        val minor = beacon.id3.toInt()
        
        return devices.find { device ->
            device.uuid.equals(uuid, ignoreCase = true) &&
            device.major == major &&
            device.minor == minor
        }
    }
}
```

### 2. 定期更新白名單

```kotlin
class WhitelistManager(private val context: Context) {
    private val whitelist = DeviceWhitelist()
    private val updateInterval = 5 * 60 * 1000L // 5 分鐘
    
    private val handler = Handler(Looper.getMainLooper())
    private val updateRunnable = object : Runnable {
        override fun run() {
            fetchWhitelist()
            handler.postDelayed(this, updateInterval)
        }
    }
    
    fun start() {
        fetchWhitelist() // 立即獲取
        handler.postDelayed(updateRunnable, updateInterval)
    }
    
    fun stop() {
        handler.removeCallbacks(updateRunnable)
    }
    
    private fun fetchWhitelist() {
        lifecycleScope.launch {
            try {
                val response = apiService.getWhitelist()
                if (response.success) {
                    val devices = response.devices.map { 
                        WhitelistDevice(
                            uuid = it.uuid,
                            major = it.major,
                            minor = it.minor,
                            deviceName = it.deviceName
                        )
                    }
                    whitelist.update(devices)
                    Log.d("Whitelist", "Fetched ${devices.size} devices")
                }
            } catch (e: Exception) {
                Log.e("Whitelist", "Failed to fetch whitelist", e)
            }
        }
    }
    
    fun isInWhitelist(beacon: Beacon): Boolean {
        return whitelist.isInWhitelist(beacon)
    }
}
```

### 3. 掃描與過濾

```kotlin
class BeaconScanner(private val whitelistManager: WhitelistManager) {
    
    fun onBeaconsDetected(beacons: Collection<Beacon>) {
        val filteredBeacons = beacons.filter { beacon ->
            // 只處理在白名單中的 Beacon
            whitelistManager.isInWhitelist(beacon)
        }
        
        if (filteredBeacons.isNotEmpty()) {
            Log.d("Scanner", "Found ${filteredBeacons.size} whitelisted beacons")
            uploadBeacons(filteredBeacons)
        }
    }
    
    private fun uploadBeacons(beacons: Collection<Beacon>) {
        val beaconDataList = beacons.map { beacon ->
            BeaconData(
                uuid = beacon.id1.toString(),
                major = beacon.id2.toInt(),
                minor = beacon.id3.toInt(),
                rssi = beacon.rssi
            )
        }
        
        // 上傳到 receiveBeaconData API
        uploadToServer(beaconDataList)
    }
}
```

---

## 📝 完整範例流程

### Android 接收器 App

```kotlin
class MainActivity : AppCompatActivity(), BeaconConsumer {
    private lateinit var beaconManager: BeaconManager
    private lateinit var whitelistManager: WhitelistManager
    private lateinit var apiClient: ApiClient
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 1. 初始化白名單管理器
        whitelistManager = WhitelistManager(this)
        whitelistManager.start()
        
        // 2. 初始化 Beacon 掃描
        beaconManager = BeaconManager.getInstanceForApplication(this)
        beaconManager.beaconParsers.add(
            BeaconParser().setBeaconLayout(IBEACON_LAYOUT)
        )
        beaconManager.bind(this)
        
        // 3. 初始化 API 客戶端
        apiClient = ApiClient()
    }
    
    override fun onBeaconServiceConnect() {
        beaconManager.addRangeNotifier { beacons, region ->
            if (beacons.isNotEmpty()) {
                processBeacons(beacons)
            }
        }
        
        try {
            // 開始掃描所有 iBeacon
            beaconManager.startRangingBeaconsInRegion(
                Region("all-beacons", null, null, null)
            )
        } catch (e: RemoteException) {
            e.printStackTrace()
        }
    }
    
    private fun processBeacons(beacons: Collection<Beacon>) {
        lifecycleScope.launch {
            // 過濾白名單中的 Beacon
            val whitelistedBeacons = beacons.filter { beacon ->
                whitelistManager.isInWhitelist(beacon).also { isInWhitelist ->
                    if (isInWhitelist) {
                        Log.d("Beacon", "Whitelisted: ${beacon.id1}-${beacon.id2}-${beacon.id3}")
                    }
                }
            }
            
            if (whitelistedBeacons.isNotEmpty()) {
                uploadBeacons(whitelistedBeacons)
            }
        }
    }
    
    private suspend fun uploadBeacons(beacons: Collection<Beacon>) {
        try {
            val location = getCurrentLocation()
            
            val payload = BeaconUploadPayload(
                gateway_id = getDeviceId(), // IMEI 或設備 ID
                lat = location.latitude,
                lng = location.longitude,
                timestamp = System.currentTimeMillis(),
                beacons = beacons.map { beacon ->
                    BeaconData(
                        uuid = beacon.id1.toString(),
                        major = beacon.id2.toInt(),
                        minor = beacon.id3.toInt(),
                        rssi = beacon.rssi
                    )
                }
            )
            
            val response = apiClient.uploadBeacons(payload)
            Log.d("Upload", "Success: ${response.updated} updated, ${response.ignored} ignored")
            
        } catch (e: Exception) {
            Log.e("Upload", "Failed to upload beacons", e)
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        beaconManager.unbind(this)
        whitelistManager.stop()
    }
}
```

---

## 🎯 關鍵注意事項

### 1. 比對邏輯

**正確 ✅：**
```kotlin
// 使用 UUID + Major + Minor 組合
fun isMatch(beacon: Beacon, whitelistItem: WhitelistDevice): Boolean {
    return beacon.id1.toString().equals(whitelistItem.uuid, ignoreCase = true) &&
           beacon.id2.toInt() == whitelistItem.major &&
           beacon.id3.toInt() == whitelistItem.minor
}
```

**錯誤 ❌：**
```kotlin
// 不要只用 UUID
fun isMatch(beacon: Beacon, whitelistItem: WhitelistDevice): Boolean {
    return beacon.id1.toString().equals(whitelistItem.uuid, ignoreCase = true)
}

// 不要用 MAC Address
fun isMatch(beacon: Beacon, whitelistItem: WhitelistDevice): Boolean {
    return beacon.bluetoothAddress == whitelistItem.macAddress
}
```

### 2. 白名單更新頻率

建議：**5 分鐘**

- 太頻繁：浪費網路和電量
- 太少：新增設備要等太久

### 3. 錯誤處理

```kotlin
try {
    val response = apiService.getWhitelist()
    if (!response.success) {
        Log.w("Whitelist", "Failed to fetch whitelist")
        // 繼續使用舊的白名單
    }
} catch (e: IOException) {
    Log.e("Whitelist", "Network error", e)
    // 保留舊的白名單，不清空
} catch (e: Exception) {
    Log.e("Whitelist", "Unknown error", e)
}
```

### 4. 性能優化

```kotlin
class DeviceWhitelist {
    // 使用 HashSet 加速查找
    private val deviceKeys = mutableSetOf<String>()
    
    fun update(devices: List<WhitelistDevice>) {
        deviceKeys.clear()
        devices.forEach { device ->
            // 建立組合鍵
            val key = "${device.uuid}:${device.major}:${device.minor}"
            deviceKeys.add(key.lowercase())
        }
    }
    
    fun isInWhitelist(beacon: Beacon): Boolean {
        val key = "${beacon.id1}:${beacon.id2}:${beacon.id3}".lowercase()
        return deviceKeys.contains(key)
    }
}
```

---

## 📊 測試建議

### 1. 白名單功能測試

```kotlin
@Test
fun testWhitelistMatching() {
    val whitelist = DeviceWhitelist()
    whitelist.update(listOf(
        WhitelistDevice(
            uuid = "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
            major = 1,
            minor = 1001
        )
    ))
    
    // 測試：正確的 Beacon 應該在白名單中
    val beacon = createTestBeacon(
        uuid = "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major = 1,
        minor = 1001
    )
    assertTrue(whitelist.isInWhitelist(beacon))
    
    // 測試：不同 Major 應該不在白名單中
    val beacon2 = createTestBeacon(
        uuid = "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major = 2,
        minor = 1001
    )
    assertFalse(whitelist.isInWhitelist(beacon2))
}
```

### 2. 實際掃描測試

1. 確保至少一個 Beacon 在白名單中
2. 用接收器 App 掃描
3. 檢查 Log：`Found X whitelisted beacons`
4. 確認上傳成功
5. 在後台檢查資料是否正確

---

## 🔍 除錯技巧

### 問題：掃描到 Beacon 但沒有上傳

**檢查清單：**
```kotlin
// 1. 確認 Beacon 資訊
Log.d("Beacon", "UUID: ${beacon.id1}")
Log.d("Beacon", "Major: ${beacon.id2}")
Log.d("Beacon", "Minor: ${beacon.id3}")

// 2. 確認白名單內容
Log.d("Whitelist", "Devices count: ${whitelist.size()}")
whitelist.forEach { device ->
    Log.d("Whitelist", "Device: ${device.uuid}-${device.major}-${device.minor}")
}

// 3. 確認比對結果
val isInWhitelist = whitelist.isInWhitelist(beacon)
Log.d("Match", "Beacon in whitelist: $isInWhitelist")
```

### 問題：白名單一直是空的

**檢查：**
1. API 端點是否正確
2. 網路連線是否正常
3. 後台是否有啟用的設備
4. 設備是否有填寫 UUID、Major、Minor

---

## 📞 相關文檔

- **後端 API：** `receiveBeaconData` - 接收 Beacon 數據
- **硬體設定：** `BEACON_HARDWARE_GUIDE.md` - Beacon 硬體配置指南
- **設備管理：** Admin 後台設備管理頁面

---

**更新日期：** 2026-01-20  
**API 版本：** v2（使用 UUID + Major + Minor 識別）
