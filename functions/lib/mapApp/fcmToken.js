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
// 標準錯誤碼定義
const ErrorCodes = {
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    ACCOUNT_DELETED: 'ACCOUNT_DELETED',
};
/**
 * Update Map App User FCM Token
 * POST /updateMapUserFcmToken
 *
 * Request Body:
 * - userId: string
 * - fcmToken: string
 * - deviceId?: string (可選，優先使用；若未提供則從 app_users.boundDeviceId 查找)
 *
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 *
 * 更新策略（統一通知架構）：
 * 1. 更新 app_users.fcmToken（向後相容）
 * 2. 若用戶有綁定設備，同時更新 devices.fcmToken
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
        res.status(405).json({
            success: false,
            error: '不支援此請求方法',
            errorCode: ErrorCodes.VALIDATION_ERROR,
        });
        return;
    }
    try {
        // Verify Firebase ID Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: '未授權：缺少或無效的認證令牌',
                errorCode: ErrorCodes.UNAUTHORIZED,
            });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        }
        catch (tokenError) {
            res.status(401).json({
                success: false,
                error: '未授權：認證令牌無效或已過期',
                errorCode: ErrorCodes.UNAUTHORIZED,
            });
            return;
        }
        const authenticatedUserId = decodedToken.uid;
        const body = req.body;
        // Validate request
        const validationErrors = {};
        if (!body.userId) {
            validationErrors.userId = '缺少必填欄位 userId';
        }
        if (!body.fcmToken) {
            validationErrors.fcmToken = '缺少必填欄位 fcmToken';
        }
        if (Object.keys(validationErrors).length > 0) {
            res.status(400).json({
                success: false,
                error: '參數驗證失敗',
                errorCode: ErrorCodes.VALIDATION_ERROR,
                errorDetails: {
                    fields: validationErrors
                }
            });
            return;
        }
        // Verify user can only update their own token
        if (body.userId !== authenticatedUserId) {
            res.status(403).json({
                success: false,
                error: '禁止操作：無法更新其他用戶的 FCM token',
                errorCode: ErrorCodes.UNAUTHORIZED,
            });
            return;
        }
        const db = admin.firestore();
        const userRef = db.collection('app_users').doc(body.userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            res.status(404).json({
                success: false,
                error: '帳號不存在或已被刪除',
                errorCode: ErrorCodes.USER_NOT_FOUND,
            });
            return;
        }
        const userData = userDoc.data();
        // 檢查用戶是否已被刪除標記
        if (userData === null || userData === void 0 ? void 0 : userData.isDeleted) {
            res.status(410).json({
                success: false,
                error: '帳號已被刪除',
                errorCode: ErrorCodes.ACCOUNT_DELETED,
            });
            return;
        }
        // Update FCM token in app_users (向後相容)
        await userRef.update({
            fcmToken: body.fcmToken,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 統一通知架構：同時更新設備的 FCM token
        let deviceId = body.deviceId;
        // 如果沒有提供 deviceId，從 app_users.boundDeviceId 查找
        if (!deviceId && (userData === null || userData === void 0 ? void 0 : userData.boundDeviceId)) {
            deviceId = userData.boundDeviceId;
        }
        if (deviceId) {
            const deviceRef = db.collection('devices').doc(deviceId);
            const deviceDoc = await deviceRef.get();
            if (deviceDoc.exists) {
                const deviceData = deviceDoc.data();
                // 驗證設備綁定到此用戶
                if ((deviceData === null || deviceData === void 0 ? void 0 : deviceData.bindingType) === 'MAP_USER' && (deviceData === null || deviceData === void 0 ? void 0 : deviceData.boundTo) === body.userId) {
                    await deviceRef.update({
                        fcmToken: body.fcmToken,
                        notificationEnabled: true,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    console.log(`Updated FCM token for device ${deviceId}`);
                }
                else {
                    console.warn(`Device ${deviceId} is not bound to user ${body.userId}, skipping device token update`);
                }
            }
            else {
                console.warn(`Device ${deviceId} not found, skipping device token update`);
            }
        }
        res.json({
            success: true,
            message: 'FCM token 更新成功',
            deviceUpdated: !!deviceId,
        });
    }
    catch (error) {
        console.error('Error in updateMapUserFcmToken:', error);
        res.status(500).json({
            success: false,
            error: '伺服器內部錯誤',
            errorCode: ErrorCodes.INTERNAL_ERROR,
        });
    }
});
//# sourceMappingURL=fcmToken.js.map