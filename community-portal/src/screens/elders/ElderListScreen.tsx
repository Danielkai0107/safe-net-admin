import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, User, Phone, Edit, Trash2, Clock, Search, Download, Upload } from 'lucide-react';
import { elderService } from '../../services/elderService';
import { deviceService } from '../../services/deviceService';
import { useAuth } from '../../hooks/useAuth';
import { ElderFormModal } from '../../components/ElderFormModal';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type { Elder, Device } from '../../types';
import * as XLSX from 'xlsx';

export const ElderListScreen = () => {
  const navigate = useNavigate();
  const { tenantId, isAdmin } = useAuth();
  const [elders, setElders] = useState<Elder[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingElder, setEditingElder] = useState<Elder | null>(null);
  const [deletingElder, setDeletingElder] = useState<Elder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 批次匯入相關
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 合併長者和設備資料
  const enrichedElders = useMemo(() => {
    return elders.map((elder) => {
      const device = devices.find(
        (d) => d.bindingType === 'ELDER' && d.boundTo === elder.id
      );
      return {
        ...elder,
        device,
      };
    });
  }, [elders, devices]);

  useEffect(() => {
    if (!tenantId) return;

    setLoading(true);
    
    // 訂閱長者列表
    const unsubscribeElders = elderService.subscribe(tenantId, (data) => {
      setElders(data);
      setLoading(false);
    });

    // 訂閱設備列表
    const unsubscribeDevices = deviceService.subscribe(tenantId, (data) => {
      setDevices(data);
    });

    return () => {
      unsubscribeElders();
      unsubscribeDevices();
    };
  }, [tenantId]);

  const handleAdd = () => {
    setEditingElder(null);
    setShowModal(true);
  };

  const handleEdit = (elder: Elder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingElder(elder);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingElder) return;
    
    try {
      await elderService.delete(deletingElder.id);
      setDeletingElder(null);
    } catch (error) {
      console.error('Failed to delete elder:', error);
      alert('刪除失敗');
    }
  };

  const handleSuccess = () => {
    // Modal 會自動重新載入資料（因為使用 subscribe）
  };

  // 匯出 Excel 模板
  const handleExportTemplate = () => {
    const template = [
      {
        "姓名": "",
        "性別": "MALE",
        "年齡": "",
        "電話": "",
        "地址": "",
        "緊急聯絡人": "",
        "緊急聯絡電話": "",
        "備註": "性別可選：MALE(男), FEMALE(女), OTHER(其他)；先不分配裝置"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "長輩模板");
    
    // 設置列寬
    ws['!cols'] = [
      { wch: 15 }, // 姓名
      { wch: 10 }, // 性別
      { wch: 10 }, // 年齡
      { wch: 15 }, // 電話
      { wch: 30 }, // 地址
      { wch: 15 }, // 緊急聯絡人
      { wch: 15 }, // 緊急聯絡電話
      { wch: 50 }  // 備註
    ];

    XLSX.writeFile(wb, `長輩批次新增模板_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 批次匯入長輩
  const handleBatchImport = async () => {
    if (!importFile) {
      alert("請選擇要匯入的檔案");
      return;
    }

    if (!tenantId) {
      alert("無法取得社區資訊");
      return;
    }

    setImporting(true);
    setImportResults(null);

    try {
      const data = await importFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        const rowNum = i + 2; // Excel 行號（從第2行開始，第1行是標題）

        try {
          // 驗證必填欄位
          if (!row["姓名"]) {
            errors.push(`第 ${rowNum} 行：缺少必填欄位（姓名）`);
            failed++;
            continue;
          }

          // 驗證性別格式
          const validGenders = ['MALE', 'FEMALE', 'OTHER'];
          if (row["性別"] && !validGenders.includes(row["性別"])) {
            errors.push(`第 ${rowNum} 行：性別格式錯誤，應為 MALE、FEMALE 或 OTHER`);
            failed++;
            continue;
          }

          // 準備長輩資料
          const elderData: Partial<Elder> = {
            tenantId: tenantId,
            name: row["姓名"],
            gender: row["性別"] || undefined,
            age: row["年齡"] ? Number(row["年齡"]) : undefined,
            phone: row["電話"] || undefined,
            address: row["地址"] || undefined,
            emergencyContact: row["緊急聯絡人"] || undefined,
            emergencyPhone: row["緊急聯絡電話"] || undefined,
            notes: row["備註"] && row["備註"] !== "性別可選：MALE(男), FEMALE(女), OTHER(其他)；先不分配裝置" ? row["備註"] : undefined,
            status: 'ACTIVE' as const,
            inactiveThresholdHours: 24,
            isActive: true,
          };

          // 創建長輩
          await elderService.create(elderData);
          success++;
        } catch (error: any) {
          errors.push(`第 ${rowNum} 行：${error.message || "匯入失敗"}`);
          failed++;
        }
      }

      setImportResults({ success, failed, errors });
    } catch (error: any) {
      alert(`檔案讀取失敗：${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  // 重置匯入狀態
  const handleResetImport = () => {
    setImportFile(null);
    setImportResults(null);
    setShowBatchImportModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      ACTIVE: 'bg-green-100 text-green-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      HOSPITALIZED: 'bg-yellow-100 text-yellow-800',
      DECEASED: 'bg-red-100 text-red-800',
      MOVED_OUT: 'bg-blue-100 text-blue-800',
    };
    
    const labels = {
      ACTIVE: '正常',
      INACTIVE: '不活躍',
      HOSPITALIZED: '住院',
      DECEASED: '已故',
      MOVED_OUT: '遷出',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  // 搜尋過濾（使用 enrichedElders）
  const filteredElders = enrichedElders.filter(elder => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      elder.name?.toLowerCase().includes(search) ||
      elder.phone?.toLowerCase().includes(search) ||
      elder.address?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">長者管理</h2>
          <p className="text-sm text-gray-600 mt-1">總共 {enrichedElders.length} 位長者</p>
        </div>
        {isAdmin && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportTemplate}
              className="flex items-center space-x-2 btn btn-secondary text-green-600 hover:text-green-700 hover:bg-green-50"
              title="匯出批次新增模板"
            >
              <Download className="w-5 h-5" />
              <span>匯出模板</span>
            </button>
            <button
              onClick={() => setShowBatchImportModal(true)}
              className="flex items-center space-x-2 btn btn-secondary text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title="批次匯入長輩"
            >
              <Upload className="w-5 h-5" />
              <span>批次新增</span>
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center space-x-2 btn btn-primary"
            >
              <Plus className="w-5 h-5" />
              <span>新增長者</span>
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="搜尋長者姓名、電話、地址..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Elders Table */}
      <div className="card">
        {filteredElders.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500">
              {searchTerm ? '找不到符合的長者' : '暫無長者資料'}
            </p>
            {isAdmin && !searchTerm && (
              <button
                onClick={handleAdd}
                className="mt-4 btn btn-primary"
              >
                新增第一位長者
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    長者
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    聯絡方式
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    設備狀態
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    狀態
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    最後活動
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredElders.map((elder) => (
                  <tr
                    key={elder.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button')) {
                        return;
                      }
                      navigate(`/elders/${elder.id}`);
                    }}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        {elder.photo ? (
                          <img
                            src={elder.photo}
                            alt={elder.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {elder.name}
                          </div>
                          {(elder.gender || elder.age) && (
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              {elder.gender && (
                                <span>
                                  {elder.gender === 'MALE'
                                    ? '男'
                                    : elder.gender === 'FEMALE'
                                      ? '女'
                                      : '其他'}
                                </span>
                              )}
                              {elder.gender && elder.age && <span>·</span>}
                              {elder.age && <span>{elder.age}歲</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {elder.phone ? (
                        <div className="flex items-center space-x-1 text-gray-700">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{elder.phone}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {elder.device ? (
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            已綁定
                          </span>
                          {elder.device.deviceName && (
                            <code className="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                              {elder.device.deviceName}
                            </code>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          未綁定
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(elder.status)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {elder.lastActivityAt ? (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">
                            {formatDistanceToNow(new Date(elder.lastActivityAt), {
                              addSuffix: true,
                              locale: zhTW,
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">無記錄</span>
                      )}
                    </td>
                    <td
                      className="py-3 px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isAdmin && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => handleEdit(elder, e)}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingElder(elder)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Elder Form Modal */}
      <ElderFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        editingElder={editingElder}
      />

      {/* Delete Confirmation */}
      {deletingElder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">確認刪除</h3>
            <p className="text-gray-600 mb-6">
              確定要刪除長者「{deletingElder.name}」嗎？此操作無法復原。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingElder(null)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-danger"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Import Modal */}
      {showBatchImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">批次新增長輩</h3>
            
            {!importResults ? (
              <div className="space-y-4">
                {/* 說明 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">使用說明：</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>點擊「匯出模板」按鈕下載 Excel 模板</li>
                    <li>在模板中填寫長輩基本資料（姓名為必填）</li>
                    <li>暫不分配裝置，可稍後在長輩詳情頁面綁定</li>
                    <li>上傳填寫完成的檔案進行批次新增</li>
                  </ol>
                </div>

                {/* 檔案上傳 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    選擇 Excel 檔案
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="input"
                  />
                  {importFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      已選擇：{importFile.name}
                    </p>
                  )}
                </div>

                {/* 按鈕 */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={handleResetImport}
                    className="btn btn-secondary"
                    disabled={importing}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleBatchImport}
                    className="btn btn-primary"
                    disabled={!importFile || importing}
                  >
                    {importing ? "匯入中..." : "開始匯入"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 匯入結果 */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">匯入結果</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <p className="text-sm text-green-600">成功</p>
                      <p className="text-2xl font-bold text-green-700">
                        {importResults.success}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-sm text-red-600">失敗</p>
                      <p className="text-2xl font-bold text-red-700">
                        {importResults.failed}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 錯誤訊息 */}
                {importResults.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <h5 className="font-semibold text-red-900 mb-2">錯誤詳情：</h5>
                    <ul className="text-sm text-red-800 space-y-1">
                      {importResults.errors.map((error, index) => (
                        <li key={index} className="border-b border-red-100 pb-1">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 關閉按鈕 */}
                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={handleResetImport}
                    className="btn btn-primary"
                  >
                    完成
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
