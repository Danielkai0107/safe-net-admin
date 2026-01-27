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
exports.updateLineUserDeviceProfile = exports.unbindDeviceFromLineUser = exports.bindDeviceToLineUser = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
/**
 * Bind Device to LINE User
 * POST /bindDeviceToLineUser
 *
 * Request Body:
 * - lineUserId: string (必填，Line 用戶管理 ID)
 * - deviceName: string (必填，產品序號，例如：1-1001)
 * - nickname?: string (選填，設備暱稱)
 * - age?: number (選填，使用者年齡)
 * - gender?: 'MALE' | 'FEMALE' | 'OTHER' (選填，使用者性別)
 */
exports.bindDeviceToLineUser = (0, https_1.onRequest)(async (req, res) => {
    // CORS handling
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
    }
    try {
        const body = req.body;
        // Validate request
        if (!body.lineUserId) {
            res.status(400).json({
                success: false,
                error: "Missing required field: lineUserId",
            });
            return;
        }
        if (!body.deviceName) {
            res.status(400).json({
                success: false,
                error: "Missing required field: deviceName",
            });
            return;
        }
        const db = admin.firestore();
        // Check if LINE user exists
        const lineUsersQuery = await db
            .collection("line_users")
            .where("lineUserId", "==", body.lineUserId)
            .limit(1)
            .get();
        if (lineUsersQuery.empty) {
            res.status(404).json({
                success: false,
                error: "LINE user not found",
            });
            return;
        }
        const lineUserDoc = lineUsersQuery.docs[0];
        const lineUserDocId = lineUserDoc.id;
        const lineUserData = lineUserDoc.data();
        // Find device by deviceName (產品序號)
        const normalizedDeviceName = body.deviceName.toUpperCase();
        const deviceQuery = await db
            .collection("devices")
            .where("deviceName", "==", normalizedDeviceName)
            .limit(1)
            .get();
        if (deviceQuery.empty) {
            res.status(404).json({
                success: false,
                error: `Device with deviceName '${normalizedDeviceName}' not found`,
            });
            return;
        }
        const deviceDoc = deviceQuery.docs[0];
        const deviceId = deviceDoc.id;
        const deviceData = deviceDoc.data();
        // 檢查設備綁定狀態
        if ((deviceData === null || deviceData === void 0 ? void 0 : deviceData.bindingType) === "ELDER") {
            res.status(400).json({
                success: false,
                error: "Device is already bound to an elder in the tenant system",
            });
            return;
        }
        // Check if device is already bound to another LINE user
        if ((deviceData === null || deviceData === void 0 ? void 0 : deviceData.bindingType) === "LINE_USER" &&
            deviceData.boundTo !== lineUserDocId) {
            res.status(400).json({
                success: false,
                error: "Device is already bound to another LINE user",
            });
            return;
        }
        // Unbind old device if user already has one
        if ((lineUserData === null || lineUserData === void 0 ? void 0 : lineUserData.boundDeviceId) &&
            lineUserData.boundDeviceId !== deviceId) {
            await db.collection("devices").doc(lineUserData.boundDeviceId).update({
                bindingType: "UNBOUND",
                boundTo: null,
                boundAt: null,
                mapUserNickname: null,
                mapUserAge: null,
                mapUserGender: null,
                inheritedNotificationPointIds: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                // 注意：不修改 tags，保留原有的社區標籤
            });
        }
        // Bind device to LINE user
        const boundAt = admin.firestore.FieldValue.serverTimestamp();
        await db
            .collection("devices")
            .doc(deviceId)
            .update({
            bindingType: "LINE_USER",
            boundTo: lineUserDocId,
            boundAt: boundAt,
            mapUserNickname: body.nickname || null,
            mapUserAge: body.age || null,
            mapUserGender: body.gender || null,
            tags: [], // 清空社區標籤（Line 用戶管理綁定後不屬於特定社區）
            inheritedNotificationPointIds: [], // 初始為空，用戶稍後設定
            updatedAt: boundAt,
        });
        // Update LINE user's bound device
        await db.collection("line_users").doc(lineUserDocId).update({
            boundDeviceId: deviceId,
            updatedAt: boundAt,
        });
        res.json({
            success: true,
            device: {
                id: deviceId,
                uuid: deviceData === null || deviceData === void 0 ? void 0 : deviceData.uuid,
                major: deviceData === null || deviceData === void 0 ? void 0 : deviceData.major,
                minor: deviceData === null || deviceData === void 0 ? void 0 : deviceData.minor,
                deviceName: deviceData === null || deviceData === void 0 ? void 0 : deviceData.deviceName,
                nickname: body.nickname,
                age: body.age,
                gender: body.gender,
            },
            boundAt: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Error in bindDeviceToLineUser:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
});
/**
 * Unbind Device from LINE User
 * POST /unbindDeviceFromLineUser
 *
 * Request Body:
 * - lineUserId: string (必填，Line 用戶管理 ID)
 */
exports.unbindDeviceFromLineUser = (0, https_1.onRequest)(async (req, res) => {
    // CORS handling
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
    }
    try {
        const body = req.body;
        // Validate request
        if (!body.lineUserId) {
            res.status(400).json({
                success: false,
                error: "Missing required field: lineUserId",
            });
            return;
        }
        const db = admin.firestore();
        // Check if LINE user exists
        const lineUsersQuery = await db
            .collection("line_users")
            .where("lineUserId", "==", body.lineUserId)
            .limit(1)
            .get();
        if (lineUsersQuery.empty) {
            res.status(404).json({
                success: false,
                error: "LINE user not found",
            });
            return;
        }
        const lineUserDoc = lineUsersQuery.docs[0];
        const lineUserDocId = lineUserDoc.id;
        const lineUserData = lineUserDoc.data();
        if (!(lineUserData === null || lineUserData === void 0 ? void 0 : lineUserData.boundDeviceId)) {
            res.status(400).json({
                success: false,
                error: "User has no bound device",
            });
            return;
        }
        const deviceId = lineUserData.boundDeviceId;
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        // 生成唯一的歸檔批次 ID
        const archiveSessionId = db.collection("_").doc().id;
        // 1. 複製 activities 到全域 anonymousActivities collection，然後刪除原記錄
        const activitiesRef = db
            .collection("devices")
            .doc(deviceId)
            .collection("activities");
        const anonymousRef = db.collection("anonymousActivities");
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
                    // 保留統計用欄位
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
                    // 匿名化欄位
                    bindingType: "ANONYMOUS",
                    boundTo: null,
                    // 新增欄位
                    anonymizedAt: timestamp,
                    archiveSessionId: archiveSessionId,
                    originalActivityId: doc.id,
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
        // 2. Unbind device（保留 tags，只清除綁定相關欄位）
        await db.collection("devices").doc(deviceId).update({
            bindingType: "UNBOUND",
            boundTo: null,
            boundAt: null,
            mapUserNickname: null,
            mapUserAge: null,
            mapUserGender: null,
            inheritedNotificationPointIds: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // 注意：不修改 tags，保留原有的社區標籤
        });
        // 3. Update LINE user
        await db.collection("line_users").doc(lineUserDocId).update({
            boundDeviceId: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({
            success: true,
            message: "Device unbound successfully",
        });
    }
    catch (error) {
        console.error("Error in unbindDeviceFromLineUser:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
});
/**
 * Update LINE User's bound device profile (nickname, age, gender only).
 * Product serial (deviceName) cannot be changed.
 * POST /updateLineUserDeviceProfile
 */
exports.updateLineUserDeviceProfile = (0, https_1.onRequest)(async (req, res) => {
    var _a, _b, _c;
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
    }
    try {
        const body = req.body;
        if (!body.lineUserId) {
            res.status(400).json({
                success: false,
                error: "Missing required field: lineUserId",
            });
            return;
        }
        const db = admin.firestore();
        const lineUsersQuery = await db
            .collection("line_users")
            .where("lineUserId", "==", body.lineUserId)
            .limit(1)
            .get();
        if (lineUsersQuery.empty) {
            res.status(404).json({
                success: false,
                error: "LINE user not found",
            });
            return;
        }
        const lineUserData = lineUsersQuery.docs[0].data();
        const boundDeviceId = lineUserData === null || lineUserData === void 0 ? void 0 : lineUserData.boundDeviceId;
        if (!boundDeviceId) {
            res.status(400).json({
                success: false,
                error: "User has no bound device",
            });
            return;
        }
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (body.nickname !== undefined)
            updateData.mapUserNickname = (_a = body.nickname) !== null && _a !== void 0 ? _a : null;
        if (body.age !== undefined)
            updateData.mapUserAge = (_b = body.age) !== null && _b !== void 0 ? _b : null;
        if (body.gender !== undefined)
            updateData.mapUserGender = (_c = body.gender) !== null && _c !== void 0 ? _c : null;
        await db.collection("devices").doc(boundDeviceId).update(updateData);
        res.json({
            success: true,
            message: "Device profile updated",
        });
    }
    catch (error) {
        console.error("Error in updateLineUserDeviceProfile:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
});
//# sourceMappingURL=lineUserDeviceBinding.js.map