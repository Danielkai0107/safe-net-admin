// User & Auth
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
  phone?: string;
  avatar?: string;
}

export type UserRole = "SUPER_ADMIN" | "TENANT_ADMIN" | "STAFF";

export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  TENANT_ADMIN: "TENANT_ADMIN",
  STAFF: "STAFF",
} as const;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

// SaaS User (Line OA 管理員 - Community Portal 使用)
export interface SaasUser {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  tenantId: string;
  role: "ADMIN" | "MEMBER";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tenant?: Tenant;
}

// Tenant
export interface Tenant {
  id: string;
  code: string;
  name: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  BU_type?: "card" | "group" | "safe";
  // LINE 通知設定
  lineLiffId?: string;
  lineLiffEndpointUrl?: string;
  lineChannelAccessToken?: string;
  lineChannelSecret?: string;
  settings?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Elder
export interface Elder {
  id: string;
  tenantId: string;
  name: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  birthDate?: string;
  age?: number;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  photo?: string;
  notes?: string;
  status: ElderStatus;
  inactiveThresholdHours: number;
  lastActivityAt?: string;
  lastSeenLocation?: any;
  isActive: boolean;
  deviceId?: string;
  device?: Device;
  tenant?: Tenant;
}

export type ElderStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "HOSPITALIZED"
  | "DECEASED"
  | "MOVED_OUT";

export const ElderStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  HOSPITALIZED: "HOSPITALIZED",
  DECEASED: "DECEASED",
  MOVED_OUT: "MOVED_OUT",
} as const;

