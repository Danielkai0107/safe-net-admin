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
exports.getMapUserActivities = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
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
exports.getMapUserActivities = (0, https_1.onRequest)(async (req, res) => {
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
        const userId = req.query.userId;
        const startTimeStr = req.query.startTime;
        const endTimeStr = req.query.endTime;
        const limitStr = req.query.limit;
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
            query = query.where('timestamp', '>=', startTime);
        }
        if (endTimeStr) {
            const endTime = admin.firestore.Timestamp.fromMillis(parseInt(endTimeStr));
            query = query.where('timestamp', '<=', endTime);
        }
        query = query.limit(limit);
        // Execute query
        const activitiesSnapshot = await query.get();
        // Fetch gateway details for each activity
        const activities = await Promise.all(activitiesSnapshot.docs.map(async (doc) => {
            var _a;
            const data = doc.data();
            // Get gateway info
            let gatewayInfo = null;
            if (data.gatewayId) {
                const gatewayDoc = await db.collection('gateways').doc(data.gatewayId).get();
                if (gatewayDoc.exists) {
                    const gw = gatewayDoc.data();
                    gatewayInfo = {
                        id: gatewayDoc.id,
                        name: gw === null || gw === void 0 ? void 0 : gw.name,
                        location: gw === null || gw === void 0 ? void 0 : gw.location,
                        type: gw === null || gw === void 0 ? void 0 : gw.type,
                    };
                }
            }
            return {
                id: doc.id,
                deviceId: data.deviceId,
                gatewayId: data.gatewayId,
                gatewayName: (gatewayInfo === null || gatewayInfo === void 0 ? void 0 : gatewayInfo.name) || 'Unknown',
                gatewayLocation: gatewayInfo === null || gatewayInfo === void 0 ? void 0 : gatewayInfo.location,
                timestamp: (_a = data.timestamp) === null || _a === void 0 ? void 0 : _a.toDate().toISOString(),
                rssi: data.rssi,
                latitude: data.latitude,
                longitude: data.longitude,
                triggeredNotification: data.triggeredNotification || false,
                notificationPointId: data.notificationPointId,
            };
        }));
        res.json({
            success: true,
            activities: activities,
            count: activities.length,
            timestamp: Date.now(),
        });
    }
    catch (error) {
        console.error('Error in getMapUserActivities:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
//# sourceMappingURL=activities.js.map