import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendNotification } from '../line/sendMessage';

interface CompleteAlertData {
  alertId: string;
  memberId: string;  // appUser ID
  resolution?: string;
}

// 標記警報已完成
export const completeAlert = functions.https.onCall(async (data: CompleteAlertData, context) => {
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
    const tenantId = alert?.tenantId;

    // 2. 驗證是否為被分配者
    if (alert?.assignedTo !== memberId) {
      throw new functions.https.HttpsError('permission-denied', '您不是此警報的處理人員');
    }

    // 3. 驗證分配狀態必須是 ACCEPTED
    if (alert?.assignmentStatus !== 'ACCEPTED') {
      throw new functions.https.HttpsError('failed-precondition', '只有已接受的警報才能標記完成');
    }

    // 4. 獲取成員資料
    const memberDoc = await db.collection('appUsers').doc(memberId).get();
    const memberName = memberDoc.exists ? memberDoc.data()?.name : '成員';

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

      if (tenant?.lineChannelAccessToken) {
        // 獲取所有管理員
        const adminsQuery = await db
          .collection('tenants').doc(tenantId)
          .collection('members')
          .where('role', '==', 'ADMIN')
          .where('status', '==', 'APPROVED')
          .get();

        // 獲取長輩資料
        const elderDoc = alert?.elderId ? await db.collection('elders').doc(alert.elderId).get() : null;
        const elderName = elderDoc?.exists ? elderDoc.data()?.name : '未知';

        // 通知所有管理員
        const notificationPromises = adminsQuery.docs.map(async (doc) => {
          const adminData = doc.data();
          const adminUserDoc = await db.collection('appUsers').doc(adminData.appUserId).get();
          const adminUser = adminUserDoc.data();

          if (adminUser?.lineUserId) {
            const message = `✅ 警報已完成\n\n${memberName} 已完成處理警報\n\n警報：${alert?.title}\n長輩：${elderName}\n${resolution ? `處理說明：${resolution}` : ''}`;
            
            await sendNotification(
              adminUser.lineUserId,
              tenant.lineChannelAccessToken,
              message
            );
          }
        });

        await Promise.all(notificationPromises);
      }
    }

    return {
      success: true,
      message: '警報已標記為完成',
    };
  } catch (error: any) {
    console.error('Error in completeAlert:', error);
    throw error;
  }
});
