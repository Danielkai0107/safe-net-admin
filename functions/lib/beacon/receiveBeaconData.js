"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiveBeaconData = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const bot_sdk_1 = require("@line/bot-sdk");
/**
 * Log error to Firestore error_logs collection
 */
async function logError(functionName, errorMessage, errorStack, payload) {
    try {
        const db = admin.firestore();
        await db.collection("error_logs").add({
            function_name: functionName,
            error_message: errorMessage,
            error_stack: errorStack || "No stack trace available",
            payload: payload,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (logError) {
        // If logging to Firestore fails, at least log to console
        console.error("Failed to log error to Firestore:", logError);
    }
}
/**
 * Validate incoming request payload
 */
function validatePayload(body) {
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
async function getGatewayInfo(gatewayId, db) {
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
        const gatewayData = gatewayDoc.data();
        return Object.assign(Object.assign({ id: gatewayDoc.id }, gatewayData), { isAD: (gatewayData === null || gatewayData === void 0 ? void 0 : gatewayData.isAD) || false });
    }
    catch (error) {
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
async function getOrCreateGateway(gatewayId, payload, db) {
    // First, try to find existing gateway
    let gateway = await getGatewayInfo(gatewayId, db);
    if (gateway) {
        return gateway;
    }
    // Gateway not found, auto-register
    console.log(`Auto-registering new gateway: ${gatewayId}`);
    // Build gateway data object (only include fields with values, not undefined)
    const newGateway = {
        serialNumber: gatewayId,
        name: `Auto-Gateway-${gatewayId.substring(0, 8)}`,
        location: `Auto-registered at ${new Date().toISOString()}`,
        type: "SAFE_ZONE",
        tenantId: null,
        isActive: true,
        isAD: false, // 預設為 false
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
        isAD: newGateway.isAD,
    };
}
/**
 * Determine the location to use based on available data
 */
function determineLocation(gateway, uploadedLat, uploadedLng) {
    // Prefer database location if available
    if (gateway.latitude !== undefined && gateway.longitude !== undefined) {
        return { lat: gateway.latitude, lng: gateway.longitude };
    }
    // Fall back to uploaded location (if available)
    if (uploadedLat !== undefined && uploadedLng !== undefined) {
        return { lat: uploadedLat, lng: uploadedLng };
    }
    // Final fallback: use default location (0, 0)
    console.warn(`No location available for gateway ${gateway.id}, using default (0, 0)`);
    return { lat: 0, lng: 0 };
}
// Note: Legacy sendLineNotificationToTenant function removed - replaced by first activity and notification point alerts
/**
 * Check if this is the first activity today for an elder
 */
async function checkIfFirstActivityToday(elderId, currentTimestamp, db) {
    try {
        const elderDoc = await db.collection("elders").doc(elderId).get();
        if (!elderDoc.exists)
            return false;
        const elder = elderDoc.data();
        const lastActivityAt = elder === null || elder === void 0 ? void 0 : elder.lastActivityAt;
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
    }
    catch (error) {
        console.error("Error checking first activity:", error);
        return false;
    }
}
/**
 * Send LINE notification for first activity today
 */
async function sendFirstActivityNotification(elderId, elder, gateway, lat, lng, timestamp, tenantId, channelAccessToken, db) {
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
        const memberAppUserIds = membersQuery.docs.map((doc) => doc.data().appUserId);
        const lineUserIds = [];
        for (const appUserId of memberAppUserIds) {
            const appUserDoc = await db.collection("line_users").doc(appUserId).get();
            if (appUserDoc.exists) {
                const appUser = appUserDoc.data();
                if (appUser === null || appUser === void 0 ? void 0 : appUser.lineUserId) {
                    lineUserIds.push(appUser.lineUserId);
                }
            }
        }
        if (lineUserIds.length === 0) {
            console.log(`No members with LINE accounts found for tenant ${tenantId}`);
            return;
        }
        const client = new bot_sdk_1.Client({ channelAccessToken });
        const elderName = (elder === null || elder === void 0 ? void 0 : elder.name) || "長輩";
        const locationText = gateway.location || gateway.name || "未知位置";
        const lastSeenTime = new Date(timestamp).toLocaleString("zh-TW", {
            timeZone: "Asia/Taipei",
        });
        const flexMessage = {
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
                                            text: (elder === null || elder === void 0 ? void 0 : elder.name) || "未知",
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
            }
            catch (error) {
                console.error(`Failed to send first activity notification to ${lineUserId}:`, error);
            }
        }
    }
    catch (error) {
        console.error("Error sending first activity notification:", error);
    }
}
/**
 * Send LINE notification for tenant notification point
 */
async function sendTenantNotificationPointAlert(elderId, elder, notificationPoint, gateway, lat, lng, timestamp, tenantId, channelAccessToken, db) {
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
        const memberAppUserIds = membersQuery.docs.map((doc) => doc.data().appUserId);
        const lineUserIds = [];
        for (const appUserId of memberAppUserIds) {
            const appUserDoc = await db.collection("line_users").doc(appUserId).get();
            if (appUserDoc.exists) {
                const appUser = appUserDoc.data();
                if (appUser === null || appUser === void 0 ? void 0 : appUser.lineUserId) {
                    lineUserIds.push(appUser.lineUserId);
                }
            }
        }
        if (lineUserIds.length === 0) {
            console.log(`No members with LINE accounts found for tenant ${tenantId}`);
            return;
        }
        const client = new bot_sdk_1.Client({ channelAccessToken });
        const elderName = (elder === null || elder === void 0 ? void 0 : elder.name) || "長輩";
        const locationText = gateway.location || notificationPoint.name || "未知位置";
        const notificationMessage = `${elderName} 出現在 ${locationText} 附近`;
        const lastSeenTime = new Date(timestamp).toLocaleString("zh-TW", {
            timeZone: "Asia/Taipei",
        });
        const flexMessage = {
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
                                            text: (elder === null || elder === void 0 ? void 0 : elder.name) || "未知",
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
            }
            catch (error) {
                console.error(`Failed to send notification point alert to ${lineUserId}:`, error);
            }
        }
    }
    catch (error) {
        console.error("Error sending notification point alert:", error);
    }
}
/**
 * Record device activity to device subcollection
 */
async function recordDeviceActivity(deviceId, device, beacon, gateway, lat, lng, timestamp, notificationResult, db) {
    const activityData = {
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
    console.log(`Recorded activity for device ${deviceId} at gateway ${gateway.id} - notification: ${notificationResult.triggered}`);
}
/**
 * Handle notification based on device binding type
 */
async function handleNotification(deviceId, device, beacon, gateway, lat, lng, timestamp, db, isFirstActivityToday = false) {
    const bindingType = device.bindingType || "UNBOUND";
    switch (bindingType) {
        case "ELDER":
            if (device.boundTo) {
                return await handleElderNotification(deviceId, device.boundTo, beacon, gateway, lat, lng, timestamp, db, isFirstActivityToday);
            }
            return { triggered: false, type: null };
        case "MAP_USER":
            if (device.boundTo) {
                return await handleMapUserNotification(deviceId, device.boundTo, beacon, gateway, lat, lng, timestamp, db);
            }
            return { triggered: false, type: null };
        case "LINE_USER":
            if (device.boundTo) {
                return await handleLineUserNotification(deviceId, device.boundTo, beacon, gateway, lat, lng, timestamp, db);
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
 * ELDER 設備觸發的通知是群發給該 elder 所屬社區的所有成員
 */
async function handleElderNotification(deviceId, elderId, beacon, gateway, lat, lng, timestamp, db, isFirstActivityToday = false) {
    var _a;
    try {
        // 1. Get elder data and tenant
        const elderDoc = await db.collection("elders").doc(elderId).get();
        if (!elderDoc.exists) {
            console.log(`Elder ${elderId} not found`);
            return { triggered: false, type: null };
        }
        const elder = elderDoc.data();
        const tenantId = elder === null || elder === void 0 ? void 0 : elder.tenantId;
        if (!tenantId) {
            console.log(`Elder ${elderId} has no associated tenant, skipping notification`);
            return { triggered: false, type: null };
        }
        // 2. Get tenant LINE settings
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        if (!tenantDoc.exists) {
            console.log(`Tenant ${tenantId} not found`);
            return { triggered: false, type: null };
        }
        const tenant = tenantDoc.data();
        const buType = tenant === null || tenant === void 0 ? void 0 : tenant.BU_type;
        const channelAccessToken = tenant === null || tenant === void 0 ? void 0 : tenant.lineChannelAccessToken;
        console.log(`Tenant ${tenantId} BU_type: ${buType}`);
        // 只有 BU_type="group" 才處理 ELDER 群發通知
        if (buType !== "group") {
            console.log(`BU_type ${buType} does not support ELDER broadcast notifications, skipping`);
            return { triggered: false, type: null };
        }
        if (!channelAccessToken) {
            console.log(`Tenant ${tenantId} has no LINE Channel Access Token`);
            return { triggered: false, type: null };
        }
        // 3. Priority 1: Send first activity notification if this is today's first activity
        // 首次活動通知的優先級最高，不需要檢查通知點
        if (isFirstActivityToday) {
            console.log(`Elder ${elder.name} first activity today (群發通知)`);
            await sendFirstActivityNotification(elderId, elder, gateway, lat, lng, timestamp, tenantId, channelAccessToken, db);
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
        // 4. Priority 2: Check if gateway is in device's inheritedNotificationPointIds
        // 獲取設備資料，檢查通知點
        const deviceDoc = await db.collection("devices").doc(deviceId).get();
        const deviceData = deviceDoc.data();
        if (!deviceData) {
            console.log(`Device ${deviceId} data not found`);
            return { triggered: false, type: null };
        }
        const notificationPointIds = deviceData.inheritedNotificationPointIds || [];
        if (!notificationPointIds.includes(gateway.id)) {
            console.log(`Gateway ${gateway.id} is not in elder device's notification points, no notification`);
            return { triggered: false, type: null };
        }
        // 5. 檢查冷卻時間（3 分鐘內不重複發送）
        const cooldownKey = `elder_${elderId}_gateway_${gateway.id}`;
        const cooldownDoc = await db
            .collection("notification_cooldowns")
            .doc(cooldownKey)
            .get();
        if (cooldownDoc.exists) {
            const lastSentAt = (_a = cooldownDoc.data()) === null || _a === void 0 ? void 0 : _a.lastSentAt;
            if (lastSentAt) {
                const timeSinceLastSent = timestamp - lastSentAt.toMillis();
                const cooldownPeriod = 3 * 60 * 1000; // 3 分鐘
                if (timeSinceLastSent < cooldownPeriod) {
                    console.log(`Skipping notification (cooldown: ${Math.round(timeSinceLastSent / 1000)}s / 180s)`);
                    return { triggered: false, type: null };
                }
            }
        }
        console.log(`Elder ${elder.name} passed through notification point ${gateway.name} (群發通知)`);
        // 6. Send notification point alert to all members (群發)
        // 使用簡化的通知資料（不需要 pointData）
        const notificationPointData = {
            name: gateway.name || "通知點",
            notificationMessage: `${elder.name} 已通過 ${gateway.name || "通知點"}`,
        };
        await sendTenantNotificationPointAlert(elderId, elder, notificationPointData, gateway, lat, lng, timestamp, tenantId, channelAccessToken, db);
        // 7. 記錄冷卻時間
        await db
            .collection("notification_cooldowns")
            .doc(cooldownKey)
            .set({
            elderId: elderId,
            gatewayId: gateway.id,
            tenantId: tenantId,
            buType: "group",
            lastSentAt: admin.firestore.Timestamp.fromMillis(timestamp),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Updated cooldown for elder ${elderId} at gateway ${gateway.id}`);
        return {
            triggered: true,
            type: "LINE",
            pointId: gateway.id,
            details: {
                elderId: elderId,
                tenantId: tenantId,
                buType: "group",
                gatewayType: gateway.type,
                notificationPointName: gateway.name || "通知點",
                notificationType: "NOTIFICATION_POINT_BROADCAST",
            },
        };
    }
    catch (error) {
        console.error(`Error in handleElderNotification for elder ${elderId}:`, error);
        return { triggered: false, type: null };
    }
}
/**
 * Handle Map User notification (FCM)
 */
async function handleMapUserNotification(deviceId, mapAppUserId, beacon, gateway, lat, lng, timestamp, db) {
    try {
        // Skip notifications for OBSERVE_ZONE and INACTIVE gateways
        if (gateway.type === "OBSERVE_ZONE" || gateway.type === "INACTIVE") {
            console.log(`Skipping FCM notification for ${gateway.type} gateway (notification disabled for this type)`);
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
        if (!isNotificationPoint && (deviceData === null || deviceData === void 0 ? void 0 : deviceData.inheritedNotificationPointIds)) {
            const inheritedIds = deviceData.inheritedNotificationPointIds;
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
            console.log(`No notification points for device ${deviceId} at gateway ${gateway.id}`);
            return { triggered: false, type: null };
        }
        // 2. 統一通知架構：優先使用設備的 FCM token
        let fcmToken = null;
        let tokenSource = "";
        if ((deviceData === null || deviceData === void 0 ? void 0 : deviceData.fcmToken) && (deviceData === null || deviceData === void 0 ? void 0 : deviceData.notificationEnabled)) {
            fcmToken = deviceData.fcmToken;
            tokenSource = "device";
            console.log(`Using device FCM token for device ${deviceId}`);
        }
        else {
            // Fallback：使用用戶的 FCM token（向後相容）
            const userDoc = await db.collection("app_users").doc(mapAppUserId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if ((userData === null || userData === void 0 ? void 0 : userData.fcmToken) && (userData === null || userData === void 0 ? void 0 : userData.notificationEnabled)) {
                    fcmToken = userData.fcmToken;
                    tokenSource = "user";
                    console.log(`Fallback to user FCM token for user ${mapAppUserId}`);
                }
            }
        }
        // 3. Send FCM notification
        if (fcmToken) {
            try {
                const finalNotificationMessage = notificationMessage ||
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
                        tokenSource: tokenSource, // 記錄 token 來源
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
            }
            catch (fcmError) {
                console.error(`Failed to send FCM notification (token source: ${tokenSource}):`, fcmError);
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
        }
        else {
            // 設備和用戶都沒有可用的 token，仍記錄這是通知點
            console.log(`Device ${deviceId} and user ${mapAppUserId} have no available FCM token`);
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
    }
    catch (error) {
        console.error(`Error in handleMapUserNotification for user ${mapAppUserId}:`, error);
        return { triggered: false, type: null };
    }
}
/**
 * 獲取綁定用戶的 LINE User ID
 * @param db Firestore 實例
 * @param boundTo 綁定對象 ID（LINE_USER doc ID 或 ELDER ID）
 * @param bindingType 綁定類型
 * @returns LINE User ID（用於發送 LINE 訊息）
 */
async function getLineUserIdFromBinding(db, boundTo, bindingType) {
    var _a;
    try {
        if (bindingType === "LINE_USER") {
            // boundTo 是 line_users document ID
            const lineUserDoc = await db.collection("line_users").doc(boundTo).get();
            if (lineUserDoc.exists) {
                const lineUserId = (_a = lineUserDoc.data()) === null || _a === void 0 ? void 0 : _a.lineUserId;
                return lineUserId || null;
            }
        }
        else if (bindingType === "ELDER") {
            // boundTo 是 elder ID
            // ELDER 不需要單發，只有群發，所以這裡返回 null
            return null;
        }
        return null;
    }
    catch (error) {
        console.error(`Error getting LINE user ID for ${bindingType} ${boundTo}:`, error);
        return null;
    }
}
/**
 * Handle LINE User notification (簡化版本)
 * 根據 device.tags 和 tenant.BU_type 決定通知方式
 */
async function handleLineUserNotification(deviceId, lineUserDocId, beacon, gateway, lat, lng, timestamp, db) {
    var _a;
    try {
        // Skip notifications for OBSERVE_ZONE and INACTIVE gateways
        if (gateway.type === "OBSERVE_ZONE" || gateway.type === "INACTIVE") {
            console.log(`Skipping LINE notification for ${gateway.type} gateway`);
            return { triggered: false, type: null };
        }
        // Get device data
        const deviceDoc = await db.collection("devices").doc(deviceId).get();
        const deviceData = deviceDoc.data();
        if (!deviceData) {
            console.log(`Device ${deviceId} data not found`);
            return { triggered: false, type: null };
        }
        // 1. 從 device.tags 取得 tenantId
        const tags = deviceData.tags || [];
        if (tags.length === 0) {
            console.log(`Device ${deviceId} has no tenant tags, skipping notification`);
            return { triggered: false, type: null };
        }
        const tenantId = tags[0]; // 一個設備只會有一個社區標籤
        console.log(`Device ${deviceId} belongs to tenant ${tenantId}`);
        // 2. 查詢 tenant 資料
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        if (!tenantDoc.exists) {
            console.log(`Tenant ${tenantId} not found`);
            return { triggered: false, type: null };
        }
        const tenantData = tenantDoc.data();
        const buType = tenantData === null || tenantData === void 0 ? void 0 : tenantData.BU_type;
        const channelAccessToken = tenantData === null || tenantData === void 0 ? void 0 : tenantData.lineChannelAccessToken;
        if (!channelAccessToken) {
            console.log(`Tenant ${tenantId} has no LINE Channel Access Token`);
            return { triggered: false, type: null };
        }
        console.log(`Tenant ${tenantId} BU_type: ${buType}`);
        // 3. 根據 BU_type 決定通知邏輯
        if (buType === "card") {
            // Card 模式：單發，不檢查通知點，每次都通知
            console.log(`Card mode: sending notification to bound user`);
        }
        else if (buType === "safe") {
            // Safe 模式：單發，檢查通知點
            const notificationPointIds = deviceData.inheritedNotificationPointIds || [];
            console.log(`Safe mode: checking notification points [${notificationPointIds.join(", ")}]`);
            if (!notificationPointIds.includes(gateway.id)) {
                console.log(`Gateway ${gateway.id} is not in notification points, no notification`);
                return { triggered: false, type: null };
            }
            console.log(`Gateway ${gateway.id} is in notification points, proceeding`);
        }
        else {
            // 其他 BU_type 或未設定，LINE_USER 設備不處理
            console.log(`BU_type ${buType} does not support LINE_USER notifications, skipping`);
            return { triggered: false, type: null };
        }
        // 4. 檢查 3 分鐘冷卻時間
        const cooldownKey = `device_${deviceId}_gateway_${gateway.id}`;
        const cooldownDoc = await db
            .collection("notification_cooldowns")
            .doc(cooldownKey)
            .get();
        if (cooldownDoc.exists) {
            const lastSentAt = (_a = cooldownDoc.data()) === null || _a === void 0 ? void 0 : _a.lastSentAt;
            if (lastSentAt) {
                const timeSinceLastSent = timestamp - lastSentAt.toMillis();
                const cooldownPeriod = 3 * 60 * 1000; // 3 分鐘
                if (timeSinceLastSent < cooldownPeriod) {
                    console.log(`Skipping notification (cooldown: ${Math.round(timeSinceLastSent / 1000)}s / 180s)`);
                    return { triggered: false, type: null };
                }
            }
        }
        // 5. 獲取 LINE User ID
        const lineUserId = await getLineUserIdFromBinding(db, lineUserDocId, "LINE_USER");
        if (!lineUserId) {
            console.log(`Cannot get LINE user ID for ${lineUserDocId}`);
            return { triggered: false, type: null };
        }
        // 6. 發送單發通知
        const { sendNotificationPointAlert } = await Promise.resolve().then(() => __importStar(require("../line/sendMessage")));
        try {
            await sendNotificationPointAlert(lineUserId, channelAccessToken, {
                gatewayName: gateway.name || "通知點",
                deviceNickname: (deviceData === null || deviceData === void 0 ? void 0 : deviceData.mapUserNickname) || undefined,
                latitude: lat,
                longitude: lng,
                timestamp: new Date(timestamp).toISOString(),
            });
            console.log(`✓ Sent LINE notification to ${lineUserId} via tenant ${tenantId} (BU_type=${buType})`);
            // 7. 記錄冷卻時間
            await db
                .collection("notification_cooldowns")
                .doc(cooldownKey)
                .set({
                deviceId: deviceId,
                gatewayId: gateway.id,
                tenantId: tenantId,
                buType: buType,
                lastSentAt: admin.firestore.Timestamp.fromMillis(timestamp),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // 8. Create alert record
            const alertData = {
                type: "NOTIFICATION_POINT",
                deviceId: deviceId,
                lineUserId: lineUserId,
                gatewayId: gateway.id,
                gatewayName: gateway.name || "未知位置",
                latitude: lat,
                longitude: lng,
                title: `已通過：${gateway.name || "通知點"}`,
                message: `您的設備已通過通知點`,
                status: "PENDING",
                triggeredAt: new Date(timestamp).toISOString(),
                visibleTo: [lineUserId],
                tenantId: tenantId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            await db.collection("alerts").add(alertData);
            return {
                triggered: true,
                type: "LINE",
                pointId: gateway.id,
                details: {
                    lineUserId: lineUserId,
                    tenantId: tenantId,
                    buType: buType,
                    gatewayName: gateway.name,
                },
            };
        }
        catch (sendError) {
            console.error(`Failed to send LINE notification:`, sendError);
            return { triggered: false, type: null };
        }
    }
    catch (error) {
        console.error(`Error in handleLineUserNotification for device ${deviceId}:`, error);
        return { triggered: false, type: null };
    }
}
/**
 * Process a single beacon - UNIFIED LOGIC
 */
async function processBeacon(beacon, gateway, uploadedLat, uploadedLng, timestamp, db) {
    var _a;
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
            console.log(`No active device found for UUID ${normalizedUuid}, Major ${beacon.major}, Minor ${beacon.minor}, skipping`);
            return {
                status: "ignored",
                beaconId: `${normalizedUuid}-${beacon.major}-${beacon.minor}`,
            };
        }
        const deviceDoc = deviceQuery.docs[0];
        const device = deviceDoc.data();
        const deviceId = deviceDoc.id;
        // 2. Update device status
        const deviceUpdateData = {
            lastSeen: new Date(timestamp).toISOString(),
            lastRssi: beacon.rssi,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (beacon.batteryLevel !== undefined && beacon.batteryLevel !== null) {
            deviceUpdateData.batteryLevel = beacon.batteryLevel;
        }
        await deviceDoc.ref.update(deviceUpdateData);
        console.log(`Updated device ${deviceId} - batteryLevel: ${(_a = beacon.batteryLevel) !== null && _a !== void 0 ? _a : "N/A"}, lastSeen: ${new Date(timestamp).toISOString()}`);
        // 3. Check if this is first activity today for elder
        let isFirstActivityToday = false;
        if (device.bindingType === "ELDER" && device.boundTo) {
            isFirstActivityToday = await checkIfFirstActivityToday(device.boundTo, timestamp, db);
        }
        // 4. Handle notification based on binding type (unified) - 先處理通知
        const notificationResult = await handleNotification(deviceId, device, beacon, gateway, lat, lng, timestamp, db, isFirstActivityToday);
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
            }
            catch (error) {
                console.error(`Failed to update elder lastActivityAt:`, error);
            }
        }
        // 6. Record activity to device subcollection (unified) - 再記錄活動（包含通知資訊）
        await recordDeviceActivity(deviceId, device, beacon, gateway, lat, lng, timestamp, notificationResult, db);
        return { status: "updated", beaconId: deviceId };
    }
    catch (error) {
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
exports.receiveBeaconData = (0, https_1.onRequest)({
    cors: true, // Allow CORS for all origins
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (req, res) => {
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
        const payload = req.body;
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
        console.log(`Received ${payload.beacons.length} beacons from gateway ${payload.gateway_id}`);
        const db = admin.firestore();
        // Step 2: Get or auto-register gateway
        const gateway = await getOrCreateGateway(payload.gateway_id, payload, db);
        console.log(`Gateway: ${gateway.name} (${gateway.type}) - Tenant: ${gateway.tenantId || "None"}`);
        // Step 3: Batch process all beacons using Promise.all
        const results = await Promise.all(payload.beacons.map((beacon) => {
            var _a, _b;
            return processBeacon(beacon, gateway, (_a = payload.lat) !== null && _a !== void 0 ? _a : 0, // Use 0 if not provided
            (_b = payload.lng) !== null && _b !== void 0 ? _b : 0, // Use 0 if not provided
            payload.timestamp, db);
        }));
        // Step 4: Calculate statistics
        const created = results.filter((r) => r.status === "created").length;
        const updated = results.filter((r) => r.status === "updated").length;
        const ignored = results.filter((r) => r.status === "ignored").length;
        const processingTime = Date.now() - startTime;
        console.log(`Processing complete: ${created} created, ${updated} updated, ${ignored} ignored (${processingTime}ms)`);
        // Step 5: Return success response
        const response = {
            success: true,
            received: payload.beacons.length,
            updated: created + updated,
            ignored: ignored,
            timestamp: payload.timestamp,
        };
        res.status(200).json(response);
    }
    catch (error) {
        console.error("Unexpected error in receiveBeaconData:", error);
        // Log error to Firestore
        await logError("receiveBeaconData", error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : undefined, req.body);
        res.status(500).json({
            success: false,
            error: "Internal server error. Please check logs.",
        });
    }
});
//# sourceMappingURL=receiveBeaconData.js.map