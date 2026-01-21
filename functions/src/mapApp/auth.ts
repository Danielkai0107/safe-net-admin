import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

interface AuthRequest {
  action: 'register' | 'login';
  email?: string;
  name?: string;
  phone?: string;
}

/**
 * Map App User Authentication
 * POST /mapUserAuth
 * 
 * Request Body:
 * - action: 'register' | 'login'
 * - email?: string
 * - name?: string
 * - phone?: string
 * 
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 */
export const mapUserAuth = onRequest(async (req, res) => {
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
    const userId = decodedToken.uid;

    const body: AuthRequest = req.body;
    const db = admin.firestore();

    if (body.action === 'register') {
      // Check if user already exists
      const userDoc = await db.collection('mapAppUsers').doc(userId).get();
      
      if (userDoc.exists) {
        res.status(400).json({ 
          success: false, 
          error: 'User already registered' 
        });
        return;
      }

      // Create new user
      const newUser = {
        id: userId,
        email: body.email || decodedToken.email || null,
        name: body.name || decodedToken.name || 'Unknown User',
        phone: body.phone || null,
        avatar: decodedToken.picture || null,
        boundDeviceId: null,
        boundAt: null,
        fcmToken: null,
        notificationEnabled: true,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('mapAppUsers').doc(userId).set(newUser);

      res.json({
        success: true,
        user: {
          id: userId,
          email: newUser.email,
          name: newUser.name,
          phone: newUser.phone,
          isActive: newUser.isActive,
        },
      });

    } else if (body.action === 'login') {
      // Update last login time
      const userDoc = await db.collection('mapAppUsers').doc(userId).get();
      
      if (!userDoc.exists) {
        res.status(404).json({ 
          success: false, 
          error: 'User not found. Please register first.' 
        });
        return;
      }

      await db.collection('mapAppUsers').doc(userId).update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userData = userDoc.data();
      res.json({
        success: true,
        user: {
          id: userId,
          email: userData?.email,
          name: userData?.name,
          phone: userData?.phone,
          boundDeviceId: userData?.boundDeviceId,
          notificationEnabled: userData?.notificationEnabled,
          isActive: userData?.isActive,
        },
      });

    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid action. Must be "register" or "login"' 
      });
    }

  } catch (error: any) {
    console.error('Error in mapUserAuth:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});
