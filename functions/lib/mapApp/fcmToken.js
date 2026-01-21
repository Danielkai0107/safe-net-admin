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
exports.updateMapUserFcmToken = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
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
exports.updateMapUserFcmToken = (0, https_1.onRequest)(async (req, res) => {
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
        const body = req.body;
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
    }
    catch (error) {
        console.error('Error in updateMapUserFcmToken:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
//# sourceMappingURL=fcmToken.js.map