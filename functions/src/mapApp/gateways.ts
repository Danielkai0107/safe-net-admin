import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

/**
 * Get Public Gateways
 * GET /getPublicGateways
 * 
 * Returns all active gateways (including tenant gateways)
 * For map app users, all gateways form the safety network
 * No authentication required (public data)
 */
export const getPublicGateways = onRequest(async (req, res) => {
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
    const db = admin.firestore();

    // Query all active gateways (including both public and tenant gateways)
    // All gateways form the safety network for map app users
    const gatewaysSnapshot = await db
      .collection('gateways')
      .where('isActive', '==', true)
      .get();

    const gateways = gatewaysSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        type: data.type,
        serialNumber: data.serialNumber,
        tenantId: data.tenantId || null,  // Include tenant info for reference
        poolType: data.poolType || 'TENANT',  // Default to TENANT if not set
      };
    });

    res.json({
      success: true,
      gateways: gateways,
      count: gateways.length,
      timestamp: Date.now(),
    });

  } catch (error: any) {
    console.error('Error in getPublicGateways:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});
