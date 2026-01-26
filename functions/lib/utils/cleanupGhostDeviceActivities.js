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
exports.cleanupGhostDeviceActivities = cleanupGhostDeviceActivities;
const admin = __importStar(require("firebase-admin"));
async function cleanupGhostDeviceActivities(dryRun = true) {
    const db = admin.firestore();
    const stats = {
        totalDevicesChecked: 0,
        devicesWithGhostActivities: 0,
        totalActivitiesArchived: 0,
        totalActivitiesDeleted: 0,
        errors: [],
    };
    console.log(`\n========================================`);
    console.log(`清理幽靈設備活動記錄`);
    console.log(`模式: ${dryRun ? "DRY RUN（不會實際寫入）" : "LIVE（實際寫入）"}`);
    console.log(`========================================\n`);
    try {
        // 查詢所有已解綁的設備
        const unboundDevicesSnapshot = await db
            .collection("devices")
            .where("bindingType", "==", "UNBOUND")
            .get();
        console.log(`找到 ${unboundDevicesSnapshot.size} 個已解綁的設備\n`);
        for (const deviceDoc of unboundDevicesSnapshot.docs) {
            const deviceId = deviceDoc.id;
            stats.totalDevicesChecked++;
            try {
                // 檢查是否有活動記錄
                const activitiesRef = db
                    .collection("devices")
                    .doc(deviceId)
                    .collection("activities");
                const activitiesSnapshot = await activitiesRef.limit(1).get();
                if (activitiesSnapshot.empty) {
                    // 沒有活動記錄，跳過
                    continue;
                }
                // 有活動記錄，這是幽靈設備！
                stats.devicesWithGhostActivities++;
                const deviceData = deviceDoc.data();
                const deviceName = deviceData.deviceName || deviceId;
                console.log(`🔍 發現幽靈設備: ${deviceName} (${deviceId})`);
                // 計算總活動記錄數
                const allActivitiesSnapshot = await activitiesRef.get();
                const activityCount = allActivitiesSnapshot.size;
                console.log(`   - 活動記錄數: ${activityCount}`);
                if (!dryRun) {
                    // 執行匿名化和刪除
                    const anonymousRef = db.collection("anonymousActivities");
                    const timestamp = admin.firestore.FieldValue.serverTimestamp();
                    const archiveSessionId = db.collection("_").doc().id;
                    // 處理函數：複製到匿名 collection 並刪除原記錄
                    const archiveAndDeleteActivities = async (snapshot) => {
                        if (snapshot.empty)
                            return;
                        const batch = db.batch();
                        snapshot.docs.forEach((doc) => {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                            const data = doc.data();
                            // 複製到全域 anonymousActivities
                            const anonymousDoc = anonymousRef.doc();
                            batch.set(anonymousDoc, {
                                deviceId: deviceId,
                                timestamp: (_a = data.timestamp) !== null && _a !== void 0 ? _a : null,
                                gatewayId: (_b = data.gatewayId) !== null && _b !== void 0 ? _b : null,
                                gatewayName: (_c = data.gatewayName) !== null && _c !== void 0 ? _c : null,
                                gatewayType: (_d = data.gatewayType) !== null && _d !== void 0 ? _d : null,
                                latitude: (_e = data.latitude) !== null && _e !== void 0 ? _e : null,
                                longitude: (_f = data.longitude) !== null && _f !== void 0 ? _f : null,
                                rssi: (_g = data.rssi) !== null && _g !== void 0 ? _g : null,
                                triggeredNotification: (_h = data.triggeredNotification) !== null && _h !== void 0 ? _h : false,
                                notificationType: (_j = data.notificationType) !== null && _j !== void 0 ? _j : null,
                                notificationPointId: (_k = data.notificationPointId) !== null && _k !== void 0 ? _k : null,
                                bindingType: "ANONYMOUS",
                                boundTo: null,
                                cleanupReason: "GHOST_DEVICE_CLEANUP",
                                anonymizedAt: timestamp,
                                archiveSessionId: archiveSessionId,
                                originalActivityId: doc.id,
                            });
                            // 刪除原記錄
                            batch.delete(doc.ref);
                            stats.totalActivitiesDeleted++;
                        });
                        await batch.commit();
                        stats.totalActivitiesArchived += snapshot.size;
                    };
                    // 分批處理（每批 500 筆）
                    let batchSnapshot = await activitiesRef.limit(500).get();
                    await archiveAndDeleteActivities(batchSnapshot);
                    while (batchSnapshot.size === 500) {
                        batchSnapshot = await activitiesRef.limit(500).get();
                        await archiveAndDeleteActivities(batchSnapshot);
                    }
                    console.log(`   ✅ 已匿名化並刪除 ${activityCount} 筆活動記錄`);
                }
                else {
                    console.log(`   [DRY RUN] 將匿名化並刪除 ${activityCount} 筆活動記錄`);
                }
            }
            catch (error) {
                const errorMsg = `設備 ${deviceId} 處理失敗: ${error}`;
                console.error(`   ❌ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }
    }
    catch (error) {
        const errorMsg = `清理過程發生錯誤: ${error}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
    }
    // 總結
    console.log(`\n========================================`);
    console.log(`清理完成`);
    console.log(`========================================`);
    console.log(`統計：`);
    console.log(`  - 檢查設備數: ${stats.totalDevicesChecked}`);
    console.log(`  - 幽靈設備數: ${stats.devicesWithGhostActivities}`);
    console.log(`  - 已匿名化記錄: ${stats.totalActivitiesArchived}`);
    console.log(`  - 已刪除記錄: ${stats.totalActivitiesDeleted}`);
    console.log(`  - 錯誤: ${stats.errors.length}`);
    if (stats.errors.length > 0) {
        console.log(`\n錯誤詳情：`);
        stats.errors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error}`);
        });
    }
    if (dryRun) {
        console.log(`\n⚠️  這是 DRY RUN，沒有實際寫入資料`);
        console.log(`   要執行實際清理，請使用 --live 參數`);
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
    cleanupGhostDeviceActivities(dryRun)
        .then((stats) => {
        console.log("清理腳本執行完成");
        process.exit(stats.errors.length > 0 ? 1 : 0);
    })
        .catch((error) => {
        console.error("清理腳本執行失敗:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=cleanupGhostDeviceActivities.js.map