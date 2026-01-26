import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { Client, FlexMessage } from "@line/bot-sdk";

// Type definitions
interface BeaconData {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  batteryLevel?: number; // Optional battery level (0-100)
}

interface NotificationResult {
  triggered: boolean;
  type: "LINE" | "FCM" | null;
  pointId?: string; // notificationPointId for MAP_USER
  details?: any;
}

interface RequestPayload {
  gateway_id: string; // MAC Address for commercial receivers, IMEI for mobile phones
  lat?: number; // Optional - will use gateway's fixed location if not provided
  lng?: number; // Optional - will use gateway's fixed location if not provided
  timestamp: number;
  beacons: BeaconData[];
}

interface GatewayInfo {
  id: string;
  tenantId: string | null;
  serialNumber: string;
  macAddress?: string;
  imei?: string;
  name: string;
  location?: string;
  type: "SCHOOL_ZONE" | "SAFE_ZONE" | "OBSERVE_ZONE" | "INACTIVE";
  latitude?: number;
  longitude?: number;
  isActive: boolean;
}

interface ProcessingResult {
  status: "created" | "updated" | "ignored";
  beaconId: string;
}

interface ResponseData {
  success: boolean;
  received: number;
  updated: number;
  ignored: number;
  timestamp: number;
}

/**
 * Log error to Firestore error_logs collection
 */
