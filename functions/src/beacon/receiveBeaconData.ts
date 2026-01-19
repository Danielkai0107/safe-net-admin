import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { Client, FlexMessage } from '@line/bot-sdk';

// Constants
const COOLDOWN_PERIOD_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const ENABLE_LOCATION_UPDATE_NOTIFICATION = process.env.ENABLE_LOCATION_UPDATE_NOTIFICATION === 'true'; // 控制位置更新通知開關（邊界警報不受影響）

// Type definitions
interface BeaconData {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
}

interface RequestPayload {
  gateway_id: string;  // MAC Address for commercial receivers, IMEI for mobile phones
  lat: number;
  lng: number;
  timestamp: number;
  beacons: BeaconData[];
}

interface GatewayInfo {
  id: string;
  tenantId: string;
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

  if (typeof body.lat !== 'number' || body.lat < -90 || body.lat > 90) {
    return { valid: false, error: 'Missing or invalid lat (must be between -90 and 90)' };
  }

  if (typeof body.lng !== 'number' || body.lng < -180 || body.lng > 180) {
    return { valid: false, error: 'Missing or invalid lng (must be between -180 and 180)' };
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
 * Determine the location to use based on gateway type
 */
function determineLocation(gateway: GatewayInfo, uploadedLat: number, uploadedLng: number): { lat: number; lng: number } {
  // For MOBILE gateways, always use the uploaded GPS location
  if (gateway.type === 'MOBILE') {
    return { lat: uploadedLat, lng: uploadedLng };
  }
  
  // For GENERAL and BOUNDARY gateways, prefer database location if available
  if (gateway.latitude && gateway.longitude) {
    return { lat: gateway.latitude, lng: gateway.longitude };
  }
  
  // Fallback to uploaded location
  return { lat: uploadedLat, lng: uploadedLng };
}

/**
 * Send LINE notification to all tenant members
 */
async function sendLineNotification(
  beacon: BeaconData,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  db: admin.firestore.Firestore,
  isFirstActivity: boolean = false
): Promise<void> {
  try {
    // 1. Find device by UUID
    const deviceQuery = await db
      .collection('devices')
      .where('uuid', '==', beacon.uuid)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (deviceQuery.empty) {
      console.log(`No active device found for UUID ${beacon.uuid}`);
      return;
    }

    const device = deviceQuery.docs[0].data();
    const elderId = device.elderId;

    if (!elderId) {
      console.log(`Device ${beacon.uuid} has no associated elder`);
      return;
    }

    // 2. Get elder info
    const elderDoc = await db.collection('elders').doc(elderId).get();
    if (!elderDoc.exists) {
      console.log(`Elder ${elderId} not found`);
      return;
    }

    const elder = elderDoc.data();
    const tenantId = gateway.tenantId;

    // 3. Get tenant LINE credentials
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      console.log(`Tenant ${tenantId} not found`);
      return;
    }

    const tenant = tenantDoc.data();
    const channelAccessToken = tenant?.lineChannelAccessToken;

    if (!channelAccessToken) {
      console.log(`Tenant ${tenantId} has no LINE Channel Access Token configured`);
      return;
    }

    // 4. Get all approved tenant members
    const membersQuery = await db
      .collection('tenants').doc(tenantId)
      .collection('members')
      .where('status', '==', 'APPROVED')
      .get();

    if (membersQuery.empty) {
      console.log(`No approved members found for tenant ${tenantId}`);
      return;
    }

    // 5. Get appUsers with LINE IDs
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
    // Boundary alerts and first activity ALWAYS send, only subsequent updates can be disabled
    if (gateway.type !== 'BOUNDARY' && !isFirstActivity && !ENABLE_LOCATION_UPDATE_NOTIFICATION) {
      console.log(`Location update notification disabled, skipping notification for ${gateway.type} gateway`);
      return;
    }

    // 6. Create LINE client and send message
    const client = new Client({ channelAccessToken });

    const gatewayTypeText = gateway.type === 'BOUNDARY' ? '邊界點' : 
                           gateway.type === 'MOBILE' ? '移動接收器' : '一般接收器';

    // Determine notification text based on gateway type and first activity
    let headerText = '';
    let bodyText = '';
    
    if (gateway.type === 'BOUNDARY') {
      headerText = '邊界警報';
      bodyText = `${elder?.name || '長輩'} 出現在邊界點`;
    } else {
      if (isFirstActivity) {
        headerText = '今日首次活動';
        bodyText = `${elder?.name || '長輩'} 今日首次偵測到活動`;
      } else {
        headerText = '位置更新';
        bodyText = `${elder?.name || '長輩'} 位置已更新`;
      }
    }

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
              color: '#FFFFFF',
            },
          ],
          backgroundColor: gateway.type === 'BOUNDARY' ? '#DC2626' : '#2563EB',
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
                      text: new Date().toLocaleString('zh-TW'),
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
    console.error('Error sending LINE notification:', error);
    // Don't throw error - notification failure shouldn't stop the main process
  }
}

