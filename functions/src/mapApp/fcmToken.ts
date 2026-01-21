import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

interface UpdateFcmTokenRequest {
  userId: string;
  fcmToken: string;
}

/**
 * Update Map App User FCM Token
 * POST /updateMapUserFcmToken
 * 
 * Request Body:
 * - userId: string
 * - fcmToken: string
 * 
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 */
export const updateMapUserFcmToken = onRequest(async (req, res) => {
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

    const body: UpdateFcmTokenRequest = req.body;

    // Validate request
    if (!body.userId || !body.fcmToken) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId and fcmToken' 
      });
      return;
    }

    // Verify user can only update their own token
    if (body.userId !== authenticatedUserId) {
      res.status(403).json({ 
        success: false, 
        error: 'Forbidden: Cannot update another user\'s FCM token' 
      });
      return;
    }

    const db = admin.firestore();
    const userRef = db.collection('mapAppUsers').doc(body.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
      return;
    }

    // Update FCM token
    await userRef.update({
      fcmToken: body.fcmToken,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'FCM token updated successfully',
    });

  } catch (error: any) {
    console.error('Error in updateMapUserFcmToken:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});
