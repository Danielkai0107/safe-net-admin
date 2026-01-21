import * as admin from 'firebase-admin';
import { assignAlert } from './alerts/assignment';
import { acceptAlertAssignment, declineAlertAssignment } from './alerts/response';
import { completeAlert } from './alerts/completion';
import { checkInactiveElders } from './alerts/inactiveAlert';
import { lineWebhook } from './line/webhook';
import { verifyUserTenant } from './line/verifyUserTenant';
import { getTenantFollowers } from './line/getTenantFollowers';
import { receiveBeaconData } from './beacon/receiveBeaconData';
import { getDeviceWhitelist } from './devices/getDeviceWhitelist';
import { getServiceUuids } from './uuids/getServiceUuids';
// Map App APIs
import { mapUserAuth } from './mapApp/auth';
import { updateMapUserFcmToken } from './mapApp/fcmToken';
import { bindDeviceToMapUser, unbindDeviceFromMapUser } from './mapApp/deviceBinding';
import { getPublicGateways } from './mapApp/gateways';
import { 
  addMapUserNotificationPoint,
  removeMapUserNotificationPoint,
  getMapUserNotificationPoints,
  updateMapUserNotificationPoint 
} from './mapApp/notificationPoints';
import { getMapUserActivities } from './mapApp/activities';

// Initialize Firebase Admin
admin.initializeApp();

// Export functions
export {
  // Alert Management
  assignAlert,
  acceptAlertAssignment,
  declineAlertAssignment,
  completeAlert,
  checkInactiveElders,
  // LINE Integration
  lineWebhook,
  verifyUserTenant,
  getTenantFollowers,
  // Beacon & Device Management
  receiveBeaconData,
  getDeviceWhitelist,
  getServiceUuids,
  // Map App APIs
  mapUserAuth,
  updateMapUserFcmToken,
  bindDeviceToMapUser,
  unbindDeviceFromMapUser,
  getPublicGateways,
  addMapUserNotificationPoint,
  removeMapUserNotificationPoint,
  getMapUserNotificationPoints,
  updateMapUserNotificationPoint,
  getMapUserActivities,
};
