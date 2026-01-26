import {
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  limit,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * 匿名化設備活動記錄
 * 
 * 將設備的活動記錄複製到 anonymousActivities 集合，然後刪除原始記錄
 * 這確保解綁後的隱私保護，同時保留統計數據
 */
export async function anonymizeDeviceActivities(
  deviceId: string,
  reason: string = "ELDER_UNBIND"
): Promise<number> {
  console.log(`開始匿名化設備 ${deviceId} 的活動記錄...`);

  let totalArchived = 0;

  try {
    // 生成唯一的歸檔批次 ID
    const archiveSessionId = doc(collection(db, "_")).id;
    const anonymizedAt = new Date().toISOString();

    // 處理函數：複製到匿名 collection 並刪除原記錄
    const archiveAndDeleteBatch = async (
      activitiesSnapshot: any
    ): Promise<number> => {
      if (activitiesSnapshot.empty) return 0;

      const batch = writeBatch(db);
      let count = 0;

      activitiesSnapshot.docs.forEach((activityDoc: any) => {
        const data = activityDoc.data();

        // 複製到 anonymousActivities
        const anonymousDoc = doc(collection(db, "anonymousActivities"));
        batch.set(anonymousDoc, {
          // 保留統計用欄位
          deviceId: deviceId,
          timestamp: data.timestamp || null,
          gatewayId: data.gatewayId || null,
          gatewayName: data.gatewayName || null,
          gatewayType: data.gatewayType || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          rssi: data.rssi || null,
          triggeredNotification: data.triggeredNotification || false,
          notificationType: data.notificationType || null,
          notificationPointId: data.notificationPointId || null,
          // 匿名化欄位
          bindingType: "ANONYMOUS",
          boundTo: null,
          anonymizedReason: reason,
          anonymizedAt: anonymizedAt,
          archiveSessionId: archiveSessionId,
          originalActivityId: activityDoc.id,
        });

        // 刪除原記錄
        batch.delete(activityDoc.ref);
        count++;
      });

      await batch.commit();
      return count;
    };

    // 分批處理（每批 500 筆）
    const activitiesRef = collection(db, "devices", deviceId, "activities");
    
    let batchSnapshot = await getDocs(query(activitiesRef, limit(500)));
    let archived = await archiveAndDeleteBatch(batchSnapshot);
    totalArchived += archived;

    // 如果有更多記錄，繼續處理
    while (batchSnapshot.size === 500) {
      batchSnapshot = await getDocs(query(activitiesRef, limit(500)));
      archived = await archiveAndDeleteBatch(batchSnapshot);
      totalArchived += archived;
    }

    console.log(
      `✅ 設備 ${deviceId}: 已匿名化並刪除 ${totalArchived} 筆活動記錄`
    );

    return totalArchived;
  } catch (error) {
    console.error(`❌ 設備 ${deviceId} 匿名化失敗:`, error);
    throw error;
  }
}
