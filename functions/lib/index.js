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
exports.receiveBeaconData = exports.getTenantFollowers = exports.verifyUserTenant = exports.lineWebhook = exports.checkInactiveElders = exports.completeAlert = exports.declineAlertAssignment = exports.acceptAlertAssignment = exports.assignAlert = void 0;
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
// Initialize Firebase Admin
admin.initializeApp();
//# sourceMappingURL=index.js.map