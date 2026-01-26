import {
  query,
  where,
  orderBy,
  getDocs,
  collection,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  getDocument,
  getAllDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  subscribeToCollection,
  toPaginatedResponse,
} from '../lib/firestore';
import type { Tenant } from '../types';

export const tenantService = {
  // 獲取所有社區（分頁）
  getAll: async (page: number = 1, limit: number = 10) => {
    try {
      const constraints = [orderBy('createdAt', 'desc')];
      const allTenants = await getAllDocuments<Tenant>('tenants', constraints);
      
      // 手動實現分頁
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = allTenants.slice(startIndex, endIndex);
      
      const response = toPaginatedResponse(paginatedData, page, limit, allTenants.length);
      return { data: response };
    } catch (error) {
      console.error('Failed to get tenants:', error);
      throw error;
    }
  },

  // 訂閱社區列表（即時監聽）
  subscribe: (callback: (data: Tenant[]) => void) => {
    const constraints = [orderBy('createdAt', 'desc')];
    return subscribeToCollection<Tenant>('tenants', constraints, callback);
  },

  // 獲取單個社區
  getOne: async (id: string) => {
    try {
      const tenant = await getDocument<Tenant>('tenants', id);
      return { data: tenant };
    } catch (error) {
      console.error('Failed to get tenant:', error);
      throw error;
    }
  },

  // 獲取社區統計
  getStats: async (id: string) => {
    try {
      // 統計該社區的長者、設備、閘道器數量
      const eldersQuery = query(collection(db, 'elders'), where('tenantId', '==', id));
      const devicesQuery = query(collection(db, 'devices'), where('tenantId', '==', id));
      const gatewaysQuery = query(collection(db, 'gateways'), where('tenantId', '==', id));
      const alertsQuery = query(
        collection(db, 'alerts'),
        where('tenantId', '==', id),
        where('status', '==', 'PENDING')
      );

      const [eldersSnap, devicesSnap, gatewaysSnap, alertsSnap] = await Promise.all([
        getDocs(eldersQuery),
        getDocs(devicesQuery),
        getDocs(gatewaysQuery),
        getDocs(alertsQuery),
      ]);

      return {
        data: {
          elders: eldersSnap.size,
          devices: devicesSnap.size,
          gateways: gatewaysSnap.size,
          pendingAlerts: alertsSnap.size,
        },
      };
    } catch (error) {
      console.error('Failed to get tenant stats:', error);
      throw error;
    }
  },

  // 新增社區
  create: async (data: Partial<Tenant>) => {
    try {
      const id = await createDocument('tenants', {
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
      const tenant = await getDocument<Tenant>('tenants', id);
      return { data: tenant };
    } catch (error) {
      console.error('Failed to create tenant:', error);
      throw error;
    }
  },

  // 更新社區
  update: async (id: string, data: Partial<Tenant>) => {
    try {
      await updateDocument('tenants', id, data);
      const tenant = await getDocument<Tenant>('tenants', id);
      return { data: tenant };
    } catch (error) {
      console.error('Failed to update tenant:', error);
      throw error;
    }
  },

  // 刪除社區
  delete: async (id: string) => {
    try {
      // 注意：在實際應用中，可能需要先檢查是否有關聯的長者、設備等
      // 或使用 Cloud Functions 進行級聯刪除
      await deleteDocument('tenants', id);
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      throw error;
    }
  },

  // App 成員管理
  // 通過該社區的 Channel Access Token 獲取 LINE OA 好友列表
  getAppMembers: async (id: string) => {
    try {
      // 調用 Cloud Function 獲取該社區的 LINE OA 好友列表
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../config/firebase');
      const getTenantFollowers = httpsCallable(functions, 'getTenantFollowers');
      
      const result: any = await getTenantFollowers({ tenantId: id });
      const followers = result.data?.followers || [];
      
      // 從 members 集合獲取已設置的角色
      const membersRef = collection(db, 'tenants', id, 'members');
      const membersSnap = await getDocs(query(membersRef));
      
      // 創建一個 map，方便查找角色
      const memberRoleMap = new Map<string, { role: string; memberId: string }>();
      membersSnap.docs.forEach(doc => {
        const memberData = doc.data();
        if (memberData.appUserId) {
          memberRoleMap.set(memberData.appUserId, {
            role: memberData.role || 'MEMBER',
            memberId: doc.id,
          });
        }
      });
      
      // 將好友列表轉換為成員列表格式
      const members = followers.map((appUser: any) => {
        const memberInfo = memberRoleMap.get(appUser.id);
        return {
          id: memberInfo?.memberId || `virtual_${appUser.id}`,
          lineUserId: appUser.id,
          role: memberInfo?.role || 'MEMBER',
          appUser: {
            id: appUser.id,
            ...appUser,
          },
          createdAt: appUser.createdAt || Timestamp.now(),
        };
      });
      
      // 按創建時間排序
      members.sort((a: any, b: any) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime;
      });

      return { data: members };
    } catch (error) {
      console.error('Failed to get app members:', error);
      throw error;
    }
  },

  // 核准成員
  approveMember: async (tenantId: string, memberId: string) => {
    try {
      await updateDocument(`tenants/${tenantId}/members`, memberId, {
        status: 'APPROVED',
        approvedAt: Timestamp.now(),
      });
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to approve member:', error);
      throw error;
    }
  },

  // 拒絕成員
  rejectMember: async (tenantId: string, memberId: string, reason?: string) => {
    try {
      await updateDocument(`tenants/${tenantId}/members`, memberId, {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedAt: Timestamp.now(),
      });
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to reject member:', error);
      throw error;
    }
  },

  // 設定成員角色
  setMemberRole: async (tenantId: string, memberId: string, role: 'MEMBER' | 'ADMIN') => {
    try {
      await updateDocument(`tenants/${tenantId}/members`, memberId, {
        role,
      });
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to set member role:', error);
      throw error;
    }
  },

  // 新增成員
  addMember: async (tenantId: string, appUserId: string, role: 'MEMBER' | 'ADMIN' = 'MEMBER') => {
    try {
      await createDocument(`tenants/${tenantId}/members`, {
        appUserId,
        role,
        status: 'APPROVED',
        approvedAt: Timestamp.now(),
      });
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to add member:', error);
      throw error;
    }
  },

  // 移除成員
  removeMember: async (tenantId: string, memberId: string) => {
    try {
      await deleteDocument(`tenants/${tenantId}/members`, memberId);
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to remove member:', error);
      throw error;
    }
  },

  // 設備分配管理
  getDevices: async (id: string) => {
    try {
      const devicesQuery = query(
        collection(db, 'devices'),
        where('tenantId', '==', id),
        orderBy('createdAt', 'desc')
      );
      const devicesSnap = await getDocs(devicesQuery);
      
      const devices = devicesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { data: devices };
    } catch (error) {
      console.error('Failed to get devices:', error);
      throw error;
    }
  },

  // 分配設備到社區
  assignDevices: async (id: string, deviceIds: string[]) => {
    try {
      // 統一通知架構：查詢社區的通知點
      const notificationPointsQuery = query(
        collection(db, 'tenantNotificationPoints'),
        where('tenantId', '==', id),
        where('isActive', '==', true)
      );
      const notificationPointsSnapshot = await getDocs(notificationPointsQuery);
      const gatewayIds = notificationPointsSnapshot.docs.map(doc => doc.data().gatewayId);

      // 批量更新設備：設定社區關聯和繼承通知點
      await Promise.all(
        deviceIds.map(async deviceId => {
          const updateData: any = { 
            tenantId: id,  // 舊架構，向後相容
            tags: [id],    // 新架構
            inheritedNotificationPointIds: gatewayIds.length > 0 ? gatewayIds : null,
          };

          await updateDocument('devices', deviceId, updateData);
        })
      );
      
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to assign devices:', error);
      throw error;
    }
  },

  // 移除設備
  removeDevice: async (_tenantId: string, deviceId: string) => {
    try {
      // 統一通知架構：移除社區 tag 時清除繼承的通知點
      await updateDocument('devices', deviceId, { 
        tenantId: null,  // 清除舊架構
        tags: [],  // 清除新架構
        inheritedNotificationPointIds: null,  // 清除繼承的通知點
      });
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to remove device:', error);
      throw error;
    }
  },
};
