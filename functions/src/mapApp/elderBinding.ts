import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

// 標準錯誤碼定義
const ErrorCodes = {
  ELDER_NOT_FOUND: 'ELDER_NOT_FOUND',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_BOUND: 'NOT_BOUND',
} as const;

interface UnbindDeviceFromElderRequest {
  elderId: string;
  deviceId: string;
}

/**
 * Unbind Device from Elder (with Activity Anonymization)
 * POST /unbindDeviceFromElder
 *
 * Request Body:
 * - elderId: string
 * - deviceId: string
 *
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 *
 * 此函數會：
 * 1. 驗證權限（必須是社區管理員）
 * 2. 複製活動記錄到 anonymousActivities
 * 3. 刪除原始活動記錄
 * 4. 解綁設備
 * 5. 更新長者記錄
 */
export const unbindDeviceFromElder = onRequest(async (req, res) => {
  // CORS handling
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: "不支援此請求方法",
      errorCode: ErrorCodes.VALIDATION_ERROR,
    });
    return;
  }

  try {
    // Verify Firebase ID Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "未授權：缺少或無效的認證令牌",
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (tokenError) {
      res.status(401).json({
        success: false,
        error: "未授權：認證令牌無效或已過期",
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
      return;
    }

    const authenticatedUserId = decodedToken.uid;

    const body: UnbindDeviceFromElderRequest = req.body;

    // Validate request
    const validationErrors: Record<string, string> = {};

    if (!body.elderId) {
      validationErrors.elderId = "缺少必填欄位 elderId";
    }
    if (!body.deviceId) {
      validationErrors.deviceId = "缺少必填欄位 deviceId";
    }

    if (Object.keys(validationErrors).length > 0) {
      res.status(400).json({
        success: false,
        error: "參數驗證失敗",
        errorCode: ErrorCodes.VALIDATION_ERROR,
        errorDetails: {
          fields: validationErrors,
        },
      });
      return;
    }

    const db = admin.firestore();

    // Check if elder exists
    const elderDoc = await db.collection("elders").doc(body.elderId).get();
    if (!elderDoc.exists) {
      res.status(404).json({
        success: false,
        error: "長者不存在",
        errorCode: ErrorCodes.ELDER_NOT_FOUND,
      });
      return;
    }

    const elderData = elderDoc.data();
    const tenantId = elderData?.tenantId;

    // Verify permission: must be admin of the elder's tenant
    if (tenantId) {
      const adminDoc = await db
        .collection("admin_users")
        .doc(authenticatedUserId)
        .get();
      const adminData = adminDoc.data();

      const isSuperAdmin = adminData?.role === "SUPER_ADMIN";
      const isTenantAdmin =
        adminData?.role === "TENANT_ADMIN" && adminData?.tenantId === tenantId;

      if (!isSuperAdmin && !isTenantAdmin) {
        res.status(403).json({
          success: false,
          error: "禁止操作：您沒有權限解綁此長者的設備",
          errorCode: ErrorCodes.UNAUTHORIZED,
        });
        return;
      }
    }

    // Check if device exists
    const deviceDoc = await db.collection("devices").doc(body.deviceId).get();
    if (!deviceDoc.exists) {
      res.status(404).json({
        success: false,
        error: "設備不存在",
        errorCode: ErrorCodes.DEVICE_NOT_FOUND,
      });
      return;
    }

    const deviceData = deviceDoc.data();

    // Verify device is bound to this elder
    if (
      deviceData?.bindingType !== "ELDER" ||
      deviceData?.boundTo !== body.elderId
    ) {
      res.status(400).json({
        success: false,
        error: "設備未綁定到此長者",
        errorCode: ErrorCodes.NOT_BOUND,
      });
      return;
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 生成唯一的歸檔批次 ID，用於標記同一次解綁的記錄
    const archiveSessionId = db.collection("_").doc().id;

    // 1. 複製 activities 到全域 anonymousActivities collection，然後刪除原記錄
    const activitiesRef = db
      .collection("devices")
      .doc(body.deviceId)
      .collection("activities");
    const anonymousRef = db.collection("anonymousActivities");

    // 處理函數：複製到匿名 collection 並刪除原記錄
    const archiveAndDeleteActivities = async (
      snapshot: FirebaseFirestore.QuerySnapshot,
    ) => {
      if (snapshot.empty) return;

      const batch = db.batch();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();

        // 複製到全域 anonymousActivities（移除個人識別資訊，保留 deviceId）
        const anonymousDoc = anonymousRef.doc(); // 使用新的自動 ID
        batch.set(anonymousDoc, {
          // 保留統計用欄位（使用 ?? null 避免 undefined 錯誤）
          deviceId: body.deviceId, // 保留設備 ID
          timestamp: data.timestamp ?? null, // 保留活動時間
          gatewayId: data.gatewayId ?? null, // 保留接收器 ID
          gatewayName: data.gatewayName ?? null, // 保留接收器名稱
          gatewayType: data.gatewayType ?? null, // 保留接收器類型
          latitude: data.latitude ?? null, // 保留位置
          longitude: data.longitude ?? null, // 保留位置
          rssi: data.rssi ?? null, // 保留信號強度
          triggeredNotification: data.triggeredNotification ?? false,
          notificationType: data.notificationType ?? null,
          notificationPointId: data.notificationPointId ?? null,
          // 匿名化欄位
          bindingType: "ANONYMOUS", // 標記為匿名
          boundTo: null, // 移除長者關聯
          elderUnbindReason: "MANUAL_UNBIND", // 解綁原因
          // 新增欄位
          anonymizedAt: timestamp, // 記錄匿名化時間
          archiveSessionId: archiveSessionId, // 歸檔批次 ID
          originalActivityId: doc.id, // 保留原始活動 ID（可選，用於追溯）
        });

        // 刪除原記錄
        batch.delete(doc.ref);
      });

      await batch.commit();
    };

    // 處理第一批（最多 500 筆）
    let activitiesSnapshot = await activitiesRef.limit(500).get();
    let totalActivitiesArchived = activitiesSnapshot.size;
    await archiveAndDeleteActivities(activitiesSnapshot);

    // 如果有更多記錄，繼續處理
    while (activitiesSnapshot.size === 500) {
      activitiesSnapshot = await activitiesRef.limit(500).get();
      totalActivitiesArchived += activitiesSnapshot.size;
      await archiveAndDeleteActivities(activitiesSnapshot);
    }

    console.log(
      `Archived and deleted ${totalActivitiesArchived} activities for device ${body.deviceId}`,
    );

    // 2. 解綁設備
    await db.collection("devices").doc(body.deviceId).update({
      bindingType: "UNBOUND",
      boundTo: null,
      boundAt: null,
      updatedAt: timestamp,
    });

    // 3. 更新長者記錄
    await db.collection("elders").doc(body.elderId).update({
      deviceId: null,
      updatedAt: timestamp,
    });

    res.json({
      success: true,
      message: "設備解綁成功",
      activitiesArchived: totalActivitiesArchived,
    });
  } catch (error: any) {
    console.error("Error in unbindDeviceFromElder:", error);
    res.status(500).json({
      success: false,
      error: "伺服器內部錯誤",
      errorCode: ErrorCodes.INTERNAL_ERROR,
    });
  }
});
