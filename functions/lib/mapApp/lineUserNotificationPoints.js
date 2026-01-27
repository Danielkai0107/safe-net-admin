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
exports.getLineUserNotificationPoints = exports.removeLineUserNotificationPoint = exports.addLineUserNotificationPoint = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
/**
 * Add Notification Point for LINE User
 * POST /addLineUserNotificationPoint
 *
 * Request Body:
 * - lineUserId: string (必填，Line 用戶管理 ID)
 * - gatewayId: string (必填，Gateway ID)
 */
exports.addLineUserNotificationPoint = (0, https_1.onRequest)(async (req, res) => {
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
        if (!body.gatewayId) {
            res.status(400).json({
                success: false,
                error: "Missing required field: gatewayId",
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
        const lineUserData = lineUserDoc.data();
        // Check if user has bound device
        if (!(lineUserData === null || lineUserData === void 0 ? void 0 : lineUserData.boundDeviceId)) {
            res.status(400).json({
                success: false,
                error: "User has no bound device",
            });
            return;
        }
        const deviceId = lineUserData.boundDeviceId;
        // Check if gateway exists
        const gatewayDoc = await db
            .collection("gateways")
            .doc(body.gatewayId)
            .get();
        if (!gatewayDoc.exists) {
            res.status(404).json({
                success: false,
                error: "Gateway not found",
            });
            return;
        }
        const gatewayData = gatewayDoc.data();
        // 驗證 gateway 類型（只允許 SAFE_ZONE 和 SCHOOL_ZONE）
        if ((gatewayData === null || gatewayData === void 0 ? void 0 : gatewayData.type) !== "SAFE_ZONE" &&
            (gatewayData === null || gatewayData === void 0 ? void 0 : gatewayData.type) !== "SCHOOL_ZONE") {
            res.status(400).json({
                success: false,
                error: `Cannot set ${gatewayData === null || gatewayData === void 0 ? void 0 : gatewayData.type} gateway as notification point. Only SAFE_ZONE and SCHOOL_ZONE are allowed.`,
            });
            return;
        }
        // Get device data
        const deviceDoc = await db.collection("devices").doc(deviceId).get();
        const deviceData = deviceDoc.data();
        // Check if gateway is already in notification points
        const currentNotificationPoints = (deviceData === null || deviceData === void 0 ? void 0 : deviceData.inheritedNotificationPointIds) || [];
        if (currentNotificationPoints.includes(body.gatewayId)) {
            res.status(400).json({
                success: false,
                error: "Gateway is already in notification points",
            });
            return;
        }
        // Add gateway to notification points
        await db
            .collection("devices")
            .doc(deviceId)
            .update({
            inheritedNotificationPointIds: admin.firestore.FieldValue.arrayUnion(body.gatewayId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({
            success: true,
            message: "Notification point added successfully",
            gatewayId: body.gatewayId,
            gatewayName: gatewayData === null || gatewayData === void 0 ? void 0 : gatewayData.name,
        });
    }
    catch (error) {
        console.error("Error in addLineUserNotificationPoint:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
});
/**
 * Remove Notification Point for LINE User
 * POST /removeLineUserNotificationPoint
 *
 * Request Body:
 * - lineUserId: string (必填，Line 用戶管理 ID)
 * - gatewayId: string (必填，Gateway ID)
 */
exports.removeLineUserNotificationPoint = (0, https_1.onRequest)(async (req, res) => {
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
        if (!body.gatewayId) {
            res.status(400).json({
                success: false,
                error: "Missing required field: gatewayId",
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
        const lineUserData = lineUserDoc.data();
        // Check if user has bound device
        if (!(lineUserData === null || lineUserData === void 0 ? void 0 : lineUserData.boundDeviceId)) {
            res.status(400).json({
                success: false,
                error: "User has no bound device",
            });
            return;
        }
        const deviceId = lineUserData.boundDeviceId;
        // Remove gateway from notification points
        await db
            .collection("devices")
            .doc(deviceId)
            .update({
            inheritedNotificationPointIds: admin.firestore.FieldValue.arrayRemove(body.gatewayId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({
            success: true,
            message: "Notification point removed successfully",
            gatewayId: body.gatewayId,
        });
    }
    catch (error) {
        console.error("Error in removeLineUserNotificationPoint:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
});
/**
 * Get Notification Points for LINE User
 * GET /getLineUserNotificationPoints
 *
 * Query Parameters:
 * - lineUserId: string (必填，Line 用戶管理 ID)
 */
exports.getLineUserNotificationPoints = (0, https_1.onRequest)(async (req, res) => {
    // CORS handling
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
    }
    try {
        const lineUserId = req.query.lineUserId;
        // Validate request
        if (!lineUserId) {
            res.status(400).json({
                success: false,
                error: "Missing required parameter: lineUserId",
            });
            return;
        }
        const db = admin.firestore();
        // Check if LINE user exists
        const lineUsersQuery = await db
            .collection("line_users")
            .where("lineUserId", "==", lineUserId)
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
        const lineUserData = lineUserDoc.data();
        // Check if user has bound device
        if (!(lineUserData === null || lineUserData === void 0 ? void 0 : lineUserData.boundDeviceId)) {
            res.json({
                success: true,
                notificationPoints: [],
                deviceId: null,
            });
            return;
        }
        const deviceId = lineUserData.boundDeviceId;
        // Get device data
        const deviceDoc = await db.collection("devices").doc(deviceId).get();
        const deviceData = deviceDoc.data();
        const notificationPointIds = (deviceData === null || deviceData === void 0 ? void 0 : deviceData.inheritedNotificationPointIds) || [];
        // Get gateway details for each notification point
        const notificationPoints = [];
        for (const gatewayId of notificationPointIds) {
            const gatewayDoc = await db.collection("gateways").doc(gatewayId).get();
            if (gatewayDoc.exists) {
                notificationPoints.push(Object.assign({ id: gatewayDoc.id }, gatewayDoc.data()));
            }
        }
        res.json({
            success: true,
            deviceId: deviceId,
            notificationPoints: notificationPoints,
        });
    }
    catch (error) {
        console.error("Error in getLineUserNotificationPoints:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
});
//# sourceMappingURL=lineUserNotificationPoints.js.map