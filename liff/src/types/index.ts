// 從 admin 專案複用型別定義

// Tenant
export interface Tenant {
  id: string;
  code: string;
  name: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
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

// Device
export interface Device {
  id: string;
  // ✅ 核心識別欄位（用於 Beacon 識別）
  uuid: string; // 必填 - 服務識別碼（所有同公司設備統一）
  major: number; // 必填 - 群組編號（例如：社區/區域）
  minor: number; // 必填 - 設備編號（每張卡片唯一）
  // ⚠️ 輔助欄位
  macAddress?: string; // 選填 - Beacon MAC 會隨機變化，僅供參考
  deviceName?: string;
  type: DeviceType;
  // 綁定狀態（新架構）
  bindingType: DeviceBindingType;
  boundTo: string | null; // elderId 或 mapAppUserId 或 lineUserDocId
  boundAt: string | null;
  // MAP_USER / LINE_USER 專屬資料
  mapUserNickname?: string | null;
  mapUserAge?: number | null;
  mapUserGender?: "MALE" | "FEMALE" | "OTHER" | null;
  inheritedNotificationPointIds?: string[]; // Gateway IDs 陣列
  // 標籤（取代 tenantId）
  tags: string[]; // 例如：["tenant_id_1", "tenant_id_2"]
  // 裝置狀態
  batteryLevel?: number;
  lastSeen?: string;
  lastRssi?: number;
  isActive: boolean;
  elder?: Elder;
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

export type DeviceType = "IBEACON" | "EDDYSTONE" | "GENERIC_BLE";

export const DeviceType = {
  IBEACON: "IBEACON",
  EDDYSTONE: "EDDYSTONE",
  GENERIC_BLE: "GENERIC_BLE",
} as const;

// Gateway
export interface Gateway {
  id: string;
  tenantId: string;
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
  isAD?: boolean; // 是否為行銷點
  storeLogo?: string; // 店家 Logo
  imageLink?: string; // 店家圖片/Banner
  activityTitle?: string; // 活動標題
  activityContent?: string; // 活動內容
  websiteLink?: string; // 官網連結
  storePassword?: string; // 商家密碼
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
  assignedTo?: string;
  assignedAt?: string;
  assignmentStatus?: "PENDING" | "ACCEPTED" | "DECLINED";
  elder?: Elder;
  gateway?: Gateway;
  assignedMember?: AppUser;
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

// AppUser
export interface AppUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  // LINE 相關資訊
  lineUserId?: string;
  lineDisplayName?: string;
  linePictureUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

// TenantMember
export interface TenantMember {
  id: string;
  tenantId: string;
  appUserId: string;
  role: "MEMBER" | "ADMIN";
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  processedAt?: string;
  processedByType?: "backend" | "app";
  rejectionReason?: string;
  appUser?: AppUser;
  tenant?: Tenant; // 關聯的社區資料
}

// Activity
export interface Activity {
  id: string;
  elderId?: string;
  gatewayId?: string;
  timestamp: any; // Firestore Timestamp or Date
  rssi?: number;
  latitude?: number;
  longitude?: number;
  gateway?: Gateway;
  bindingType?: string;
}

// Map related types
export interface MapMarker {
  id: string;
  type: "gateway" | "activity";
  position: {
    top: string;
    left: string;
  };
  data: Gateway | (Activity & { elder?: Elder });
}

export interface TimelineActivity {
  id: string;
  gatewayId: string;
  gatewayName: string;
  message: string;
  time: string;
  timestamp: any;
  isLatest?: boolean;
  hasNotification?: boolean;
}

export interface DateGroup {
  date: string;
  activities: TimelineActivity[];
}
