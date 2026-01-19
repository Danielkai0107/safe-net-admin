import {
  where,
  collection,
  getDocs,
  query,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  getDocument,
  getAllDocuments,
  updateDocument,
  subscribeToCollection,
} from '../lib/firestore';
import type { Alert, AlertStatus, AlertType } from '../types';

export const alertService = {
  // 獲取社區的所有警報
  getAll: async (
    tenantId: string,
    status?: AlertStatus,
    type?: AlertType
  ) => {
    try {
      const constraints: any[] = [where('tenantId', '==', tenantId)];
      
      if (status) {
        constraints.push(where('status', '==', status));
      }
      if (type) {
        constraints.push(where('type', '==', type));
      }
      
      // 移除 orderBy，改在客戶端排序
      const alerts = await getAllDocuments<Alert>('alerts', constraints);
      
      // 在記憶體中排序
      alerts.sort((a: any, b: any) => {
        const timeA = a.triggeredAt?.seconds || 0;
        const timeB = b.triggeredAt?.seconds || 0;
        return timeB - timeA;
      });
      
      return { data: alerts };
    } catch (error) {
      console.error('Failed to get alerts:', error);
      throw error;
    }
  },

  // 訂閱警報列表（即時監聽）
  subscribe: (
    tenantId: string,
    callback: (data: Alert[]) => void,
    status?: AlertStatus,
    type?: AlertType
  ) => {
    const constraints: any[] = [where('tenantId', '==', tenantId)];
    
    if (status) {
      constraints.push(where('status', '==', status));
    }
    if (type) {
      constraints.push(where('type', '==', type));
    }
    
    // 移除 orderBy 以避免索引問題，改在客戶端排序
    return subscribeToCollection<Alert>('alerts', constraints, (data) => {
      // 在記憶體中排序
      const sortedData = [...data].sort((a: any, b: any) => {
        const timeA = a.triggeredAt?.seconds || 0;
        const timeB = b.triggeredAt?.seconds || 0;
        return timeB - timeA; // 降序排列
      });
      callback(sortedData);
    });
  },

  // 獲取單個警報
  getOne: async (id: string) => {
    try {
      const alert = await getDocument<Alert>('alerts', id);
      return { data: alert };
    } catch (error) {
      console.error('Failed to get alert:', error);
      throw error;
    }
  },

  // 解決警報
  resolve: async (id: string, resolvedBy: string, resolution: string) => {
    try {
      await updateDocument('alerts', id, {
        status: 'RESOLVED',
        resolvedBy,
        resolution,
        resolvedAt: new Date().toISOString(),
      });
      const alert = await getDocument<Alert>('alerts', id);
      return { data: alert };
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      throw error;
    }
  },

  // 獲取社區成員列表（用於分配）
  getTenantMembers: async (tenantId: string) => {
    try {
      console.log('Getting members for tenant:', tenantId);
      
      const membersQuery = query(
        collection(db, 'tenants', tenantId, 'members'),
        where('status', '==', 'APPROVED')
      );
      
      const membersSnap = await getDocs(membersQuery);
      console.log('Found members count:', membersSnap.docs.length);
      
      // 載入每個成員的 appUser 資料
      const membersWithUsers = await Promise.all(
        membersSnap.docs.map(async (doc) => {
          const memberData = doc.data();
          console.log('Member data:', memberData);
          
          // 獲取對應的 appUser 資料
          if (memberData.appUserId) {
            try {
              const appUserDoc = await getDocument('appUsers', memberData.appUserId);
              return {
                id: doc.id,
                ...memberData,
                appUser: appUserDoc,
              };
            } catch (error) {
              console.error('Failed to get appUser:', memberData.appUserId, error);
              return {
                id: doc.id,
                ...memberData,
              };
            }
          }
          
          return {
            id: doc.id,
            ...memberData,
          };
        })
      );

      // 在記憶體中排序
      membersWithUsers.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      console.log('Returning members with users:', membersWithUsers);
      return { data: membersWithUsers };
    } catch (error) {
      console.error('Failed to get tenant members:', error);
      throw error;
    }
  },
};
