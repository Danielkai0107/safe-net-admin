import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface BeaconData {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
}

interface TestPayload {
  gateway_id: string;
  lat: number;
  lng: number;
  timestamp: number;
  beacons: BeaconData[];
}

interface TestResult {
  success: boolean;
  response?: any;
  error?: string;
  statusCode?: number;
}

interface LatestLocation {
  id: string;
  gateway_id: string;
  gateway_name?: string;
  gateway_type?: string;
  lat: number;
  lng: number;
  rssi: number;
  major: number;
  minor: number;
  last_seen: any;
}

interface Alert {
  id: string;
  type: string;
  status: string;
  severity: string;
  title: string;
  message: string;
  triggeredAt: any;
  elderId?: string;
  gatewayId?: string;
}

interface Gateway {
  id: string;
  serialNumber: string;
  macAddress?: string;
  imei?: string;
  name: string;
  type: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  tenantId?: string;
}

interface Device {
  id: string;
  elderId: string;
  macAddress: string;
  uuid?: string;
  major?: number;
  minor?: number;
  deviceName?: string;
  type: string;
  isActive: boolean;
  elder?: Elder;
}

interface Elder {
  id: string;
  tenantId: string;
  name: string;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  tenant?: Tenant;
}

interface Tenant {
  id: string;
  name: string;
  lineChannelAccessToken?: string;
}