/**
 * Create boundary alert for elder detected at boundary gateway
 */
async function createBoundaryAlert(
  beacon: BeaconData,
  gateway: GatewayInfo,
  lat: number,
  lng: number,
  db: admin.firestore.Firestore
): Promise<void> {
  try {
    // Find elder by device UUID
    const deviceQuery = await db
      .collection('devices')
      .where('uuid', '==', beacon.uuid)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (deviceQuery.empty) {
      console.log(`No active device found for UUID ${beacon.uuid}`);
      return;
    }

    const device = deviceQuery.docs[0].data();
    const elderId = device.elderId;

    if (!elderId) {
      console.log(`Device ${beacon.uuid} has no associated elder`);
      return;
    }

    // Get elder info
    const elderDoc = await db.collection('elders').doc(elderId).get();
    if (!elderDoc.exists) {
      console.log(`Elder ${elderId} not found`);
      return;
    }

    const elder = elderDoc.data();

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
      tenantId: gateway.tenantId,
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
    // Don't throw error - notification failure shouldn't stop the main process
  }
}

/**
 * Process a single beacon with 5-minute cooldown logic
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
    // 1. Find device by UUID to get the associated elder
    const deviceQuery = await db
      .collection('devices')
      .where('uuid', '==', beacon.uuid)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (deviceQuery.empty) {
      console.log(`No active device found for UUID ${beacon.uuid}, skipping location update`);
      return { status: 'ignored', beaconId: beacon.uuid };
    }

    const device = deviceQuery.docs[0].data();
    const elderId = device.elderId;

    if (!elderId) {
      console.log(`Device ${beacon.uuid} has no associated elder, skipping location update`);
      return { status: 'ignored', beaconId: beacon.uuid };
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
      await sendLineNotification(beacon, gateway, lat, lng, db, true);

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
      await sendLineNotification(beacon, gateway, lat, lng, db, false);

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
      await sendLineNotification(beacon, gateway, lat, lng, db, false);

      return { status: 'updated', beaconId: docId };
    }

    // Within cooldown period at same gateway, ignore
    console.log(`Ignored elder ${docId} (same gateway within cooldown, time diff: ${Math.floor(timeDiff / 1000)}s)`);
    return { status: 'ignored', beaconId: docId };

  } catch (error) {
    console.error(`Error processing beacon ${beacon.uuid}:`, error);
    throw error;
  }
}

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

      // Step 2: Query gateway information
      const gateway = await getGatewayInfo(payload.gateway_id, db);

      if (!gateway) {
        console.warn(`Gateway not found or inactive: ${payload.gateway_id}`);
        
        // Log unregistered gateway
        await logError(
          'receiveBeaconData',
          `Unregistered or inactive gateway: ${payload.gateway_id}`,
          undefined,
          payload
        );

        res.status(404).json({
          success: false,
          error: `Gateway ${payload.gateway_id} is not registered or inactive. Please register it in the Gateway Management system.`,
        });
        return;
      }

      console.log(`Gateway found: ${gateway.name} (${gateway.type}) - Tenant: ${gateway.tenantId}`);

      // Step 3: Batch process all beacons using Promise.all
      const results = await Promise.all(
        payload.beacons.map(beacon =>
          processBeacon(
            beacon,
            gateway,
            payload.lat,
            payload.lng,
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
