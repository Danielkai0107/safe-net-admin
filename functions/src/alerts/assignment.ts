import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendAlertAssignment } from '../line/sendMessage';

interface AssignAlertData {
  alertId: string;
  assignedTo: string;  // appUser ID
  assignedBy: string;  // appUser ID (管理員)
}

export const assignAlert = functions.https.onCall(async (data: AssignAlertData, context) => {
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
    const alert = { id: alertDoc.id, ...alertData } as any;
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
    if (!appUser?.lineUserId) {
      throw new functions.https.HttpsError('failed-precondition', '該用戶未綁定 LINE 帳號');
    }

    // 5. 獲取社區的 LINE 設定
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    const tenant = tenantDoc.data();
    
    if (!tenant?.lineChannelAccessToken) {
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
    await sendAlertAssignment(
      appUser.lineUserId,
      tenant.lineChannelAccessToken,
      {
        id: alertId,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        elderName: elder?.name || '未知',
        elderPhone: elder?.phone,
        triggeredAt: alert.triggeredAt,
        latitude: alert.latitude,
        longitude: alert.longitude,
      }
    );

    return {
      success: true,
      message: '警報已分配並發送通知',
    };
  } catch (error: any) {
    console.error('Error in assignAlert:', error);
    throw error;
  }
});
