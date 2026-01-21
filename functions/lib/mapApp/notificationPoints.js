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
exports.removeMapUserNotificationPoint = exports.updateMapUserNotificationPoint = exports.getMapUserNotificationPoints = exports.addMapUserNotificationPoint = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
/**
 * Add Map User Notification Point
 * POST /addMapUserNotificationPoint
 */
exports.addMapUserNotificationPoint = (0, https_1.onRequest)(async (req, res) => {
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
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const authenticatedUserId = decodedToken.uid;
        const body = req.body;
        // Validate request
        if (!body.userId || !body.gatewayId || !body.name) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, gatewayId, name'
            });
            return;
        }
        // Verify user can only add their own notification points
        if (body.userId !== authenticatedUserId) {
            res.status(403).json({
                success: false,
                error: 'Forbidden'
            });
            return;
        }
        const db = admin.firestore();
        // Verify user exists
        const userDoc = await db.collection('mapAppUsers').doc(body.userId).get();
        if (!userDoc.exists) {
            res.status(404).json({ success: false, error: 'User not found' });
            return;
        }
        // Verify gateway exists and is public
        const gatewayDoc = await db.collection('gateways').doc(body.gatewayId).get();
        if (!gatewayDoc.exists) {
            res.status(404).json({ success: false, error: 'Gateway not found' });
            return;
        }
        const gatewayData = gatewayDoc.data();
        if ((gatewayData === null || gatewayData === void 0 ? void 0 : gatewayData.poolType) !== 'PUBLIC') {
            res.status(400).json({
                success: false,
                error: 'Gateway is not in public pool'
            });
            return;
        }
        // Create notification point
        const notificationPoint = {
            mapAppUserId: body.userId,
            gatewayId: body.gatewayId,
            name: body.name,
            notificationMessage: body.notificationMessage || null,
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const docRef = await db.collection('mapUserNotificationPoints').add(notificationPoint);
        res.json({
            success: true,
            notificationPoint: Object.assign(Object.assign({ id: docRef.id }, notificationPoint), { createdAt: new Date().toISOString() }),
        });
    }
    catch (error) {
        console.error('Error in addMapUserNotificationPoint:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
/**
 * Get Map User Notification Points
 * GET /getMapUserNotificationPoints?userId=xxx
 */
exports.getMapUserNotificationPoints = (0, https_1.onRequest)(async (req, res) => {
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
        // Verify user can only access their own notification points
        if (userId !== authenticatedUserId) {
            res.status(403).json({ success: false, error: 'Forbidden' });
            return;
        }
        const db = admin.firestore();
        // Get notification points
        const pointsSnapshot = await db
            .collection('mapUserNotificationPoints')
            .where('mapAppUserId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        const points = await Promise.all(pointsSnapshot.docs.map(async (doc) => {
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
                        latitude: gw === null || gw === void 0 ? void 0 : gw.latitude,
                        longitude: gw === null || gw === void 0 ? void 0 : gw.longitude,
                    };
                }
            }
            return {
                id: doc.id,
                name: data.name,
                gatewayId: data.gatewayId,
                notificationMessage: data.notificationMessage,
                isActive: data.isActive,
                createdAt: (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate().toISOString(),
                gateway: gatewayInfo,
            };
        }));
        res.json({
            success: true,
            notificationPoints: points,
            count: points.length,
        });
    }
    catch (error) {
        console.error('Error in getMapUserNotificationPoints:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
/**
 * Update Map User Notification Point
 * PUT /updateMapUserNotificationPoint
 */
exports.updateMapUserNotificationPoint = (0, https_1.onRequest)(async (req, res) => {
    // CORS handling
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'PUT') {
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
        const body = req.body;
        if (!body.pointId) {
            res.status(400).json({
                success: false,
                error: 'Missing required field: pointId'
            });
            return;
        }
        const db = admin.firestore();
        // Get notification point
        const pointDoc = await db.collection('mapUserNotificationPoints').doc(body.pointId).get();
        if (!pointDoc.exists) {
            res.status(404).json({ success: false, error: 'Notification point not found' });
            return;
        }
        const pointData = pointDoc.data();
        // Verify ownership
        if ((pointData === null || pointData === void 0 ? void 0 : pointData.mapAppUserId) !== authenticatedUserId) {
            res.status(403).json({ success: false, error: 'Forbidden' });
            return;
        }
        // Build update object
        const updateData = {};
        if (body.name !== undefined)
            updateData.name = body.name;
        if (body.notificationMessage !== undefined)
            updateData.notificationMessage = body.notificationMessage;
        if (body.isActive !== undefined)
            updateData.isActive = body.isActive;
        if (Object.keys(updateData).length === 0) {
            res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
            return;
        }
        await db.collection('mapUserNotificationPoints').doc(body.pointId).update(updateData);
        res.json({
            success: true,
            message: 'Notification point updated successfully',
        });
    }
    catch (error) {
        console.error('Error in updateMapUserNotificationPoint:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
/**
 * Remove Map User Notification Point
 * DELETE /removeMapUserNotificationPoint
 */
exports.removeMapUserNotificationPoint = (0, https_1.onRequest)(async (req, res) => {
    // CORS handling
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'DELETE' && req.method !== 'POST') {
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
        const body = req.body;
        if (!body.pointId) {
            res.status(400).json({
                success: false,
                error: 'Missing required field: pointId'
            });
            return;
        }
        const db = admin.firestore();
        // Get notification point
        const pointDoc = await db.collection('mapUserNotificationPoints').doc(body.pointId).get();
        if (!pointDoc.exists) {
            res.status(404).json({ success: false, error: 'Notification point not found' });
            return;
        }
        const pointData = pointDoc.data();
        // Verify ownership
        if ((pointData === null || pointData === void 0 ? void 0 : pointData.mapAppUserId) !== authenticatedUserId) {
            res.status(403).json({ success: false, error: 'Forbidden' });
            return;
        }
        // Delete notification point
        await db.collection('mapUserNotificationPoints').doc(body.pointId).delete();
        res.json({
            success: true,
            message: 'Notification point removed successfully',
        });
    }
    catch (error) {
        console.error('Error in removeMapUserNotificationPoint:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
//# sourceMappingURL=notificationPoints.js.map