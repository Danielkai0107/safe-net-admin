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
exports.getPublicGateways = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
/**
 * Get Public Gateways
 * GET /getPublicGateways
 *
 * Returns all active gateways (including tenant gateways)
 * For map app users, all gateways form the safety network
 * No authentication required (public data)
 */
exports.getPublicGateways = (0, https_1.onRequest)(async (req, res) => {
    // CORS handling
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }
    try {
        const db = admin.firestore();
        // Query all active gateways (including both public and tenant gateways)
        // All gateways form the safety network for map app users
        const gatewaysSnapshot = await db
            .collection('gateways')
            .where('isActive', '==', true)
            .get();
        const gateways = gatewaysSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                location: data.location,
                latitude: data.latitude,
                longitude: data.longitude,
                type: data.type,
                serialNumber: data.serialNumber,
                tenantId: data.tenantId || null, // Include tenant info for reference
                poolType: data.poolType || 'TENANT', // Default to TENANT if not set
            };
        });
        res.json({
            success: true,
            gateways: gateways,
            count: gateways.length,
            timestamp: Date.now(),
        });
    }
    catch (error) {
        console.error('Error in getPublicGateways:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
//# sourceMappingURL=gateways.js.map