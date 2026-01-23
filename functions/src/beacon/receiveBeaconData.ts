import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { Client, FlexMessage } from '@line/bot-sdk';

// Constants
const COOLDOWN_PERIOD_MS = 2 * 60 * 1000; // 5 minutes in milliseconds

// Define environment parameter for location update notification
const enableLocationNotification = defineString(
  'ENABLE_LOCATION_UPDATE_NOTIFICATION',
  {
    default: 'false',
    description: '是否啟用位置更新通知（邊界警報和首次活動不受影響）',
  }
);

// Type definitions
interface BeaconData {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  batteryLevel?: number;  // Optional battery level (0-100)
}

interface NotificationResult {
  triggered: boolean;
  type: 'LINE' | 'FCM' | null;
  pointId?: string;  // notificationPointId for MAP_USER
  details?: any;
}

interface RequestPayload {
  gateway_id: string;  // MAC Address for commercial receivers, IMEI for mobile phones
  lat?: number;        // Optional - will use gateway's fixed location if not provided
  lng?: number;        // Optional - will use gateway's fixed location if not provided
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
  type: 'GENERAL' | 'BOUNDARY' | 'MOBILE';
  latitude?: number;
  longitude?: number;
  isActive: boolean;
}

interface ProcessingResult {
  status: 'created' | 'updated' | 'ignored';
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
  payload: any
): Promise<void> {
  try {
    const db = admin.firestore();
    await db.collection('error_logs').add({
      function_name: functionName,
      error_message: errorMessage,
      error_stack: errorStack || 'No stack trace available',
      payload: payload,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    // If logging to Firestore fails, at least log to console
    console.error('Failed to log error to Firestore:', logError);
  }
}

/**
 * Validate incoming request payload
 */
function validatePayload(body: any): { valid: boolean; error?: string } {
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
async function getGatewayInfo(
  gatewayId: string,
  db: admin.firestore.Firestore
): Promise<GatewayInfo | null> {
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
    return {
      id: gatewayDoc.id,
      ...gatewayDoc.data(),
    } as GatewayInfo;
  } catch (error) {
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
async function getOrCreateGateway(
  gatewayId: string,
  payload: RequestPayload,
  db: admin.firestore.Firestore
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
    type: 'MOBILE' as const,
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
  } as GatewayInfo;
}

/**
 * Determine the location to use based on gateway type and available data
 */
function determineLocation(
  gateway: GatewayInfo, 
  uploadedLat: number | undefined, 
  uploadedLng: number | undefined
): { lat: number; lng: number } {
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
 * Send LINE notification to tenant members for elder
 */
async function sendLineNotificationToTenant(
  elderId: string,
  elder: any,
  beacon: BeaconData,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  timestamp: number,
  tenantId: string,
  channelAccessToken: string,
  db: admin.firestore.Firestore
): Promise<void> {
  try {
    // 1. Get all approved tenant members
    const membersQuery = await db
      .collection('tenants').doc(tenantId)
      .collection('members')
      .where('status', '==', 'APPROVED')
      .get();

    if (membersQuery.empty) {
      console.log(`No approved members found for tenant ${tenantId}`);
      return;
    }

    // 2. Get appUsers with LINE IDs
    const memberAppUserIds = membersQuery.docs.map(doc => doc.data().appUserId);
    const lineUserIds: string[] = [];

    for (const appUserId of memberAppUserIds) {
      const appUserDoc = await db.collection('appUsers').doc(appUserId).get();
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

    // Check if location update notification is enabled
    const notificationEnabled = enableLocationNotification.value() === 'true';
    const isFirstActivity = false; // This would need to be determined differently in the new architecture
    if (gateway.type !== 'BOUNDARY' && !isFirstActivity && !notificationEnabled) {
      console.log(`Location update notification disabled, skipping notification for ${gateway.type} gateway`);
      return;
    }

    // 3. Create LINE client and send message
    const client = new Client({ channelAccessToken });

    const gatewayTypeText = gateway.type === 'BOUNDARY' ? '邊界點' : 
                           gateway.type === 'MOBILE' ? '移動接收器' : '一般接收器';

    let headerText = '';
    let bodyText = '';
    
    if (gateway.type === 'BOUNDARY') {
      headerText = '邊界警報';
      bodyText = `${elder?.name || '長輩'} 出現在邊界點`;
    } else {
      headerText = '位置更新';
      bodyText = `${elder?.name || '長輩'} 位置已更新`;
    }

    const lastSeenTime = new Date(timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

    const flexMessage: FlexMessage = {
      type: 'flex',
      altText: `${elder?.name || '長輩'} ${headerText}通知`,
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
                      text: elder?.name || '未知',
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
      } catch (error) {
        console.error(`Failed to send LINE notification to ${lineUserId}:`, error);
      }
    }

  } catch (error) {
    console.error('Error sending LINE notification to tenant:', error);
  }
}

/**
 * Create boundary alert for elder (simplified)
 */
async function createBoundaryAlertForElder(
  elderId: string,
  elder: any,
  beacon: BeaconData,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  tenantId: string,
  db: admin.firestore.Firestore
): Promise<void> {
  try {
    // Check if there's already a recent BOUNDARY alert (within cooldown period)
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
      title: `${elder?.name || '長輩'} 出現在邊界點`,
      message: `${elder?.name || '長輩'} 在 ${gateway.name || gateway.location || '邊界點'} 被偵測到，請注意其安全。`,
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
  } catch (error) {
    console.error('Error creating boundary alert:', error);
  }
}

// OLD FUNCTIONS REMOVED - Now using sendLineNotificationToTenant and createBoundaryAlertForElder

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
  db: admin.firestore.Firestore
): Promise<void> {
  const activityData: any = {
    timestamp: admin.firestore.Timestamp.fromMillis(timestamp),
    gatewayId: gateway.id,
    gatewayName: gateway.name,
    gatewayType: gateway.type,
    latitude: lat,
    longitude: lng,
    rssi: beacon.rssi,
    bindingType: device.bindingType || 'UNBOUND',
    boundTo: device.boundTo || null,
    triggeredNotification: notificationResult.triggered,
    notificationType: notificationResult.type,
    notificationDetails: notificationResult.details || null,
  };
  
  // 如果是 MAP_USER 且有觸發通知，加上 notificationPointId
  if (notificationResult.triggered && notificationResult.pointId) {
    activityData.notificationPointId = notificationResult.pointId;
  }
  
  await db.collection('devices').doc(deviceId)
    .collection('activities')
    .add(activityData);
  
  console.log(`Recorded activity for device ${deviceId} at gateway ${gateway.id} - notification: ${notificationResult.triggered}`);
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
  db: admin.firestore.Firestore
): Promise<NotificationResult> {
  const bindingType = device.bindingType || 'UNBOUND';
  
  switch (bindingType) {
    case 'ELDER':
      if (device.boundTo) {
        return await handleElderNotification(deviceId, device.boundTo, beacon, gateway, lat, lng, timestamp, db);
      }
      return { triggered: false, type: null };
      
    case 'MAP_USER':
      if (device.boundTo) {
        return await handleMapUserNotification(deviceId, device.boundTo, beacon, gateway, lat, lng, timestamp, db);
      }
      return { triggered: false, type: null };
      
    case 'UNBOUND':
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
  db: admin.firestore.Firestore
): Promise<NotificationResult> {
  try {
    // 1. Get elder data
    const elderDoc = await db.collection('elders').doc(elderId).get();
    if (!elderDoc.exists) {
      console.log(`Elder ${elderId} not found`);
      return { triggered: false, type: null };
    }
    
    const elder = elderDoc.data();
    const tenantId = elder?.tenantId;
    
    if (!tenantId) {
      console.log(`Elder ${elderId} has no associated tenant, skipping notification`);
      return { triggered: false, type: null };
    }
    
    // 2. Get tenant LINE settings
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
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
    
    // 3. Send LINE notification (reuse existing LINE notification logic)
    await sendLineNotificationToTenant(elderId, elder, beacon, gateway, lat, lng, timestamp, tenantId, channelAccessToken, db);
    
    // 4. Handle boundary alert
    if (gateway.type === 'BOUNDARY') {
      await createBoundaryAlertForElder(elderId, elder, beacon, gateway, lat, lng, tenantId, db);
    }
    
    console.log(`Handled elder notification for ${elderId}`);
    
    return {
      triggered: true,
      type: 'LINE',
      details: {
        elderId: elderId,
        tenantId: tenantId,
        gatewayType: gateway.type,
      }
    };
  } catch (error) {
    console.error(`Error in handleElderNotification for elder ${elderId}:`, error);
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
  db: admin.firestore.Firestore
): Promise<NotificationResult> {
  try {
    // 1. Check if user has notification points at this gateway
    const notifPointsSnapshot = await db
      .collection('mapUserNotificationPoints')
      .where('mapAppUserId', '==', mapAppUserId)
      .where('gatewayId', '==', gateway.id)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (notifPointsSnapshot.empty) {
      console.log(`No notification points for user ${mapAppUserId} at gateway ${gateway.id}`);
      return { triggered: false, type: null };
    }
    
    const notifPoint = notifPointsSnapshot.docs[0];
    const notifPointData = notifPoint.data();
    
    // 2. Get user FCM token
    const userDoc = await db.collection('mapAppUsers').doc(mapAppUserId).get();
    if (!userDoc.exists) {
      console.log(`Map user ${mapAppUserId} not found`);
      // 即使用戶不存在，仍記錄這是通知點
      return { 
        triggered: false, 
        type: null,
        pointId: notifPoint.id,  // 記錄通知點 ID
        details: {
          notificationPointName: notifPointData.name,
          reason: 'User not found'
        }
      };
    }
    
    const userData = userDoc.data();
    
    // 3. Send FCM notification
    if (userData?.fcmToken && userData?.notificationEnabled) {
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
            deviceId: deviceId,
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
        
        console.log(`Sent FCM notification to map user ${mapAppUserId}`);
        
        return {
          triggered: true,
          type: 'FCM',
          pointId: notifPoint.id,
          details: {
            mapAppUserId: mapAppUserId,
            notificationPointName: notifPointData.name,
            message: notificationMessage,
          }
        };
      } catch (fcmError) {
        console.error(`Failed to send FCM notification to user ${mapAppUserId}:`, fcmError);
        // 發送失敗仍記錄這是通知點
        return { 
          triggered: false, 
          type: null,
          pointId: notifPoint.id,
          details: {
            notificationPointName: notifPointData.name,
            reason: 'FCM send failed'
          }
        };
      }
    } else {
      // 用戶關閉通知或沒有 token，仍記錄這是通知點
      console.log(`User ${mapAppUserId} has notifications disabled or no FCM token`);
      return { 
        triggered: false, 
        type: null,
        pointId: notifPoint.id,  // 重點：記錄通知點 ID
        details: {
          notificationPointName: notifPointData.name,
          reason: userData?.notificationEnabled === false ? 'Notifications disabled' : 'No FCM token'
        }
      };
    }
  } catch (error) {
    console.error(`Error in handleMapUserNotification for user ${mapAppUserId}:`, error);
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
  db: admin.firestore.Firestore
): Promise<ProcessingResult> {
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
    console.log(`Updated device ${deviceId} - batteryLevel: ${beacon.batteryLevel ?? 'N/A'}, lastSeen: ${new Date(timestamp).toISOString()}`);

    // 3. Handle notification based on binding type (unified) - 先處理通知
    const notificationResult = await handleNotification(deviceId, device, beacon, gateway, lat, lng, timestamp, db);

    // 4. Record activity to device subcollection (unified) - 再記錄活動（包含通知資訊）
    await recordDeviceActivity(deviceId, device, beacon, gateway, lat, lng, timestamp, notificationResult, db);

    return { status: 'updated', beaconId: deviceId };

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
    memory: '256MiB',
  },
  async (req, res) => {
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
      const payload: RequestPayload = req.body;

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
      const results = await Promise.all(
        payload.beacons.map(beacon =>
          processBeacon(
            beacon,
            gateway,
            payload.lat ?? 0,  // Use 0 if not provided
            payload.lng ?? 0,  // Use 0 if not provided
            payload.timestamp,
            db
          )
        )
      );

      // Step 4: Calculate statistics
      const created = results.filter(r => r.status === 'created').length;
      const updated = results.filter(r => r.status === 'updated').length;
      const ignored = results.filter(r => r.status === 'ignored').length;

      const processingTime = Date.now() - startTime;

      console.log(`Processing complete: ${created} created, ${updated} updated, ${ignored} ignored (${processingTime}ms)`);

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
      console.error('Unexpected error in receiveBeaconData:', error);

      // Log error to Firestore
      await logError(
        'receiveBeaconData',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined,
        req.body
      );

      res.status(500).json({
        success: false,
        error: 'Internal server error. Please check logs.',
      });
    }
  }
);
