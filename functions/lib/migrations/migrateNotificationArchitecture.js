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
exports.migrateNotificationArchitecture = migrateNotificationArchitecture;
const admin = __importStar(require("firebase-admin"));
async function migrateNotificationArchitecture(dryRun = true) {
    const db = admin.firestore();
    const stats = {
        fcmTokensMigrated: 0,
        fcmTokensSkipped: 0,
        notificationPointsMigrated: 0,
        notificationPointsSkipped: 0,
        inheritedPointsSet: 0,
        errors: [],
    };
    console.log(`\n========================================`);
    console.log(`統一通知架構資料遷移`);
    console.log(`模式: ${dryRun ? "DRY RUN（不會實際寫入）" : "LIVE（實際寫入）"}`);
    console.log(`========================================\n`);
    // ========================================
    // 1. 遷移 FCM Token
    // ========================================
    console.log("步驟 1：遷移 FCM Token from app_users to devices...");
    try {
        // 查詢所有 bindingType = "MAP_USER" 的設備
        const devicesSnapshot = await db
            .collection("devices")
            .where("bindingType", "==", "MAP_USER")
            .get();
        console.log(`找到 ${devicesSnapshot.size} 個已綁定的 MAP_USER 設備\n`);
        for (const deviceDoc of devicesSnapshot.docs) {
            const deviceData = deviceDoc.data();
            const deviceId = deviceDoc.id;
            const mapAppUserId = deviceData.boundTo;
            if (!mapAppUserId) {
                console.log(`⚠️  設備 ${deviceId}: boundTo 為空，跳過`);
                stats.fcmTokensSkipped++;
                continue;
            }
            // 如果設備已有 fcmToken，跳過
            if (deviceData.fcmToken) {
                console.log(`⏭️  設備 ${deviceId}: 已有 fcmToken，跳過`);
                stats.fcmTokensSkipped++;
                continue;
            }
            // 從 app_users 取得 fcmToken
            const userDoc = await db.collection("app_users").doc(mapAppUserId).get();
            if (!userDoc.exists) {
                console.log(`⚠️  設備 ${deviceId}: 用戶 ${mapAppUserId} 不存在，跳過`);
                stats.fcmTokensSkipped++;
                continue;
            }
            const userData = userDoc.data();
            if (!(userData === null || userData === void 0 ? void 0 : userData.fcmToken)) {
                console.log(`⏭️  設備 ${deviceId}: 用戶 ${mapAppUserId} 沒有 fcmToken，跳過`);
                stats.fcmTokensSkipped++;
                continue;
            }
            // 遷移 fcmToken
            const updateData = {
                fcmToken: userData.fcmToken,
                notificationEnabled: userData.notificationEnabled !== false,
            };
            if (!dryRun) {
                await deviceDoc.ref.update(updateData);
            }
            console.log(`✅ 設備 ${deviceId}: 遷移 fcmToken 成功`);
            stats.fcmTokensMigrated++;
        }
    }
    catch (error) {
        const errorMsg = `步驟 1 錯誤: ${error}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
    }
    console.log(`\n步驟 1 完成：`);
    console.log(`  - 已遷移: ${stats.fcmTokensMigrated}`);
    console.log(`  - 已跳過: ${stats.fcmTokensSkipped}\n`);
    // ========================================
    // 2. 遷移 App 用戶通知點
    // ========================================
    console.log("步驟 2：遷移 appUserNotificationPoints to devices/{deviceId}/notificationPoints...");
    try {
        const notificationPointsSnapshot = await db
            .collection("appUserNotificationPoints")
            .get();
        console.log(`找到 ${notificationPointsSnapshot.size} 個 App 用戶通知點\n`);
        for (const pointDoc of notificationPointsSnapshot.docs) {
            const pointData = pointDoc.data();
            const pointId = pointDoc.id;
            const mapAppUserId = pointData.mapAppUserId;
            if (!mapAppUserId) {
                console.log(`⚠️  通知點 ${pointId}: mapAppUserId 為空，跳過`);
                stats.notificationPointsSkipped++;
                continue;
            }
            // 找到對應的設備
            const deviceQuery = await db
                .collection("devices")
                .where("bindingType", "==", "MAP_USER")
                .where("boundTo", "==", mapAppUserId)
                .limit(1)
                .get();
            if (deviceQuery.empty) {
                console.log(`⚠️  通知點 ${pointId}: 用戶 ${mapAppUserId} 沒有綁定設備，跳過`);
                stats.notificationPointsSkipped++;
                continue;
            }
            const deviceDoc = deviceQuery.docs[0];
            const deviceId = deviceDoc.id;
            // 檢查子集合中是否已存在相同 gatewayId 的通知點
            const existingPointQuery = await db
                .collection("devices")
                .doc(deviceId)
                .collection("notificationPoints")
                .where("gatewayId", "==", pointData.gatewayId)
                .limit(1)
                .get();
            if (!existingPointQuery.empty) {
                console.log(`⏭️  通知點 ${pointId}: 設備 ${deviceId} 已有相同 gateway 的通知點，跳過`);
                stats.notificationPointsSkipped++;
                continue;
            }
            // 複製到設備的子集合
            const newPointData = {
                gatewayId: pointData.gatewayId,
                name: pointData.name,
                notificationMessage: pointData.notificationMessage || null,
                isActive: pointData.isActive !== false,
                createdAt: pointData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            };
            if (!dryRun) {
                await db
                    .collection("devices")
                    .doc(deviceId)
                    .collection("notificationPoints")
                    .doc(pointId)
                    .set(newPointData);
            }
            console.log(`✅ 通知點 ${pointId}: 遷移到設備 ${deviceId} 成功`);
            stats.notificationPointsMigrated++;
        }
    }
    catch (error) {
        const errorMsg = `步驟 2 錯誤: ${error}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
    }
    console.log(`\n步驟 2 完成：`);
    console.log(`  - 已遷移: ${stats.notificationPointsMigrated}`);
    console.log(`  - 已跳過: ${stats.notificationPointsSkipped}\n`);
    // ========================================
    // 3. 設定社區設備繼承通知點
    // ========================================
    console.log("步驟 3：設定社區設備繼承通知點...");
    try {
        // 取得所有社區及其通知點
        const tenantsSnapshot = await db.collection("tenants").get();
        console.log(`找到 ${tenantsSnapshot.size} 個社區\n`);
        for (const tenantDoc of tenantsSnapshot.docs) {
            const tenantId = tenantDoc.id;
            // 查詢該社區的通知點
            const tenantNotificationPointsQuery = await db
                .collection("tenantNotificationPoints")
                .where("tenantId", "==", tenantId)
                .where("isActive", "==", true)
                .get();
            if (tenantNotificationPointsQuery.empty) {
                console.log(`⏭️  社區 ${tenantId}: 沒有通知點，跳過`);
                continue;
            }
            const gatewayIds = tenantNotificationPointsQuery.docs.map((doc) => doc.data().gatewayId);
            console.log(`社區 ${tenantId}: 有 ${gatewayIds.length} 個通知點`);
            // 查詢該社區的設備（有該社區 tag 的設備）
            const devicesQuery = await db
                .collection("devices")
                .where("tags", "array-contains", tenantId)
                .get();
            console.log(`  - 找到 ${devicesQuery.size} 個設備`);
            for (const deviceDoc of devicesQuery.docs) {
                const deviceId = deviceDoc.id;
                const deviceData = deviceDoc.data();
                // 如果設備已有 inheritedNotificationPointIds 且內容相同，跳過
                if (deviceData.inheritedNotificationPointIds &&
                    JSON.stringify(deviceData.inheritedNotificationPointIds.sort()) ===
                        JSON.stringify(gatewayIds.sort())) {
                    continue;
                }
                // 設定 inheritedNotificationPointIds
                if (!dryRun) {
                    await deviceDoc.ref.update({
                        inheritedNotificationPointIds: gatewayIds,
                    });
                }
                console.log(`  ✅ 設備 ${deviceId}: 設定 ${gatewayIds.length} 個繼承通知點`);
                stats.inheritedPointsSet++;
            }
        }
    }
    catch (error) {
        const errorMsg = `步驟 3 錯誤: ${error}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
    }
    console.log(`\n步驟 3 完成：`);
    console.log(`  - 已設定: ${stats.inheritedPointsSet}\n`);
    // ========================================
    // 總結
    // ========================================
    console.log(`\n========================================`);
    console.log(`遷移完成！`);
    console.log(`========================================`);
    console.log(`統計：`);
    console.log(`  FCM Token 遷移: ${stats.fcmTokensMigrated} 成功, ${stats.fcmTokensSkipped} 跳過`);
    console.log(`  通知點遷移: ${stats.notificationPointsMigrated} 成功, ${stats.notificationPointsSkipped} 跳過`);
    console.log(`  繼承通知點設定: ${stats.inheritedPointsSet}`);
    console.log(`  錯誤: ${stats.errors.length}`);
    if (stats.errors.length > 0) {
        console.log(`\n錯誤詳情：`);
        stats.errors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error}`);
        });
    }
    if (dryRun) {
        console.log(`\n⚠️  這是 DRY RUN，沒有實際寫入資料`);
        console.log(`   要執行實際遷移，請使用 dryRun = false`);
    }
    console.log(`========================================\n`);
    return stats;
}
// 如果直接執行此腳本
if (require.main === module) {
    // 初始化 Firebase Admin（如果尚未初始化）
    if (!admin.apps.length) {
        admin.initializeApp();
    }
    const dryRun = process.argv.includes("--live") ? false : true;
    migrateNotificationArchitecture(dryRun)
        .then((stats) => {
        console.log("遷移腳本執行完成");
        process.exit(stats.errors.length > 0 ? 1 : 0);
    })
        .catch((error) => {
        console.error("遷移腳本執行失敗:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=migrateNotificationArchitecture.js.map