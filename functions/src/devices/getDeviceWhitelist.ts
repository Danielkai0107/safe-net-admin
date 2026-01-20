import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

interface DeviceWhitelistItem {
  uuid: string;          // 服務識別碼（必填）
  major: number;         // 群組編號（必填）
  minor: number;         // 設備編號（必填）
  deviceName?: string;   // 設備名稱（選填）
  macAddress?: string;   // MAC 地址（選填，不用於識別）
}

interface WhitelistResponse {
  success: boolean;
  devices: DeviceWhitelistItem[];
  count: number;
  timestamp: number;
  error?: string;
}

/**
 * Get Device Whitelist
 * 
 * Returns a list of ALL active devices in the system.
 * Used by Android receiver apps to filter which beacons to upload.
 * 
 * **重要：設備識別方式**
 * - 主要識別：UUID + Major + Minor 組合
 * - macAddress 僅供參考，不用於識別（會隨機變化）
 * 
 * No authentication required - public endpoint.
 */
export const getDeviceWhitelist = onRequest(
  {
    cors: true, // Enable CORS for all origins
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    // Support both GET and POST requests
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({
        success: false,
        devices: [],
        count: 0,
        timestamp: Date.now(),
        error: 'Method not allowed. Use GET or POST.',
      });
      return;
    }

    try {
      console.log('Fetching global device whitelist');

      const db = admin.firestore();

      // Get ALL active devices across all tenants
      const devicesQuery = await db
        .collection('devices')
        .where('isActive', '==', true)
        .get();

      console.log(`Found ${devicesQuery.docs.length} active devices`);

      // Format device list
      const devices: DeviceWhitelistItem[] = devicesQuery.docs
        .map(doc => {
          const data = doc.data();
          return {
            uuid: data.uuid || '',
            major: data.major ?? 0,
            minor: data.minor ?? 0,
            deviceName: data.deviceName,
            macAddress: data.macAddress,
          };
        })
        .filter(device => {
          // 必須有 UUID 且 Major/Minor 有效
          return device.uuid && 
                 device.major !== null && 
                 device.minor !== null;
        });

      console.log(`Returning ${devices.length} devices with valid UUID+Major+Minor`);

      // Return response
      const response: WhitelistResponse = {
        success: true,
        devices: devices,
        count: devices.length,
        timestamp: Date.now(),
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error in getDeviceWhitelist:', error);
      res.status(500).json({
        success: false,
        devices: [],
        count: 0,
        timestamp: Date.now(),
        error: 'Internal server error',
      });
    }
  }
);
