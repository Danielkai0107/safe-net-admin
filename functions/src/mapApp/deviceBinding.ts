import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

// 標準錯誤碼定義
const ErrorCodes = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  DEVICE_ALREADY_BOUND: 'DEVICE_ALREADY_BOUND',
  NO_BOUND_DEVICE: 'NO_BOUND_DEVICE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
} as const;

interface BindDeviceRequest {
  userId: string;
  deviceId?: string; // 設備 ID（與 deviceName 二選一）
  deviceName?: string; // 產品序號（與 deviceId 二選一）
  avatar?: string; // 用戶頭像（儲存在 mapAppUsers）
  nickname?: string; // 設備暱稱（儲存在 devices）
  age?: number; // 使用者年齡（儲存在 devices）
  gender?: "MALE" | "FEMALE" | "OTHER"; // 使用者性別（儲存在 devices）
}

interface UnbindDeviceRequest {
  userId: string;
}

/**
 * Bind Device to Map App User
 * POST /bindDeviceToMapUser
 *
 * Request Body:
 * - userId: string (必填)
 * - deviceId?: string (設備 ID，與 deviceName 二選一)
 * - deviceName?: string (產品序號，與 deviceName 二選一)
 * - avatar?: string (用戶頭像，儲存在 mapAppUsers)
 * - nickname?: string (設備暱稱，儲存在 devices)
 * - age?: number (使用者年齡，儲存在 devices)
 * - gender?: 'MALE' | 'FEMALE' | 'OTHER' (使用者性別，儲存在 devices)
 *
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 */
export const bindDeviceToMapUser = onRequest(async (req, res) => {
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

    const body: BindDeviceRequest = req.body;

    // Validate request - 必須提供 userId
    if (!body.userId) {
      res.status(400).json({
        success: false,
        error: "參數驗證失敗",
        errorCode: ErrorCodes.VALIDATION_ERROR,
        errorDetails: {
          fields: {
            userId: "缺少必填欄位 userId"
          }
        }
      });
      return;
    }

    // 必須提供 deviceId 或 deviceName 其中之一
    if (!body.deviceId && !body.deviceName) {
      res.status(400).json({
        success: false,
        error: "參數驗證失敗",
        errorCode: ErrorCodes.VALIDATION_ERROR,
        errorDetails: {
          fields: {
            deviceId: "必須提供 deviceId 或 deviceName 其中之一",
            deviceName: "必須提供 deviceId 或 deviceName 其中之一"
          }
        }
      });
      return;
    }

    const db = admin.firestore();

    // Verify user can only bind to their own account (except for admins)
    if (body.userId !== authenticatedUserId) {
      // Check if authenticated user is an admin
      const adminDoc = await db
        .collection("admin_users")
        .doc(authenticatedUserId)
        .get();
      const adminData = adminDoc.data();

      if (
        !adminData ||
        (adminData.role !== "SUPER_ADMIN" && adminData.role !== "TENANT_ADMIN")
      ) {
        res.status(403).json({
          success: false,
          error: "禁止操作：無法為其他用戶綁定設備",
          errorCode: ErrorCodes.UNAUTHORIZED,
        });
        return;
      }
    }

    // Check if user exists
    const userDoc = await db.collection("app_users").doc(body.userId).get();
    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        error: "用戶不存在",
        errorCode: ErrorCodes.USER_NOT_FOUND,
      });
      return;
    }

    // 檢查用戶是否已被刪除標記
    const userData = userDoc.data();
    if (userData?.isDeleted) {
      res.status(410).json({
        success: false,
        error: "帳號已被刪除",
        errorCode: ErrorCodes.ACCOUNT_DELETED,
      });
      return;
    }

    // Find device by deviceId or deviceName
    let deviceDoc: FirebaseFirestore.DocumentSnapshot;
    let actualDeviceId: string;

    if (body.deviceId) {
      // 使用 deviceId 直接查詢
      deviceDoc = await db.collection("devices").doc(body.deviceId).get();
      actualDeviceId = body.deviceId;

      if (!deviceDoc.exists) {
        res.status(404).json({
          success: false,
          error: "設備不存在，請檢查產品序號",
          errorCode: ErrorCodes.DEVICE_NOT_FOUND,
        });
        return;
      }
    } else if (body.deviceName) {
      // 使用 deviceName（產品序號）查詢，轉為大寫以匹配存儲格式
      const normalizedDeviceName = body.deviceName.toUpperCase();
      const deviceQuery = await db
        .collection("devices")
        .where("deviceName", "==", normalizedDeviceName)
        .limit(1)
        .get();

      if (deviceQuery.empty) {
        res.status(404).json({
          success: false,
          error: "設備不存在，請檢查產品序號",
          errorCode: ErrorCodes.DEVICE_NOT_FOUND,
        });
        return;
      }

      deviceDoc = deviceQuery.docs[0];
      actualDeviceId = deviceDoc.id;
    } else {
      res.status(400).json({
        success: false,
        error: "參數驗證失敗",
        errorCode: ErrorCodes.VALIDATION_ERROR,
        errorDetails: {
          fields: {
            deviceId: "必須提供 deviceId 或 deviceName 其中之一",
            deviceName: "必須提供 deviceId 或 deviceName 其中之一"
          }
        }
      });
      return;
    }

    const deviceData = deviceDoc.data();

    // ⚠️ 檢查設備綁定狀態（使用新的 bindingType）
    if (deviceData?.bindingType === "ELDER") {
      res.status(409).json({
        success: false,
        error: "此設備已被其他用戶綁定",
        errorCode: ErrorCodes.DEVICE_ALREADY_BOUND,
      });
      return;
    }

    // Check if device is already bound to another map app user
    if (
      deviceData?.bindingType === "MAP_USER" &&
      deviceData.boundTo !== body.userId
    ) {
      res.status(409).json({
        success: false,
        error: "此設備已被其他用戶綁定",
        errorCode: ErrorCodes.DEVICE_ALREADY_BOUND,
      });
      return;
    }

    // Unbind old device if user already has one
    if (userData?.boundDeviceId && userData.boundDeviceId !== actualDeviceId) {
      await db.collection("devices").doc(userData.boundDeviceId).update({
        bindingType: "UNBOUND",
        boundTo: null,
        boundAt: null,
        mapUserNickname: null,
        mapUserAge: null,
        mapUserGender: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Bind device to user (使用新的資料結構)
    const boundAt = admin.firestore.FieldValue.serverTimestamp();
    
    // 統一通知架構：綁定時同步 FCM token 到設備
    const deviceUpdateData: any = {
      bindingType: "MAP_USER",
      boundTo: body.userId,
      boundAt: boundAt,
      mapUserNickname: body.nickname || null,
      mapUserAge: body.age || null,
      mapUserGender: body.gender || null,
      updatedAt: boundAt,
    };

    // 如果用戶有 FCM token，同步到設備
    if (userData?.fcmToken) {
      deviceUpdateData.fcmToken = userData.fcmToken;
      deviceUpdateData.notificationEnabled = true;
      console.log(`Syncing FCM token to device ${actualDeviceId}`);
    }

    await db
      .collection("devices")
      .doc(actualDeviceId)
      .update(deviceUpdateData);

    // Update user's bound device and avatar
    const userUpdateData: any = {
      boundDeviceId: actualDeviceId,
      updatedAt: boundAt,
    };

    // 如果有提供 avatar，一併更新
    if (body.avatar !== undefined) {
      userUpdateData.avatar = body.avatar;
    }

    await db.collection("app_users").doc(body.userId).update(userUpdateData);

    res.json({
      success: true,
      device: {
        id: actualDeviceId,
        uuid: deviceData?.uuid,
        major: deviceData?.major,
        minor: deviceData?.minor,
        deviceName: deviceData?.deviceName,
        nickname: body.nickname,
        age: body.age,
        gender: body.gender,
      },
      user: {
        avatar: body.avatar,
      },
      boundAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in bindDeviceToMapUser:", error);
    res.status(500).json({
      success: false,
      error: "伺服器內部錯誤",
      errorCode: ErrorCodes.INTERNAL_ERROR,
    });
  }
});

/**
 * Unbind Device from Map App User
 * POST /unbindDeviceFromMapUser
 *
 * Request Body:
 * - userId: string
 *
 * Headers:
 * - Authorization: Bearer {FIREBASE_ID_TOKEN}
 */
export const unbindDeviceFromMapUser = onRequest(async (req, res) => {
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

    const body: UnbindDeviceRequest = req.body;

    // Validate request
    if (!body.userId) {
      res.status(400).json({
        success: false,
        error: "參數驗證失敗",
        errorCode: ErrorCodes.VALIDATION_ERROR,
        errorDetails: {
          fields: {
            userId: "缺少必填欄位 userId"
          }
        }
      });
      return;
    }

    const db = admin.firestore();

    // Verify user can only unbind their own device (except for admins)
    if (body.userId !== authenticatedUserId) {
      // Check if authenticated user is an admin
      const adminDoc = await db
        .collection("admin_users")
        .doc(authenticatedUserId)
        .get();
      const adminData = adminDoc.data();

      if (
        !adminData ||
        (adminData.role !== "SUPER_ADMIN" && adminData.role !== "TENANT_ADMIN")
      ) {
        res.status(403).json({
          success: false,
          error: "禁止操作：無法解綁其他用戶的設備",
          errorCode: ErrorCodes.UNAUTHORIZED,
        });
        return;
      }
    }

    // Check if user exists
    const userDoc = await db.collection("app_users").doc(body.userId).get();
    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        error: "用戶不存在",
        errorCode: ErrorCodes.USER_NOT_FOUND,
      });
      return;
    }

    const userData = userDoc.data();

    // 檢查用戶是否已被刪除標記
    if (userData?.isDeleted) {
      res.status(410).json({
        success: false,
        error: "帳號已被刪除",
        errorCode: ErrorCodes.ACCOUNT_DELETED,
      });
      return;
    }

    if (!userData?.boundDeviceId) {
      res.status(400).json({
        success: false,
        error: "您尚未綁定任何設備",
        errorCode: ErrorCodes.NO_BOUND_DEVICE,
      });
      return;
    }

    const deviceId = userData.boundDeviceId;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 生成唯一的歸檔批次 ID，用於標記同一次解綁的記錄
    const archiveSessionId = db.collection("_").doc().id;

    // 1. 複製 activities 到全域 anonymousActivities collection，然後刪除原記錄
    const activitiesRef = db
      .collection("devices")
      .doc(deviceId)
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
          deviceId: deviceId, // 保留設備 ID
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
          boundTo: null, // 移除用戶關聯
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
    await archiveAndDeleteActivities(activitiesSnapshot);

    // 如果有更多記錄，繼續處理
    while (activitiesSnapshot.size === 500) {
      activitiesSnapshot = await activitiesRef.limit(500).get();
      await archiveAndDeleteActivities(activitiesSnapshot);
    }

    // 2. 統一通知架構：刪除設備的通知點子集合
    const notificationPointsRef = db
      .collection("devices")
      .doc(deviceId)
      .collection("notificationPoints");
    
    const deleteNotificationPoints = async (
      snapshot: FirebaseFirestore.QuerySnapshot,
    ) => {
      if (snapshot.empty) return;

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    };

    // 刪除所有通知點（分批處理）
    let notificationPointsSnapshot = await notificationPointsRef.limit(500).get();
    await deleteNotificationPoints(notificationPointsSnapshot);

    while (notificationPointsSnapshot.size === 500) {
      notificationPointsSnapshot = await notificationPointsRef.limit(500).get();
      await deleteNotificationPoints(notificationPointsSnapshot);
    }

    // 3. Unbind device (使用新的資料結構，清除通知相關欄位)
    await db.collection("devices").doc(deviceId).update({
      bindingType: "UNBOUND",
      boundTo: null,
      boundAt: null,
      mapUserNickname: null,
      mapUserAge: null,
      mapUserGender: null,
      // 統一通知架構：清除通知相關欄位
      fcmToken: null,
      notificationEnabled: null,
      inheritedNotificationPointIds: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Update user (只清空 boundDeviceId)
    await db.collection("app_users").doc(body.userId).update({
      boundDeviceId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: "設備解綁成功",
    });
  } catch (error: any) {
    console.error("Error in unbindDeviceFromMapUser:", error);
    res.status(500).json({
      success: false,
      error: "伺服器內部錯誤",
      errorCode: ErrorCodes.INTERNAL_ERROR,
    });
  }
});
