import { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Battery, Signal, Edit, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { deviceService } from '../services/deviceService';
import { elderService } from '../services/elderService';
import { tenantService } from '../services/tenantService';
import { uuidService } from '../services/uuidService';
import type { Device, Elder, Tenant, BeaconUUID } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const DevicesPage = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [elders, setElders] = useState<Elder[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [uuids, setUuids] = useState<BeaconUUID[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  
  // 批次選擇相關
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
  
  // 監聽 major 和 minor 的變化，自動更新設備序號
  const major = watch('major');
  const minor = watch('minor');
  
  useEffect(() => {
    if (major !== undefined && minor !== undefined && major !== '' && minor !== '') {
      const deviceSerial = `${major}-${minor}`;
      setValue('deviceName', deviceSerial);
    }
  }, [major, minor, setValue]);

  // 計算合併後的設備資料
  const enrichedDevices = useMemo(() => {
    return devices.map(device => {
      const elder = elders.find(e => e.id === device.elderId);
      const tenant = tenants.find(t => t.id === device.tenantId);
      return {
        ...device,
        elder,
        tenant
      };
    });
  }, [devices, elders, tenants]);

  useEffect(() => {
    setLoading(true);
    
    // 訂閱設備列表（即時監聽）
    const unsubscribeDevices = deviceService.subscribe((deviceData) => {
      setDevices(deviceData);
      setTotal(deviceData.length);
      setLoading(false);
    });

    // 訂閱長者列表（即時監聽）
    const unsubscribeElders = elderService.subscribe((elderData) => {
      setElders(elderData);
    });

    // 訂閱 UUID 列表（只訂閱啟用的）
    const unsubscribeUuids = uuidService.subscribeActive((uuidData) => {
      setUuids(uuidData);
    });

    loadTenants();

    // 清理訂閱
    return () => {
      unsubscribeDevices();
      unsubscribeElders();
      unsubscribeUuids();
    };
  }, []);

  const loadTenants = async () => {
    try {
      const response: any = await tenantService.getAll(1, 100);
      setTenants(response.data.data);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    }
  };

  const loadDevices = () => {
    // 即時監聽會自動更新，此函數保留用於相容性
  };

  const handleCreate = () => {
    setEditingDevice(null);
    
    // 設備序號會根據 Major-Minor 自動生成
    reset({ 
      deviceName: '',
      type: 'IBEACON',
      batteryLevel: 100,
      major: 0,
      minor: 0
    });
    setShowModal(true);
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    
    // 設備序號根據 Major-Minor 格式顯示
    const deviceSerial = device.major !== undefined && device.minor !== undefined 
      ? `${device.major}-${device.minor}` 
      : device.deviceName || '';
    
    reset({
      deviceName: deviceSerial,
      elderId: device.elderId || '',
      uuid: device.uuid || '',
      type: device.type || 'IBEACON',
      batteryLevel: device.batteryLevel || 0,
      major: device.major || 0,
      minor: device.minor || 0,
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingDevice) return;
    
    try {
      await deviceService.delete(deletingDevice.id);
      alert('刪除成功');
      loadDevices();
    } catch (error: any) {
      alert(error.response?.data?.message || '刪除失敗');
    }
  };

  // 批次選擇相關函數
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(devices.map(d => d.id));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedDevices(prev => [...prev, deviceId]);
    } else {
      setSelectedDevices(prev => prev.filter(id => id !== deviceId));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedDevices.length === 0) {
      alert('請至少選擇一個設備');
      return;
    }

    if (!confirm(`確定要刪除選中的 ${selectedDevices.length} 個設備嗎？此操作無法復原。`)) {
      return;
    }

    try {
      await Promise.all(selectedDevices.map(id => deviceService.delete(id)));
      alert(`成功刪除 ${selectedDevices.length} 個設備`);
      setSelectedDevices([]);
      loadDevices();
    } catch (error: any) {
      alert(error.response?.data?.message || '批次刪除失敗');
    }
  };

  // 清理孤兒設備（elderId 指向不存在的長者）
  const handleCleanOrphanDevices = async () => {
    if (!confirm('此操作將清理所有綁定到不存在長者的設備。\n\n確定要繼續嗎？')) {
      return;
    }

    try {
      // 找出所有有 elderId 的設備
      const boundDevices = devices.filter(d => d.elderId);
      
      if (boundDevices.length === 0) {
        alert('沒有需要清理的設備');
        return;
      }

      // 檢查每個設備的 elderId 是否對應到真實存在的長者
      const orphanDevices = boundDevices.filter(device => {
        return !elders.some(elder => elder.id === device.elderId);
      });

      if (orphanDevices.length === 0) {
        alert('沒有發現孤兒設備，所有設備綁定狀態正常');
        return;
      }

      // 解除孤兒設備的綁定
      await Promise.all(
        orphanDevices.map(device => 
          deviceService.assignToElder(device.id, null)
        )
      );

      alert(`成功清理 ${orphanDevices.length} 個孤兒設備`);
      loadDevices();
    } catch (error: any) {
      alert(error.message || '清理失敗');
    }
  };

  const onSubmit = async (data: any) => {
    try {
      if (editingDevice) {
        // 編輯模式：檢查 UUID + Major + Minor 組合是否與其他設備重複
        if (data.uuid && data.major !== undefined && data.minor !== undefined) {
          const existingDevice: any = await deviceService.getByMajorMinor(data.uuid, data.major, data.minor);
          if (existingDevice.data && existingDevice.data.id !== editingDevice.id) {
            alert(`設備組合「UUID + Major(${data.major}) + Minor(${data.minor})」已被其他設備使用\n\n已存在的設備：${existingDevice.data.deviceName || '未命名設備'}\n\n請使用不同的 Major 或 Minor 編號`);
            return;
          }
        }
        
        // 處理綁定邏輯
        const newElderId = data.elderId || null;
        if (newElderId !== editingDevice.elderId) {
          await deviceService.assignToElder(editingDevice.id, newElderId);
        }

        // 更新其他欄位
        const { elderId, ...otherData } = data;
        await deviceService.update(editingDevice.id, otherData);
        alert('更新成功');
      } else {
        // 創建模式：檢查 UUID + Major + Minor 組合是否已存在
        if (data.uuid && data.major !== undefined && data.minor !== undefined) {
          const existingDevice: any = await deviceService.getByMajorMinor(data.uuid, data.major, data.minor);
          if (existingDevice.data) {
            alert(`設備組合「UUID + Major(${data.major}) + Minor(${data.minor})」已存在\n\n已存在的設備：${existingDevice.data.deviceName || '未命名設備'}\n\n💡 提示：多個設備可以使用相同的 UUID，但 Major + Minor 組合必須唯一`);
            return;
          }
        }
        
        // 移除 elderId，設備創建後進入設備池
        const { elderId, ...createData } = data;
        await deviceService.create(createData);
        alert('設備登記成功！已加入設備池。\n\n下一步：\n1. 前往「社區管理」分配設備到社區\n2. 再到「長者管理」綁定給長者');
      }
      setShowModal(false);
      loadDevices();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  const getBatteryColor = (level?: number) => {
    if (!level) return 'text-gray-400';
    if (level > 60) return 'text-green-500';
    if (level > 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getBindingStatusBadge = (device: Device) => {
    if (!device.tenantId) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          🔵 設備池
        </span>
      );
    }
    if (!device.elderId) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          🏘️ 已分配社區
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        👴 已綁定長者
      </span>
    );
  };

  const getDeviceTypeBadge = (type: string) => {
    const styles = {
      IBEACON: 'bg-blue-100 text-blue-800',
      EDDYSTONE: 'bg-purple-100 text-purple-800',
      GENERIC_BLE: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type as keyof typeof styles] || styles.GENERIC_BLE}`}>
        {type}
      </span>
    );
  };

  if (loading) {
    return <div className="text-center py-12">載入中...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Beacon 管理</h1>
          <p className="text-gray-600 mt-1">管理所有 Beacon 設備（UUID + Major + Minor 組合識別）</p>
          <p className="text-sm text-blue-600 mt-1">
            💡 工作流程：先登記設備（設備池） → 前往「社區管理」分配到社區 → 再到「長者管理」綁定給長者
          </p>
          <p className="text-sm text-orange-600 mt-1">
            ⭐ 硬體設定：所有卡片建議設定同一個 UUID，用 Major（群組）+ Minor（編號）區分不同設備
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleCleanOrphanDevices} 
            className="btn-secondary flex items-center space-x-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            title="清理綁定到不存在長者的設備"
          >
            <span>🧹</span>
            <span>清理孤兒設備</span>
          </button>
          {selectedDevices.length > 0 && (
            <button 
              onClick={handleBatchDelete} 
              className="btn-secondary flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-5 h-5" />
              <span>刪除選中項 ({selectedDevices.length})</span>
            </button>
          )}
          <button onClick={handleCreate} className="btn-primary flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>登記新設備</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋設備名稱、UUID、Major、Minor..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Devices List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedDevices.length === devices.length && devices.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">序號</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">設備識別（UUID / Major / Minor）</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">社區</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">長者</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">綁定狀態</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">類型</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">電量</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {enrichedDevices.map((device) => (
                <tr key={device.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedDevices.includes(device.id)}
                      onChange={(e) => handleSelectDevice(device.id, e.target.checked)}
                    />
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">
                    <code className="text-sm font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">
                      {device.major !== undefined && device.minor !== undefined 
                        ? `${device.major}-${device.minor}` 
                        : device.deviceName || '-'}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <code className="text-xs font-mono bg-blue-50 text-blue-800 px-2 py-1 rounded block">
                        UUID: {device.uuid ? device.uuid.substring(0, 8) + '...' : '-'}
                      </code>
                      <div className="flex items-center space-x-2">
                        <code className="text-xs font-mono bg-green-50 text-green-800 px-2 py-1 rounded">
                          Major: {device.major ?? '-'}
                        </code>
                        <code className="text-xs font-mono bg-purple-50 text-purple-800 px-2 py-1 rounded">
                          Minor: {device.minor ?? '-'}
                        </code>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {device.tenant?.name || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {device.elder?.name || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {getBindingStatusBadge(device)}
                  </td>
                  <td className="py-3 px-4">{getDeviceTypeBadge(device.type)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <Battery className={`w-4 h-4 ${getBatteryColor(device.batteryLevel)}`} />
                      <span className="text-sm">{device.batteryLevel ? `${device.batteryLevel}%` : '-'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {device.lastSeen ? (
                      <div className="flex items-center space-x-1">
                        <Signal className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true, locale: zhTW })}</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={() => handleEdit(device)} className="text-primary-600 hover:text-primary-700 text-sm font-medium mr-3">
                      <Edit className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => setDeletingDevice(device)} className="text-red-600 hover:text-red-700 text-sm font-medium">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-gray-600">總共 {total} 個設備</p>
          <div className="flex space-x-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50">上一頁</button>
            <span className="px-3 py-1">第 {page} 頁</span>
            <button onClick={() => setPage(page + 1)} disabled={page * 10 >= total} className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50">下一頁</button>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingDevice ? '編輯設備' : '新增設備'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 提示訊息 */}
          {!editingDevice && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                💡 <strong>提示：</strong>先登記設備資料，之後可以在「長者管理」頁面中分配設備給長者
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* 設備序號 - 放在最上方 */}
            <div className="col-span-2">
              <label className="label">設備序號（自動生成）</label>
              <input 
                {...register('deviceName')} 
                className="input bg-gray-100 text-gray-600" 
                placeholder="請先輸入 Major 和 Minor" 
                disabled
                readOnly
              />
              <p className="text-xs text-blue-600 mt-1">💡 序號格式：Major-Minor（例如：1-1001）會自動更新</p>
            </div>

            {/* 長者選擇 - 只在編輯模式顯示 */}
            {editingDevice && (
              <div className="col-span-2">
                <label className="label">分配給長者</label>
                <select {...register('elderId')} className="input">
                  <option value="">不分配給長者</option>
                  {elders.map((elder) => (
                    <option key={elder.id} value={elder.id}>{elder.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  💡 可以通過此處更改設備的分配狀態
                </p>
              </div>
            )}

            <div className="col-span-2">
              <label className="label">UUID * (服務識別碼)</label>
              <select 
                {...register('uuid', { required: true })} 
                className="input"
              >
                <option value="">請選擇 UUID</option>
                {uuids.map((uuid) => (
                  <option key={uuid.id} value={uuid.uuid}>
                    {uuid.name} - {uuid.uuid}
                  </option>
                ))}
              </select>
              {errors.uuid && <p className="text-sm text-red-600 mt-1">請選擇 UUID</p>}
              {uuids.length === 0 ? (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ 尚未建立 UUID，請先前往「UUID 管理」新增
                </p>
              ) : (
                <p className="text-xs text-blue-600 mt-1">
                  💡 若需要新的 UUID，請前往「UUID 管理」新增
                </p>
              )}
            </div>

            <div>
              <label className="label">設備類型</label>
              <select {...register('type')} className="input">
                <option value="IBEACON">iBeacon</option>
                <option value="EDDYSTONE">Eddystone</option>
                <option value="GENERIC_BLE">一般 BLE</option>
              </select>
            </div>

            <div>
              <label className="label">電量 (%)</label>
              <input type="number" {...register('batteryLevel')} className="input" min="0" max="100" placeholder="100" />
            </div>

            <div>
              <label className="label">Major * (群組編號)</label>
              <input 
                type="number" 
                {...register('major', { required: true, valueAsNumber: true })} 
                className="input" 
                placeholder="1" 
              />
              {errors.major && <p className="text-sm text-red-600 mt-1">請輸入 Major（群組編號）</p>}
              <p className="text-xs text-gray-500 mt-1">例如：1 = 大愛社區</p>
            </div>

            <div>
              <label className="label">Minor * (設備編號)</label>
              <input 
                type="number" 
                {...register('minor', { required: true, valueAsNumber: true })} 
                className="input" 
                placeholder="1001" 
              />
              {errors.minor && <p className="text-sm text-red-600 mt-1">請輸入 Minor（設備編號）</p>}
              <p className="text-xs text-gray-500 mt-1">⭐ Major + Minor 組合才是設備的唯一識別碼</p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">取消</button>
            <button type="submit" className="btn-primary">{editingDevice ? '更新' : '新增'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingDevice}
        onClose={() => setDeletingDevice(null)}
        onConfirm={handleDelete}
        title="確認刪除"
        message={`確定要刪除設備「${deletingDevice?.deviceName || deletingDevice?.uuid}」嗎？此操作無法復原。`}
        confirmText="刪除"
        type="danger"
      />
    </div>
  );
};