// BeaconUUID (服務識別碼管理)
export interface BeaconUUID {
  id: string;
  uuid: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Device
export interface Device {
  id: string;
  // 核心識別欄位（用於 Beacon 識別）
  uuid: string; // 必填 - 服務識別碼（所有同公司設備統一）
  major: number; // 必填 - 群組編號（例如：社區/區域）
  minor: number; // 必填 - 設備編號（每張卡片唯一）
  deviceName?: string;
  type: DeviceType;
  // 綁定狀態（統一管理）
  bindingType: DeviceBindingType;
  boundTo: string | null; // elderId 或 mapAppUserId
  boundAt: string | null;
  // MAP 用戶專屬資料（只在 bindingType="MAP_USER" 時有值）
  mapUserNickname?: string | null;
  mapUserAge?: number | null;
  mapUserGender?: "MALE" | "FEMALE" | "OTHER" | null;
  // 標籤（取代 tenantId）
  tags: string[]; // 例如：["tenant_dalove_001", "批次2024"]
  // 通知相關欄位（統一通知架構）
  fcmToken?: string | null; // FCM 推送 token（從 app_users 移過來）
  notificationEnabled?: boolean; // 是否啟用通知
  inheritedNotificationPointIds?: string[]; // 從社區繼承的通知點 gateway IDs
  // 輔助欄位
  macAddress?: string; // 選填 - Beacon MAC 會隨機變化，僅供參考
  // 裝置狀態
  batteryLevel?: number;
  lastSeen?: string;
  lastRssi?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  elder?: Elder;
}

export type DeviceType = "IBEACON" | "EDDYSTONE" | "GENERIC_BLE";

export const DeviceType = {
  IBEACON: "IBEACON",
  EDDYSTONE: "EDDYSTONE",
  GENERIC_BLE: "GENERIC_BLE",
} as const;

// 設備的自訂通知點（子集合：devices/{deviceId}/notificationPoints/{pointId}）
export interface DeviceNotificationPoint {
  id: string;
  gatewayId: string;
  name: string;
  notificationMessage?: string | null;
  isActive: boolean;
  createdAt: string;
}

// 裝置綁定類型
export type DeviceBindingType =
  | "ELDER"
  | "MAP_USER"
  | "LINE_USER"
  | "UNBOUND"
  | "ANONYMOUS";

export const DeviceBindingType = {
  ELDER: "ELDER",
  MAP_USER: "MAP_USER",
  LINE_USER: "LINE_USER",
  UNBOUND: "UNBOUND",
  ANONYMOUS: "ANONYMOUS",
} as const;

// 裝置活動記錄
export interface DeviceActivity {
  id: string;
  timestamp: string;
  gatewayId: string;
  gatewayName: string;
  gatewayType: GatewayType;
  latitude: number;
  longitude: number;
  rssi: number;
  bindingType: DeviceBindingType;
  boundTo: string | null;
  triggeredNotification: boolean;
  notificationType: "LINE" | "FCM" | null;
  notificationDetails?: any;
  notificationPointId?: string; // MAP_USER 專用：觸發通知的點位 ID
  anonymizedAt?: string; // 記錄匿名化時間
}

// Gateway
export interface Gateway {
  id: string;
  tenantId: string | null;
  serialNumber: string;
  macAddress?: string; // MAC Address for commercial receivers
  imei?: string; // IMEI for mobile phones
  name: string;
  location?: string;
  type: GatewayType;
  latitude?: number;
  longitude?: number;
  deviceInfo?: any;
  isActive: boolean;
  isAD?: boolean; // 行銷點
  tenant?: Tenant;
}

export type GatewayType =
  | "SCHOOL_ZONE"
  | "SAFE_ZONE"
  | "OBSERVE_ZONE"
  | "INACTIVE";

export const GatewayType = {
  SCHOOL_ZONE: "SCHOOL_ZONE",
  SAFE_ZONE: "SAFE_ZONE",
  OBSERVE_ZONE: "OBSERVE_ZONE",
  INACTIVE: "INACTIVE",
} as const;

// Alert
export interface Alert {
  id: string;
  tenantId: string;
  elderId: string;
  gatewayId?: string;
  type: AlertType;
  status: AlertStatus;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: any;
  latitude?: number;
  longitude?: number;
  triggeredAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  // 警報分配相關
  assignedTo?: string; // 分配給哪位成員的 appUser ID
  assignedAt?: string; // 分配時間
  assignmentStatus?: "PENDING" | "ACCEPTED" | "DECLINED"; // 分配狀態
  elder?: Elder;
  gateway?: Gateway;
}

export type AlertType =
  | "BOUNDARY"
  | "INACTIVE"
  | "FIRST_ACTIVITY"
  | "LOW_BATTERY"
  | "EMERGENCY";

export const AlertType = {
  BOUNDARY: "BOUNDARY",
  INACTIVE: "INACTIVE",
  FIRST_ACTIVITY: "FIRST_ACTIVITY",
  LOW_BATTERY: "LOW_BATTERY",
  EMERGENCY: "EMERGENCY",
} as const;

export type AlertStatus = "PENDING" | "NOTIFIED" | "RESOLVED" | "DISMISSED";

export const AlertStatus = {
  PENDING: "PENDING",
  NOTIFIED: "NOTIFIED",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const AlertSeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

// API Response
export interface ApiResponse<T> {
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Dashboard Stats
export interface DashboardStats {
  tenants: { total: number };
  elders: { total: number; active: number };
  devices: { total: number };
  gateways: { total: number };
  alerts: { pending: number; today: number };
  logs: { today: number };
}

// ========================================
// Map App 相關型別定義
// ========================================

// Line 用戶管理
export interface MapAppUser {
  id: string;
  email?: string;
  name: string;
  phone?: string;
  avatar?: string;
  boundDeviceId?: string; // 雙向引用，方便查詢
  fcmToken?: string;
  notificationEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 用戶通知點位
export interface MapUserNotificationPoint {
  id: string;
  mapAppUserId: string;
  gatewayId: string;
  name: string;
  notificationMessage?: string;
  isActive: boolean;
  createdAt: string;
  gateway?: Gateway;
}

// 用戶活動記錄
export interface MapUserActivity {
  id: string;
  mapAppUserId: string;
  deviceId: string;
  gatewayId: string;
  timestamp: string;
  rssi?: number;
  latitude?: number;
  longitude?: number;
  triggeredNotification?: boolean;
  notificationPointId?: string;
}

// 匿名活動記錄（解綁後的歷史記錄，用於統計分析）
export interface AnonymousActivity {
  id: string;
  deviceId: string; // 設備 ID
  timestamp: string; // 活動時間
  gatewayId: string; // 接收器 ID
  gatewayName?: string; // 接收器名稱
  gatewayType?: GatewayType; // 接收器類型
  latitude?: number; // 位置
  longitude?: number; // 位置
  rssi?: number; // 信號強度
  triggeredNotification?: boolean;
  notificationType?: "LINE" | "FCM" | null;
  notificationPointId?: string;
  bindingType: "ANONYMOUS"; // 固定為 ANONYMOUS
  boundTo: null; // 固定為 null
  anonymizedAt: string; // 匿名化時間
  archiveSessionId: string; // 歸檔批次 ID（同一次解綁的記錄會有相同的 ID）
  originalActivityId?: string; // 原始活動 ID（可選）
}
