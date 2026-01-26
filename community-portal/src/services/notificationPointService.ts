import {
  query,
  where,
  orderBy,
  collection,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  getAllDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  subscribeToCollection,
} from '../lib/firestore';
import type { TenantNotificationPoint, Gateway } from '../types';

export const notificationPointService = {
  // 訂閱通知點列表
  subscribe: (tenantId: string, callback: (data: TenantNotificationPoint[]) => void) => {
    const constraints: any[] = [
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    ];

    return subscribeToCollection<TenantNotificationPoint>(
      'tenantNotificationPoints',
      constraints,
      async (points) => {
        // 載入關聯的 gateway 資料
        const pointsWithGateway = await Promise.all(
          points.map(async (point) => {
            if (point.gatewayId) {
              const gateway = await getDoc(doc(db, 'gateways', point.gatewayId));
              if (gateway.exists()) {
                return {
                  ...point,
                  gateway: { id: gateway.id, ...gateway.data() } as Gateway,
                };
              }
            }
            return point;
          })
        );
        callback(pointsWithGateway);
      }
    );
  },

  // 獲取通知點列表（非即時）
  getAll: async (tenantId: string) => {
    try {
      const constraints: any[] = [
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc')
      ];
      const points = await getAllDocuments<TenantNotificationPoint>(
        'tenantNotificationPoints',
        constraints
      );
      return { data: points };
    } catch (error) {
      console.error('Failed to get notification points:', error);
      throw error;
    }
  },

  // 新增通知點
  create: async (data: Partial<TenantNotificationPoint>) => {
    try {
      const id = await createDocument('tenantNotificationPoints', {
        ...data,
        notifyOnElderActivity: data.notifyOnElderActivity !== false, // 預設為 true
        isActive: data.isActive !== false, // 預設為 true
      });
      
      // 統一通知架構：新增通知點後，同步到該社區的所有設備
      if (data.tenantId && data.gatewayId) {
        await notificationPointService.syncTenantDevices(data.tenantId);
      }
      
      return { data: { id } };
    } catch (error) {
      console.error('Failed to create notification point:', error);
      throw error;
    }
  },

  // 更新通知點
  update: async (id: string, data: Partial<TenantNotificationPoint>) => {
    try {
      await updateDocument('tenantNotificationPoints', id, data);
      
      // 統一通知架構：更新通知點後，重新同步到該社區的所有設備
      if (data.tenantId) {
        await notificationPointService.syncTenantDevices(data.tenantId);
      } else {
        // 如果沒有提供 tenantId，先查詢該通知點的 tenantId
        const pointDoc = await getDoc(doc(db, 'tenantNotificationPoints', id));
        if (pointDoc.exists()) {
          const tenantId = pointDoc.data().tenantId;
          if (tenantId) {
            await notificationPointService.syncTenantDevices(tenantId);
          }
        }
      }
      
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to update notification point:', error);
      throw error;
    }
  },

  // 刪除通知點
  delete: async (id: string) => {
    try {
      // 先查詢該通知點的 tenantId，以便刪除後同步設備
      const pointDoc = await getDoc(doc(db, 'tenantNotificationPoints', id));
      const tenantId = pointDoc.exists() ? pointDoc.data().tenantId : null;
      
      await deleteDocument('tenantNotificationPoints', id);
      
      // 統一通知架構：刪除通知點後，重新同步到該社區的所有設備
      if (tenantId) {
        await notificationPointService.syncTenantDevices(tenantId);
      }
      
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to delete notification point:', error);
      throw error;
    }
  },

  // 獲取所有可用的 gateways（不限社區，讓社區管理員自行選擇）
  getAvailableGateways: async (_tenantId?: string) => {
    try {
      const gatewaysQuery = query(
        collection(db, 'gateways'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(gatewaysQuery);
      const gateways = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Gateway[];

      return { data: gateways };
    } catch (error) {
      console.error('Failed to get available gateways:', error);
      throw error;
    }
  },

  // 統一通知架構：同步社區的通知點到所有該社區的設備
  syncTenantDevices: async (tenantId: string) => {
    try {
      console.log(`Syncing notification points for tenant ${tenantId}`);
      
      // 1. 查詢該社區的所有啟用通知點
      const notificationPointsQuery = query(
        collection(db, 'tenantNotificationPoints'),
        where('tenantId', '==', tenantId),
        where('isActive', '==', true)
      );
      const notificationPointsSnapshot = await getDocs(notificationPointsQuery);
      const gatewayIds = notificationPointsSnapshot.docs.map(doc => doc.data().gatewayId);
      
      console.log(`Found ${gatewayIds.length} active notification points for tenant ${tenantId}`);
      
      // 2. 查詢該社區的所有設備（使用 tags）
      const devicesQuery = query(
        collection(db, 'devices'),
        where('tags', 'array-contains', tenantId)
      );
      const devicesSnapshot = await getDocs(devicesQuery);
      
      console.log(`Found ${devicesSnapshot.docs.length} devices in tenant ${tenantId}`);
      
      // 3. 批量更新所有設備的 inheritedNotificationPointIds
      const updatePromises = devicesSnapshot.docs.map(deviceDoc => {
        const updateData: any = {
          inheritedNotificationPointIds: gatewayIds.length > 0 ? gatewayIds : null,
        };
        return updateDocument('devices', deviceDoc.id, updateData);
      });
      
      await Promise.all(updatePromises);
      
      console.log(`Successfully synced ${devicesSnapshot.docs.length} devices with ${gatewayIds.length} notification points`);
      
      return { data: { 
        success: true, 
        devicesUpdated: devicesSnapshot.docs.length,
        notificationPoints: gatewayIds.length,
      }};
    } catch (error) {
      console.error('Failed to sync tenant devices:', error);
      throw error;
    }
  },
};
