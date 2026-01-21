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
const params_1 = require("firebase-functions/params");
const bot_sdk_1 = require("@line/bot-sdk");
// Constants
const COOLDOWN_PERIOD_MS = 2 * 60 * 1000; // 5 minutes in milliseconds
// Define environment parameter for location update notification
const enableLocationNotification = (0, params_1.defineString)('ENABLE_LOCATION_UPDATE_NOTIFICATION', {
    default: 'false',
    description: '是否啟用位置更新通知（邊界警報和首次活動不受影響）',
});
/**
 * Log error to Firestore error_logs collection
 */
async function logError(functionName, errorMessage, errorStack, payload) {
    try {
        const db = admin.firestore();
        await db.collection('error_logs').add({
            function_name: functionName,
            error_message: errorMessage,
            error_stack: errorStack || 'No stack trace available',
            payload: payload,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (logError) {
        // If logging to Firestore fails, at least log to console
        console.error('Failed to log error to Firestore:', logError);
    }
}
/**
 * Validate incoming request payload
 */
function validatePayload(body) {
    if (!body) {
        return { valid: false, error: 'Request body is empty' };
    }
    if (!body.gateway_id || typeof body.gateway_id !== 'string') {
        return { valid: false, error: 'Missing or invalid gateway_id' };
    }
    // lat and lng are optional, but if provided, must be valid
    if (body.lat !== undefined && body.lat !== null) {
        if (typeof body.lat !== 'number' || body.lat < -90 || body.lat > 90) {
            return { valid: false, error: 'Invalid lat (must be between -90 and 90)' };
        }
    }
    if (body.lng !== undefined && body.lng !== null) {
        if (typeof body.lng !== 'number' || body.lng < -180 || body.lng > 180) {
            return { valid: false, error: 'Invalid lng (must be between -180 and 180)' };
        }
    }
    if (!body.timestamp || typeof body.timestamp !== 'number') {
        return { valid: false, error: 'Missing or invalid timestamp' };
    }
    if (!Array.isArray(body.beacons)) {
        return { valid: false, error: 'Missing or invalid beacons array' };
    }
    if (body.beacons.length === 0) {
        return { valid: false, error: 'Beacons array is empty' };
    }
    // Validate and normalize each beacon
    for (let i = 0; i < body.beacons.length; i++) {
        const beacon = body.beacons[i];
        // Validate UUID
        if (!beacon.uuid || typeof beacon.uuid !== 'string') {
            return { valid: false, error: `Beacon at index ${i} is missing uuid` };
        }
        // 轉換 major/minor 為數字（接受字串或數字）
        const major = Number(beacon.major);
        const minor = Number(beacon.minor);
        const rssi = Number(beacon.rssi);
        if (isNaN(major) || isNaN(minor)) {
            return { valid: false, error: `Beacon at index ${i} has invalid major/minor (major: ${beacon.major}, minor: ${beacon.minor})` };
        }
        if (isNaN(rssi)) {
            return { valid: false, error: `Beacon at index ${i} has invalid rssi (${beacon.rssi})` };
        }
        // 標準化為數字類型
        body.beacons[i].major = major;
        body.beacons[i].minor = minor;
        body.beacons[i].rssi = rssi;
        // Validate and normalize batteryLevel if provided (optional)
        if (beacon.batteryLevel !== undefined && beacon.batteryLevel !== null) {
            const batteryLevel = Number(beacon.batteryLevel);
            if (isNaN(batteryLevel) || batteryLevel < 0 || batteryLevel > 100) {
                return { valid: false, error: `Beacon at index ${i} has invalid batteryLevel (must be 0-100, got: ${beacon.batteryLevel})` };
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
            .collection('gateways')
            .where('macAddress', '==', gatewayId)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        // If not found, try by imei (for mobile phones)
        if (gatewayQuery.empty) {
            gatewayQuery = await db
                .collection('gateways')
                .where('imei', '==', gatewayId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
        }
        // If still not found, try by serialNumber
        if (gatewayQuery.empty) {
            gatewayQuery = await db
                .collection('gateways')
                .where('serialNumber', '==', gatewayId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
        }
        if (gatewayQuery.empty) {
            return null;
        }
        const gatewayDoc = gatewayQuery.docs[0];
        return Object.assign({ id: gatewayDoc.id }, gatewayDoc.data());
    }
    catch (error) {
        console.error('Error querying gateway:', error);
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
        type: 'MOBILE',
        tenantId: null,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Only add macAddress if it looks like a MAC address
    if (gatewayId.includes(':')) {
        newGateway.macAddress = gatewayId;
    }
    // Only add imei if it looks like an IMEI or device ID
    if (!gatewayId.includes(':') && gatewayId.length >= 10) {
        newGateway.imei = gatewayId;
    }
    // Only add latitude/longitude if provided (not undefined)
    if (payload.lat !== undefined && payload.lat !== null) {
        newGateway.latitude = payload.lat;
    }
    if (payload.lng !== undefined && payload.lng !== null) {
        newGateway.longitude = payload.lng;
    }
    const docRef = await db.collection('gateways').add(newGateway);
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
    };
}
/**
 * Determine the location to use based on gateway type and available data
 */
function determineLocation(gateway, uploadedLat, uploadedLng) {
    // For MOBILE gateways, prefer uploaded GPS location
    if (gateway.type === 'MOBILE') {
        if (uploadedLat !== undefined && uploadedLng !== undefined) {
            return { lat: uploadedLat, lng: uploadedLng };
        }
    }
    // For GENERAL and BOUNDARY gateways, prefer database location
    if (gateway.latitude !== undefined && gateway.longitude !== undefined) {
        return { lat: gateway.latitude, lng: gateway.longitude };
    }
    // If no database location, use uploaded location (if available)
    if (uploadedLat !== undefined && uploadedLng !== undefined) {
        return { lat: uploadedLat, lng: uploadedLng };
    }
    // Final fallback: use default location (0, 0)
    console.warn(`No location available for gateway ${gateway.id}, using default (0, 0)`);
    return { lat: 0, lng: 0 };
}
/**
 * Send LINE notification to all tenant members
 */
async function sendLineNotification(beacon, gateway, lat, lng, timestamp, db, isFirstActivity = false) {
    try {
        // 1. Find device by UUID + Major + Minor (unique identifier for Beacon)
        const deviceQuery = await db
            .collection('devices')
            .where('uuid', '==', beacon.uuid)
            .where('major', '==', beacon.major)
            .where('minor', '==', beacon.minor)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (deviceQuery.empty) {
            console.log(`No active device found for UUID ${beacon.uuid}, Major ${beacon.major}, Minor ${beacon.minor}`);
            return;
        }
        const device = deviceQuery.docs[0].data();
        const elderId = device.elderId;
        if (!elderId) {
            console.log(`Device (UUID: ${beacon.uuid}, Major: ${beacon.major}, Minor: ${beacon.minor}) has no associated elder`);
            return;
        }
        // 2. Get elder info
        const elderDoc = await db.collection('elders').doc(elderId).get();
        if (!elderDoc.exists) {
            console.log(`Elder ${elderId} not found`);
            return;
        }
        const elder = elderDoc.data();
        // 3. Get tenantId from elder (not from gateway)
        const tenantId = elder === null || elder === void 0 ? void 0 : elder.tenantId;
        // Skip notification if elder is not associated with any tenant
        if (!tenantId) {
            console.log(`Elder ${elderId} has no associated tenant, skipping notification`);
            return;
        }
        // 3.5. Get latest location to get accurate last_seen time
        const latestLocationDoc = await db.collection('latest_locations').doc(elderId).get();
        let lastSeenTime = new Date(timestamp).toLocaleString('zh-TW'); // fallback to timestamp
        if (latestLocationDoc.exists) {
            const locationData = latestLocationDoc.data();
            if (locationData === null || locationData === void 0 ? void 0 : locationData.last_seen) {
                // Convert Firestore Timestamp to readable format
                const lastSeenTimestamp = locationData.last_seen.toMillis ?
                    locationData.last_seen.toMillis() :
                    new Date(locationData.last_seen).getTime();
                lastSeenTime = new Date(lastSeenTimestamp).toLocaleString('zh-TW');
            }
        }
        // 4. Get tenant LINE credentials
        const tenantDoc = await db.collection('tenants').doc(tenantId).get();
        if (!tenantDoc.exists) {
            console.log(`Tenant ${tenantId} not found`);
            return;
        }
        const tenant = tenantDoc.data();
        const channelAccessToken = tenant === null || tenant === void 0 ? void 0 : tenant.lineChannelAccessToken;
        if (!channelAccessToken) {
            console.log(`Tenant ${tenantId} has no LINE Channel Access Token configured`);
            return;
        }
        // 5. Get all approved tenant members
        const membersQuery = await db
            .collection('tenants').doc(tenantId)
            .collection('members')
            .where('status', '==', 'APPROVED')
            .get();
        if (membersQuery.empty) {
            console.log(`No approved members found for tenant ${tenantId}`);
            return;
        }
        // 6. Get appUsers with LINE IDs
        const memberAppUserIds = membersQuery.docs.map(doc => doc.data().appUserId);
        const lineUserIds = [];
        for (const appUserId of memberAppUserIds) {
            const appUserDoc = await db.collection('appUsers').doc(appUserId).get();
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
        // Check if location update notification is enabled
        // Boundary alerts and first activity ALWAYS send, only subsequent updates can be disabled
        const notificationEnabled = enableLocationNotification.value() === 'true';
        if (gateway.type !== 'BOUNDARY' && !isFirstActivity && !notificationEnabled) {
            console.log(`Location update notification disabled, skipping notification for ${gateway.type} gateway`);
            return;
        }
        // 7. Create LINE client and send message
        const client = new bot_sdk_1.Client({ channelAccessToken });
        const gatewayTypeText = gateway.type === 'BOUNDARY' ? '邊界點' :
            gateway.type === 'MOBILE' ? '移動接收器' : '一般接收器';
        // Determine notification text based on gateway type and first activity
        let headerText = '';
        let bodyText = '';
        if (gateway.type === 'BOUNDARY') {
            headerText = '邊界警報';
            bodyText = `${(elder === null || elder === void 0 ? void 0 : elder.name) || '長輩'} 出現在邊界點`;
        }
        else {
            if (isFirstActivity) {
                headerText = '今日首次活動';
                bodyText = `${(elder === null || elder === void 0 ? void 0 : elder.name) || '長輩'} 今日首次偵測到活動`;
            }
            else {
                headerText = '位置更新';
                bodyText = `${(elder === null || elder === void 0 ? void 0 : elder.name) || '長輩'} 位置已更新`;
            }
        }
        const flexMessage = {
            type: 'flex',
            altText: `${(elder === null || elder === void 0 ? void 0 : elder.name) || '長輩'} ${headerText}通知`,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: headerText,
                            weight: 'bold',
                            size: 'lg',
                            color: '#111111',
                        },
                    ],
                    backgroundColor: '#FFFFFF',
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: bodyText,
                            weight: 'bold',
                            size: 'md',
                            wrap: true,
                        },
                        {
                            type: 'separator',
                            margin: 'md',
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            margin: 'md',
                            spacing: 'sm',
                            contents: [
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '長輩',
                                            size: 'sm',
                                            color: '#999999',
                                            flex: 2,
                                        },
                                        {
                                            type: 'text',
                                            text: (elder === null || elder === void 0 ? void 0 : elder.name) || '未知',
                                            size: 'sm',
                                            color: '#111111',
                                            flex: 5,
                                            wrap: true,
                                        },
                                    ],
                                },
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '位置',
                                            size: 'sm',
                                            color: '#999999',
                                            flex: 2,
                                        },
                                        {
                                            type: 'text',
                                            text: gateway.name || gateway.location || '未知',
                                            size: 'sm',
                                            color: '#111111',
                                            flex: 5,
                                            wrap: true,
                                        },
                                    ],
                                },
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '類型',
                                            size: 'sm',
                                            color: '#999999',
                                            flex: 2,
                                        },
                                        {
                                            type: 'text',
                                            text: gatewayTypeText,
                                            size: 'sm',
                                            color: '#111111',
                                            flex: 5,
                                        },
                                    ],
                                },
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '時間',
                                            size: 'sm',
                                            color: '#999999',
                                            flex: 2,
                                        },
                                        {
                                            type: 'text',
                                            text: lastSeenTime,
                                            size: 'sm',
                                            color: '#111111',
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
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            action: {
                                type: 'uri',
                                label: '查看地圖',
                                uri: `https://www.google.com/maps?q=${lat},${lng}`,
                            },
                        },
                    ],
                },
            },
        };
        // Send to all member LINE users
        for (const lineUserId of lineUserIds) {
            try {
                await client.pushMessage(lineUserId, flexMessage);
                console.log(`Sent LINE notification to member ${lineUserId}`);
            }
            catch (error) {
                console.error(`Failed to send LINE notification to ${lineUserId}:`, error);
            }
        }
    }
    catch (error) {
        console.error('Error sending LINE notification:', error);
        // Don't throw error - notification failure shouldn't stop the main process
    }
}
/**
 * Create boundary alert for elder detected at boundary gateway
 */