async function logError(
  functionName: string,
  errorMessage: string,
  errorStack: string | undefined,
  payload: any,
): Promise<void> {
  try {
    const db = admin.firestore();
    await db.collection("error_logs").add({
      function_name: functionName,
      error_message: errorMessage,
      error_stack: errorStack || "No stack trace available",
      payload: payload,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    // If logging to Firestore fails, at least log to console
    console.error("Failed to log error to Firestore:", logError);
  }
}

/**
 * Validate incoming request payload
 */
function validatePayload(body: any): { valid: boolean; error?: string } {
  if (!body) {
    return { valid: false, error: "Request body is empty" };
  }

  if (!body.gateway_id || typeof body.gateway_id !== "string") {
    return { valid: false, error: "Missing or invalid gateway_id" };
  }

  // lat and lng are optional, but if provided, must be valid
  if (body.lat !== undefined && body.lat !== null) {
    if (typeof body.lat !== "number" || body.lat < -90 || body.lat > 90) {
      return {
        valid: false,
        error: "Invalid lat (must be between -90 and 90)",
      };
    }
  }

  if (body.lng !== undefined && body.lng !== null) {
    if (typeof body.lng !== "number" || body.lng < -180 || body.lng > 180) {
      return {
        valid: false,
        error: "Invalid lng (must be between -180 and 180)",
      };
    }
  }

  if (!body.timestamp || typeof body.timestamp !== "number") {
    return { valid: false, error: "Missing or invalid timestamp" };
  }

  if (!Array.isArray(body.beacons)) {
    return { valid: false, error: "Missing or invalid beacons array" };
  }

  if (body.beacons.length === 0) {
    return { valid: false, error: "Beacons array is empty" };
  }

  // Validate and normalize each beacon
  for (let i = 0; i < body.beacons.length; i++) {
    const beacon = body.beacons[i];

    // Validate UUID
    if (!beacon.uuid || typeof beacon.uuid !== "string") {
      return { valid: false, error: `Beacon at index ${i} is missing uuid` };
    }

    // 轉換 major/minor 為數字（接受字串或數字）
    const major = Number(beacon.major);
    const minor = Number(beacon.minor);
    const rssi = Number(beacon.rssi);

    if (isNaN(major) || isNaN(minor)) {
      return {
        valid: false,
        error: `Beacon at index ${i} has invalid major/minor (major: ${beacon.major}, minor: ${beacon.minor})`,
      };
    }

    if (isNaN(rssi)) {
      return {
        valid: false,
        error: `Beacon at index ${i} has invalid rssi (${beacon.rssi})`,
      };
    }

    // 標準化為數字類型
    body.beacons[i].major = major;
    body.beacons[i].minor = minor;
    body.beacons[i].rssi = rssi;

    // Validate and normalize batteryLevel if provided (optional)
    if (beacon.batteryLevel !== undefined && beacon.batteryLevel !== null) {
      const batteryLevel = Number(beacon.batteryLevel);
      if (isNaN(batteryLevel) || batteryLevel < 0 || batteryLevel > 100) {
        return {
          valid: false,
          error: `Beacon at index ${i} has invalid batteryLevel (must be 0-100, got: ${beacon.batteryLevel})`,
        };
      }
      body.beacons[i].batteryLevel = batteryLevel;
    }
  }

  return { valid: true };
}

/**
 * Query gateway information from Firestore
 */
async function getGatewayInfo(
  gatewayId: string,
  db: admin.firestore.Firestore,
): Promise<GatewayInfo | null> {
  try {
    // Try to find gateway by macAddress
    let gatewayQuery = await db
      .collection("gateways")
      .where("macAddress", "==", gatewayId)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    // If not found, try by imei (for mobile phones)
    if (gatewayQuery.empty) {
      gatewayQuery = await db
        .collection("gateways")
        .where("imei", "==", gatewayId)
        .where("isActive", "==", true)
        .limit(1)
        .get();
    }

    // If still not found, try by serialNumber
    if (gatewayQuery.empty) {
      gatewayQuery = await db
        .collection("gateways")
        .where("serialNumber", "==", gatewayId)
        .where("isActive", "==", true)
        .limit(1)
        .get();
    }

    if (gatewayQuery.empty) {
      return null;
    }

    const gatewayDoc = gatewayQuery.docs[0];
    return {
      id: gatewayDoc.id,
      ...gatewayDoc.data(),
    } as GatewayInfo;
  } catch (error) {
    console.error("Error querying gateway:", error);
    throw error;
  }
}

/**
 * Get or create gateway (auto-register if not exists)
 *
 * If gateway is not found in database, automatically create a new one.
 * This allows receivers to upload data without pre-registration.
 */
async function getOrCreateGateway(
  gatewayId: string,
  payload: RequestPayload,
  db: admin.firestore.Firestore,
): Promise<GatewayInfo> {
  // First, try to find existing gateway
  let gateway = await getGatewayInfo(gatewayId, db);

  if (gateway) {
    return gateway;
  }

  // Gateway not found, auto-register
  console.log(`Auto-registering new gateway: ${gatewayId}`);

  // Build gateway data object (only include fields with values, not undefined)
  const newGateway: any = {
    serialNumber: gatewayId,
    name: `Auto-Gateway-${gatewayId.substring(0, 8)}`,
    location: `Auto-registered at ${new Date().toISOString()}`,
    type: "SAFE_ZONE" as const,
    tenantId: null,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Only add macAddress if it looks like a MAC address
  if (gatewayId.includes(":")) {
    newGateway.macAddress = gatewayId;
  }

  // Only add imei if it looks like an IMEI or device ID
  if (!gatewayId.includes(":") && gatewayId.length >= 10) {
    newGateway.imei = gatewayId;
  }

  // Only add latitude/longitude if provided (not undefined)
  if (payload.lat !== undefined && payload.lat !== null) {
    newGateway.latitude = payload.lat;
  }

  if (payload.lng !== undefined && payload.lng !== null) {
    newGateway.longitude = payload.lng;
  }

  const docRef = await db.collection("gateways").add(newGateway);

  console.log(`Gateway auto-registered with ID: ${docRef.id}`);

  return {
    id: docRef.id,
    serialNumber: newGateway.serialNumber,
    macAddress: newGateway.macAddress,
    imei: newGateway.imei,
    name: newGateway.name,
    location: newGateway.location,
    type: newGateway.type,
    latitude: newGateway.latitude,
    longitude: newGateway.longitude,
    tenantId: newGateway.tenantId,
    isActive: newGateway.isActive,
  } as GatewayInfo;
}

/**
 * Determine the location to use based on available data
 */
function determineLocation(
  gateway: GatewayInfo,
  uploadedLat: number | undefined,
  uploadedLng: number | undefined,
): { lat: number; lng: number } {
  // Prefer database location if available
  if (gateway.latitude !== undefined && gateway.longitude !== undefined) {
    return { lat: gateway.latitude, lng: gateway.longitude };
  }

  // Fall back to uploaded location (if available)
  if (uploadedLat !== undefined && uploadedLng !== undefined) {
    return { lat: uploadedLat, lng: uploadedLng };
  }

  // Final fallback: use default location (0, 0)
  console.warn(
    `No location available for gateway ${gateway.id}, using default (0, 0)`,
  );
  return { lat: 0, lng: 0 };
}

// Note: Legacy sendLineNotificationToTenant function removed - replaced by first activity and notification point alerts

/**
 * Check if this is the first activity today for an elder
 */
async function checkIfFirstActivityToday(
  elderId: string,
  currentTimestamp: number,
  db: admin.firestore.Firestore,
): Promise<boolean> {
  try {
    const elderDoc = await db.collection("elders").doc(elderId).get();
    if (!elderDoc.exists) return false;

    const elder = elderDoc.data();
    const lastActivityAt = elder?.lastActivityAt;

    if (!lastActivityAt) {
      return true; // 從未有活動，這是第一次
    }

    // 比較日期（只比年月日）
    const lastActivityDate = new Date(lastActivityAt);
    const currentDate = new Date(currentTimestamp);

    const lastActivityDay = lastActivityDate.toLocaleDateString("zh-TW", {
      timeZone: "Asia/Taipei",
    });
    const currentDay = currentDate.toLocaleDateString("zh-TW", {
      timeZone: "Asia/Taipei",
    });

    return lastActivityDay !== currentDay;
  } catch (error) {
    console.error("Error checking first activity:", error);
    return false;
  }
}

/**
 * Send LINE notification for first activity today
 */
async function sendFirstActivityNotification(
  elderId: string,
  elder: any,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  timestamp: number,
  tenantId: string,
  channelAccessToken: string,
  db: admin.firestore.Firestore,
): Promise<void> {
  try {
    const membersQuery = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("members")
      .where("status", "==", "APPROVED")
      .get();

    if (membersQuery.empty) {
      console.log(`No approved members found for tenant ${tenantId}`);
      return;
    }

    const memberAppUserIds = membersQuery.docs.map(
      (doc) => doc.data().appUserId,
    );
    const lineUserIds: string[] = [];

    for (const appUserId of memberAppUserIds) {
      const appUserDoc = await db.collection("line_users").doc(appUserId).get();
      if (appUserDoc.exists) {
        const appUser = appUserDoc.data();
        if (appUser?.lineUserId) {
          lineUserIds.push(appUser.lineUserId);
        }
      }
    }

    if (lineUserIds.length === 0) {
      console.log(`No members with LINE accounts found for tenant ${tenantId}`);
      return;
    }

    const client = new Client({ channelAccessToken });
    const elderName = elder?.name || "長輩";
    const locationText = gateway.location || gateway.name || "未知位置";
    const lastSeenTime = new Date(timestamp).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
    });

    const flexMessage: FlexMessage = {
      type: "flex",
      altText: `${elderName} 今日首次活動`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `${elderName} 今日首次活動`,
              weight: "bold",
              size: "lg",
              color: "#111111",
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `${elderName} 今日首次在 ${locationText} 被偵測到`,
              size: "md",
              color: "#111111",
              wrap: true,
            },
            {
              type: "separator",
              margin: "md",
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              spacing: "sm",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "長輩",
                      size: "sm",
                      color: "#555555",
                      flex: 2,
                    },
                    {
                      type: "text",
                      text: elder?.name || "未知",
                      size: "sm",
                      color: "#111111",
                      flex: 5,
                      wrap: true,
                    },
                  ],
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "地點",
                      size: "sm",
                      color: "#555555",
                      flex: 2,
                    },
                    {
                      type: "text",
                      text: locationText,
                      size: "sm",
                      color: "#111111",
                      flex: 5,
                      wrap: true,
                    },
                  ],
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "時間",
                      size: "sm",
                      color: "#555555",
                      flex: 2,
                    },
                    {
                      type: "text",
                      text: lastSeenTime,
                      size: "sm",
                      color: "#111111",
                      flex: 5,
                      wrap: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "primary",
              action: {
                type: "uri",
                label: "查看地圖",
                uri: `https://www.google.com/maps?q=${lat},${lng}`,
              },
            },
          ],
        },
      },
    };

    for (const lineUserId of lineUserIds) {
      try {
        await client.pushMessage(lineUserId, flexMessage);
        console.log(`Sent first activity notification to member ${lineUserId}`);
      } catch (error) {
        console.error(
          `Failed to send first activity notification to ${lineUserId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Error sending first activity notification:", error);
  }
}

/**
 * Send LINE notification for tenant notification point
 */
async function sendTenantNotificationPointAlert(
  elderId: string,
  elder: any,
  notificationPoint: any,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  timestamp: number,
  tenantId: string,
  channelAccessToken: string,
  db: admin.firestore.Firestore,
): Promise<void> {
  try {
    const membersQuery = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("members")
      .where("status", "==", "APPROVED")
      .get();

    if (membersQuery.empty) {
      console.log(`No approved members found for tenant ${tenantId}`);
      return;
    }

    const memberAppUserIds = membersQuery.docs.map(
      (doc) => doc.data().appUserId,
    );
    const lineUserIds: string[] = [];

    for (const appUserId of memberAppUserIds) {
      const appUserDoc = await db.collection("line_users").doc(appUserId).get();
      if (appUserDoc.exists) {
        const appUser = appUserDoc.data();
        if (appUser?.lineUserId) {
          lineUserIds.push(appUser.lineUserId);
        }
      }
    }

    if (lineUserIds.length === 0) {
      console.log(`No members with LINE accounts found for tenant ${tenantId}`);
      return;
    }

    const client = new Client({ channelAccessToken });
    const elderName = elder?.name || "長輩";
    const locationText =
      gateway.location || notificationPoint.name || "未知位置";
    const notificationMessage = `${elderName} 出現在 ${locationText} 附近`;
    const lastSeenTime = new Date(timestamp).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
    });

    const flexMessage: FlexMessage = {
      type: "flex",
      altText: `新偵測通知 - ${elderName}`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "新偵測通知",
              weight: "bold",
              size: "lg",
              color: "#111111",
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: notificationMessage,
              size: "md",
              color: "#111111",
              wrap: true,
            },
            {
              type: "separator",
              margin: "md",
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              spacing: "sm",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "長輩",
                      size: "sm",
                      color: "#555555",
                      flex: 2,
                    },
                    {
                      type: "text",
                      text: elder?.name || "未知",
                      size: "sm",
                      color: "#111111",
                      flex: 5,
                      wrap: true,
                    },
                  ],
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "地點",
                      size: "sm",
                      color: "#555555",
                      flex: 2,
                    },
                    {
                      type: "text",
                      text: notificationPoint.name,
                      size: "sm",
                      color: "#111111",
                      flex: 5,
                      wrap: true,
                    },
                  ],
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "時間",
                      size: "sm",
                      color: "#555555",
                      flex: 2,
                    },
                    {
                      type: "text",
                      text: lastSeenTime,
                      size: "sm",
                      color: "#111111",
                      flex: 5,
                      wrap: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "primary",
              action: {
                type: "uri",
                label: "查看地圖",
                uri: `https://www.google.com/maps?q=${lat},${lng}`,
              },
            },
          ],
        },
      },
    };

    for (const lineUserId of lineUserIds) {
      try {
        await client.pushMessage(lineUserId, flexMessage);
        console.log(`Sent notification point alert to member ${lineUserId}`);
      } catch (error) {
        console.error(
          `Failed to send notification point alert to ${lineUserId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Error sending notification point alert:", error);
  }
}

/**
 * Record device activity to device subcollection
 */
async function recordDeviceActivity(
  deviceId: string,
  device: any,
  beacon: BeaconData,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  timestamp: number,
  notificationResult: NotificationResult,
  db: admin.firestore.Firestore,
): Promise<void> {
  const activityData: any = {
    timestamp: admin.firestore.Timestamp.fromMillis(timestamp),
    gatewayId: gateway.id,
    gatewayName: gateway.name,
    gatewayType: gateway.type,
    latitude: lat,
    longitude: lng,
    rssi: beacon.rssi,
    bindingType: device.bindingType || "UNBOUND",
    boundTo: device.boundTo || null,
    triggeredNotification: notificationResult.triggered,
    notificationType: notificationResult.type,
    notificationDetails: notificationResult.details || null,
  };

  // 如果是 MAP_USER 且有觸發通知，加上 notificationPointId
  if (notificationResult.triggered && notificationResult.pointId) {
    activityData.notificationPointId = notificationResult.pointId;
  }

  await db
    .collection("devices")
    .doc(deviceId)
    .collection("activities")
    .add(activityData);

  console.log(
    `Recorded activity for device ${deviceId} at gateway ${gateway.id} - notification: ${notificationResult.triggered}`,
  );
}

/**
 * Handle notification based on device binding type
 */
async function handleNotification(
  deviceId: string,
  device: any,
  beacon: BeaconData,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  timestamp: number,
  db: admin.firestore.Firestore,
  isFirstActivityToday: boolean = false,
): Promise<NotificationResult> {
  const bindingType = device.bindingType || "UNBOUND";

  switch (bindingType) {
    case "ELDER":
      if (device.boundTo) {
        return await handleElderNotification(
          deviceId,
          device.boundTo,
          beacon,
          gateway,
          lat,
          lng,
          timestamp,
          db,
          isFirstActivityToday,
        );
      }
      return { triggered: false, type: null };

    case "MAP_USER":
      if (device.boundTo) {
        return await handleMapUserNotification(
          deviceId,
          device.boundTo,
          beacon,
          gateway,
          lat,
          lng,
          timestamp,
          db,
        );
      }
      return { triggered: false, type: null };

    case "UNBOUND":
    default:
      console.log(`Device ${deviceId} is unbound, no notification sent`);
      return { triggered: false, type: null };
  }
}

/**
 * Handle Elder notification (LINE)
 */
async function handleElderNotification(
  deviceId: string,
  elderId: string,
  beacon: BeaconData,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  timestamp: number,
  db: admin.firestore.Firestore,
  isFirstActivityToday: boolean = false,
): Promise<NotificationResult> {
  try {
    // 1. Get elder data
    const elderDoc = await db.collection("elders").doc(elderId).get();
    if (!elderDoc.exists) {
      console.log(`Elder ${elderId} not found`);
      return { triggered: false, type: null };
    }

    const elder = elderDoc.data();
    const tenantId = elder?.tenantId;

    if (!tenantId) {
      console.log(
        `Elder ${elderId} has no associated tenant, skipping notification`,
      );
      return { triggered: false, type: null };
    }

    // 2. Check if gateway is a notification point for this tenant
    const notificationPointsSnapshot = await db
      .collection("tenantNotificationPoints")
      .where("tenantId", "==", tenantId)
      .where("gatewayId", "==", gateway.id)
      .where("isActive", "==", true)
      .where("notifyOnElderActivity", "==", true)
      .limit(1)
      .get();

    // 3. Get tenant LINE settings
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    if (!tenantDoc.exists) {
      console.log(`Tenant ${tenantId} not found`);
      return { triggered: false, type: null };
    }

    const tenant = tenantDoc.data();
    const channelAccessToken = tenant?.lineChannelAccessToken;

    if (!channelAccessToken) {
      console.log(`Tenant ${tenantId} has no LINE Channel Access Token`);
      return { triggered: false, type: null };
    }

    // 4. Priority 1: Send first activity notification if this is today's first activity
    if (isFirstActivityToday) {
      console.log(`Elder ${elder.name} first activity today`);

      await sendFirstActivityNotification(
        elderId,
        elder,
        gateway,
        lat,
        lng,
        timestamp,
        tenantId,
        channelAccessToken,
        db,
      );

      return {
        triggered: true,
        type: "LINE",
        details: {
          elderId: elderId,
          tenantId: tenantId,
          notificationType: "FIRST_ACTIVITY",
        },
      };
    }

    // 5. Priority 2: If gateway is a notification point, send notification
    if (!notificationPointsSnapshot.empty) {
      const notificationPoint = notificationPointsSnapshot.docs[0];
      const pointData = notificationPoint.data();

      console.log(
        `Elder ${elder.name} passed through notification point: ${pointData.name}`,
      );

      await sendTenantNotificationPointAlert(
        elderId,
        elder,
        pointData,
        gateway,
        lat,
        lng,
        timestamp,
        tenantId,
        channelAccessToken,
        db,
      );

      return {
        triggered: true,
        type: "LINE",
        pointId: notificationPoint.id,
        details: {
          elderId: elderId,
          tenantId: tenantId,
          gatewayType: gateway.type,
          notificationPointName: pointData.name,
        },
      };
    }

    // 6. No notification sent
    console.log(
      `No notification sent for elder ${elderId} (not first activity, not notification point)`,
    );

    return {
      triggered: false,
      type: null,
    };
  } catch (error) {
    console.error(
      `Error in handleElderNotification for elder ${elderId}:`,
      error,
    );
    return { triggered: false, type: null };
  }
}

/**
 * Handle Map User notification (FCM)
 */
async function handleMapUserNotification(
  deviceId: string,
  mapAppUserId: string,
  beacon: BeaconData,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  timestamp: number,
  db: admin.firestore.Firestore,
): Promise<NotificationResult> {
  try {
    // Skip notifications for OBSERVE_ZONE and INACTIVE gateways
    if (gateway.type === "OBSERVE_ZONE" || gateway.type === "INACTIVE") {
      console.log(
        `Skipping FCM notification for ${gateway.type} gateway (notification disabled for this type)`,
      );
      return { triggered: false, type: null };
    }

    // 統一通知架構：從設備獲取通知點和 token
    const deviceDoc = await db.collection("devices").doc(deviceId).get();
    const deviceData = deviceDoc.data();

    // 1. 檢查是否為通知點（優先檢查設備子集合，其次檢查繼承的通知點）
    let isNotificationPoint = false;
    let notificationPointName = "";
    let notificationMessage = "";
    let notificationPointId = "";

    // 1a. 檢查設備的自訂通知點子集合
    const deviceNotifPointsSnapshot = await db
      .collection("devices")
      .doc(deviceId)
      .collection("notificationPoints")
      .where("gatewayId", "==", gateway.id)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (!deviceNotifPointsSnapshot.empty) {
      isNotificationPoint = true;
      const notifPoint = deviceNotifPointsSnapshot.docs[0];
      const notifPointData = notifPoint.data();
      notificationPointName = notifPointData.name || gateway.name || "通知點";
      notificationMessage = notifPointData.notificationMessage || "";
      notificationPointId = notifPoint.id;
      console.log(`Found device notification point: ${notificationPointName}`);
    }

    // 1b. 檢查繼承的通知點
    if (!isNotificationPoint && deviceData?.inheritedNotificationPointIds) {
      const inheritedIds = deviceData.inheritedNotificationPointIds as string[];
      if (inheritedIds.includes(gateway.id)) {
        isNotificationPoint = true;
        notificationPointName = gateway.name || "通知點";
        console.log(`Gateway ${gateway.id} is in inherited notification points`);
      }
    }

    // 1c. Fallback：檢查舊的 appUserNotificationPoints（向後相容）
    if (!isNotificationPoint) {
      const legacyNotifPointsSnapshot = await db
        .collection("appUserNotificationPoints")
        .where("mapAppUserId", "==", mapAppUserId)
        .where("gatewayId", "==", gateway.id)
        .where("isActive", "==", true)
        .limit(1)
        .get();

      if (!legacyNotifPointsSnapshot.empty) {
        isNotificationPoint = true;
        const notifPoint = legacyNotifPointsSnapshot.docs[0];
        const notifPointData = notifPoint.data();
        notificationPointName = notifPointData.name || gateway.name || "通知點";
        notificationMessage = notifPointData.notificationMessage || "";
        notificationPointId = notifPoint.id;
        console.log(`Found legacy notification point: ${notificationPointName}`);
      }
    }

    if (!isNotificationPoint) {
      console.log(
        `No notification points for device ${deviceId} at gateway ${gateway.id}`,
      );
      return { triggered: false, type: null };
    }

    // 2. 統一通知架構：優先使用設備的 FCM token
    let fcmToken: string | null = null;
    let tokenSource = "";

    if (deviceData?.fcmToken && deviceData?.notificationEnabled) {
      fcmToken = deviceData.fcmToken;
      tokenSource = "device";
      console.log(`Using device FCM token for device ${deviceId}`);
    } else {
      // Fallback：使用用戶的 FCM token（向後相容）
      const userDoc = await db.collection("app_users").doc(mapAppUserId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.fcmToken && userData?.notificationEnabled) {
          fcmToken = userData.fcmToken;
          tokenSource = "user";
          console.log(`Fallback to user FCM token for user ${mapAppUserId}`);
        }
      }
    }

    // 3. Send FCM notification
    if (fcmToken) {
      try {
        const finalNotificationMessage =
          notificationMessage ||
          `您的設備已經過 ${notificationPointName}`;

        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: "位置通知",
            body: finalNotificationMessage,
          },
          data: {
            type: "LOCATION_ALERT",
            gatewayId: gateway.id,
            gatewayName: gateway.name || "",
            deviceId: deviceId,
            notificationPointId: notificationPointId,
            latitude: lat.toString(),
            longitude: lng.toString(),
            tokenSource: tokenSource,  // 記錄 token 來源
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "location_alerts",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
        });

        console.log(`Sent FCM notification (token source: ${tokenSource})`);

        return {
          triggered: true,
          type: "FCM",
          pointId: notificationPointId,
          details: {
            mapAppUserId: mapAppUserId,
            notificationPointName: notificationPointName,
            message: finalNotificationMessage,
            tokenSource: tokenSource,
          },
        };
      } catch (fcmError) {
        console.error(
          `Failed to send FCM notification (token source: ${tokenSource}):`,
          fcmError,
        );
        // 發送失敗仍記錄這是通知點
        return {
          triggered: false,
          type: null,
          pointId: notificationPointId,
          details: {
            notificationPointName: notificationPointName,
            reason: "FCM send failed",
            tokenSource: tokenSource,
          },
        };
      }
    } else {
      // 設備和用戶都沒有可用的 token，仍記錄這是通知點
      console.log(
        `Device ${deviceId} and user ${mapAppUserId} have no available FCM token`,
      );
      return {
        triggered: false,
        type: null,
        pointId: notificationPointId, // 重點：記錄通知點 ID
        details: {
          notificationPointName: notificationPointName,
          reason: "No FCM token available (device or user)",
        },
      };
    }
  } catch (error) {
    console.error(
      `Error in handleMapUserNotification for user ${mapAppUserId}:`,
      error,
    );
    return { triggered: false, type: null };
  }
}

/**
 * Process a single beacon - UNIFIED LOGIC
 */
async function processBeacon(
  beacon: BeaconData,
  gateway: GatewayInfo,
  uploadedLat: number,
  uploadedLng: number,
  timestamp: number,
  db: admin.firestore.Firestore,
): Promise<ProcessingResult> {
  // Determine the location to use based on gateway type
  const { lat, lng } = determineLocation(gateway, uploadedLat, uploadedLng);

  // Normalize UUID to lowercase for case-insensitive matching
  const normalizedUuid = beacon.uuid.toLowerCase();

  try {
    // 1. Find device by UUID + Major + Minor (unique identifier for Beacon)
    // Note: UUID is normalized to lowercase for case-insensitive matching
    const deviceQuery = await db
      .collection("devices")
      .where("uuid", "==", normalizedUuid)
      .where("major", "==", beacon.major)
      .where("minor", "==", beacon.minor)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (deviceQuery.empty) {
      console.log(
        `No active device found for UUID ${normalizedUuid}, Major ${beacon.major}, Minor ${beacon.minor}, skipping`,
      );
      return {
        status: "ignored",
        beaconId: `${normalizedUuid}-${beacon.major}-${beacon.minor}`,
      };
    }

    const deviceDoc = deviceQuery.docs[0];
    const device = deviceDoc.data();
    const deviceId = deviceDoc.id;

    // 2. Update device status
    const deviceUpdateData: any = {
      lastSeen: new Date(timestamp).toISOString(),
      lastRssi: beacon.rssi,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (beacon.batteryLevel !== undefined && beacon.batteryLevel !== null) {
      deviceUpdateData.batteryLevel = beacon.batteryLevel;
    }

    await deviceDoc.ref.update(deviceUpdateData);
    console.log(
      `Updated device ${deviceId} - batteryLevel: ${beacon.batteryLevel ?? "N/A"}, lastSeen: ${new Date(timestamp).toISOString()}`,
    );

    // 3. Check if this is first activity today for elder
    let isFirstActivityToday = false;
    if (device.bindingType === "ELDER" && device.boundTo) {
      isFirstActivityToday = await checkIfFirstActivityToday(
        device.boundTo,
        timestamp,
        db,
      );
    }

    // 4. Handle notification based on binding type (unified) - 先處理通知
    const notificationResult = await handleNotification(
      deviceId,
      device,
      beacon,
      gateway,
      lat,
      lng,
      timestamp,
      db,
      isFirstActivityToday,
    );

    // 5. Update elder's lastActivityAt if device is bound to elder
    if (device.bindingType === "ELDER" && device.boundTo) {
      try {
        await db
          .collection("elders")
          .doc(device.boundTo)
          .update({
            lastActivityAt: new Date(timestamp).toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log(`Updated elder ${device.boundTo} lastActivityAt`);
      } catch (error) {
        console.error(`Failed to update elder lastActivityAt:`, error);
      }
    }

    // 6. Record activity to device subcollection (unified) - 再記錄活動（包含通知資訊）
    await recordDeviceActivity(
      deviceId,
      device,
      beacon,
      gateway,
      lat,
      lng,
      timestamp,
      notificationResult,
      db,
    );

    return { status: "updated", beaconId: deviceId };
  } catch (error) {
    console.error(`Error processing beacon ${beacon.uuid}:`, error);
    throw error;
  }
}

// OLD FUNCTION REMOVED - Now using handleMapUserNotification

/**
 * Main Cloud Function: Receive Beacon Data
 *
 * This function receives batch beacon data from edge devices (Android phones/Gateways),
 * filters duplicate data using a 5-minute throttling mechanism, and updates Firestore.
 */
export const receiveBeaconData = onRequest(
  {
    cors: true, // Allow CORS for all origins
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    const startTime = Date.now();

    // Only accept POST requests
    if (req.method !== "POST") {
      res.status(405).json({
        success: false,
        error: "Method not allowed. Use POST.",
      });
      return;
    }

    try {
      const payload: RequestPayload = req.body;

      // Step 1: Validate request payload
      const validation = validatePayload(payload);
      if (!validation.valid) {
        console.warn("Validation failed:", validation.error);
        res.status(400).json({
          success: false,
          error: validation.error,
        });
        return;
      }

      console.log(
        `Received ${payload.beacons.length} beacons from gateway ${payload.gateway_id}`,
      );

      const db = admin.firestore();

      // Step 2: Get or auto-register gateway
      const gateway = await getOrCreateGateway(payload.gateway_id, payload, db);

      console.log(
        `Gateway: ${gateway.name} (${gateway.type}) - Tenant: ${gateway.tenantId || "None"}`,
      );

      // Step 3: Batch process all beacons using Promise.all
      const results = await Promise.all(
        payload.beacons.map((beacon) =>
          processBeacon(
            beacon,
            gateway,
            payload.lat ?? 0, // Use 0 if not provided
            payload.lng ?? 0, // Use 0 if not provided
            payload.timestamp,
            db,
          ),
        ),
      );

      // Step 4: Calculate statistics
      const created = results.filter((r) => r.status === "created").length;
      const updated = results.filter((r) => r.status === "updated").length;
      const ignored = results.filter((r) => r.status === "ignored").length;

      const processingTime = Date.now() - startTime;

      console.log(
        `Processing complete: ${created} created, ${updated} updated, ${ignored} ignored (${processingTime}ms)`,
      );

      // Step 5: Return success response
      const response: ResponseData = {
        success: true,
        received: payload.beacons.length,
        updated: created + updated,
        ignored: ignored,
        timestamp: payload.timestamp,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Unexpected error in receiveBeaconData:", error);

      // Log error to Firestore
      await logError(
        "receiveBeaconData",
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined,
        req.body,
      );

      res.status(500).json({
        success: false,
        error: "Internal server error. Please check logs.",
      });
    }
  },
);
