import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Battery,
  Signal,
  Clock,
  Edit,
  Tag,
  User,
  MapPin,
  Calendar,
  Unlink,
} from "lucide-react";
import { deviceService } from "../services/deviceService";
import { elderService } from "../services/elderService";
import { formatDistanceToNow, format } from "date-fns";
import { zhTW } from "date-fns/locale";
import type { Device, Elder } from "../types";
import { ConfirmDialog } from "../components/ConfirmDialog";

export const DeviceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [elder, setElder] = useState<Elder | null>(null);
  const [loading, setLoading] = useState(true);
  const [unbinding, setUnbinding] = useState(false);
  const [showUnbindConfirm, setShowUnbindConfirm] = useState(false);

  // 安全的日期格式化函數
  const safeFormatDate = (
    timestamp: any,
    formatStr: string = "yyyy/MM/dd HH:mm",
  ): string => {
    if (!timestamp) return "-";

    try {
      let date: Date;

      // 處理 Firestore Timestamp
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
      }
      // 處理 Firestore Timestamp 對象格式 { seconds, nanoseconds }
      else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      }
      // 處理字串或數字
      else {
        date = new Date(timestamp);
      }

      // 檢查日期是否有效
      if (isNaN(date.getTime())) {
        return "-";
      }

      return format(date, formatStr, { locale: zhTW });
    } catch (error) {
      console.error("Date format error:", error);
      return "-";
    }
  };

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const deviceRes = await deviceService.getOne(id);
        setDevice(deviceRes.data);

        // 如果綁定了長者，載入長者資訊
        if (
          deviceRes.data &&
          deviceRes.data.bindingType === "ELDER" &&
          deviceRes.data.boundTo
        ) {
          try {
            const elderRes = await elderService.getOne(deviceRes.data.boundTo);
            setElder(elderRes.data);
          } catch (error) {
            console.error("Failed to load elder:", error);
          }
        }
      } catch (error) {
        console.error("Failed to load device data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // 解除綁定處理
  const handleUnbind = async () => {
    if (!device || !id) return;

    setUnbinding(true);
    try {
      await deviceService.unbindDevice(id);
      alert("已成功解除綁定");
      // 重新載入設備資料
      const deviceRes = await deviceService.getOne(id);
      setDevice(deviceRes.data);
      setElder(null);
    } catch (error: any) {
      alert(error.message || "解除綁定失敗");
    } finally {
      setUnbinding(false);
      setShowUnbindConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">找不到設備資料</p>
      </div>
    );
  }

  const getBindingTypeBadge = (type: string) => {
    const styles = {
      ELDER: "bg-blue-100 text-blue-800",
      MAP_USER: "bg-green-100 text-green-800",
      UNBOUND: "bg-gray-100 text-gray-800",
    };

    const labels = {
      ELDER: "已綁定長者",
      MAP_USER: "已綁定APP用戶",
      UNBOUND: "未綁定",
    };

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[type as keyof typeof styles]}`}
      >
        {labels[type as keyof typeof labels]}
      </span>
    );
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

  const getBatteryColor = (level?: number) => {
    if (!level) return "text-gray-400";
    if (level > 60) return "text-green-500";
    if (level > 20) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate("/devices")}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">設備詳情</h1>
        </div>
        <div className="flex items-center space-x-3">
          {/* 解除綁定按鈕 - 只在有綁定時顯示 */}
          {device.bindingType !== "UNBOUND" && (
            <button
              onClick={() => setShowUnbindConfirm(true)}
              disabled={unbinding}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              <Unlink className="w-4 h-4" />
              <span>{unbinding ? "處理中..." : "解除綁定"}</span>
            </button>
          )}
          <button
            onClick={() => navigate(`/devices?edit=${id}`)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Edit className="w-4 h-4" />
            <span>編輯設備</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：設備基本資料 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 設備識別資訊 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mx-auto mb-4">
                <Signal className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                <code className="font-mono">
                  {device.major !== undefined && device.minor !== undefined
                    ? `${device.major}-${device.minor}`
                    : device.deviceName || "未命名設備"}
                </code>
              </h2>
              {getBindingTypeBadge(device.bindingType)}
            </div>

            <div className="space-y-4 border-t pt-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  UUID（服務識別碼）
                </div>
                <code className="text-sm font-mono bg-blue-50 text-blue-800 px-3 py-2 rounded block break-all">
                  {device.uuid || "-"}
                </code>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Major（群組）
                  </div>
                  <code className="text-lg font-mono font-bold bg-green-50 text-green-800 px-3 py-2 rounded block text-center">
                    {device.major ?? "-"}
                  </code>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Minor（編號）
                  </div>
                  <code className="text-lg font-mono font-bold bg-purple-50 text-purple-800 px-3 py-2 rounded block text-center">
                    {device.minor ?? "-"}
                  </code>
                </div>
              </div>

              {device.macAddress && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    MAC Address（參考）
                  </div>
                  <code className="text-xs font-mono bg-gray-50 text-gray-700 px-2 py-1 rounded block break-all">
                    {device.macAddress}
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* 設備狀態 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              設備狀態
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">設備類型</span>
                {getDeviceTypeBadge(device.type)}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">電量</span>
                <div className="flex items-center space-x-2">
                  <Battery
                    className={`w-5 h-5 ${getBatteryColor(device.batteryLevel)}`}
                  />
                  <span className="text-sm font-medium">
                    {device.batteryLevel ? `${device.batteryLevel}%` : "未知"}
                  </span>
                </div>
              </div>

              {device.lastRssi && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">最後訊號強度</span>
                  <span className="text-sm font-medium font-mono">
                    {device.lastRssi} dBm
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">啟用狀態</span>
                <span
                  className={`text-sm font-medium ${device.isActive ? "text-green-600" : "text-red-600"}`}
                >
                  {device.isActive ? " 啟用中" : " 已停用"}
                </span>
              </div>

              {device.lastSeen &&
                (() => {
                  try {
                    let date: Date;
                    const lastSeen: any = device.lastSeen;
                    if (
                      lastSeen.toDate &&
                      typeof lastSeen.toDate === "function"
                    ) {
                      date = lastSeen.toDate();
                    } else if (lastSeen.seconds) {
                      date = new Date(lastSeen.seconds * 1000);
                    } else {
                      date = new Date(device.lastSeen);
                    }

                    if (isNaN(date.getTime())) return null;

                    return (
                      <div className="pt-4 border-t">
                        <div className="text-xs text-gray-500 mb-1">
                          最後上線時間
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">
                            {formatDistanceToNow(date, {
                              addSuffix: true,
                              locale: zhTW,
                            })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {safeFormatDate(
                            device.lastSeen,
                            "yyyy/MM/dd HH:mm:ss",
                          )}
                        </div>
                      </div>
                    );
                  } catch (error) {
                    console.error("Error formatting lastSeen:", error);
                    return null;
                  }
                })()}
            </div>
          </div>

          {/* 標籤資訊 */}
          {device.tags && device.tags.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Tag className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  標籤（社區）
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {device.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-3 py-1.5 text-sm rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右側：綁定資訊 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 綁定對象資訊 */}
          {device.bindingType === "ELDER" && elder ? (
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-6 h-6" />
                <h3 className="text-xl font-semibold">綁定長者資訊</h3>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-2xl font-bold mb-2">{elder.name}</div>
                    {(elder.gender || elder.age) && (
                      <div className="flex items-center space-x-2 text-sm opacity-90">
                        {elder.gender && (
                          <span>
                            {elder.gender === "MALE"
                              ? "男"
                              : elder.gender === "FEMALE"
                                ? "女"
                                : "其他"}
                          </span>
                        )}
                        {elder.gender && elder.age && <span>·</span>}
                        {elder.age && (
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{elder.age}歲</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/elders/${elder.id}`)}
                    className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition text-sm font-medium"
                  >
                    查看詳情
                  </button>
                </div>

                {elder.phone && (
                  <div className="flex items-center space-x-2 pt-3 border-t border-white/20">
                    <span className="text-sm opacity-75">聯絡電話：</span>
                    <a
                      href={`tel:${elder.phone}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {elder.phone}
                    </a>
                  </div>
                )}

                {elder.address && (
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-4 h-4 mt-0.5 opacity-75" />
                    <span className="text-sm opacity-90">{elder.address}</span>
                  </div>
                )}

                {(elder.emergencyContact || elder.emergencyPhone) && (
                  <div className="pt-3 border-t border-white/20">
                    <div className="text-sm opacity-75 mb-2">緊急聯絡人</div>
                    <div className="space-y-1">
                      {elder.emergencyContact && (
                        <div className="text-sm">{elder.emergencyContact}</div>
                      )}
                      {elder.emergencyPhone && (
                        <a
                          href={`tel:${elder.emergencyPhone}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {elder.emergencyPhone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : device.bindingType === "MAP_USER" ? (
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-6 h-6" />
                <h3 className="text-xl font-semibold">綁定 MAP 用戶資訊</h3>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 space-y-3">
                <div className="text-2xl font-bold">
                  {device.mapUserNickname || "未知用戶"}
                </div>
                {device.mapUserAge && (
                  <div className="text-lg opacity-90">
                    年齡：{device.mapUserAge} 歲
                  </div>
                )}
                {device.boundTo && (
                  <div className="pt-3 border-t border-white/20">
                    <div className="text-sm opacity-75">用戶 ID</div>
                    <code className="text-xs font-mono bg-white/20 px-2 py-1 rounded mt-1 block break-all">
                      {device.boundTo}
                    </code>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                設備尚未綁定
              </h3>
              <p className="text-sm text-gray-500">
                此設備目前未綁定到任何長者或 APP 用戶
              </p>
            </div>
          )}

          {/* 系統資訊 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              系統資訊
            </h3>
            <div className="space-y-3 text-sm">
              {device.boundAt && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">綁定時間</span>
                  <span className="text-gray-900 font-medium">
                    {safeFormatDate(device.boundAt)}
                  </span>
                </div>
              )}
              {device.createdAt && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">建立時間</span>
                  <span className="text-gray-900 font-medium">
                    {safeFormatDate(device.createdAt)}
                  </span>
                </div>
              )}
              {device.updatedAt && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">最後更新</span>
                  <span className="text-gray-900 font-medium">
                    {safeFormatDate(device.updatedAt)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t">
                <span className="text-gray-600">設備 ID</span>
                <code className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {device.id}
                </code>
              </div>
            </div>
          </div>

          {/* 操作說明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">設備管理說明</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• 點擊右上角「編輯設備」可修改設備基本資料</li>
              <li>• 前往「長者管理」可將設備綁定給長者</li>
              <li>• 前往「地圖APP用戶管理」可將設備綁定給APP用戶</li>
              <li>• UUID + Major + Minor 組合是設備的唯一識別碼</li>
              <li>• 建議所有設備使用相同的 UUID，用 Major/Minor 區分</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 解除綁定確認對話框 */}
      <ConfirmDialog
        isOpen={showUnbindConfirm}
        onClose={() => setShowUnbindConfirm(false)}
        onConfirm={handleUnbind}
        title="確認解除綁定"
        message={`確定要解除設備「${device.deviceName || device.uuid}」的綁定嗎？\n\n${
          device.bindingType === "ELDER"
            ? `此設備目前綁定給長者「${elder?.name || "未知"}」`
            : device.bindingType === "MAP_USER"
              ? `此設備目前綁定給 APP 用戶「${device.mapUserNickname || "未知"}」`
              : ""
        }\n\n解除後設備將變為「未綁定」狀態。`}
        confirmText="解除綁定"
        type="danger"
      />
    </div>
  );
};
