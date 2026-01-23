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
exports.updateMapUserDevice = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
/**
 * Update Map App User Device Information
 * POST /updateMapUserDevice
 *
 * Request Body:
 * - userId: string (必填)
 * - avatar?: string (選填) - 用戶頭像檔名 (例如：01.png)
 * - nickname?: string (選填) - 設備暱稱
 * - age?: number (選填) - 使用者年齡
 * - gender?: 'MALE' | 'FEMALE' | 'OTHER' (選填) - 使用者性別
 *
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 */
exports.updateMapUserDevice = (0, https_1.onRequest)(async (req, res) => {
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
        // 1. 驗證 Firebase ID Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token' });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const authenticatedUserId = decodedToken.uid;
        const body = req.body;
        // 2. 驗證必填欄位
        if (!body.userId) {
            res.status(400).json({
                success: false,
                error: 'Missing required field: userId'
            });
            return;
        }
        // 3. 驗證權限（用戶只能更新自己的資料，管理員除外）
        if (body.userId !== authenticatedUserId) {
            const adminDoc = await admin.firestore().collection('users').doc(authenticatedUserId).get();
            const adminData = adminDoc.data();
            if (!adminData || (adminData.role !== 'SUPER_ADMIN' && adminData.role !== 'TENANT_ADMIN')) {
                res.status(403).json({
                    success: false,
                    error: 'Forbidden: Cannot update another user\'s device'
                });
                return;
            }
        }
        const db = admin.firestore();
        // 4. 查詢用戶
        const userDoc = await db.collection('mapAppUsers').doc(body.userId).get();
        if (!userDoc.exists) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        const userData = userDoc.data();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        // 5. 更新用戶頭像（如果有提供）
        if (body.avatar !== undefined) {
            await db.collection('mapAppUsers').doc(body.userId).update({
                avatar: body.avatar,
                updatedAt: timestamp,
            });
        }
        // 6. 更新設備資訊（如果有綁定設備且有提供設備相關欄位）
        if ((userData === null || userData === void 0 ? void 0 : userData.boundDeviceId) && (body.nickname !== undefined || body.age !== undefined || body.gender !== undefined)) {
            const deviceUpdateData = {
                updatedAt: timestamp,
            };
            if (body.nickname !== undefined) {
                deviceUpdateData.mapUserNickname = body.nickname;
            }
            if (body.age !== undefined) {
                deviceUpdateData.mapUserAge = body.age;
            }
            if (body.gender !== undefined) {
                deviceUpdateData.mapUserGender = body.gender;
            }
            await db.collection('devices').doc(userData.boundDeviceId).update(deviceUpdateData);
        }
        res.json({
            success: true,
            message: '設備資訊已更新',
            updated: {
                avatar: body.avatar !== undefined,
                nickname: body.nickname !== undefined && !!(userData === null || userData === void 0 ? void 0 : userData.boundDeviceId),
                age: body.age !== undefined && !!(userData === null || userData === void 0 ? void 0 : userData.boundDeviceId),
                gender: body.gender !== undefined && !!(userData === null || userData === void 0 ? void 0 : userData.boundDeviceId),
            }
        });
    }
    catch (error) {
        console.error('Error in updateMapUserDevice:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
//# sourceMappingURL=deviceUpdate.js.map