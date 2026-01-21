import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

interface BindDeviceRequest {
  userId: string;
  deviceId: string;
}

interface UnbindDeviceRequest {
  userId: string;
}

/**
 * Bind Device to Map App User
 * POST /bindDeviceToMapUser
 * 
 * Request Body:
 * - userId: string
 * - deviceId: string
 * 
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 */
export const bindDeviceToMapUser = onRequest(async (req, res) => {
  // CORS handling
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Verify Firebase ID Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const authenticatedUserId = decodedToken.uid;

    const body: BindDeviceRequest = req.body;

    // Validate request
    if (!body.userId || !body.deviceId) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId and deviceId' 
      });
      return;
    }

    // Verify user can only bind to their own account
    if (body.userId !== authenticatedUserId) {
      res.status(403).json({ 
        success: false, 
        error: 'Forbidden: Cannot bind device to another user' 
      });
      return;
    }

    const db = admin.firestore();

    // Check if user exists
    const userDoc = await db.collection('mapAppUsers').doc(body.userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
      return;
    }

    // Check if device exists
    const deviceDoc = await db.collection('devices').doc(body.deviceId).get();
    if (!deviceDoc.exists) {
      res.status(404).json({ 
        success: false, 
        error: 'Device not found' 
      });
      return;
    }

    const deviceData = deviceDoc.data();

    // Verify device is in public pool
    if (deviceData?.poolType !== 'PUBLIC') {
      res.status(400).json({ 
        success: false, 
        error: 'Device is not available in public pool' 
      });
      return;
    }

    // Check if device is already bound to another user
    if (deviceData?.mapAppUserId && deviceData.mapAppUserId !== body.userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Device is already bound to another user' 
      });
      return;
    }

    // Unbind old device if user already has one
    const userData = userDoc.data();
    if (userData?.boundDeviceId && userData.boundDeviceId !== body.deviceId) {
      await db.collection('devices').doc(userData.boundDeviceId).update({
        mapAppUserId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Bind device to user
    await db.collection('devices').doc(body.deviceId).update({
      mapAppUserId: body.userId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user's bound device
    const boundAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('mapAppUsers').doc(body.userId).update({
      boundDeviceId: body.deviceId,
      boundAt: boundAt,
      updatedAt: boundAt,
    });

    res.json({
      success: true,
      device: {
        id: body.deviceId,
        uuid: deviceData?.uuid,
        major: deviceData?.major,
        minor: deviceData?.minor,
        deviceName: deviceData?.deviceName,
      },
      boundAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error in bindDeviceToMapUser:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

/**
 * Unbind Device from Map App User
 * POST /unbindDeviceFromMapUser
 * 
 * Request Body:
 * - userId: string
 * 
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 */
export const unbindDeviceFromMapUser = onRequest(async (req, res) => {
  // CORS handling
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Verify Firebase ID Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const authenticatedUserId = decodedToken.uid;

    const body: UnbindDeviceRequest = req.body;

    // Validate request
    if (!body.userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required field: userId' 
      });
      return;
    }

    // Verify user can only unbind their own device
    if (body.userId !== authenticatedUserId) {
      res.status(403).json({ 
        success: false, 
        error: 'Forbidden: Cannot unbind another user\'s device' 
      });
      return;
    }

    const db = admin.firestore();

    // Check if user exists
    const userDoc = await db.collection('mapAppUsers').doc(body.userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
      return;
    }

    const userData = userDoc.data();
    if (!userData?.boundDeviceId) {
      res.status(400).json({ 
        success: false, 
        error: 'User has no bound device' 
      });
      return;
    }

    // Unbind device
    await db.collection('devices').doc(userData.boundDeviceId).update({
      mapAppUserId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user
    await db.collection('mapAppUsers').doc(body.userId).update({
      boundDeviceId: null,
      boundAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'Device unbound successfully',
    });

  } catch (error: any) {
    console.error('Error in unbindDeviceFromMapUser:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});
