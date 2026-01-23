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
exports.getMapUserProfile = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
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
exports.getMapUserProfile = (0, https_1.onRequest)(async (req, res) => {
    var _a, _b, _c;
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
            email: (userData === null || userData === void 0 ? void 0 : userData.email) || null,
            name: (userData === null || userData === void 0 ? void 0 : userData.name) || 'Unknown User',
            phone: (userData === null || userData === void 0 ? void 0 : userData.phone) || null,
            avatar: (userData === null || userData === void 0 ? void 0 : userData.avatar) || null,
            notificationEnabled: (_a = userData === null || userData === void 0 ? void 0 : userData.notificationEnabled) !== null && _a !== void 0 ? _a : true,
        };
        // 3. Get bound device details (if any)
        let boundDevice = null;
        if (userData === null || userData === void 0 ? void 0 : userData.boundDeviceId) {
            const deviceDoc = await db.collection('devices').doc(userData.boundDeviceId).get();
            if (deviceDoc.exists) {
                const deviceData = deviceDoc.data();
                boundDevice = {
                    id: userData.boundDeviceId,
                    deviceName: (deviceData === null || deviceData === void 0 ? void 0 : deviceData.deviceName) || `${deviceData === null || deviceData === void 0 ? void 0 : deviceData.major}-${deviceData === null || deviceData === void 0 ? void 0 : deviceData.minor}`,
                    nickname: (deviceData === null || deviceData === void 0 ? void 0 : deviceData.mapUserNickname) || null, // 從 Device 取得
                    age: (deviceData === null || deviceData === void 0 ? void 0 : deviceData.mapUserAge) || null, // 從 Device 取得
                    uuid: deviceData === null || deviceData === void 0 ? void 0 : deviceData.uuid,
                    major: deviceData === null || deviceData === void 0 ? void 0 : deviceData.major,
                    minor: deviceData === null || deviceData === void 0 ? void 0 : deviceData.minor,
                    boundAt: ((_c = (_b = deviceData === null || deviceData === void 0 ? void 0 : deviceData.boundAt) === null || _b === void 0 ? void 0 : _b.toDate) === null || _c === void 0 ? void 0 : _c.call(_b)) ? deviceData.boundAt.toDate().toISOString() : null, // 從 Device 取得
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
        const notificationPoints = await Promise.all(notifPointsSnapshot.docs.map(async (doc) => {
            var _a, _b;
            const pointData = doc.data();
            // Get gateway info
            let gatewayInfo = null;
            if (pointData.gatewayId) {
                const gatewayDoc = await db.collection('gateways').doc(pointData.gatewayId).get();
                if (gatewayDoc.exists) {
                    const gw = gatewayDoc.data();
                    gatewayInfo = {
                        name: (gw === null || gw === void 0 ? void 0 : gw.name) || 'Unknown Gateway',
                        location: (gw === null || gw === void 0 ? void 0 : gw.location) || null,
                        latitude: (gw === null || gw === void 0 ? void 0 : gw.latitude) || null,
                        longitude: (gw === null || gw === void 0 ? void 0 : gw.longitude) || null,
                    };
                }
            }
            return {
                id: doc.id,
                name: pointData.name,
                gatewayId: pointData.gatewayId,
                notificationMessage: pointData.notificationMessage || null,
                isActive: pointData.isActive,
                createdAt: ((_b = (_a = pointData.createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
                gateway: gatewayInfo,
            };
        }));
        // 5. Return complete profile
        res.json({
            success: true,
            user: userInfo,
            boundDevice: boundDevice,
            notificationPoints: notificationPoints,
            timestamp: Date.now(),
        });
    }
    catch (error) {
        console.error('Error in getMapUserProfile:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
//# sourceMappingURL=userProfile.js.map