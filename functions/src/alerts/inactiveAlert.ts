import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendNotification } from '../line/sendMessage';

interface InactiveElderInfo {
  name: string;
  id: string;
  lastSeen?: Date;
}

/**
 * Check for inactive elders in specific time periods
 * Scheduled to run at 12:00, 18:00, and 00:00 daily
 */
export const checkInactiveElders = functions.pubsub
  .schedule('0 0,12,18 * * *') // Run at 00:00, 12:00, and 18:00 every day
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const hour = now.getHours();

    // Determine time period
    let periodName = '';
    let periodStart: Date;
    let periodEnd: Date;

    if (hour === 0) {
      // Night period check (18:00 - 00:00 yesterday)
      periodName = '晚上時段';
      periodStart = new Date(now);
      periodStart.setHours(18, 0, 0, 0);
      periodStart.setDate(periodStart.getDate() - 1); // Yesterday
      periodEnd = new Date(now);
      periodEnd.setHours(0, 0, 0, 0);
    } else if (hour === 12) {
      // Morning period check (00:00 - 12:00 today)
      periodName = '早上時段';
      periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(now);
      periodEnd.setHours(12, 0, 0, 0);
    } else if (hour === 18) {
      // Afternoon period check (12:00 - 18:00 today)
      periodName = '下午時段';
      periodStart = new Date(now);
      periodStart.setHours(12, 0, 0, 0);
      periodEnd = new Date(now);
      periodEnd.setHours(18, 0, 0, 0);
    } else {
      console.log('Function triggered at unexpected hour:', hour);
      return;
    }

    console.log(`Checking inactive elders for ${periodName} (${periodStart.toISOString()} - ${periodEnd.toISOString()})`);

    try {
      // Get all tenants
      const tenantsSnapshot = await db.collection('tenants').where('isActive', '==', true).get();

      for (const tenantDoc of tenantsSnapshot.docs) {
        const tenantId = tenantDoc.id;
        const tenantData = tenantDoc.data();
        const channelAccessToken = tenantData.lineChannelAccessToken;

        if (!channelAccessToken) {
          console.log(`Tenant ${tenantId} has no LINE Channel Access Token, skipping`);
          continue;
        }

        // Get all active elders in this tenant
        const eldersSnapshot = await db
          .collection('elders')
          .where('tenantId', '==', tenantId)
          .where('isActive', '==', true)
          .where('status', '==', 'ACTIVE')
          .get();

        if (eldersSnapshot.empty) {
          console.log(`No active elders found for tenant ${tenantId}`);
          continue;
        }

        const inactiveElders: InactiveElderInfo[] = [];

        // Check each elder's last activity
        for (const elderDoc of eldersSnapshot.docs) {
          const elderData = elderDoc.data();
          const elderId = elderDoc.id;
          const elderName = elderData.name;

          // Check latest_locations for this elder
          const locationDoc = await db.collection('latest_locations').doc(elderId).get();

          if (!locationDoc.exists) {
            // Elder has never been seen - add to inactive list
            inactiveElders.push({
              name: elderName,
              id: elderId,
            });
            continue;
          }

          const locationData = locationDoc.data();
          const lastSeen = locationData?.last_seen;

          if (!lastSeen) {
            // No last_seen data - add to inactive list
            inactiveElders.push({
              name: elderName,
              id: elderId,
            });
            continue;
          }

          // Convert Firestore Timestamp to Date
          const lastSeenDate = lastSeen.toDate();

          // Check if last seen was before this period started
          if (lastSeenDate < periodStart) {
            inactiveElders.push({
              name: elderName,
              id: elderId,
              lastSeen: lastSeenDate,
            });
          }
        }

        // If there are inactive elders, send notification to all admins
        if (inactiveElders.length > 0) {
          console.log(`Found ${inactiveElders.length} inactive elders in tenant ${tenantId} for ${periodName}`);

          // Get all admin members
          const adminsSnapshot = await db
            .collection('tenants')
            .doc(tenantId)
            .collection('members')
            .where('role', '==', 'ADMIN')
            .where('status', '==', 'APPROVED')
            .get();

          if (adminsSnapshot.empty) {
            console.log(`No admin members found for tenant ${tenantId}`);
            continue;
          }

          // Build notification message
          const elderList = inactiveElders.map(elder => `• ${elder.name}`).join('\n');
          const message = `⚠️ 注意通知（${periodName}）\n\n以下長輩今日尚未偵測到活動：\n${elderList}\n\n請關注其安全狀況`;

          // Send to all admins
          for (const adminDoc of adminsSnapshot.docs) {
            const adminData = adminDoc.data();
            const adminAppUserId = adminData.appUserId;

            // Get admin's LINE user ID
            const appUserDoc = await db.collection('appUsers').doc(adminAppUserId).get();
            if (!appUserDoc.exists) {
              continue;
            }

            const appUserData = appUserDoc.data();
            const lineUserId = appUserData?.lineUserId;

            if (lineUserId) {
              try {
                await sendNotification(lineUserId, channelAccessToken, message);
                console.log(`Sent inactive alert to admin ${lineUserId} for tenant ${tenantId}`);
              } catch (error) {
                console.error(`Failed to send notification to admin ${lineUserId}:`, error);
              }
            }
          }
        } else {
          console.log(`All elders active in tenant ${tenantId} for ${periodName}`);
        }
      }

      console.log('Inactive elders check completed successfully');
    } catch (error) {
      console.error('Error checking inactive elders:', error);
      throw error;
    }
  });
