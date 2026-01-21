import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

/**
 * Get Map User Activities (Device History)
 * GET /getMapUserActivities?userId=xxx&startTime=xxx&endTime=xxx&limit=100
 * 
 * Query Parameters:
 * - userId: string (required)
 * - startTime: number (optional, timestamp in milliseconds)
 * - endTime: number (optional, timestamp in milliseconds)
 * - limit: number (optional, default 100, max 1000)
 * 
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 */
export const getMapUserActivities = onRequest(async (req, res) => {
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
    const startTimeStr = req.query.startTime as string;
    const endTimeStr = req.query.endTime as string;
    const limitStr = req.query.limit as string;

    // Validate userId
    if (!userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required query parameter: userId' 
      });
      return;
    }

    // Verify user can only access their own activities
    if (userId !== authenticatedUserId) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const db = admin.firestore();

    // Verify user exists
    const userDoc = await db.collection('mapAppUsers').doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Parse query parameters
    const limit = limitStr ? Math.min(parseInt(limitStr), 1000) : 100;
    
    // Build query
    let query = db
      .collection('mapUserActivities')
      .where('mapAppUserId', '==', userId)
      .orderBy('timestamp', 'desc');

    // Add time range filters if provided
    if (startTimeStr) {
      const startTime = admin.firestore.Timestamp.fromMillis(parseInt(startTimeStr));
      query = query.where('timestamp', '>=', startTime) as any;
    }

    if (endTimeStr) {
      const endTime = admin.firestore.Timestamp.fromMillis(parseInt(endTimeStr));
      query = query.where('timestamp', '<=', endTime) as any;
    }

    query = query.limit(limit) as any;

    // Execute query
    const activitiesSnapshot = await query.get();

    // Fetch gateway details for each activity
    const activities = await Promise.all(
      activitiesSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // Get gateway info
        let gatewayInfo = null;
        if (data.gatewayId) {
          const gatewayDoc = await db.collection('gateways').doc(data.gatewayId).get();
          if (gatewayDoc.exists) {
            const gw = gatewayDoc.data();
            gatewayInfo = {
              id: gatewayDoc.id,
              name: gw?.name,
              location: gw?.location,
              type: gw?.type,
            };
          }
        }

        return {
          id: doc.id,
          deviceId: data.deviceId,
          gatewayId: data.gatewayId,
          gatewayName: gatewayInfo?.name || 'Unknown',
          gatewayLocation: gatewayInfo?.location,
          timestamp: data.timestamp?.toDate().toISOString(),
          rssi: data.rssi,
          latitude: data.latitude,
          longitude: data.longitude,
          triggeredNotification: data.triggeredNotification || false,
          notificationPointId: data.notificationPointId,
        };
      })
    );

    res.json({
      success: true,
      activities: activities,
      count: activities.length,
      timestamp: Date.now(),
    });

  } catch (error: any) {
    console.error('Error in getMapUserActivities:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});