async function createBoundaryAlert(beacon, gateway, lat, lng, db) {
    try {
        // Find elder by device UUID + Major + Minor (unique identifier for Beacon)
        const deviceQuery = await db
            .collection('devices')
            .where('uuid', '==', beacon.uuid)
            .where('major', '==', beacon.major)
            .where('minor', '==', beacon.minor)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (deviceQuery.empty) {
            console.log(`No active device found for UUID ${beacon.uuid}, Major ${beacon.major}, Minor ${beacon.minor}`);
            return;
        }
        const device = deviceQuery.docs[0].data();
        const elderId = device.elderId;
        if (!elderId) {
            console.log(`Device (UUID: ${beacon.uuid}, Major: ${beacon.major}, Minor: ${beacon.minor}) has no associated elder`);
            return;
        }
        // Get elder info
        const elderDoc = await db.collection('elders').doc(elderId).get();
        if (!elderDoc.exists) {
            console.log(`Elder ${elderId} not found`);
            return;
        }
        const elder = elderDoc.data();
        // Get tenantId from elder
        const tenantId = elder === null || elder === void 0 ? void 0 : elder.tenantId;
        if (!tenantId) {
            console.log(`Elder ${elderId} has no associated tenant, skipping boundary alert`);
            return;
        }
        // Check if there's already a recent BOUNDARY alert (within 5 minutes)
        // Simplified query to avoid complex index requirements
        const recentAlertsQuery = await db
            .collection('alerts')
            .where('elderId', '==', elderId)
            .where('type', '==', 'BOUNDARY')
            .where('gatewayId', '==', gateway.id)
            .limit(10)
            .get();
        // Check in memory for recent alerts
        const now = Date.now();
        for (const doc of recentAlertsQuery.docs) {
            const alertData = doc.data();
            if (alertData.triggeredAt) {
                const lastAlertTime = alertData.triggeredAt.toMillis ?
                    alertData.triggeredAt.toMillis() :
                    new Date(alertData.triggeredAt).getTime();
                const timeDiff = now - lastAlertTime;
                if (timeDiff < COOLDOWN_PERIOD_MS) {
                    console.log(`Boundary alert cooldown active for elder ${elderId} at gateway ${gateway.id} (${Math.floor(timeDiff / 1000)}s ago)`);
                    return;
                }
            }
        }
        // Create boundary alert
        await db.collection('alerts').add({
            tenantId: tenantId,
            elderId: elderId,
            gatewayId: gateway.id,
            type: 'BOUNDARY',
            status: 'PENDING',
            severity: 'HIGH',
            title: `${(elder === null || elder === void 0 ? void 0 : elder.name) || '長輩'} 出現在邊界點`,
            message: `${(elder === null || elder === void 0 ? void 0 : elder.name) || '長輩'} 在 ${gateway.name || gateway.location || '邊界點'} 被偵測到，請注意其安全。`,
            details: {
                beaconUuid: beacon.uuid,
                beaconMajor: beacon.major,
                beaconMinor: beacon.minor,
                rssi: beacon.rssi,
                gatewayName: gateway.name,
                gatewayLocation: gateway.location,
            },
            latitude: lat,
            longitude: lng,
            triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Created BOUNDARY alert for elder ${elderId} at gateway ${gateway.id}`);
    }
    catch (error) {
        console.error('Error creating boundary alert:', error);
        // Don't throw error - notification failure shouldn't stop the main process
    }
}
/**
 * Process a single beacon with 5-minute cooldown logic
 */
async function processBeacon(beacon, gateway, uploadedLat, uploadedLng, timestamp, db) {
    var _a;
    // Determine the location to use based on gateway type
    const { lat, lng } = determineLocation(gateway, uploadedLat, uploadedLng);
    try {
        // 1. Find device by UUID + Major + Minor (unique identifier for Beacon)
        const deviceQuery = await db
            .collection('devices')
            .where('uuid', '==', beacon.uuid)
            .where('major', '==', beacon.major)
            .where('minor', '==', beacon.minor)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (deviceQuery.empty) {
            console.log(`No active device found for UUID ${beacon.uuid}, Major ${beacon.major}, Minor ${beacon.minor}, skipping`);
            return { status: 'ignored', beaconId: `${beacon.uuid}-${beacon.major}-${beacon.minor}` };
        }
        const deviceDoc = deviceQuery.docs[0];
        const device = deviceDoc.data();
        const deviceId = deviceDoc.id;
        // 🆕 Update device battery level and lastSeen if battery info is provided
        const deviceUpdateData = {
            lastSeen: new Date(timestamp).toISOString(),
            lastRssi: beacon.rssi,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        // Only update batteryLevel if it's provided in the beacon data
        if (beacon.batteryLevel !== undefined && beacon.batteryLevel !== null) {
            deviceUpdateData.batteryLevel = beacon.batteryLevel;
        }
        await deviceDoc.ref.update(deviceUpdateData);
        console.log(`Updated device ${deviceId} - batteryLevel: ${(_a = beacon.batteryLevel) !== null && _a !== void 0 ? _a : 'N/A'}, lastSeen: ${new Date(timestamp).toISOString()}`);
        // 🆕 Check if this is a map app user device
        if (device.poolType === 'PUBLIC' && device.mapAppUserId) {
            console.log(`Processing beacon for map app user ${device.mapAppUserId}`);
            await handleMapUserBeacon(beacon, gateway, deviceId, device.mapAppUserId, lat, lng, timestamp, db);
            return { status: 'updated', beaconId: deviceId };
        }
        // Original logic: Handle tenant-elder system
        const elderId = device.elderId;
        if (!elderId) {
            console.log(`Device (UUID: ${beacon.uuid}, Major: ${beacon.major}, Minor: ${beacon.minor}) has no associated elder or map user, skipping`);
            return { status: 'ignored', beaconId: `${beacon.uuid}-${beacon.major}-${beacon.minor}` };
        }
        // 2. Use elderId as the document ID in latest_locations
        const docId = elderId;
        const docRef = db.collection('latest_locations').doc(docId);
        // Read the existing document
        const doc = await docRef.get();
        // Prepare location data
        const locationData = {
            elderId: elderId,
            deviceUuid: beacon.uuid,
            gateway_id: gateway.id,
            gateway_name: gateway.name,
            gateway_type: gateway.type,
            lat: lat,
            lng: lng,
            rssi: beacon.rssi,
            major: beacon.major,
            minor: beacon.minor,
            last_seen: admin.firestore.FieldValue.serverTimestamp(),
        };
        // If document doesn't exist, create it
        if (!doc.exists) {
            // Update main document (latest location)
            await docRef.set(locationData);
            // Create history record in subcollection
            await docRef.collection('history').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                gateway: {
                    id: gateway.id,
                    name: gateway.name,
                    location: gateway.location,
                    type: gateway.type,
                },
                latitude: lat,
                longitude: lng,
                rssi: beacon.rssi,
                deviceUuid: beacon.uuid,
                major: beacon.major,
                minor: beacon.minor,
            });
            console.log(`Created new location record for elder ${docId} at ${gateway.type} gateway`);
            // Create alert if BOUNDARY gateway
            if (gateway.type === 'BOUNDARY') {
                await createBoundaryAlert(beacon, gateway, lat, lng, db);
            }
            // Send LINE notification to members (first activity of the day)
            await sendLineNotification(beacon, gateway, lat, lng, timestamp, db, true);
            return { status: 'created', beaconId: docId };
        }
        // Document exists, check cooldown period
        const data = doc.data();
        if (!data || !data.last_seen) {
            // Data is corrupted, update it
            await docRef.set(locationData);
            // Create history record in subcollection
            await docRef.collection('history').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                gateway: {
                    id: gateway.id,
                    name: gateway.name,
                    location: gateway.location,
                    type: gateway.type,
                },
                latitude: lat,
                longitude: lng,
                rssi: beacon.rssi,
                deviceUuid: beacon.uuid,
                major: beacon.major,
                minor: beacon.minor,
            });
            console.log(`Updated corrupted record for elder ${docId}`);
            // Create alert if BOUNDARY gateway
            if (gateway.type === 'BOUNDARY') {
                await createBoundaryAlert(beacon, gateway, lat, lng, db);
            }
            // Send LINE notification to members
            await sendLineNotification(beacon, gateway, lat, lng, timestamp, db, false);
            return { status: 'updated', beaconId: docId };
        }
        // Calculate time difference
        const lastSeenMillis = data.last_seen.toMillis();
        const timeDiff = timestamp - lastSeenMillis;
        const lastGatewayId = data.gateway_id;
        // Check if this is a different gateway (elder moved to new location)
        const isDifferentGateway = lastGatewayId !== gateway.id;
        // If different gateway, always update (elder moved)
        // If same gateway, check cooldown period
        if (isDifferentGateway || timeDiff >= COOLDOWN_PERIOD_MS) {
            // Update main document (latest location)
            await docRef.set(locationData);
            // Create history record in subcollection
            await docRef.collection('history').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                gateway: {
                    id: gateway.id,
                    name: gateway.name,
                    location: gateway.location,
                    type: gateway.type,
                },
                latitude: lat,
                longitude: lng,
                rssi: beacon.rssi,
                deviceUuid: beacon.uuid,
                major: beacon.major,
                minor: beacon.minor,
            });
            const reason = isDifferentGateway
                ? `moved to different gateway (${lastGatewayId} → ${gateway.id})`
                : `cooldown passed (time diff: ${Math.floor(timeDiff / 1000)}s)`;
            console.log(`Updated location for elder ${docId} at ${gateway.type} gateway (${reason})`);
            // Create alert if BOUNDARY gateway
            if (gateway.type === 'BOUNDARY') {
                await createBoundaryAlert(beacon, gateway, lat, lng, db);
            }
            // Send LINE notification to members (subsequent location update)
            await sendLineNotification(beacon, gateway, lat, lng, timestamp, db, false);
            return { status: 'updated', beaconId: docId };
        }
        // Within cooldown period at same gateway, ignore
        console.log(`Ignored elder ${docId} (same gateway within cooldown, time diff: ${Math.floor(timeDiff / 1000)}s)`);
        return { status: 'ignored', beaconId: docId };
    }
    catch (error) {
        console.error(`Error processing beacon ${beacon.uuid}:`, error);
        throw error;
    }
}
/**
 * Handle Map App User Beacon Detection
 * Process beacon data for map app users (not tenant-elder system)
 */
async function handleMapUserBeacon(beacon, gateway, deviceId, mapAppUserId, lat, lng, timestamp, db) {
    try {
        // 1. Record activity to mapUserActivities
        const activityData = {
            mapAppUserId: mapAppUserId,
            deviceId: deviceId,
            gatewayId: gateway.id,
            timestamp: admin.firestore.Timestamp.fromMillis(timestamp),
            rssi: beacon.rssi,
            latitude: lat,
            longitude: lng,
            triggeredNotification: false,
            notificationPointId: null,
        };
        const activityRef = await db.collection('mapUserActivities').add(activityData);
        console.log(`Recorded map user activity: ${activityRef.id} for user ${mapAppUserId}`);
        // 2. Check if user has notification points at this gateway
        const notifPointsSnapshot = await db
            .collection('mapUserNotificationPoints')
            .where('mapAppUserId', '==', mapAppUserId)
            .where('gatewayId', '==', gateway.id)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (notifPointsSnapshot.empty) {
            console.log(`No notification points for user ${mapAppUserId} at gateway ${gateway.id}`);
            return;
        }
        const notifPoint = notifPointsSnapshot.docs[0];
        const notifPointData = notifPoint.data();
        // 3. Get user FCM token
        const userDoc = await db.collection('mapAppUsers').doc(mapAppUserId).get();
        if (!userDoc.exists) {
            console.log(`Map user ${mapAppUserId} not found`);
            return;
        }
        const userData = userDoc.data();
        // 4. Send FCM notification if enabled
        if ((userData === null || userData === void 0 ? void 0 : userData.fcmToken) && (userData === null || userData === void 0 ? void 0 : userData.notificationEnabled)) {
            try {
                const notificationMessage = notifPointData.notificationMessage ||
                    `您的設備已經過 ${notifPointData.name}`;
                await admin.messaging().send({
                    token: userData.fcmToken,
                    notification: {
                        title: '位置通知',
                        body: notificationMessage,
                    },
                    data: {
                        type: 'LOCATION_ALERT',
                        gatewayId: gateway.id,
                        gatewayName: gateway.name || '',
                        notificationPointId: notifPoint.id,
                        latitude: lat.toString(),
                        longitude: lng.toString(),
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default',
                            channelId: 'location_alerts',
                        },
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                badge: 1,
                            },
                        },
                    },
                });
                // Update activity record to mark notification sent
                await activityRef.update({
                    triggeredNotification: true,
                    notificationPointId: notifPoint.id,
                });
                console.log(`Sent FCM notification to map user ${mapAppUserId} for point ${notifPointData.name}`);
            }
            catch (fcmError) {
                console.error(`Failed to send FCM notification to user ${mapAppUserId}:`, fcmError);
            }
        }
        else {
            console.log(`User ${mapAppUserId} has notifications disabled or no FCM token`);
        }
    }
    catch (error) {
        console.error(`Error in handleMapUserBeacon for user ${mapAppUserId}:`, error);
    }
}
/**
 * Main Cloud Function: Receive Beacon Data
 *
 * This function receives batch beacon data from edge devices (Android phones/Gateways),
 * filters duplicate data using a 5-minute throttling mechanism, and updates Firestore.
 */
exports.receiveBeaconData = (0, https_1.onRequest)({
    cors: true, // Allow CORS for all origins
    timeoutSeconds: 60,
    memory: '256MiB',
}, async (req, res) => {
    const startTime = Date.now();
    // Only accept POST requests
    if (req.method !== 'POST') {
        res.status(405).json({
            success: false,
            error: 'Method not allowed. Use POST.'
        });
        return;
    }
    try {
        const payload = req.body;
        // Step 1: Validate request payload
        const validation = validatePayload(payload);
        if (!validation.valid) {
            console.warn('Validation failed:', validation.error);
            res.status(400).json({
                success: false,
                error: validation.error
            });
            return;
        }
        console.log(`Received ${payload.beacons.length} beacons from gateway ${payload.gateway_id}`);
        const db = admin.firestore();
        // Step 2: Get or auto-register gateway
        const gateway = await getOrCreateGateway(payload.gateway_id, payload, db);
        console.log(`Gateway: ${gateway.name} (${gateway.type}) - Tenant: ${gateway.tenantId || 'None'}`);
        // Step 3: Batch process all beacons using Promise.all
        const results = await Promise.all(payload.beacons.map(beacon => {
            var _a, _b;
            return processBeacon(beacon, gateway, (_a = payload.lat) !== null && _a !== void 0 ? _a : 0, // Use 0 if not provided
            (_b = payload.lng) !== null && _b !== void 0 ? _b : 0, // Use 0 if not provided
            payload.timestamp, db);
        }));
        // Step 4: Calculate statistics
        const created = results.filter(r => r.status === 'created').length;
        const updated = results.filter(r => r.status === 'updated').length;
        const ignored = results.filter(r => r.status === 'ignored').length;
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
        console.error('Unexpected error in receiveBeaconData:', error);
        // Log error to Firestore
        await logError('receiveBeaconData', error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : undefined, req.body);
        res.status(500).json({
            success: false,
            error: 'Internal server error. Please check logs.',
        });
    }
});
//# sourceMappingURL=receiveBeaconData.js.map