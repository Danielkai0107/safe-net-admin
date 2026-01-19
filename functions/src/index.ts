import * as admin from 'firebase-admin';
import { assignAlert } from './alerts/assignment';
import { acceptAlertAssignment, declineAlertAssignment } from './alerts/response';
import { completeAlert } from './alerts/completion';
import { checkInactiveElders } from './alerts/inactiveAlert';
import { lineWebhook } from './line/webhook';
import { verifyUserTenant } from './line/verifyUserTenant';
import { getTenantFollowers } from './line/getTenantFollowers';
import { receiveBeaconData } from './beacon/receiveBeaconData';

// Initialize Firebase Admin
admin.initializeApp();

// Export functions
export {
  assignAlert,
  acceptAlertAssignment,
  declineAlertAssignment,
  completeAlert,
  checkInactiveElders,
  lineWebhook,
  verifyUserTenant,
  getTenantFollowers,
  receiveBeaconData,
};
