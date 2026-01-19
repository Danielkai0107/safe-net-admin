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
exports.assignAlert = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const sendMessage_1 = require("../line/sendMessage");
exports.assignAlert = functions.https.onCall(async (data, context) => {
    try {
        const { alertId, assignedTo, assignedBy } = data;
        if (!alertId || !assignedTo || !assignedBy) {
            throw new functions.https.HttpsError('invalid-argument', '缺少必要參數');
        }
        const db = admin.firestore();
        // 1. 獲取警報資料
        const alertDoc = await db.collection('alerts').doc(alertId).get();
        if (!alertDoc.exists) {
            throw new functions.https.HttpsError('not-found', '找不到警報');
        }
        const alertData = alertDoc.data();
        const alert = Object.assign({ id: alertDoc.id }, alertData);
        const tenantId = alert.tenantId;
        // 2. 驗證分配者是管理員
        console.log('Checking if assignedBy is admin:', assignedBy, 'in tenant:', tenantId);
        const assignerMemberQuery = await db
            .collection('tenants').doc(tenantId)
            .collection('members')
            .where('appUserId', '==', assignedBy)
            .where('status', '==', 'APPROVED')
            .limit(1)
            .get();
        console.log('Found assigner members:', assignerMemberQuery.size);
        if (assignerMemberQuery.empty) {
            throw new functions.https.HttpsError('permission-denied', '找不到您的成員資料');
        }
        const assignerMember = assignerMemberQuery.docs[0].data();
        console.log('Assigner member data:', assignerMember);
        if (assignerMember.role !== 'ADMIN') {
            throw new functions.https.HttpsError('permission-denied', '只有管理員可以分配警報');
        }
        // 3. 獲取被分配成員資料
        const assigneeMemberQuery = await db
            .collection('tenants').doc(tenantId)
            .collection('members')
            .where('appUserId', '==', assignedTo)
            .where('status', '==', 'APPROVED')
            .limit(1)
            .get();
        if (assigneeMemberQuery.empty) {
            throw new functions.https.HttpsError('not-found', '找不到被分配的成員');
        }
        // 4. 獲取被分配者的 App User 資料
        const appUserDoc = await db.collection('appUsers').doc(assignedTo).get();
        if (!appUserDoc.exists) {
            throw new functions.https.HttpsError('not-found', '找不到用戶資料');
        }
        const appUser = appUserDoc.data();
        if (!(appUser === null || appUser === void 0 ? void 0 : appUser.lineUserId)) {
            throw new functions.https.HttpsError('failed-precondition', '該用戶未綁定 LINE 帳號');
        }
        // 5. 獲取社區的 LINE 設定
        const tenantDoc = await db.collection('tenants').doc(tenantId).get();
        const tenant = tenantDoc.data();
        if (!(tenant === null || tenant === void 0 ? void 0 : tenant.lineChannelAccessToken)) {
            throw new functions.https.HttpsError('failed-precondition', '社區尚未設定 LINE Channel Access Token');
        }
        // 6. 獲取長輩資料
        const elderDoc = await db.collection('elders').doc(alert.elderId).get();
        const elder = elderDoc.exists ? elderDoc.data() : null;
        // 7. 更新警報狀態
        await db.collection('alerts').doc(alertId).update({
            assignedTo,
            assignedAt: admin.firestore.FieldValue.serverTimestamp(),
            assignmentStatus: 'PENDING',
            status: 'NOTIFIED',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 8. 發送 LINE 通知
        await (0, sendMessage_1.sendAlertAssignment)(appUser.lineUserId, tenant.lineChannelAccessToken, {
            id: alertId,
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            elderName: (elder === null || elder === void 0 ? void 0 : elder.name) || '未知',
            elderPhone: elder === null || elder === void 0 ? void 0 : elder.phone,
            triggeredAt: alert.triggeredAt,
            latitude: alert.latitude,
            longitude: alert.longitude,
        });
        return {
            success: true,
            message: '警報已分配並發送通知',
        };
    }
    catch (error) {
        console.error('Error in assignAlert:', error);
        throw error;
    }
});
//# sourceMappingURL=assignment.js.map