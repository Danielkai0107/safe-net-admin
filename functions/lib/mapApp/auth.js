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
exports.mapUserAuth = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
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
exports.mapUserAuth = (0, https_1.onRequest)(async (req, res) => {
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
        const body = req.body;
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
        }
        else if (body.action === 'login') {
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
                    email: userData === null || userData === void 0 ? void 0 : userData.email,
                    name: userData === null || userData === void 0 ? void 0 : userData.name,
                    phone: userData === null || userData === void 0 ? void 0 : userData.phone,
                    boundDeviceId: userData === null || userData === void 0 ? void 0 : userData.boundDeviceId,
                    notificationEnabled: userData === null || userData === void 0 ? void 0 : userData.notificationEnabled,
                    isActive: userData === null || userData === void 0 ? void 0 : userData.isActive,
                },
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Invalid action. Must be "register" or "login"'
            });
        }
    }
    catch (error) {
        console.error('Error in mapUserAuth:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
//# sourceMappingURL=auth.js.map