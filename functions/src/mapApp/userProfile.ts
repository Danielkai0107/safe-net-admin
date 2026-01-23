import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

/**
 * Get Map App User Profile
 * GET /getMapUserProfile?userId={userId}
 * 
 * Returns complete user profile including:
 * - User information
 * - Bound device details (if any)
 * - Notification points list
 * 
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 */
export const getMapUserProfile = onRequest(async (req, res) => {
  // CORS handling
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Verify Firebase ID Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const authenticatedUserId = decodedToken.uid;

    const userId = req.query.userId as string;

    if (!userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required query parameter: userId' 
      });
      return;
    }

    // Verify user can only access their own profile
    if (userId !== authenticatedUserId) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const db = admin.firestore();

    // 1. Get user data
    const userDoc = await db.collection('mapAppUsers').doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const userData = userDoc.data();

    // 2. Prepare user info response
    const userInfo = {
      id: userId,
      email: userData?.email || null,
      name: userData?.name || 'Unknown User',
      phone: userData?.phone || null,
      avatar: userData?.avatar || null,
      notificationEnabled: userData?.notificationEnabled ?? true,
    };

    // 3. Get bound device details (if any)
    let boundDevice = null;
    if (userData?.boundDeviceId) {
      const deviceDoc = await db.collection('devices').doc(userData.boundDeviceId).get();
      if (deviceDoc.exists) {
        const deviceData = deviceDoc.data();
        boundDevice = {
          id: userData.boundDeviceId,
          deviceName: deviceData?.deviceName || `${deviceData?.major}-${deviceData?.minor}`,
          nickname: deviceData?.mapUserNickname || null,  // 從 Device 取得
          age: deviceData?.mapUserAge || null,            // 從 Device 取得
          uuid: deviceData?.uuid,
          major: deviceData?.major,
          minor: deviceData?.minor,
          boundAt: deviceData?.boundAt?.toDate?.() ? deviceData.boundAt.toDate().toISOString() : null,  // 從 Device 取得
        };
      }
    }

    // 4. Get notification points
    const notifPointsSnapshot = await db
      .collection('mapUserNotificationPoints')
      .where('mapAppUserId', '==', userId)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    const notificationPoints = await Promise.all(
      notifPointsSnapshot.docs.map(async (doc) => {
        const pointData = doc.data();
        
        // Get gateway info
        let gatewayInfo = null;
        if (pointData.gatewayId) {
          const gatewayDoc = await db.collection('gateways').doc(pointData.gatewayId).get();
          if (gatewayDoc.exists) {
            const gw = gatewayDoc.data();
            gatewayInfo = {
              name: gw?.name || 'Unknown Gateway',
              location: gw?.location || null,
              latitude: gw?.latitude || null,
              longitude: gw?.longitude || null,
            };
          }
        }

        return {
          id: doc.id,
          name: pointData.name,
          gatewayId: pointData.gatewayId,
          notificationMessage: pointData.notificationMessage || null,
          isActive: pointData.isActive,
          createdAt: pointData.createdAt?.toDate()?.toISOString() || null,
          gateway: gatewayInfo,
        };
      })
    );

    // 5. Return complete profile
    res.json({
      success: true,
      user: userInfo,
      boundDevice: boundDevice,
      notificationPoints: notificationPoints,
      timestamp: Date.now(),
    });

  } catch (error: any) {
    console.error('Error in getMapUserProfile:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});
