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
exports.getMapUserProfile = exports.getMapUserActivities = exports.updateMapUserNotificationPoint = exports.getMapUserNotificationPoints = exports.removeMapUserNotificationPoint = exports.addMapUserNotificationPoint = exports.getPublicGateways = exports.updateMapUserDevice = exports.unbindDeviceFromMapUser = exports.bindDeviceToMapUser = exports.updateMapUserFcmToken = exports.mapUserAuth = exports.getServiceUuids = exports.getDeviceWhitelist = exports.receiveBeaconData = exports.getTenantFollowers = exports.verifyUserTenant = exports.lineWebhook = exports.checkInactiveElders = exports.completeAlert = exports.declineAlertAssignment = exports.acceptAlertAssignment = exports.assignAlert = void 0;
const admin = __importStar(require("firebase-admin"));
const assignment_1 = require("./alerts/assignment");
Object.defineProperty(exports, "assignAlert", { enumerable: true, get: function () { return assignment_1.assignAlert; } });
const response_1 = require("./alerts/response");
Object.defineProperty(exports, "acceptAlertAssignment", { enumerable: true, get: function () { return response_1.acceptAlertAssignment; } });
Object.defineProperty(exports, "declineAlertAssignment", { enumerable: true, get: function () { return response_1.declineAlertAssignment; } });
const completion_1 = require("./alerts/completion");
Object.defineProperty(exports, "completeAlert", { enumerable: true, get: function () { return completion_1.completeAlert; } });
const inactiveAlert_1 = require("./alerts/inactiveAlert");
Object.defineProperty(exports, "checkInactiveElders", { enumerable: true, get: function () { return inactiveAlert_1.checkInactiveElders; } });
const webhook_1 = require("./line/webhook");
Object.defineProperty(exports, "lineWebhook", { enumerable: true, get: function () { return webhook_1.lineWebhook; } });
const verifyUserTenant_1 = require("./line/verifyUserTenant");
Object.defineProperty(exports, "verifyUserTenant", { enumerable: true, get: function () { return verifyUserTenant_1.verifyUserTenant; } });
const getTenantFollowers_1 = require("./line/getTenantFollowers");
Object.defineProperty(exports, "getTenantFollowers", { enumerable: true, get: function () { return getTenantFollowers_1.getTenantFollowers; } });
const receiveBeaconData_1 = require("./beacon/receiveBeaconData");
Object.defineProperty(exports, "receiveBeaconData", { enumerable: true, get: function () { return receiveBeaconData_1.receiveBeaconData; } });
const getDeviceWhitelist_1 = require("./devices/getDeviceWhitelist");
Object.defineProperty(exports, "getDeviceWhitelist", { enumerable: true, get: function () { return getDeviceWhitelist_1.getDeviceWhitelist; } });
const getServiceUuids_1 = require("./uuids/getServiceUuids");
Object.defineProperty(exports, "getServiceUuids", { enumerable: true, get: function () { return getServiceUuids_1.getServiceUuids; } });
// Map App APIs
const auth_1 = require("./mapApp/auth");
Object.defineProperty(exports, "mapUserAuth", { enumerable: true, get: function () { return auth_1.mapUserAuth; } });
const fcmToken_1 = require("./mapApp/fcmToken");
Object.defineProperty(exports, "updateMapUserFcmToken", { enumerable: true, get: function () { return fcmToken_1.updateMapUserFcmToken; } });
const deviceBinding_1 = require("./mapApp/deviceBinding");
Object.defineProperty(exports, "bindDeviceToMapUser", { enumerable: true, get: function () { return deviceBinding_1.bindDeviceToMapUser; } });
Object.defineProperty(exports, "unbindDeviceFromMapUser", { enumerable: true, get: function () { return deviceBinding_1.unbindDeviceFromMapUser; } });
const deviceUpdate_1 = require("./mapApp/deviceUpdate");
Object.defineProperty(exports, "updateMapUserDevice", { enumerable: true, get: function () { return deviceUpdate_1.updateMapUserDevice; } });
const gateways_1 = require("./mapApp/gateways");
Object.defineProperty(exports, "getPublicGateways", { enumerable: true, get: function () { return gateways_1.getPublicGateways; } });
const notificationPoints_1 = require("./mapApp/notificationPoints");
Object.defineProperty(exports, "addMapUserNotificationPoint", { enumerable: true, get: function () { return notificationPoints_1.addMapUserNotificationPoint; } });
Object.defineProperty(exports, "removeMapUserNotificationPoint", { enumerable: true, get: function () { return notificationPoints_1.removeMapUserNotificationPoint; } });
Object.defineProperty(exports, "getMapUserNotificationPoints", { enumerable: true, get: function () { return notificationPoints_1.getMapUserNotificationPoints; } });
Object.defineProperty(exports, "updateMapUserNotificationPoint", { enumerable: true, get: function () { return notificationPoints_1.updateMapUserNotificationPoint; } });
const activities_1 = require("./mapApp/activities");
Object.defineProperty(exports, "getMapUserActivities", { enumerable: true, get: function () { return activities_1.getMapUserActivities; } });
const userProfile_1 = require("./mapApp/userProfile");
Object.defineProperty(exports, "getMapUserProfile", { enumerable: true, get: function () { return userProfile_1.getMapUserProfile; } });
// Initialize Firebase Admin
admin.initializeApp();
//# sourceMappingURL=index.js.map