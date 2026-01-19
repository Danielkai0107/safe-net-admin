import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { WebhookEvent, FollowEvent, PostbackEvent, Client, validateSignature } from '@line/bot-sdk';
import { sendNotification } from './sendMessage';

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
};

// LINE Webhook 處理器
export const lineWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const events: WebhookEvent[] = req.body.events;
    const signature = req.headers['x-line-signature'] as string;
    const body = JSON.stringify(req.body);

    // 查找匹配的社區（通過 Channel Secret 驗證）
    const db = admin.firestore();
    const tenantsSnap = await db.collection('tenants').get();
    
    let matchedTenant: { id: string; channelSecret: string; channelAccessToken: string } | null = null;
    
    // 嘗試找到匹配的社區（通過驗證簽名）
    for (const tenantDoc of tenantsSnap.docs) {
      const tenantData = tenantDoc.data();
      if (tenantData.lineChannelSecret && signature) {
        try {
          if (validateSignature(body, tenantData.lineChannelSecret, signature)) {
            matchedTenant = {
              id: tenantDoc.id,
              channelSecret: tenantData.lineChannelSecret,
              channelAccessToken: tenantData.lineChannelAccessToken || '',
            };
            console.log('Matched tenant:', tenantDoc.id);
            break;
          }
        } catch (e) {
          // 繼續嘗試下一個社區
          console.warn(`Failed to validate signature for tenant ${tenantDoc.id}:`, e);
        }
      }
    }

    // 如果找不到匹配的社區，使用全局配置（向後兼容）
    if (!matchedTenant && config.channelSecret && signature) {
      try {
        if (validateSignature(body, config.channelSecret, signature)) {
          console.log('Using global config');
        }
      } catch (e) {
        console.warn('Signature validation failed, continuing anyway');
      }
    }

    await Promise.all(
      events.map(async (event) => {
        // 處理用戶加入（Follow）事件
        if (event.type === 'follow') {
          await handleFollow(event as FollowEvent, matchedTenant);
        }
        
        // 處理用戶取消好友（Unfollow）事件
        if (event.type === 'unfollow') {
          await handleUnfollow(event);
        }
        
        // 處理 Postback 事件（接受/拒絕警報）
        if (event.type === 'postback') {
          await handlePostback(event as PostbackEvent, matchedTenant);
        }
      })
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 處理用戶加入事件
async function handleFollow(
  event: FollowEvent,
  matchedTenant: { id: string; channelSecret: string; channelAccessToken: string } | null
) {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  const db = admin.firestore();

  try {
    // 確定使用的 Channel Access Token
    const channelAccessToken = matchedTenant?.channelAccessToken || config.channelAccessToken;
    
    // 嘗試獲取用戶的 LINE profile 資訊
    let lineDisplayName = 'LINE 用戶';
    let linePictureUrl: string | null = null;
    
    if (channelAccessToken) {
      try {
        const client = new Client({
          channelAccessToken,
          channelSecret: matchedTenant?.channelSecret || config.channelSecret,
        });
        const profile = await client.getProfile(lineUserId);
        lineDisplayName = profile.displayName;
        linePictureUrl = profile.pictureUrl || null;
        console.log('Got LINE profile:', { lineDisplayName, linePictureUrl });
      } catch (profileError) {
        console.warn('Failed to get LINE profile, using defaults:', profileError);
        // 如果獲取 profile 失敗，使用預設值
      }
    }

    // 檢查用戶是否已存在
    const existingUserQuery = await db
      .collection('appUsers')
      .where('lineUserId', '==', lineUserId)
      .limit(1)
      .get();

    let appUserId: string;
    
    if (!existingUserQuery.empty) {
      console.log('User already exists:', lineUserId);
      appUserId = existingUserQuery.docs[0].id;
      // 更新 isActive 為 true，並更新 LINE 資訊（如果用戶曾經取消好友後又加回）
      const updateData: any = {
        isActive: true,
        lineDisplayName,
        linePictureUrl,
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      // 如果找到了匹配的社區，記錄用戶是從哪個社區加入的
      if (matchedTenant) {
        updateData.joinedFromTenantId = matchedTenant.id;
      }
      
      await db.collection('appUsers').doc(appUserId).update(updateData);
    } else {
      // 創建新用戶記錄
      const userData: any = {
        lineUserId,
        lineDisplayName,
        linePictureUrl,
        email: null,
        name: lineDisplayName,
        phone: null,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      // 如果找到了匹配的社區，記錄用戶是從哪個社區加入的
      if (matchedTenant) {
        userData.joinedFromTenantId = matchedTenant.id;
      }
      
      const docRef = await db.collection('appUsers').add(userData);
      appUserId = docRef.id;
      console.log('New user created:', lineUserId, lineDisplayName, matchedTenant ? `from tenant ${matchedTenant.id}` : '');
    }

    // 如果找到了匹配的社區，自動將用戶添加到該社區的 members 中
    if (matchedTenant) {
      try {
        // 檢查用戶是否已經是該社區的成員
        const membersQuery = await db
          .collection('tenants')
          .doc(matchedTenant.id)
          .collection('members')
          .where('appUserId', '==', appUserId)
          .limit(1)
          .get();

        if (membersQuery.empty) {
          // 自動添加用戶為社區成員（預設為 MEMBER 角色）
          await db
            .collection('tenants')
            .doc(matchedTenant.id)
            .collection('members')
            .add({
              appUserId,
              role: 'MEMBER',
              status: 'APPROVED',
              approvedAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          console.log(`Auto-added user to tenant: ${matchedTenant.id}`);
        } else {
          console.log(`User already a member of tenant: ${matchedTenant.id}`);
        }
      } catch (memberError) {
        console.error('Error adding user to tenant:', memberError);
        // 不中斷流程，繼續執行
      }
    }
  } catch (error) {
    console.error('Error handling follow event:', error);
  }
}

// 處理用戶取消好友事件
async function handleUnfollow(event: WebhookEvent) {
  const lineUserId = (event.source as any).userId;
  if (!lineUserId) return;

  const db = admin.firestore();

  try {
    // 找到用戶並標記為不活躍（不刪除，保留歷史記錄）
    const userQuery = await db
      .collection('appUsers')
      .where('lineUserId', '==', lineUserId)
      .limit(1)
      .get();

    if (!userQuery.empty) {
      const userId = userQuery.docs[0].id;
      await db.collection('appUsers').doc(userId).update({
        isActive: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('User unfollowed:', lineUserId);
    }
  } catch (error) {
    console.error('Error handling unfollow event:', error);
  }
}

// 處理 Postback 事件（接受/拒絕警報）
async function handlePostback(
  event: PostbackEvent,
  matchedTenant: { id: string; channelSecret: string; channelAccessToken: string } | null
) {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  const db = admin.firestore();
  const postbackData = event.postback.data;

  try {
    // 解析 postback data
    const params = new URLSearchParams(postbackData);
    const action = params.get('action');
    const alertId = params.get('alertId');

    if (!action || !alertId) {
      console.error('Invalid postback data:', postbackData);
      return;
    }

    console.log('Postback received:', { action, alertId, lineUserId });

    // 找到對應的 appUser
    const appUserQuery = await db
      .collection('appUsers')
      .where('lineUserId', '==', lineUserId)
      .limit(1)
      .get();

    if (appUserQuery.empty) {
      console.error('AppUser not found for LINE user:', lineUserId);
      return;
    }

    const appUserId = appUserQuery.docs[0].id;
    const appUserData = appUserQuery.docs[0].data();

    // 獲取警報資料
    const alertDoc = await db.collection('alerts').doc(alertId).get();
    if (!alertDoc.exists) {
      console.error('Alert not found:', alertId);
      return;
    }

    const alertData = alertDoc.data();
    const tenantId = alertData?.tenantId;

    // 確定使用的 Channel Access Token
    const channelAccessToken = matchedTenant?.channelAccessToken || config.channelAccessToken;

    // 檢查是否為被分配者
    if (alertData?.assignedTo !== appUserId) {
      console.log('User is not the assigned person:', { assignedTo: alertData?.assignedTo, appUserId });
      if (channelAccessToken) {
        await sendNotification(
          lineUserId,
          channelAccessToken,
          '⚠️ 此警報未分配給您，無法操作。'
        );
      }
      return;
    }

    // 檢查警報是否已經被處理過（防止重複點擊）
    if (alertData?.assignmentStatus !== 'PENDING') {
      console.log('Alert already processed:', { alertId, status: alertData?.assignmentStatus });
      
      const statusMessages: Record<string, string> = {
        'ACCEPTED': '✅ 此警報您已經接受過了',
        'DECLINED': '❌ 此警報您已經拒絕過了',
      };
      
      if (channelAccessToken) {
        await sendNotification(
          lineUserId,
          channelAccessToken,
          statusMessages[alertData?.assignmentStatus || ''] || '⚠️ 此警報已被處理，無法再次操作。'
        );
      }
      return;
    }

    if (action === 'accept') {
      // 接受警報
      await db.collection('alerts').doc(alertId).update({
        assignmentStatus: 'ACCEPTED',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Alert ${alertId} accepted by ${appUserId}`);

      // 發送確認訊息給用戶
      if (channelAccessToken) {
        await sendNotification(
          lineUserId,
          channelAccessToken,
          `✅ 已接受警報處理\n\n您已接受處理警報「${alertData?.title}」\n\n完成處理後，請到警報詳情頁面標記為已完成。`
        );
      }

      // 通知管理員
      if (tenantId) {
        await notifyAdmins(db, tenantId, channelAccessToken, {
          message: `${appUserData.name || '成員'} 已接受處理警報「${alertData?.title}」`,
          alertId,
        });
      }
    } else if (action === 'decline') {
      // 拒絕警報
      await db.collection('alerts').doc(alertId).update({
        assignmentStatus: 'DECLINED',
        declineReason: '成員在 LINE 中拒絕',
        status: 'PENDING',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Alert ${alertId} declined by ${appUserId}`);

      // 發送確認訊息給用戶
      if (channelAccessToken) {
        await sendNotification(
          lineUserId,
          channelAccessToken,
          `❌ 已拒絕警報處理\n\n您已拒絕處理警報「${alertData?.title}」\n\n管理員將重新分配給其他成員。`
        );
      }

      // 通知管理員重新分配
      if (tenantId) {
        await notifyAdmins(db, tenantId, channelAccessToken, {
          message: `${appUserData.name || '成員'} 拒絕處理警報「${alertData?.title}」\n\n請重新分配處理人員。`,
          alertId,
        });
      }
    }
  } catch (error) {
    console.error('Error handling postback event:', error);
  }
}

// 通知管理員的輔助函數
async function notifyAdmins(
  db: admin.firestore.Firestore,
  tenantId: string,
  channelAccessToken: string,
  data: { message: string; alertId: string }
) {
  try {
    // 獲取所有管理員
    const adminsQuery = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('members')
      .where('role', '==', 'ADMIN')
      .where('status', '==', 'APPROVED')
      .get();

    // 通知所有管理員
    const notifications = adminsQuery.docs.map(async (doc) => {
      const adminData = doc.data();
      const adminUserDoc = await db.collection('appUsers').doc(adminData.appUserId).get();
      const adminUser = adminUserDoc.data();

      if (adminUser?.lineUserId && channelAccessToken) {
        await sendNotification(
          adminUser.lineUserId,
          channelAccessToken,
          data.message
        );
      }
    });

    await Promise.all(notifications);
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
}
