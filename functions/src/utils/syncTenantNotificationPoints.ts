import * as admin from "firebase-admin";

/**
 * 手動同步工具：將社區的通知點同步到所有該社區的設備
 * 
 * 使用場景：
 * 1. 首次部署新架構後，同步現有設備
 * 2. 修復資料不一致的問題
 * 3. 定期維護
 */

interface SyncResult {
  tenantId: string;
  tenantName?: string;
  devicesUpdated: number;
  notificationPoints: number;
  gatewayIds: string[];
}

export async function syncSingleTenant(
  tenantId: string
): Promise<SyncResult> {
  const db = admin.firestore();

  console.log(`\n[${tenantId}] 開始同步社區通知點...`);

  // 1. 查詢社區資訊
  const tenantDoc = await db.collection("tenants").doc(tenantId).get();
  const tenantName = tenantDoc.exists
    ? tenantDoc.data()?.name || "未知社區"
    : "未知社區";

  console.log(`[${tenantId}] 社區名稱: ${tenantName}`);

  // 2. 查詢該社區的所有啟用通知點
  const notificationPointsSnapshot = await db
    .collection("tenantNotificationPoints")
    .where("tenantId", "==", tenantId)
    .where("isActive", "==", true)
    .get();

  const gatewayIds = notificationPointsSnapshot.docs.map(
    (doc) => doc.data().gatewayId as string
  );

  console.log(
    `[${tenantId}] 找到 ${gatewayIds.length} 個啟用的通知點: ${gatewayIds.join(", ")}`
  );

  // 3. 查詢該社區的所有設備（使用 tags）
  const devicesSnapshot = await db
    .collection("devices")
    .where("tags", "array-contains", tenantId)
    .get();

  console.log(`[${tenantId}] 找到 ${devicesSnapshot.docs.length} 個設備`);

  // 4. 批量更新所有設備的 inheritedNotificationPointIds
  const batch = db.batch();
  let updateCount = 0;

  devicesSnapshot.docs.forEach((deviceDoc) => {
    const deviceData = deviceDoc.data();
    const currentIds = deviceData.inheritedNotificationPointIds || [];

    // 檢查是否需要更新（避免不必要的寫入）
    const needsUpdate =
      gatewayIds.length !== currentIds.length ||
      !gatewayIds.every((id) => currentIds.includes(id));

    if (needsUpdate) {
      batch.update(deviceDoc.ref, {
        inheritedNotificationPointIds:
          gatewayIds.length > 0 ? gatewayIds : admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      updateCount++;
      console.log(
        `[${tenantId}] 更新設備 ${deviceDoc.id}: ${currentIds.length} → ${gatewayIds.length} 個通知點`
      );
    }
  });

  if (updateCount > 0) {
    await batch.commit();
    console.log(`[${tenantId}] ✅ 成功更新 ${updateCount} 個設備`);
  } else {
    console.log(`[${tenantId}] ⏭️  所有設備已是最新狀態，無需更新`);
  }

  return {
    tenantId,
    tenantName,
    devicesUpdated: updateCount,
    notificationPoints: gatewayIds.length,
    gatewayIds,
  };
}

export async function syncAllTenants(): Promise<SyncResult[]> {
  const db = admin.firestore();

  console.log("\n========================================");
  console.log("開始同步所有社區的通知點到設備");
  console.log("========================================\n");

  // 查詢所有啟用的社區
  const tenantsSnapshot = await db
    .collection("tenants")
    .where("isActive", "==", true)
    .get();

  console.log(`找到 ${tenantsSnapshot.docs.length} 個啟用的社區\n`);

  const results: SyncResult[] = [];

  for (const tenantDoc of tenantsSnapshot.docs) {
    try {
      const result = await syncSingleTenant(tenantDoc.id);
      results.push(result);
    } catch (error) {
      console.error(`[${tenantDoc.id}] ❌ 同步失敗:`, error);
      results.push({
        tenantId: tenantDoc.id,
        devicesUpdated: 0,
        notificationPoints: 0,
        gatewayIds: [],
      });
    }
  }

  // 總結
  console.log("\n========================================");
  console.log("同步完成");
  console.log("========================================");

  const totalDevicesUpdated = results.reduce(
    (sum, r) => sum + r.devicesUpdated,
    0
  );
  const tenantsWithPoints = results.filter((r) => r.notificationPoints > 0);

  console.log(`\n總計：`);
  console.log(`  - 處理社區: ${results.length}`);
  console.log(`  - 有通知點的社區: ${tenantsWithPoints.length}`);
  console.log(`  - 更新設備: ${totalDevicesUpdated}`);

  console.log(`\n詳細結果：`);
  results.forEach((result) => {
    if (result.devicesUpdated > 0 || result.notificationPoints > 0) {
      console.log(
        `  ${result.tenantName || result.tenantId}: ${result.devicesUpdated} 設備, ${result.notificationPoints} 通知點`
      );
    }
  });

  console.log("\n========================================\n");

  return results;
}

// 如果直接執行此腳本
if (require.main === module) {
  // 初始化 Firebase Admin（如果尚未初始化）
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const tenantId = process.argv[2]; // 從命令列參數取得 tenantId

  if (tenantId) {
    // 同步單一社區
    console.log(`同步單一社區: ${tenantId}`);
    syncSingleTenant(tenantId)
      .then((result) => {
        console.log("\n同步完成:", result);
        process.exit(0);
      })
      .catch((error) => {
        console.error("同步失敗:", error);
        process.exit(1);
      });
  } else {
    // 同步所有社區
    syncAllTenants()
      .then(() => {
        console.log("所有社區同步完成");
        process.exit(0);
      })
      .catch((error) => {
        console.error("同步失敗:", error);
        process.exit(1);
      });
  }
}