export default function BeaconTestPage() {
  const [functionUrl, setFunctionUrl] = useState('');
  const [testPayload, setTestPayload] = useState<TestPayload>({
    gateway_id: '',
    lat: 25.0330,
    lng: 121.5654,
    timestamp: Date.now(),
    beacons: [
      { uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825', major: 100, minor: 1, rssi: -59 },
    ],
  });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [latestLocations, setLatestLocations] = useState<LatestLocation[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // 載入資料
  useEffect(() => {
    loadGateways();
    loadDevices();
  }, []);

  const loadGateways = async () => {
    try {
      const q = query(collection(db, 'gateways'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Gateway[];
      setGateways(data);
    } catch (error) {
      console.error('Failed to load gateways:', error);
    }
  };

  // 載入設備列表（包含長者資訊）
  const loadDevices = async () => {
    try {
      const devicesQuery = query(collection(db, 'devices'), orderBy('createdAt', 'desc'));
      const devicesSnapshot = await getDocs(devicesQuery);
      
      const devicesWithElders = await Promise.all(
        devicesSnapshot.docs.map(async (docSnapshot) => {
          const deviceData = { id: docSnapshot.id, ...docSnapshot.data() } as Device;
          
          // 載入長者資訊
          if (deviceData.elderId) {
            try {
              const elderDocRef = doc(db, 'elders', deviceData.elderId);
              const elderDocSnap = await getDoc(elderDocRef);
              
              if (elderDocSnap.exists()) {
                const elderData = { id: elderDocSnap.id, ...elderDocSnap.data() } as Elder;
                
                // 載入社區資訊
                if (elderData.tenantId) {
                  try {
                    const tenantDocRef = doc(db, 'tenants', elderData.tenantId);
                    const tenantDocSnap = await getDoc(tenantDocRef);
                    
                    if (tenantDocSnap.exists()) {
                      elderData.tenant = { id: tenantDocSnap.id, ...tenantDocSnap.data() } as Tenant;
                    }
                  } catch (error) {
                    console.error('Failed to load tenant:', error);
                  }
                }
                
                deviceData.elder = elderData;
              }
            } catch (error) {
              console.error('Failed to load elder:', error);
            }
          }
          
          return deviceData;
        })
      );
      
      // 只顯示已綁定長者的啟用設備
      setDevices(devicesWithElders.filter(d => d.isActive && d.elder));
      console.log('Loaded devices with elders:', devicesWithElders.filter(d => d.isActive && d.elder));
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  // 選擇設備
  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
    
    // 檢查設備是否有 major/minor
    if (device.major === undefined || device.minor === undefined) {
      alert(`警告：設備「${device.deviceName || device.macAddress}」尚未設定 Beacon Major/Minor 值！\n\n請前往「設備管理」編輯該設備，設定 Major 和 Minor 值。`);
      return;
    }
    
    // 確保 major/minor 是數字類型
    const major = Number(device.major);
    const minor = Number(device.minor);
    
    if (isNaN(major) || isNaN(minor)) {
      alert(`錯誤：設備的 Major (${device.major}) 或 Minor (${device.minor}) 不是有效的數字！`);
      return;
    }
    
    // 自動填入 beacon 資料
    setTestPayload(prev => ({
      ...prev,
      beacons: [{
        uuid: device.uuid || 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
        major: major,
        minor: minor,
        rssi: -59,
      }],
    }));
    
    console.log('Selected device beacon data:', { major, minor, uuid: device.uuid });
  };

  // 發送測試請求
  const handleTest = async () => {
    if (!functionUrl.trim()) {
      alert('請輸入 Cloud Function URL');
      return;
    }
    
    // 驗證測試資料
    if (!testPayload.gateway_id) {
      alert('請選擇接收器（Gateway）');
      return;
    }
    
    if (!selectedDevice) {
      alert('請選擇長者設備');
      return;
    }
    
    // 驗證 Beacon 資料
    if (!testPayload.beacons || testPayload.beacons.length === 0) {
      alert('Beacon 資料不完整，請重新選擇設備');
      return;
    }
    
    const beacon = testPayload.beacons[0];
    if (typeof beacon.major !== 'number' || typeof beacon.minor !== 'number') {
      alert(`Beacon 資料無效：\nMajor: ${beacon.major} (${typeof beacon.major})\nMinor: ${beacon.minor} (${typeof beacon.minor})\n\n請確保設備的 Major/Minor 是數字類型。`);
      return;
    }

    setLoading(true);
    setTestResult(null);

    const requestPayload = {
      ...testPayload,
      timestamp: Date.now(), // 使用當前時間
    };
    
    console.log('Sending test request:', requestPayload);

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();

      setTestResult({
        success: response.ok,
        response: data,
        statusCode: response.status,
        error: response.ok ? undefined : data.error || '請求失敗',
      });

      // 自動刷新資料
      if (response.ok) {
        setTimeout(() => {
          loadLatestLocations();
          loadRecentAlerts();
        }, 1000);
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || '網路錯誤',
      });
    } finally {
      setLoading(false);
    }
  };

  // 載入最新位置記錄
  const loadLatestLocations = async () => {
    setLoadingData(true);
    try {
      const q = query(
        collection(db, 'latest_locations'),
        orderBy('last_seen', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as LatestLocation[];
      setLatestLocations(data);
    } catch (error) {
      console.error('Failed to load latest locations:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // 載入最近警報
  const loadRecentAlerts = async () => {
    setLoadingData(true);
    try {
      const q = query(
        collection(db, 'alerts'),
        orderBy('triggeredAt', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Alert[];
      setRecentAlerts(data);
    } catch (error) {
      console.error('Failed to load recent alerts:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // 快速選擇 Gateway（自動填入經緯度）
  const handleSelectGateway = (gateway: Gateway) => {
    setTestPayload(prev => ({
      ...prev,
      gateway_id: gateway.macAddress || gateway.imei || gateway.serialNumber,
      lat: gateway.latitude || 25.0330,
      lng: gateway.longitude || 121.5654,
    }));
  };


  // 格式化時間
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('zh-TW');
  };

  useEffect(() => {
    loadLatestLocations();
    loadRecentAlerts();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Line 通知測試</h1>

      {/* Function URL 設定 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Cloud Function 設定</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Function URL
            </label>
            <input
              type="text"
              value={functionUrl}
              onChange={(e) => setFunctionUrl(e.target.value)}
              placeholder="https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/receiveBeaconData"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              部署後從 Firebase Console 複製 Function URL
            </p>
          </div>
        </div>
      </div>

      {/* 快速選擇 Gateway */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">快速選擇 Gateway</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gateways.map((gateway) => (
            <button
              key={gateway.id}
              onClick={() => handleSelectGateway(gateway)}
              className={`p-4 border rounded-lg text-left hover:bg-gray-50 transition ${
                testPayload.gateway_id === (gateway.macAddress || gateway.imei || gateway.serialNumber)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300'
              }`}
            >
              <div className="font-medium">{gateway.name}</div>
              <div className="text-sm text-gray-500 mt-1">
                類型: <span className={`font-semibold ${
                  gateway.type === 'BOUNDARY' ? 'text-red-600' :
                  gateway.type === 'MOBILE' ? 'text-blue-600' : 'text-gray-600'
                }`}>{gateway.type}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {gateway.macAddress || gateway.imei || gateway.serialNumber}
              </div>
              <div className={`text-xs mt-1 ${gateway.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {gateway.isActive ? '● 啟用中' : '● 已停用'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 選擇設備（自動填入 Beacon 資料） */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">選擇設備（自動填入 Beacon 資料）</h2>
        {selectedDevice && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-blue-900">
                  已選擇: {selectedDevice.elder?.name || '未知長者'}
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  設備: {selectedDevice.deviceName || selectedDevice.macAddress}
                </div>
                <div className="text-sm text-blue-700">
                  Beacon: {selectedDevice.major}_{selectedDevice.minor}
                </div>
                {selectedDevice.elder?.tenant && (
                  <div className="text-sm text-blue-700 mt-1">
                    社區: {selectedDevice.elder.tenant.name}
                    {selectedDevice.elder.tenant.lineChannelAccessToken ? (
                      <span className="ml-2 text-green-600">✓ 已設定 LINE 通知</span>
                    ) : (
                      <span className="ml-2 text-red-600">✗ 未設定 LINE 通知</span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                清除選擇
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() => handleSelectDevice(device)}
              className={`p-4 border rounded-lg text-left hover:bg-gray-50 transition ${
                selectedDevice?.id === device.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300'
              }`}
            >
              <div className="font-medium">{device.elder?.name || '未知長者'}</div>
              <div className="text-sm text-gray-600 mt-1">
                {device.deviceName || device.macAddress}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Beacon: {device.major}_{device.minor}
              </div>
              {device.elder?.tenant && (
                <div className="text-xs text-gray-500 mt-1">
                  社區: {device.elder.tenant.name}
                </div>
              )}
              {device.elder?.phone && (
                <div className="text-xs text-gray-500 mt-1">
                  電話: {device.elder.phone}
                </div>
              )}
              <div className={`text-xs mt-1 ${device.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {device.isActive ? '● 啟用中' : '● 已停用'}
              </div>
            </button>
          ))}
          {devices.length === 0 && (
            <div className="col-span-3 text-center text-gray-500 py-8">
              尚無已註冊的設備，請先在「裝置管理」中新增設備
            </div>
          )}
        </div>
      </div>

      {/* 快速測試面板 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-8 mb-6 border-2 border-blue-200">
        <h2 className="text-2xl font-bold mb-6 text-blue-900 flex items-center">
          <span className="mr-3">🚀</span>
          快速測試
        </h2>
        
        {/* 測試摘要 */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow">
          <h3 className="font-semibold text-gray-800 mb-4">測試配置摘要</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">接收器：</span>
              <span className="font-mono ml-2 text-gray-900">
                {testPayload.gateway_id || '未選擇'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">位置：</span>
              <span className="font-mono ml-2 text-gray-900">
                {testPayload.lat.toFixed(4)}, {testPayload.lng.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">長者設備：</span>
              <span className="font-mono ml-2 text-gray-900">
                {selectedDevice ? `${selectedDevice.elder?.name} (${selectedDevice.major}_${selectedDevice.minor})` : '未選擇'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">社區：</span>
              <span className="font-mono ml-2 text-gray-900">
                {selectedDevice?.elder?.tenant?.name || '未設定'}
              </span>
            </div>
          </div>
        </div>

        {/* 發送按鈕 */}
        <button
          onClick={handleTest}
          disabled={loading || !functionUrl.trim() || !testPayload.gateway_id || !selectedDevice}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg transition-all transform hover:scale-[1.02]"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              發送測試中...
            </span>
          ) : !functionUrl.trim() ? (
            '⚠️ 請先設定 Function URL'
          ) : !testPayload.gateway_id ? (
            '⚠️ 請選擇接收器'
          ) : !selectedDevice ? (
            '⚠️ 請選擇長者設備'
          ) : (
            '🚀 發送測試訊息'
          )}
        </button>

        {!functionUrl.trim() || !testPayload.gateway_id || !selectedDevice ? (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-medium">📝 測試前請確認：</p>
            <ul className="mt-2 text-sm text-yellow-700 space-y-1 ml-5 list-disc">
              {!functionUrl.trim() && <li>請在上方設定 Cloud Function URL</li>}
              {!testPayload.gateway_id && <li>請選擇一個接收器（Gateway）</li>}
              {!selectedDevice && <li>請選擇一個長者設備</li>}
            </ul>
          </div>
        ) : (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              ✅ 配置完成！點擊上方按鈕即可發送測試訊息
              {testPayload.gateway_id && gateways.find(g => (g.macAddress || g.imei || g.serialNumber) === testPayload.gateway_id)?.type === 'BOUNDARY' && (
                <span className="ml-2 font-semibold">🚨 此接收器為邊界點，將觸發 LINE 警報通知！</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* 測試結果 */}
      {testResult && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">測試結果</h2>
          <div
            className={`p-4 rounded-lg ${
              testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-center mb-2">
              <span
                className={`text-lg font-semibold ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {testResult.success ? '✅ 成功' : '❌ 失敗'}
              </span>
              {testResult.statusCode && (
                <span className="ml-3 text-sm text-gray-600">
                  HTTP {testResult.statusCode}
                </span>
              )}
            </div>
            {testResult.error && (
              <div className="text-red-700 mt-2">錯誤: {testResult.error}</div>
            )}
            {testResult.response && (
              <pre className="mt-3 p-3 bg-white rounded text-sm overflow-auto">
                {JSON.stringify(testResult.response, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* 資料查詢區 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最新位置記錄 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">最新位置記錄</h2>
            <button
              onClick={loadLatestLocations}
              disabled={loadingData}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              🔄 重新載入
            </button>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {latestLocations.map((location) => (
              <div key={location.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">
                      Beacon: {location.major}_{location.minor}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Gateway: {location.gateway_name || location.gateway_id}
                    </div>
                    {location.gateway_type && (
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded mt-1 ${
                          location.gateway_type === 'BOUNDARY'
                            ? 'bg-red-100 text-red-700'
                            : location.gateway_type === 'MOBILE'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {location.gateway_type}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>RSSI: {location.rssi}</div>
                    <div className="text-xs mt-1">{formatTime(location.last_seen)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  位置: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </div>
              </div>
            ))}
            {latestLocations.length === 0 && (
              <div className="text-center text-gray-500 py-8">暫無資料</div>
            )}
          </div>
        </div>

        {/* 最近警報 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">最近警報</h2>
            <button
              onClick={loadRecentAlerts}
              disabled={loadingData}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              🔄 重新載入
            </button>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                    <div className="flex gap-2 mt-2">
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded ${
                          alert.type === 'BOUNDARY'
                            ? 'bg-red-100 text-red-700'
                            : alert.type === 'INACTIVE'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {alert.type}
                      </span>
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-red-100 text-red-700'
                            : alert.severity === 'HIGH'
                            ? 'bg-orange-100 text-orange-700'
                            : alert.severity === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded ${
                          alert.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-700'
                            : alert.status === 'NOTIFIED'
                            ? 'bg-blue-100 text-blue-700'
                            : alert.status === 'RESOLVED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 ml-3">
                    {formatTime(alert.triggeredAt)}
                  </div>
                </div>
              </div>
            ))}
            {recentAlerts.length === 0 && (
              <div className="text-center text-gray-500 py-8">暫無警報</div>
            )}
          </div>
        </div>
      </div>

      {/* 使用說明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
        <h3 className="font-semibold text-blue-900 mb-3">📖 使用說明</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>1. 先在上方輸入已部署的 Cloud Function URL</li>
          <li>2. 從「快速選擇 Gateway」選擇要測試的接收器（會自動填入 Gateway ID）</li>
          <li>3. ⭐ <strong>從「選擇設備」區域選擇要測試的長者設備</strong>（會自動填入 Beacon 的 Major/Minor）</li>
          <li>4. 調整測試資料（經緯度、Beacon 參數等，如需要）</li>
          <li>5. 點擊「發送測試請求」按鈕</li>
          <li>6. 查看測試結果和資料更新情況</li>
          <li className="mt-3 pt-3 border-t border-blue-200">
            <strong>📱 LINE 通知測試：</strong>
            <ul className="mt-1 ml-4 space-y-1">
              <li>• 選擇設備後，會顯示該長者所屬的社區和 LINE 通知設定狀態</li>
              <li>• 如果選擇的 Gateway 是 <strong>BOUNDARY 類型</strong>，系統會：</li>
              <li className="ml-4">1. 自動建立 BOUNDARY 警報</li>
              <li className="ml-4">2. 將警報發送到該社區的 LINE 官方帳號群組</li>
              <li>• 請確保社區已設定 LINE Channel Access Token</li>
            </ul>
          </li>
          <li className="mt-3 pt-3 border-t border-blue-200">
            <strong>💡 提示：</strong>
            <ul className="mt-1 ml-4 space-y-1">
              <li>• 5 分鐘內的重複訊號會被忽略（省錢機制）</li>
              <li>• 未註冊的 Gateway 會回傳 404 錯誤</li>
              <li>• 設備必須先在「裝置管理」中註冊並綁定長者</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
