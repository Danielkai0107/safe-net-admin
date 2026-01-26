import * as admin from 'firebase-admin';
import { assignAlert } from './alerts/assignment';
import { acceptAlertAssignment, declineAlertAssignment } from './alerts/response';
import { completeAlert } from './alerts/completion';
import { checkInactiveElders } from './alerts/inactiveAlert';
import { lineWebhook } from './line/webhook';
import { verifyUserTenant } from './line/verifyUserTenant';
import { getTenantFollowers } from './line/getTenantFollowers';
import { receiveBeaconData } from './beacon/receiveBeaconData';
import { minewGateway } from './beacon/minewGatewayAdapter';
import { getDeviceWhitelist } from './devices/getDeviceWhitelist';
import { getServiceUuids } from './uuids/getServiceUuids';
// Map App APIs
import { mapUserAuth } from './mapApp/auth';
import { updateMapUserFcmToken } from './mapApp/fcmToken';
import { updateMapUserAvatar } from './mapApp/updateAvatar';
import { bindDeviceToMapUser, unbindDeviceFromMapUser } from './mapApp/deviceBinding';
import { unbindDeviceFromElder } from './mapApp/elderBinding';
import { updateMapUserDevice } from './mapApp/deviceUpdate';
import { deleteMapAppUser } from './mapApp/deleteUser';
import { getPublicGateways } from './mapApp/gateways';
import { 
  addMapUserNotificationPoint,
  removeMapUserNotificationPoint,
  getMapUserNotificationPoints,
  updateMapUserNotificationPoint 
} from './mapApp/notificationPoints';
import { getMapUserActivities } from './mapApp/activities';
import { getMapUserProfile } from './mapApp/userProfile';
import { checkMapUserStatus } from './mapApp/userStatus';
// Admin APIs
import { clearAllData } from './admin/clearAllData';
import { createAdminUser } from './admin/createAdminUser';

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
  minewGateway,
  getDeviceWhitelist,
  getServiceUuids,
  // Map App APIs
  mapUserAuth,
  updateMapUserFcmToken,
  updateMapUserAvatar,
  bindDeviceToMapUser,
  unbindDeviceFromMapUser,
  unbindDeviceFromElder,
  updateMapUserDevice,
  deleteMapAppUser,
  getPublicGateways,
  addMapUserNotificationPoint,
  removeMapUserNotificationPoint,
  getMapUserNotificationPoints,
  updateMapUserNotificationPoint,
  getMapUserActivities,
  getMapUserProfile,
  checkMapUserStatus,
  // Admin APIs
  clearAllData,
  createAdminUser,
};
