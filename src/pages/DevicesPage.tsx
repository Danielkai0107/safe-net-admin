import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Battery, Signal, Edit, Trash2, Download, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { deviceService } from "../services/deviceService";
import { elderService } from "../services/elderService";
import { uuidService } from "../services/uuidService";
import { tenantService } from "../services/tenantService";
import type { Device, Elder, BeaconUUID, Tenant } from "../types";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import * as XLSX from 'xlsx';

export const DevicesPage = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [elders, setElders] = useState<Elder[]>([]);
  const [uuids, setUuids] = useState<BeaconUUID[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);

  // 批次選擇相關
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

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

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm();

  // 序號生成中的狀態
  const [generatingSerial, setGeneratingSerial] = useState(false);
  // 序號重複檢查狀態
  const [serialError, setSerialError] = useState<string | null>(null);
  const [checkingSerial, setCheckingSerial] = useState(false);

  // 自動生成唯一設備序號
  const handleGenerateSerial = async () => {
    setGeneratingSerial(true);
    setSerialError(null);
    try {
      const serial = await deviceService.generateUniqueSerial();
      setValue("deviceName", serial);
    } catch (error: any) {
      setSerialError(error.message || "生成序號失敗");
    } finally {
      setGeneratingSerial(false);
    }
  };

  // 檢查序號是否重複
  const checkSerialDuplicate = async (
    serial: string,
    currentDeviceId?: string,
  ) => {
    if (!serial || serial.length !== 10) {
      return;
    }

    // 驗證格式
    if (!deviceService.validateSerial(serial)) {
      setSerialError("序號格式錯誤，應為 6碼英文字母 + 4碼數字");
      return;
    }

    setCheckingSerial(true);
    setSerialError(null);
    try {
      const existing: any = await deviceService.getByDeviceName(serial);
      if (existing.data && existing.data.id !== currentDeviceId) {
        setSerialError(`序號「${serial}」已被使用`);
      }
    } catch (error) {
      console.error("檢查序號失敗:", error);
    } finally {
      setCheckingSerial(false);
    }
  };

  // 監聽設備序號變化，進行重複檢查
  const deviceName = watch("deviceName");
  useEffect(() => {
    if (deviceName && deviceName.length === 10) {
      const timer = setTimeout(() => {
        checkSerialDuplicate(deviceName, editingDevice?.id);
      }, 500); // 防抖延遲
      return () => clearTimeout(timer);
    } else {
      setSerialError(null);
    }
  }, [deviceName, editingDevice?.id]);

  // 計算合併後的設備資料（使用新的 bindingType 和 boundTo）
  const enrichedDevices = useMemo(() => {
    return devices.map((device) => {
      const elder =
        device.bindingType === "ELDER" && device.boundTo
          ? elders.find((e) => e.id === device.boundTo)
          : undefined;
      return {
        ...device,
        elder,
      };
    });
  }, [devices, elders]);

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

    // 訂閱社區列表
    const unsubscribeTenants = tenantService.subscribe((tenantData) => {
      setTenants(tenantData);
    });

    // 清理訂閱
    return () => {
      unsubscribeDevices();
      unsubscribeElders();
      unsubscribeUuids();
      unsubscribeTenants();
    };
  }, []);

  const loadDevices = () => {
    // 即時監聽會自動更新，此函數保留用於相容性
  };

  const handleCreate = async () => {
    setEditingDevice(null);
    setSerialError(null);

    // 自動生成設備序號
    let generatedSerial = "";
    try {
      generatedSerial = await deviceService.generateUniqueSerial();
    } catch (error) {
      console.error("自動生成序號失敗:", error);
    }

    reset({
      deviceName: generatedSerial,
      type: "IBEACON",
      tenantTag: "", // 所屬社區
      batteryLevel: 100,
      major: 0,
      minor: 0,
    });
    setShowModal(true);
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setSerialError(null);

    reset({
      deviceName: device.deviceName || "",
      uuid: device.uuid ? device.uuid.toLowerCase() : "", // 統一轉為小寫以匹配 select options
      type: device.type || "IBEACON",
      tenantTag: device.tags?.[0] || "", // 取第一個社區標籤
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
      alert("刪除成功");
      loadDevices();
    } catch (error: any) {
      alert(error.response?.data?.message || "刪除失敗");
    }
  };

  // 批次選擇相關函數
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(devices.map((d) => d.id));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedDevices((prev) => [...prev, deviceId]);
    } else {
      setSelectedDevices((prev) => prev.filter((id) => id !== deviceId));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedDevices.length === 0) {
      alert("請至少選擇一個設備");
      return;
    }

    if (
      !confirm(
        `確定要刪除選中的 ${selectedDevices.length} 個設備嗎？此操作無法復原。`,
      )
    ) {
      return;
    }

    try {
      await Promise.all(selectedDevices.map((id) => deviceService.delete(id)));
      alert(`成功刪除 ${selectedDevices.length} 個設備`);
      setSelectedDevices([]);
      loadDevices();
    } catch (error: any) {
      alert(error.response?.data?.message || "批次刪除失敗");
    }
  };

  // 匯出 Excel 模板
  const handleExportTemplate = () => {
    const template = [
      {
        UUID: "",
        Major: "",
        Minor: "",
        "設備類型": "IBEACON",
        "所屬社區ID": "",
        "電量": 100,
        "備註": "UUID請從UUID管理中複製；設備類型可選：IBEACON, EDDYSTONE, GENERIC_BLE；所屬社區ID請從社區管理中複製"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Beacon模板");
    
    // 設置列寬
    ws['!cols'] = [
      { wch: 40 }, // UUID
      { wch: 10 }, // Major
      { wch: 10 }, // Minor
      { wch: 15 }, // 設備類型
      { wch: 20 }, // 所屬社區ID
      { wch: 10 }, // 電量
      { wch: 60 }  // 備註
    ];

    XLSX.writeFile(wb, `Beacon批次新增模板_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 批次匯入 Beacon
  const handleBatchImport = async () => {
    if (!importFile) {
      alert("請選擇要匯入的檔案");
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
          if (!row.UUID || !row.Major || !row.Minor) {
            errors.push(`第 ${rowNum} 行：缺少必填欄位（UUID、Major、Minor）`);
            failed++;
            continue;
          }

          // 生成唯一序號
          const deviceName = await deviceService.generateUniqueSerial();

          // 檢查 UUID + Major + Minor 組合是否已存在
          const existingDevice = await deviceService.getByMajorMinor(
            row.UUID.toLowerCase(),
            Number(row.Major),
            Number(row.Minor)
          );

          if (existingDevice.data) {
            errors.push(`第 ${rowNum} 行：UUID + Major(${row.Major}) + Minor(${row.Minor}) 組合已存在`);
            failed++;
            continue;
          }

          // 準備設備資料
          const deviceData = {
            deviceName: deviceName,
            uuid: row.UUID.toLowerCase(),
            major: Number(row.Major),
            minor: Number(row.Minor),
            type: row["設備類型"] || "IBEACON",
            batteryLevel: row["電量"] ? Number(row["電量"]) : 100,
            tags: row["所屬社區ID"] ? [row["所屬社區ID"]] : [],
          };

          // 創建設備
          await deviceService.create(deviceData);
          success++;
        } catch (error: any) {
          errors.push(`第 ${rowNum} 行：${error.message || "匯入失敗"}`);
          failed++;
        }
      }

      setImportResults({ success, failed, errors });
      
      if (success > 0) {
        loadDevices();
      }
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

  // 清理孤兒設備（bindingType='ELDER' 但 boundTo 指向不存在的長者）
  const handleCleanOrphanDevices = async () => {
    if (
      !confirm("此操作將清理所有綁定到不存在長者的設備。\n\n確定要繼續嗎？")
    ) {
      return;
    }

    try {
      // 找出所有綁定到長者的設備
      const boundDevices = devices.filter(
        (d) => d.bindingType === "ELDER" && d.boundTo,
      );

      if (boundDevices.length === 0) {
        alert("沒有需要清理的設備");
        return;
      }

      // 檢查每個設備的 boundTo 是否對應到真實存在的長者
      const orphanDevices = boundDevices.filter((device) => {
        return !elders.some((elder) => elder.id === device.boundTo);
      });

      if (orphanDevices.length === 0) {
        alert("沒有發現孤兒設備，所有設備綁定狀態正常");
        return;
      }

      // 解除孤兒設備的綁定
      await Promise.all(
        orphanDevices.map((device) =>
          deviceService.assignToElder(device.id, null),
        ),
      );

      alert(`成功清理 ${orphanDevices.length} 個孤兒設備`);
      loadDevices();
    } catch (error: any) {
      alert(error.message || "清理失敗");
    }
  };

  const onSubmit = async (data: any) => {
    try {
      // 驗證設備序號格式
      if (!data.deviceName || !deviceService.validateSerial(data.deviceName)) {
        alert(
          "設備序號格式錯誤\n\n正確格式：6碼英文字母 + 4碼數字\n例如：ABCDEF1234",
        );
        return;
      }

      // 將設備序號轉換為大寫
      data.deviceName = data.deviceName.toUpperCase();

      // 將 tenantTag 轉換為 tags 陣列
      if (data.tenantTag) {
        data.tags = [data.tenantTag];
      } else {
        data.tags = [];
      }
      delete data.tenantTag;

      // 檢查設備序號是否重複
      const existingByName: any = await deviceService.getByDeviceName(
        data.deviceName,
      );
      if (existingByName.data && existingByName.data.id !== editingDevice?.id) {
        alert(
          `設備序號「${data.deviceName}」已被使用\n\n請更換其他序號或點擊「自動生成」按鈕`,
        );
        return;
      }

      if (editingDevice) {
        // 編輯模式：檢查 UUID + Major + Minor 組合是否與其他設備重複
        if (data.uuid && data.major !== undefined && data.minor !== undefined) {
          const existingDevice: any = await deviceService.getByMajorMinor(
            data.uuid,
            data.major,
            data.minor,
          );
          if (
            existingDevice.data &&
            existingDevice.data.id !== editingDevice.id
          ) {
            alert(
              `設備組合「UUID + Major(${data.major}) + Minor(${data.minor})」已被其他設備使用\n\n已存在的設備：${existingDevice.data.deviceName || "未命名設備"}\n\n請使用不同的 Major 或 Minor 編號`,
            );
            return;
          }
        }

        // 更新設備欄位（不包含綁定狀態，綁定由其他功能管理）
        await deviceService.update(editingDevice.id, data);
        alert("更新成功");
      } else {
        // 創建模式：檢查 UUID + Major + Minor 組合是否已存在
        if (data.uuid && data.major !== undefined && data.minor !== undefined) {
          const existingDevice: any = await deviceService.getByMajorMinor(
            data.uuid,
            data.major,
            data.minor,
          );
          if (existingDevice.data) {
            alert(
              `設備組合「UUID + Major(${data.major}) + Minor(${data.minor})」已存在\n\n已存在的設備：${existingDevice.data.deviceName || "未命名設備"}\n\n 提示：多個設備可以使用相同的 UUID，但 Major + Minor 組合必須唯一`,
            );
            return;
          }
        }

        // 創建設備（自動設為 UNBOUND）
        await deviceService.create(data);
        alert(
          "設備登記成功！\n\n下一步：\n1. 前往「長者管理」綁定給長者\n2. 或在「地圖APP用戶管理」綁定給APP用戶",
        );
      }
      setShowModal(false);
      loadDevices();
    } catch (error: any) {
      alert(error.response?.data?.message || "操作失敗");
    }
  };

  const getBatteryColor = (level?: number) => {
    if (!level) return "text-gray-400";
    if (level > 60) return "text-green-500";
    if (level > 20) return "text-yellow-500";
    return "text-red-500";
  };

  const getBindingStatusBadge = (device: Device) => {
    switch (device.bindingType) {
      case "ELDER":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            已綁定長者
          </span>
        );
      case "MAP_USER":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            已綁定APP用戶
          </span>
        );
      case "UNBOUND":
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            未綁定
          </span>
        );
    }
  };

  const getDeviceTypeBadge = (type: string) => {
    const styles = {
      IBEACON: "bg-blue-100 text-blue-800",
      EDDYSTONE: "bg-purple-100 text-purple-800",
      GENERIC_BLE: "bg-gray-100 text-gray-800",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type as keyof typeof styles] || styles.GENERIC_BLE}`}
      >
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
          <p className="text-gray-600 mt-1">
            管理所有 Beacon 設備（UUID + Major + Minor 組合識別）
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportTemplate}
            className="btn-secondary flex items-center space-x-2 text-green-600 hover:text-green-700 hover:bg-green-50"
            title="匯出批次新增模板"
          >
            <Download className="w-5 h-5" />
            <span>匯出模板</span>
          </button>
          <button
            onClick={() => setShowBatchImportModal(true)}
            className="btn-secondary flex items-center space-x-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            title="批次匯入 Beacon"
          >
            <Upload className="w-5 h-5" />
            <span>批次新增</span>
          </button>
          <button
            onClick={handleCleanOrphanDevices}
            className="btn-secondary flex items-center space-x-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            title="清理綁定到不存在長者的設備"
          >
            <span>清理暫存</span>
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
          <button
            onClick={handleCreate}
            className="btn-primary flex items-center space-x-2"
          >
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
                    checked={
                      selectedDevices.length === devices.length &&
                      devices.length > 0
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  序號
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  設備識別（UUID / Major / Minor）
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  綁定狀態
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  設備類型
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  電量
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  最後上線
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {enrichedDevices.map((device) => (
                <tr
                  key={device.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => {
                    // 如果點擊的是 checkbox 或操作按鈕，不導航
                    const target = e.target as HTMLElement;
                    if (
                      target.closest('input[type="checkbox"]') ||
                      target.closest("button")
                    ) {
                      return;
                    }
                    navigate(`/devices/${device.id}`);
                  }}
                >
                  <td
                    className="py-3 px-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedDevices.includes(device.id)}
                      onChange={(e) =>
                        handleSelectDevice(device.id, e.target.checked)
                      }
                    />
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">
                    <code className="text-sm font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">
                      {device.deviceName || "-"}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <code className="text-xs font-mono bg-blue-50 text-blue-800 px-2 py-1 rounded block">
                        UUID:{" "}
                        {device.uuid
                          ? device.uuid.substring(0, 8) + "..."
                          : "-"}
                      </code>
                      <div className="flex items-center space-x-2">
                        <code className="text-xs font-mono bg-green-50 text-green-800 px-2 py-1 rounded">
                          Major: {device.major ?? "-"}
                        </code>
                        <code className="text-xs font-mono bg-purple-50 text-purple-800 px-2 py-1 rounded">
                          Minor: {device.minor ?? "-"}
                        </code>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {getBindingStatusBadge(device)}
                  </td>
                  <td className="py-3 px-4">
                    {getDeviceTypeBadge(device.type)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <Battery
                        className={`w-4 h-4 ${getBatteryColor(device.batteryLevel)}`}
                      />
                      <span className="text-sm">
                        {device.batteryLevel ? `${device.batteryLevel}%` : "-"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {device.lastSeen ? (
                      <div className="flex items-center space-x-1">
                        <Signal className="w-3 h-3" />
                        <span className="text-xs">
                          {formatDistanceToNow(new Date(device.lastSeen), {
                            addSuffix: true,
                            locale: zhTW,
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">從未上線</span>
                    )}
                  </td>
                  <td
                    className="py-3 px-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(device)}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        title="編輯設備"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingDevice(device)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                        title="刪除設備"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              上一頁
            </button>
            <span className="px-3 py-1">第 {page} 頁</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * 10 >= total}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              下一頁
            </button>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDevice ? "編輯設備" : "新增設備"}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 提示訊息 */}
          {!editingDevice && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>提示：</strong>
                先登記設備資料，之後可以在「長者管理」頁面中分配設備給長者
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* 設備序號 - 放在最上方 */}
            <div className="col-span-2">
              <label className="label">設備序號 *（6碼英文 + 4碼數字）</label>
              <div className="flex space-x-2">
                <input
                  {...register("deviceName", { required: true })}
                  className={`input flex-1 uppercase ${serialError ? "border-red-500" : ""}`}
                  placeholder="例如：ABCDEF1234"
                  maxLength={10}
                />
                <button
                  type="button"
                  onClick={handleGenerateSerial}
                  disabled={generatingSerial}
                  className="btn-secondary whitespace-nowrap"
                >
                  {generatingSerial ? "生成中..." : "自動生成"}
                </button>
              </div>
              {serialError && (
                <p className="text-sm text-red-600 mt-1">{serialError}</p>
              )}
              {checkingSerial && (
                <p className="text-sm text-gray-500 mt-1">檢查序號中...</p>
              )}
              {errors.deviceName && !serialError && (
                <p className="text-sm text-red-600 mt-1">請輸入設備序號</p>
              )}
              <p className="text-xs text-blue-600 mt-1">
                格式：6碼大寫英文字母 + 4碼數字（例如：ABCDEF1234）
              </p>
            </div>

            {/* 長者選擇 - 只在編輯模式顯示 */}
            {editingDevice && (
              <div className="col-span-2">
                <label className="label">分配給長者</label>
                <select {...register("elderId")} className="input">
                  <option value="">不分配給長者</option>
                  {elders.map((elder) => (
                    <option key={elder.id} value={elder.id}>
                      {elder.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  可以通過此處更改設備的分配狀態
                </p>
              </div>
            )}

            <div className="col-span-2">
              <label className="label">UUID * (服務識別碼)</label>
              <select
                {...register("uuid", { required: true })}
                className="input"
              >
                <option value="">請選擇 UUID</option>
                {uuids.map((uuid) => (
                  <option key={uuid.id} value={uuid.uuid.toLowerCase()}>
                    {uuid.name} - {uuid.uuid}
                  </option>
                ))}
              </select>
              {errors.uuid && (
                <p className="text-sm text-red-600 mt-1">請選擇 UUID</p>
              )}
              {uuids.length === 0 ? (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ 尚未建立 UUID，請先前往「UUID 管理」新增
                </p>
              ) : (
                <p className="text-xs text-blue-600 mt-1">
                  若需要新的 UUID，請前往「UUID 管理」新增
                </p>
              )}
            </div>

            <div>
              <label className="label">設備類型</label>
              <select {...register("type")} className="input">
                <option value="IBEACON">iBeacon</option>
                <option value="EDDYSTONE">Eddystone</option>
                <option value="GENERIC_BLE">一般 BLE</option>
              </select>
            </div>

            <div>
              <label className="label">所屬社區</label>
              <select {...register("tenantTag")} className="input">
                <option value="">請選擇社區</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.code})
                  </option>
                ))}
              </select>
              {tenants.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ 尚未建立社區，請先前往「社區管理」新增
                </p>
              )}
            </div>

            <div>
              <label className="label">電量 (%)</label>
              <input
                type="number"
                {...register("batteryLevel")}
                className="input"
                min="0"
                max="100"
                placeholder="100"
              />
            </div>

            <div>
              <label className="label">Major * (群組編號)</label>
              <input
                type="number"
                {...register("major", { required: true, valueAsNumber: true })}
                className="input"
                placeholder="1"
              />
              {errors.major && (
                <p className="text-sm text-red-600 mt-1">
                  請輸入 Major（群組編號）
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">例如：1 = 大愛社區</p>
            </div>

            <div>
              <label className="label">Minor * (設備編號)</label>
              <input
                type="number"
                {...register("minor", { required: true, valueAsNumber: true })}
                className="input"
                placeholder="1001"
              />
              {errors.minor && (
                <p className="text-sm text-red-600 mt-1">
                  請輸入 Minor（設備編號）
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Major + Minor 組合才是設備的唯一識別碼
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button type="submit" className="btn-primary">
              {editingDevice ? "更新" : "新增"}
            </button>
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

      {/* Batch Import Modal */}
      <Modal
        isOpen={showBatchImportModal}
        onClose={handleResetImport}
        title="批次新增 Beacon"
        size="lg"
      >
        <div className="space-y-4">
          {!importResults ? (
            <>
              {/* 說明 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">使用說明：</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>點擊「匯出模板」按鈕下載 Excel 模板</li>
                  <li>在模板中填寫 Beacon 資料（UUID、Major、Minor 為必填）</li>
                  <li>序號會自動生成，無需填寫</li>
                  <li>上傳填寫完成的檔案進行批次新增</li>
                </ol>
              </div>

              {/* 檔案上傳 */}
              <div>
                <label className="label">選擇 Excel 檔案</label>
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
              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleResetImport}
                  className="btn-secondary"
                  disabled={importing}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleBatchImport}
                  className="btn-primary"
                  disabled={!importFile || importing}
                >
                  {importing ? "匯入中..." : "開始匯入"}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 匯入結果 */}
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">匯入結果</h3>
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
                    <h4 className="font-semibold text-red-900 mb-2">錯誤詳情：</h4>
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
                <div className="flex items-center justify-end pt-4 border-t">
                  <button
                    type="button"
                    onClick={handleResetImport}
                    className="btn-primary"
                  >
                    完成
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
