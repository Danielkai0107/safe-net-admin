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
exports.completeAlert = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const sendMessage_1 = require("../line/sendMessage");
// 標記警報已完成
exports.completeAlert = functions.https.onCall(async (data, context) => {
    var _a, _b;
    try {
        const { alertId, memberId, resolution } = data;
        if (!alertId || !memberId) {
            throw new functions.https.HttpsError('invalid-argument', '缺少必要參數');
        }
        const db = admin.firestore();
        // 1. 獲取警報資料
        const alertDoc = await db.collection('alerts').doc(alertId).get();
        if (!alertDoc.exists) {
            throw new functions.https.HttpsError('not-found', '找不到警報');
        }
        const alert = alertDoc.data();
        const tenantId = alert === null || alert === void 0 ? void 0 : alert.tenantId;
        // 2. 驗證是否為被分配者
        if ((alert === null || alert === void 0 ? void 0 : alert.assignedTo) !== memberId) {
            throw new functions.https.HttpsError('permission-denied', '您不是此警報的處理人員');
        }
        // 3. 驗證分配狀態必須是 ACCEPTED
        if ((alert === null || alert === void 0 ? void 0 : alert.assignmentStatus) !== 'ACCEPTED') {
            throw new functions.https.HttpsError('failed-precondition', '只有已接受的警報才能標記完成');
        }
        // 4. 獲取成員資料
        const memberDoc = await db.collection('appUsers').doc(memberId).get();
        const memberName = memberDoc.exists ? (_a = memberDoc.data()) === null || _a === void 0 ? void 0 : _a.name : '成員';
        // 5. 更新警報狀態為已解決
        await db.collection('alerts').doc(alertId).update({
            status: 'RESOLVED',
            resolvedBy: memberId,
            resolution: resolution || `由 ${memberName} 處理完成`,
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 6. 通知管理員任務已完成（可選）
        if (tenantId) {
            const tenantDoc = await db.collection('tenants').doc(tenantId).get();
            const tenant = tenantDoc.data();
            if (tenant === null || tenant === void 0 ? void 0 : tenant.lineChannelAccessToken) {
                // 獲取所有管理員
                const adminsQuery = await db
                    .collection('tenants').doc(tenantId)
                    .collection('members')
                    .where('role', '==', 'ADMIN')
                    .where('status', '==', 'APPROVED')
                    .get();
                // 獲取長輩資料
                const elderDoc = (alert === null || alert === void 0 ? void 0 : alert.elderId) ? await db.collection('elders').doc(alert.elderId).get() : null;
                const elderName = (elderDoc === null || elderDoc === void 0 ? void 0 : elderDoc.exists) ? (_b = elderDoc.data()) === null || _b === void 0 ? void 0 : _b.name : '未知';
                // 通知所有管理員
                const notificationPromises = adminsQuery.docs.map(async (doc) => {
                    const adminData = doc.data();
                    const adminUserDoc = await db.collection('appUsers').doc(adminData.appUserId).get();
                    const adminUser = adminUserDoc.data();
                    if (adminUser === null || adminUser === void 0 ? void 0 : adminUser.lineUserId) {
                        const message = `✅ 警報已完成\n\n${memberName} 已完成處理警報\n\n警報：${alert === null || alert === void 0 ? void 0 : alert.title}\n長輩：${elderName}\n${resolution ? `處理說明：${resolution}` : ''}`;
                        await (0, sendMessage_1.sendNotification)(adminUser.lineUserId, tenant.lineChannelAccessToken, message);
                    }
                });
                await Promise.all(notificationPromises);
            }
        }
        return {
            success: true,
            message: '警報已標記為完成',
        };
    }
    catch (error) {
        console.error('Error in completeAlert:', error);
        throw error;
    }
});
//# sourceMappingURL=completion.js.map