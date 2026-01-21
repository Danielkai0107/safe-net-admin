import { useEffect, useState } from 'react';
import { Plus, Search, MapPin, Wifi, Edit, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { gatewayService } from '../services/gatewayService';
import { tenantService } from '../services/tenantService';
import type { Gateway, GatewayType, Tenant } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PlaceAutocomplete } from '../components/PlaceAutocomplete';

export const GatewaysPage = () => {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState<GatewayType | ''>('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null);
  const [deletingGateway, setDeletingGateway] = useState<Gateway | null>(null);
  
  // 批次選擇相關
  const [selectedGateways, setSelectedGateways] = useState<string[]>([]);
  
  // Google Places 搜尋相關
  const [placeName, setPlaceName] = useState('');

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
  const selectedType = watch('type');

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    setLoading(true);
    
    // 訂閱閘道器列表（即時監聽）
    const typeParam = filterType !== '' ? filterType : undefined;
    const unsubscribe = gatewayService.subscribe(
      (data) => {
        setGateways(data);
        setTotal(data.length);
        setLoading(false);
      },
      undefined, // tenantId
      typeParam // type
    );

    // 清理訂閱
    return () => unsubscribe();
  }, [filterType]);

  const loadGateways = () => {
    // 即時監聽會自動更新，此函數保留用於相容性
  };

  const loadTenants = async () => {
    try {
      const response: any = await tenantService.getAll(1, 100);
      setTenants(response.data.data);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    }
  };

  const handleCreate = () => {
    setEditingGateway(null);
    
    // 生成新的接收點序號：g-年份-月份-該月第幾個
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // 取年份後兩位
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份補零
    const prefix = `g-${year}-${month}-`;
    
    // 找出當月的接收點
    const currentMonthGateways = gateways
      .filter(g => g.serialNumber && g.serialNumber.startsWith(prefix))
      .map(g => {
        const match = g.serialNumber.match(new RegExp(`${prefix}(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const nextNumber = currentMonthGateways.length > 0 
      ? Math.max(...currentMonthGateways) + 1 
      : 1;
    
    const gatewaySerial = `${prefix}${String(nextNumber).padStart(4, '0')}`;
    
    reset({ 
      serialNumber: gatewaySerial,
      type: 'GENERAL', 
      isActive: true,
      name: '',
      latitude: undefined,
      longitude: undefined,
    });
    setPlaceName('');
    setShowModal(true);
  };

  const handleEdit = (gateway: Gateway) => {
    setEditingGateway(gateway);
    
    // 如果接收點沒有序號或序號不符合新格式，生成新序號
    let gatewaySerial = gateway.serialNumber || '';
    if (!gatewaySerial || !gatewaySerial.match(/^g-\d{2}-\d{2}-\d{4}$/)) {
      const now = new Date();
      const year = String(now.getFullYear()).slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `g-${year}-${month}-`;
      
      const currentMonthGateways = gateways
        .filter(g => g.id !== gateway.id && g.serialNumber && g.serialNumber.startsWith(prefix))
        .map(g => {
          const match = g.serialNumber.match(new RegExp(`${prefix}(\\d+)`));
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => !isNaN(num));
      
      const nextNumber = currentMonthGateways.length > 0 
        ? Math.max(...currentMonthGateways) + 1 
        : 1;
      
      gatewaySerial = `${prefix}${String(nextNumber).padStart(4, '0')}`;
    }
    
    reset({
      ...gateway,
      serialNumber: gatewaySerial
    });
    setPlaceName(gateway.name || '');
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingGateway) return;
    
    try {
      await gatewayService.delete(deletingGateway.id);
      alert('刪除成功');
      loadGateways();
    } catch (error: any) {
      alert(error.response?.data?.message || '刪除失敗');
    }
  };

  // 批次選擇相關函數
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGateways(gateways.map(g => g.id));
    } else {
      setSelectedGateways([]);
    }
  };

  const handleSelectGateway = (gatewayId: string, checked: boolean) => {
    if (checked) {
      setSelectedGateways(prev => [...prev, gatewayId]);
    } else {
      setSelectedGateways(prev => prev.filter(id => id !== gatewayId));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedGateways.length === 0) {
      alert('請至少選擇一個接收點');
      return;
    }

    if (!confirm(`確定要刪除選中的 ${selectedGateways.length} 個接收點嗎？此操作會刪除相關的訊號記錄，無法復原！`)) {
      return;
    }

    try {
      await Promise.all(selectedGateways.map(id => gatewayService.delete(id)));
      alert(`成功刪除 ${selectedGateways.length} 個接收點`);
      setSelectedGateways([]);
      loadGateways();
    } catch (error: any) {
      alert(error.response?.data?.message || '批次刪除失敗');
    }
  };

  // 處理 Google Places 地點選擇
  const handlePlaceSelected = (place: { name: string; lat: number; lng: number }) => {
    setPlaceName(place.name);
    setValue('name', place.name);
    setValue('latitude', place.lat);
    setValue('longitude', place.lng);
    console.log('已選擇地點:', place);
  };

  const onSubmit = async (data: any) => {
    try {
      // 如果是移動式，清除 GPS 座標和 macAddress
      if (data.type === 'MOBILE') {
        delete data.latitude;
        delete data.longitude;
        delete data.macAddress;
      } else {
        // 如果是固定式，清除 imei
        delete data.imei;
      }
      
      if (editingGateway) {
        await gatewayService.update(editingGateway.id, data);
        alert('更新成功');
      } else {
        await gatewayService.create(data);
        alert('新增成功');
      }
      setShowModal(false);
      loadGateways();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  const getTypeBadge = (type: GatewayType) => {
    const config = {
      GENERAL: { bg: 'bg-blue-100', text: 'text-blue-800', label: '一般接收點' },
      BOUNDARY: { bg: 'bg-red-100', text: 'text-red-800', label: '邊界點' },
      MOBILE: { bg: 'bg-green-100', text: 'text-green-800', label: '移動接收點' },
    };

    const { bg, text, label } = config[type];

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
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
          <h1 className="text-3xl font-bold text-gray-900">GateWay 管理</h1>
          <p className="text-gray-600 mt-1">管理所有訊號接收點（可選擇標記所在社區範圍）</p>
          <p className="text-sm text-blue-600 mt-1">
            💡 接收點不需要分配社區，可接收所有設備訊號。標記社區僅用於位置管理。
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedGateways.length > 0 && (
            <button 
              onClick={handleBatchDelete} 
              className="btn-secondary flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-5 h-5" />
              <span>刪除選中項 ({selectedGateways.length})</span>
            </button>
          )}
          <button onClick={handleCreate} className="btn-primary flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>新增接收點</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="搜尋序列號或名稱..." className="input pl-10" />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as GatewayType | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">全部</option>
          <option value="GENERAL">一般接收點</option>
          <option value="BOUNDARY">邊界點</option>
          <option value="MOBILE">移動接收點</option>
        </select>
      </div>

      {/* Gateways List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedGateways.length === gateways.length && gateways.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">序列號</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">MAC Address</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">名稱</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">類型</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">位置</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">GPS 座標</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">狀態</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {gateways.map((gateway) => (
                <tr key={gateway.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedGateways.includes(gateway.id)}
                      onChange={(e) => handleSelectGateway(gateway.id, e.target.checked)}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <Wifi className="w-4 h-4 text-primary-500" />
                      <code className="text-sm font-mono">{gateway.serialNumber}</code>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {gateway.macAddress ? (
                      <code className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {gateway.macAddress}
                      </code>
                    ) : gateway.imei ? (
                      <code className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded">
                        {gateway.imei}
                      </code>
                    ) : (
                      <span className="text-xs text-gray-400">未設定</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">{gateway.name}</td>
                  <td className="py-3 px-4">{getTypeBadge(gateway.type)}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{gateway.location || '-'}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {gateway.latitude !== undefined && gateway.latitude !== null && 
                     gateway.longitude !== undefined && gateway.longitude !== null ? (
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="font-mono text-xs">
                          {Number(gateway.latitude).toFixed(4)}, {Number(gateway.longitude).toFixed(4)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">移動式</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${gateway.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {gateway.isActive ? '運作中' : '已停用'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={() => handleEdit(gateway)} className="text-primary-600 hover:text-primary-700 text-sm font-medium mr-3">
                      <Edit className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => setDeletingGateway(gateway)} className="text-red-600 hover:text-red-700 text-sm font-medium">
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
          <p className="text-gray-600">總共 {total} 個接收點</p>
          <div className="flex space-x-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50">上一頁</button>
            <span className="px-3 py-1">第 {page} 頁</span>
            <button onClick={() => setPage(page + 1)} disabled={page * 10 >= total} className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50">下一頁</button>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingGateway ? '編輯接收點' : '新增接收點'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* 接收點序號 - 放在最上方 */}
            <div className="col-span-2">
              <label className="label">接收點序號 *</label>
              <input
                {...register('serialNumber', { required: true })}
                className="input bg-gray-50"
                placeholder="g-26-01-0001"
                disabled
              />
              {errors.serialNumber && <p className="text-sm text-red-600 mt-1">請輸入接收點序號</p>}
              <p className="text-xs text-gray-500 mt-1">💡 系統自動生成：g-年份-月份-該月第幾個</p>
            </div>

            {/* MAC Address / IMEI - 裝置判別序號 */}
            {selectedType === 'MOBILE' ? (
              <div className="col-span-2">
                <label className="label">IMEI 裝置判別序號（移動接收點）</label>
                <input
                  {...register('imei')}
                  className="input font-mono"
                  placeholder="例如：869444031234567"
                  maxLength={15}
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 手機 IMEI 碼，用於識別移動接收點（志工手機）
                </p>
              </div>
            ) : (
              <div className="col-span-2">
                <label className="label">MAC Address 裝置判別序號</label>
                <input
                  {...register('macAddress')}
                  className="input font-mono"
                  placeholder="例如：AA:BB:CC:DD:EE:FF"
                  maxLength={17}
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 商用接收器的 MAC 位址，用於識別固定式接收點
                </p>
              </div>
            )}

            <div className="col-span-2">
              <label className="label">所在社區範圍（選填）</label>
              <select {...register('tenantId')} className="input">
                <option value="">不標記社區</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                💡 僅用於標記接收點位置，不影響功能。接收點可接收所有設備訊號。
              </p>
            </div>

            <div className="col-span-2">
              <label className="label">搜尋地點 *</label>
              <PlaceAutocomplete
                value={placeName}
                onChange={setPlaceName}
                onPlaceSelected={handlePlaceSelected}
                placeholder="搜尋地點（例如：台北101、某某社區大門）"
                className="input"
              />
              {errors.name && <p className="text-sm text-red-600 mt-1">請輸入名稱</p>}
              <p className="text-xs text-blue-600 mt-1">
                💡 使用 Google 地點搜尋，選擇後會自動帶入經緯度
              </p>
            </div>
            
            {/* 隱藏的名稱欄位，用於表單驗證 */}
            <input type="hidden" {...register('name', { required: true })} />

            <div className="col-span-2">
              <label className="label">位置描述</label>
              <input
                {...register('location')}
                className="input"
                placeholder="社區正門入口"
              />
            </div>

            <div className="col-span-2">
              <label className="label">接收點類型 *</label>
              <select {...register('type', { required: true })} className="input">
                <option value="GENERAL">一般接收點（記錄活動）</option>
                <option value="BOUNDARY">邊界點（觸發警報）</option>
                <option value="MOBILE">移動接收點（志工手機）</option>
              </select>
            </div>

            {selectedType !== 'MOBILE' && (
              <>
                <div>
                  <label className="label">緯度（固定式接收點）</label>
                  <input
                    type="number"
                    step="any"
                    {...register('latitude', { valueAsNumber: true })}
                    className="input bg-green-50"
                    placeholder="25.033"
                  />
                  <p className="text-xs text-green-600 mt-1">✓ 選擇地點後自動填入</p>
                </div>

                <div>
                  <label className="label">經度（固定式接收點）</label>
                  <input
                    type="number"
                    step="any"
                    {...register('longitude', { valueAsNumber: true })}
                    className="input bg-green-50"
                    placeholder="121.5654"
                  />
                  <p className="text-xs text-green-600 mt-1">✓ 選擇地點後自動填入</p>
                </div>
              </>
            )}

            {selectedType === 'MOBILE' && (
              <div className="col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  💡 <strong>移動接收點說明：</strong>志工手機作為接收點時，GPS 座標會隨著志工移動自動記錄，無需手動設定。
                </p>
              </div>
            )}

            <div className="col-span-2">
              <label className="flex items-center space-x-2">
                <input type="checkbox" {...register('isActive')} className="rounded" defaultChecked />
                <span className="text-sm font-medium text-gray-700">啟用此接收點</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">取消</button>
            <button type="submit" className="btn-primary">{editingGateway ? '更新' : '新增'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingGateway}
        onClose={() => setDeletingGateway(null)}
        onConfirm={handleDelete}
        title="確認刪除"
        message={`確定要刪除接收點「${deletingGateway?.name}」嗎？此操作會刪除相關的訊號記錄，無法復原！`}
        confirmText="刪除"
        type="danger"
      />

      {/* Type Legend */}
      <div className="mt-4 card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">接收點類型說明</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              一般接收點
            </span>
            <span className="text-gray-600">- 用於記錄長者活動，不觸發警報</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              邊界點
            </span>
            <span className="text-gray-600">- 偵測到時自動觸發警報（如社區大門）</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              移動接收點
            </span>
            <span className="text-gray-600">- 志工手機，可隨時移動</span>
          </div>
        </div>
      </div>
    </div>
  );
};
