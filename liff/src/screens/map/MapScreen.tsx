import { useState, useEffect, useRef } from "react";
import { BottomSheet } from "../../components/map/BottomSheet";
import { Modal } from "../../components/map/Modal";
import { TimelineItem, DateGroup } from "../../components/map/TimelineItem";
import { StatisticsPanel } from "../../components/map/StatisticsPanel";
import { FullScreenLoading } from "../../components/map/FullScreenLoading";
import type {
  Gateway,
  TimelineActivity,
  DateGroup as DateGroupType,
  Elder,
  Device,
} from "../../types";
import { useTenantStore } from "../../store/tenantStore";
import { elderService } from "../../services/elderService";
import { gatewayService } from "../../services/gatewayService";
import { useGoogleMap } from "../../hooks/useGoogleMap";
import { useMapMarkers } from "../../hooks/useMapMarkers";
import { useCurrentLocation } from "../../hooks/useCurrentLocation";
import { useAuth } from "../../hooks/useAuth";
import * as deviceService from "../../services/deviceService";
import * as notificationPointService from "../../services/notificationPointService";
import * as activityService from "../../services/activityService";

export const MapScreen = () => {
  const tenant = useTenantStore((state) => state.selectedTenant);
  const { profile } = useAuth();
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isBindModalOpen, setIsBindModalOpen] = useState(false);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [isGatewayManageOpen, setIsGatewayManageOpen] = useState(false);
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [selectedElder, setSelectedElder] = useState<Elder | null>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null);

  // Device binding states
  const [isBound, setIsBound] = useState(false);
  const [boundDevice, setBoundDevice] = useState<Device | null>(null);
  const [isLoadingBinding, setIsLoadingBinding] = useState(true);
  const [deviceName, setDeviceName] = useState("");
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState<number | undefined>();
  const [isBinding, setIsBinding] = useState(false);
  const [isUnbinding, setIsUnbinding] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [notificationPointIds, setNotificationPointIds] = useState<string[]>(
    [],
  );
  // 設備資訊編輯欄位（已綁定時可編輯，產品序號不可改）
  const [deviceEditNickname, setDeviceEditNickname] = useState("");
  const [deviceEditAge, setDeviceEditAge] = useState<number | "">("");
  const [deviceEditGender, setDeviceEditGender] = useState<string>("");

  // Activity states
  const [activities, setActivities] = useState<
    activityService.DeviceActivity[]
  >([]);

  // Panel states (for swipe navigation)
  const [activePanel, setActivePanel] = useState<"timeline" | "statistics">(
    "timeline",
  );
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Full screen loading states
  const [isFullScreenLoading, setIsFullScreenLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("處理中...");

  // 獲取當前位置
  const { location: currentLocation } = useCurrentLocation();

  // 追蹤是否已經初始定位過
  const hasInitiallyLocated = useRef(false);

  // 預設使用台北位置，等待實際位置獲取後會自動移動
  const mapCenter = { lat: 25.033, lng: 121.565 };

  const handleGatewayClick = (gateway: Gateway) => {
    setSelectedGateway(gateway);
    setIsGatewayModalOpen(true);
  };

  // 初始化 Google Maps（先用預設位置，位置獲取後會自動移動）
  const { mapRef, map, isLoaded } = useGoogleMap({
    center: mapCenter,
    zoom: 15,
    onMapReady: () => {
      console.log("Google Maps 已載入，等待位置獲取...");
    },
  });

  // 管理地圖標記
  useMapMarkers({
    map,
    gateways,
    selectedElder,
    currentLocation,
    onGatewayClick: handleGatewayClick,
  });

  // 當位置獲取成功後，自動移動地圖到當前位置（只執行一次）
  useEffect(() => {
    if (map && currentLocation && !hasInitiallyLocated.current && isLoaded) {
      // 等待地圖完全載入後再定位
      setTimeout(() => {
        if (!hasInitiallyLocated.current) {
          hasInitiallyLocated.current = true;
          map.panTo(currentLocation);
          map.setZoom(16);
          console.log("已自動定位到當前位置:", currentLocation);
        }
      }, 500);
    }
  }, [map, currentLocation, isLoaded]);

  useEffect(() => {
    if (!tenant) return;

    // 載入長者列表
    const unsubscribeElders = elderService.subscribe(
      tenant.id,
      (data: Elder[]) => {
        if (data.length > 0) {
          setSelectedElder(data[0]);
        }
      },
    );

    // 載入 gateway 列表（依據社區過濾）
    const unsubscribeGateways = gatewayService.subscribeByTenant(
      tenant.id,
      (data: Gateway[]) => {
        setGateways(data);
        console.log("已載入 gateways:", data.length);
        console.log(
          "Gateways 詳細資料:",
          data.map((g) => ({
            id: g.id,
            name: g.name,
            latitude: g.latitude,
            longitude: g.longitude,
            isActive: g.isActive,
            tenantId: g.tenantId,
            type: g.type,
          })),
        );
        // 檢查有多少 gateway 有經緯度資料
        const gatewaysWithLocation = data.filter(
          (g) => g.latitude && g.longitude,
        );
        console.log(
          `有經緯度的 gateways: ${gatewaysWithLocation.length} / ${data.length}`,
        );
      },
    );

    return () => {
      unsubscribeElders();
      unsubscribeGateways();
    };
  }, [tenant]);

  const [isLocating, setIsLocating] = useState(false);

  const handleMyLocation = () => {
    console.log("handleMyLocation 被呼叫");
    console.log("map 狀態:", map ? "已載入" : "未載入");

    if (!map) {
      console.error("地圖尚未載入");
      alert("地圖尚未載入，請稍後再試");
      return;
    }

    if (!navigator.geolocation) {
      console.error("此裝置不支援定位功能");
      alert("此裝置不支援定位功能");
      return;
    }

    console.log("開始獲取位置...");
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        console.log("定位成功:", pos);
        map.panTo(pos);
        map.setZoom(16);
        setIsLocating(false);
      },
      (error) => {
        console.error("定位失敗:", error.code, error.message);
        setIsLocating(false);

        let errorMsg = "無法取得您的位置";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "請允許存取位置權限";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "無法取得位置資訊";
            break;
          case error.TIMEOUT:
            errorMsg = "定位請求逾時，請再試一次";
            break;
        }

        // 定位失敗時，使用已有的位置或顯示錯誤
        if (currentLocation) {
          map.panTo(currentLocation);
          map.setZoom(16);
          console.log("使用快取的當前位置");
        } else {
          alert(errorMsg);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const handleRefresh = () => {
    if (!map) return;

    // 重新載入地圖並調整視角以顯示所有標記
    const bounds = new google.maps.LatLngBounds();

    gateways.forEach((gateway) => {
      if (gateway.latitude && gateway.longitude) {
        bounds.extend({ lat: gateway.latitude, lng: gateway.longitude });
      }
    });

    if (selectedElder?.lastSeenLocation) {
      const location = selectedElder.lastSeenLocation;
      if (location.latitude && location.longitude) {
        bounds.extend({ lat: location.latitude, lng: location.longitude });
      }
    }

    map.fitBounds(bounds);
  };

  const handleActivityClick = (activity: TimelineActivity) => {
    setIsSheetExpanded(false);

    // 找到對應的 gateway 並定位到該位置
    const gateway = gateways.find((g) => g.id === activity.gatewayId);
    if (gateway && gateway.latitude && gateway.longitude && map) {
      map.panTo({ lat: gateway.latitude, lng: gateway.longitude });
      map.setZoom(17);
    }
  };

  // Check binding status when component mounts or profile changes
  useEffect(() => {
    const checkBinding = async () => {
      if (!profile) return;

      setIsLoadingBinding(true);
      try {
        const status = await deviceService.getBindingStatus(profile.userId);
        setIsBound(status.isBound);
        setBoundDevice(status.device || null);

        // Load notification points if device is bound
        if (status.isBound && status.device) {
          const points = await notificationPointService.getNotificationPoints(
            profile.userId,
          );
          if (points.success && points.notificationPoints) {
            setNotificationPointIds(points.notificationPoints.map((p) => p.id));
          }
        }
      } catch (error) {
        console.error("Error checking binding status:", error);
      } finally {
        setIsLoadingBinding(false);
      }
    };

    checkBinding();
  }, [profile]);

  // Subscribe to device activities
  useEffect(() => {
    if (!boundDevice?.id) {
      setActivities([]);
      return;
    }

    console.log("Subscribing to activities for device:", boundDevice.id);
    const unsubscribe = activityService.subscribeActivities(
      boundDevice.id,
      (newActivities) => {
        console.log("Received activities:", newActivities.length);
        setActivities(newActivities);
      },
      100, // Limit to 100 recent activities
    );

    return () => {
      console.log("Unsubscribing from activities");
      unsubscribe();
    };
  }, [boundDevice?.id]);

  // 打開設備資訊時，把編輯欄位同步成目前設備資料
  useEffect(() => {
    if (isBindModalOpen && boundDevice) {
      setDeviceEditNickname(boundDevice.mapUserNickname ?? "");
      setDeviceEditAge(boundDevice.mapUserAge ?? "");
      setDeviceEditGender(boundDevice.mapUserGender ?? "");
    }
  }, [isBindModalOpen, boundDevice]);

  const handleSaveDeviceProfile = async () => {
    if (!profile) return;
    setIsSavingProfile(true);
    setIsFullScreenLoading(true);
    setLoadingMessage("儲存中...");
    try {
      const result = await deviceService.updateDeviceProfile(profile.userId, {
        nickname: deviceEditNickname.trim() || null,
        age: deviceEditAge === "" ? null : Number(deviceEditAge),
        gender: deviceEditGender
          ? (deviceEditGender as "MALE" | "FEMALE" | "OTHER")
          : null,
      });
      if (result.success) {
        const status = await deviceService.getBindingStatus(profile.userId);
        setBoundDevice(status.device || null);
        setLoadingMessage("已儲存");
        setTimeout(() => setIsFullScreenLoading(false), 400);
      } else {
        setIsFullScreenLoading(false);
        alert(result.error || "儲存失敗");
      }
    } catch (e: any) {
      setIsFullScreenLoading(false);
      alert(e?.message || "儲存失敗");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleConfirmBind = async () => {
    if (!profile) {
      alert("請先登入");
      return;
    }

    if (!deviceName.trim()) {
      alert("請輸入產品序號");
      return;
    }

    setIsBinding(true);
    setIsFullScreenLoading(true);
    setLoadingMessage("正在綁定設備...");

    try {
      const result = await deviceService.bindDevice(
        profile.userId,
        deviceName.trim(),
        nickname.trim() || undefined,
        age,
        selectedGender as "MALE" | "FEMALE" | "OTHER" | undefined,
      );

      if (result.success) {
        setLoadingMessage("綁定成功！正在載入設備資訊...");
        setIsBindModalOpen(false);
        // Reset form
        setDeviceName("");
        setNickname("");
        setAge(undefined);
        setSelectedGender("");
        // Reload binding status
        const status = await deviceService.getBindingStatus(profile.userId);
        setIsBound(status.isBound);
        setBoundDevice(status.device || null);

        setTimeout(() => {
          alert("設備綁定成功！");
          setIsFullScreenLoading(false);
        }, 500);
      } else {
        setIsFullScreenLoading(false);
        alert(`綁定失敗：${result.error || "未知錯誤"}`);
      }
    } catch (error: any) {
      console.error("Error binding device:", error);
      setIsFullScreenLoading(false);
      alert(`綁定失敗：${error.message || "未知錯誤"}`);
    } finally {
      setIsBinding(false);
    }
  };

  const handleUnbind = async () => {
    if (!profile) {
      alert("請先登入");
      return;
    }

    if (
      !confirm("確定要解除綁定嗎？解綁後將無法接收通知，且活動記錄會被匿名化。")
    ) {
      return;
    }

    setIsUnbinding(true);
    setIsFullScreenLoading(true);
    setLoadingMessage("正在解除綁定...");

    try {
      const result = await deviceService.unbindDevice(profile.userId);

      if (result.success) {
        setLoadingMessage("解綁成功！正在清理資料...");
        setIsBindModalOpen(false);
        setIsBound(false);
        setBoundDevice(null);
        setNotificationPointIds([]);

        setTimeout(() => {
          alert("設備解綁成功！");
          setIsFullScreenLoading(false);
        }, 500);
      } else {
        setIsFullScreenLoading(false);
        alert(`解綁失敗：${result.error || "未知錯誤"}`);
      }
    } catch (error: any) {
      console.error("Error unbinding device:", error);
      setIsFullScreenLoading(false);
      alert(`解綁失敗：${error.message || "未知錯誤"}`);
    } finally {
      setIsUnbinding(false);
    }
  };

  const handleAddNotificationPoint = async (gateway: Gateway) => {
    if (!profile) {
      alert("請先登入");
      return;
    }

    if (!isBound) {
      alert("請先綁定設備");
      return;
    }

    setIsFullScreenLoading(true);
    setLoadingMessage("正在設定通知點...");

    try {
      const result = await notificationPointService.addNotificationPoint(
        profile.userId,
        gateway.id,
      );

      if (result.success) {
        setLoadingMessage("設定成功！");
        setNotificationPointIds([...notificationPointIds, gateway.id]);
        setIsGatewayModalOpen(false);

        setTimeout(() => {
          alert(`已將「${gateway.name}」設為通知點`);
          setIsFullScreenLoading(false);
        }, 500);
      } else {
        setIsFullScreenLoading(false);
        alert(`設定失敗：${result.error || "未知錯誤"}`);
      }
    } catch (error: any) {
      console.error("Error adding notification point:", error);
      setIsFullScreenLoading(false);
      alert(`設定失敗：${error.message || "未知錯誤"}`);
    }
  };

  const handleRemoveNotificationPoint = async (gateway: Gateway) => {
    if (!profile) {
      alert("請先登入");
      return;
    }

    if (!confirm(`確定要移除「${gateway.name}」的通知功能嗎？`)) {
      return;
    }

    setIsFullScreenLoading(true);
    setLoadingMessage("正在移除通知點...");

    try {
      const result = await notificationPointService.removeNotificationPoint(
        profile.userId,
        gateway.id,
      );

      if (result.success) {
        setLoadingMessage("移除成功！");
        setNotificationPointIds(
          notificationPointIds.filter((id) => id !== gateway.id),
        );
        setIsGatewayModalOpen(false);

        setTimeout(() => {
          alert(`已移除「${gateway.name}」的通知功能`);
          setIsFullScreenLoading(false);
        }, 500);
      } else {
        setIsFullScreenLoading(false);
        alert(`移除失敗：${result.error || "未知錯誤"}`);
      }
    } catch (error: any) {
      console.error("Error removing notification point:", error);
      setIsFullScreenLoading(false);
      alert(`移除失敗：${error.message || "未知錯誤"}`);
    }
  };

  // Group activities by date
  const activityMap = activityService.groupActivitiesByDate(activities);
  const dateGroups: DateGroupType[] = Array.from(activityMap.entries()).map(
    ([date, acts]) => ({
      date,
      activities: acts.map((activity, index) => ({
        id: activity.id,
        gatewayId: activity.gatewayId,
        gatewayName: activity.gatewayName,
        message: `已通過：${activity.gatewayName}`,
        time: activityService.formatActivityTime(activity.timestamp),
        timestamp: new Date(activity.timestamp),
        isLatest: index === 0 && activityService.isToday(activity.timestamp),
        hasNotification: activity.triggeredNotification,
      })),
    }),
  );

  const lastActivity = activities.length > 0 ? activities[0] : null;

  // Swipe handling
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && activePanel === "timeline") {
      setActivePanel("statistics");
    } else if (isRightSwipe && activePanel === "statistics") {
      setActivePanel("timeline");
    }
  };

  const getGatewayTypeLabel = (type: string): string => {
    switch (type) {
      case "SAFE_ZONE":
        return "可通知守望點";
      case "SCHOOL_ZONE":
        return "學校區域";
      case "OBSERVE_ZONE":
        return "觀察區域";
      case "INACTIVE":
        return "未啟用";
      default:
        return type;
    }
  };

  return (
    <>
      {/* Full Screen Loading */}
      <FullScreenLoading
        isOpen={isFullScreenLoading}
        message={loadingMessage}
      />

      {/* 關閉按鈕 - 展開時顯示在 navbar 左側 */}
      {isSheetExpanded && (
        <button
          onClick={() => setIsSheetExpanded(false)}
          className="fixed left-4 z-[250] w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center active:scale-95 transition shadow-sm"
          style={{ top: "calc(57px / 2)", transform: "translateY(-50%)" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5 text-gray-600"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Google Maps 容器 */}
      <div className="map-container" id="mapContainer">
        {!isLoaded && (
          <div className="map-loading">
            <div className="loading-spinner"></div>
            <div>載入地圖中...</div>
          </div>
        )}
        <div
          ref={mapRef}
          className="google-map"
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* 左側浮動按鈕組 */}
      <div className="floating-buttons-group">
        {/* 綁定設備按鈕 */}
        <button
          className="floating-button"
          id="bindDeviceBtn"
          aria-label="綁定設備"
          onClick={() => setIsBindModalOpen(true)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" />
          </svg>
        </button>

        {/* 通知點管理按鈕 */}
        <button
          className="floating-button"
          id="gatewayManageBtn"
          aria-label="通知點管理"
          onClick={() => setIsGatewayManageOpen(true)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
        </button>

        {/* 回到我的位置按鈕 */}
        <button
          className={`floating-button action-btn ${isLocating ? "locating" : ""}`}
          id="myLocationBtn"
          aria-label="回到我的位置"
          onClick={handleMyLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <div className="loading-spinner-small"></div>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
            </svg>
          )}
        </button>

        {/* 重新載入按鈕 */}
        <button
          className="floating-button action-btn"
          id="refreshBtn"
          aria-label="重新載入"
          onClick={handleRefresh}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
        </button>
      </div>

      {/* 時間軸底部彈窗 */}
      <BottomSheet isExpanded={isSheetExpanded} onToggle={setIsSheetExpanded}>
        {/* 固定的 Header - 點擊切換展開/關閉 */}
        <div
          className="bottom-sheet-header"
          onClick={() => setIsSheetExpanded(!isSheetExpanded)}
          style={{ cursor: "pointer" }}
        >
          <div className="timeline-header">
            <div className="device-info">
              <div className="device-avatar">
                {boundDevice?.mapUserNickname ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: "#4ECDC4",
                    }}
                  >
                    {boundDevice.mapUserNickname.charAt(0)}
                  </div>
                ) : (
                  <svg viewBox="0 0 24 24" fill="#4ECDC4">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </div>
              <div className="device-name">
                {boundDevice?.mapUserNickname ||
                  boundDevice?.deviceName ||
                  "我的設備"}
              </div>
            </div>
            <div className="latest-update">
              <div className="update-time">
                {lastActivity
                  ? activityService.formatActivityTime(lastActivity.timestamp)
                  : "--:--"}
              </div>
              <div className="update-label">最新更新</div>
            </div>
          </div>

          {/* Panel Tabs */}
          {isBound && activities.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                padding: "0 16px",
                borderBottom: "1px solid #e0e0e0",
                position: "relative",
              }}
            >
              {/* Sliding indicator */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: activePanel === "timeline" ? "16px" : "calc(50% + 4px)",
                  width: "calc(50% - 20px)",
                  height: "3px",
                  background: "#1a1a1a",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  borderRadius: "3px 3px 0 0",
                }}
              />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePanel("timeline");
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  border: "none",
                  background: "transparent",
                  color: activePanel === "timeline" ? "#1a1a1a" : "#999",
                  fontWeight: activePanel === "timeline" ? "bold" : "normal",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s ease",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                守護紀錄
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePanel("statistics");
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  border: "none",
                  background: "transparent",
                  color: activePanel === "statistics" ? "#1a1a1a" : "#999",
                  fontWeight: activePanel === "statistics" ? "bold" : "normal",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s ease",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                統計分析
              </button>
            </div>
          )}
        </div>

        {/* 可滾動的內容區 */}
        <div className="bottom-sheet-scrollable">
          <div
            className="timeline-content"
            id="timelineContent"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              position: "relative",
              overflow: "hidden",
            }}
          >
            {!isBound ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#999",
                }}
              >
                <p>請先綁定設備以查看活動記錄</p>
              </div>
            ) : activities.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#999",
                }}
              >
                <p>尚無活動記錄</p>
                <p style={{ fontSize: "14px", marginTop: "8px" }}>
                  當設備被接收器偵測到時，會顯示在這裡
                </p>
              </div>
            ) : (
              <div style={{ position: "relative", minHeight: "200px" }}>
                {/* Timeline Panel */}
                <div
                  style={{
                    position:
                      activePanel === "timeline" ? "relative" : "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    opacity: activePanel === "timeline" ? 1 : 0,
                    transform:
                      activePanel === "timeline"
                        ? "translateX(0)"
                        : "translateX(-100%)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    pointerEvents: activePanel === "timeline" ? "auto" : "none",
                  }}
                >
                  {/* Activity timeline */}
                  {dateGroups.map((group, index) => (
                    <DateGroup key={index} date={group.date}>
                      {group.activities.map((activity) => (
                        <TimelineItem
                          key={activity.id}
                          activity={activity}
                          onClick={() => handleActivityClick(activity)}
                        />
                      ))}
                    </DateGroup>
                  ))}
                </div>

                {/* Statistics Panel */}
                <div
                  style={{
                    position:
                      activePanel === "statistics" ? "relative" : "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    opacity: activePanel === "statistics" ? 1 : 0,
                    transform:
                      activePanel === "statistics"
                        ? "translateX(0)"
                        : "translateX(100%)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    pointerEvents:
                      activePanel === "statistics" ? "auto" : "none",
                  }}
                >
                  <StatisticsPanel activities={activities} />
                </div>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* 綁定設備對話框 */}
      <Modal
        isOpen={isBindModalOpen}
        onClose={() => setIsBindModalOpen(false)}
        title={isBound ? "設備資訊" : "綁定設備"}
      >
        {isLoadingBinding ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
            }}
          >
            <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
            <div
              style={{ marginTop: "12px", color: "#999", textAlign: "center" }}
            >
              載入中...
            </div>
          </div>
        ) : isBound && boundDevice ? (
          // 已綁定：產品序號唯讀，暱稱／年齡／性別可編輯
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  產品序號
                </label>
                <div className="text-base font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  {boundDevice.deviceName || "未設定"}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  暱稱（選填）
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="例如：我的設備"
                  value={deviceEditNickname}
                  onChange={(e) => setDeviceEditNickname(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  性別（選填）
                </label>
                <select
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
                  value={deviceEditGender}
                  onChange={(e) => setDeviceEditGender(e.target.value)}
                >
                  <option value="">請選擇</option>
                  <option value="MALE">男性</option>
                  <option value="FEMALE">女性</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  年齡（選填）
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="例如：75"
                  min={0}
                  max={150}
                  value={deviceEditAge === "" ? "" : deviceEditAge}
                  onChange={(e) =>
                    setDeviceEditAge(
                      e.target.value === "" ? "" : parseInt(e.target.value, 10),
                    )
                  }
                />
              </div>

              {boundDevice.boundAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    綁定時間
                  </label>
                  <div className="text-base text-gray-900">
                    {(() => {
                      const boundAt = boundDevice.boundAt as any;
                      if (
                        boundAt &&
                        typeof boundAt === "object" &&
                        boundAt.seconds
                      ) {
                        return new Date(boundAt.seconds * 1000).toLocaleString(
                          "zh-TW",
                        );
                      }
                      const date = new Date(boundAt);
                      return isNaN(date.getTime())
                        ? "未知"
                        : date.toLocaleString("zh-TW");
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleSaveDeviceProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? "儲存中..." : "儲存"}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleUnbind}
                disabled={isUnbinding}
              >
                {isUnbinding ? "解綁中..." : "解除綁定"}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setIsBindModalOpen(false)}
              >
                關閉
              </button>
            </div>
          </>
        ) : (
          // 未綁定：顯示綁定表單
          <>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  產品序號 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="例如：1-1001"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  暱稱（選填）
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="例如：我的設備"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  性別（選填）
                </label>
                <select
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                >
                  <option value="">請選擇</option>
                  <option value="MALE">男性</option>
                  <option value="FEMALE">女性</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  年齡（選填）
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="例如：75"
                  min="0"
                  max="150"
                  value={age || ""}
                  onChange={(e) =>
                    setAge(
                      e.target.value ? parseInt(e.target.value) : undefined,
                    )
                  }
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleConfirmBind}
                disabled={isBinding}
              >
                {isBinding ? "綁定中..." : "確認綁定"}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setIsBindModalOpen(false)}
              >
                取消
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* 接收點詳情對話框 */}
      <Modal
        isOpen={isGatewayModalOpen}
        onClose={() => setIsGatewayModalOpen(false)}
        title={selectedGateway?.location || "接收點詳情"}
        titleBadge={
          selectedGateway?.isAD && selectedGateway?.storeLogo ? (
            <img
              src={selectedGateway.storeLogo}
              alt="店家Logo"
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid #fff",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              }}
            />
          ) : undefined
        }
      >
        {selectedGateway && (
          <>
            <div className="gateway-info">
              <div className="info-row">
                <svg
                  className="location-icon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span>{selectedGateway.name || "名稱未設定"}</span>
              </div>
              <div className="gateway-badges">
                <span
                  className={`badge badge-${selectedGateway.type.toLowerCase().replace("_", "-")}`}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    {selectedGateway.type === "SAFE_ZONE" && (
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    )}
                    {selectedGateway.type === "SCHOOL_ZONE" && (
                      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9M12 5.09L16.5 7.5 12 9.91 7.5 7.5 12 5.09z" />
                    )}
                    {selectedGateway.type === "OBSERVE_ZONE" && (
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    )}
                  </svg>
                  {getGatewayTypeLabel(selectedGateway.type)}
                </span>
                {selectedGateway.isAD && (
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#dcfce7",
                      color: "#16a34a",
                      border: "1px solid #86efac",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      style={{ width: "14px", height: "14px" }}
                    >
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                    合作友善商家
                  </span>
                )}
              </div>
            </div>

            {/* 商家優惠區塊 - 僅在 isAD 為 true 時顯示 */}
            {selectedGateway.isAD && (
              <>
                <div
                  style={{
                    borderTop: "1px solid #e5e7eb",
                    margin: "16px 0",
                  }}
                />
                <div className="store-promotion-section">
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#374151",
                      marginBottom: "12px",
                      textAlign: "left",
                    }}
                  >
                    商家優惠
                  </h3>

                  {selectedGateway.imageLink && (
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        paddingTop: "33.33%", // 3:1 比例
                        marginBottom: "12px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        backgroundColor: "#f3f4f6",
                      }}
                    >
                      <img
                        src={selectedGateway.imageLink}
                        alt="優惠活動"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                  )}

                  {selectedGateway.activityTitle && (
                    <h4
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#111827",
                        marginBottom: "8px",
                        textAlign: "left",
                      }}
                    >
                      {selectedGateway.activityTitle}
                    </h4>
                  )}

                  {selectedGateway.activityContent && (
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        lineHeight: "1.6",
                        textAlign: "left",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {selectedGateway.activityContent}
                    </p>
                  )}

                  {selectedGateway.websiteLink && (
                    <a
                      href={selectedGateway.websiteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        marginTop: "12px",
                        color: "#3b82f6",
                        fontSize: "14px",
                        textDecoration: "none",
                      }}
                    >
                      <svg
                        style={{
                          width: "16px",
                          height: "16px",
                          marginRight: "4px",
                        }}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                      </svg>
                      前往官網
                    </a>
                  )}
                </div>
              </>
            )}

            {/* Gateway 序號 - 灰色小字 */}
            <div
              style={{
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: "1px solid #f3f4f6",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  fontWeight: "400",
                }}
              >
                接收點序號：{selectedGateway.serialNumber}
              </span>
            </div>

            <div className="modal-actions">
              {isBound &&
                (selectedGateway.type === "SAFE_ZONE" ||
                  selectedGateway.type === "SCHOOL_ZONE") && (
                  <>
                    {notificationPointIds.includes(selectedGateway.id) ? (
                      <button
                        className="btn btn-danger"
                        onClick={() =>
                          handleRemoveNotificationPoint(selectedGateway)
                        }
                      >
                        <svg
                          style={{ width: "18px", height: "18px" }}
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                        移除通知點
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          handleAddNotificationPoint(selectedGateway)
                        }
                      >
                        <svg
                          style={{ width: "18px", height: "18px" }}
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                        </svg>
                        設為通知點
                      </button>
                    )}
                  </>
                )}

              <button
                className="btn btn-outline"
                onClick={() => setIsGatewayModalOpen(false)}
              >
                關閉
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* 通知點管理對話框 */}
      <Modal
        isOpen={isGatewayManageOpen}
        onClose={() => setIsGatewayManageOpen(false)}
        title="通知點管理"
      >
        <div className="gateway-list">
          {!isBound ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#999",
              }}
            >
              <svg
                style={{
                  width: "64px",
                  height: "64px",
                  margin: "0 auto 12px",
                  color: "#ddd",
                }}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <p>請先綁定設備</p>
            </div>
          ) : notificationPointIds.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#999",
              }}
            >
              <svg
                style={{
                  width: "64px",
                  height: "64px",
                  margin: "0 auto 12px",
                  color: "#ddd",
                }}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <p>尚未設定通知點</p>
              <p style={{ fontSize: "14px", marginTop: "8px" }}>
                點擊地圖上的接收點可以設為通知點
              </p>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {gateways
                .filter((gateway) => notificationPointIds.includes(gateway.id))
                .map((gateway) => (
                  <div key={gateway.id} className="gateway-item">
                    <div
                      className="gateway-item-content"
                      onClick={() => {
                        setSelectedGateway(gateway);
                        setIsGatewayManageOpen(false);
                        setIsGatewayModalOpen(true);
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "12px",
                        }}
                      >
                        <svg
                          style={{
                            width: "22px",
                            height: "22px",
                            color: "#4ecdc4",
                          }}
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        <span
                          style={{
                            fontWeight: "bold",
                            fontSize: "17px",
                            color: "#2c3e50",
                            flex: 1,
                          }}
                        >
                          {gateway.name}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#666",
                          marginBottom: "12px",
                          paddingLeft: "32px",
                        }}
                      >
                        {gateway.location || "位置未設定"}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          paddingLeft: "32px",
                        }}
                      >
                        <span
                          className={`badge badge-${gateway.type.toLowerCase().replace("_", "-")}`}
                        >
                          {getGatewayTypeLabel(gateway.type)}
                        </span>
                      </div>
                    </div>

                    {/* 移除按鈕 */}
                    <button
                      className="gateway-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveNotificationPoint(gateway);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-outline"
            onClick={() => setIsGatewayManageOpen(false)}
          >
            關閉
          </button>
        </div>
      </Modal>
    </>
  );
};
