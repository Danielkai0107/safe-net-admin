import {
  query,
  where,
  orderBy,
  limit,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  getDocument,
  getAllDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  subscribeToCollection,
} from '../lib/firestore';
import type { Elder, Activity } from '../types';

export const elderService = {
  // 獲取社區的所有長者（只顯示 isActive = true 的長輩）
  getAll: async (tenantId: string) => {
    try {
      const constraints: any[] = [
        where('tenantId', '==', tenantId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      ];
      const elders = await getAllDocuments<Elder>('elders', constraints);
      return { data: elders };
    } catch (error) {
      console.error('Failed to get elders:', error);
      throw error;
    }
  },

  // 訂閱長者列表（即時監聯，只顯示 isActive = true 的長輩）
  subscribe: (tenantId: string, callback: (data: Elder[]) => void) => {
    const constraints: any[] = [
      where('tenantId', '==', tenantId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    ];
    return subscribeToCollection<Elder>('elders', constraints, callback);
  },

  // 獲取單個長者（包含關聯設備資料）
  getOne: async (id: string) => {
    try {
      const elder = await getDocument<Elder>('elders', id);
      
      // 如果長者有綁定設備，載入設備資料
      if (elder && elder.deviceId) {
        const device = await getDocument<any>('devices', elder.deviceId);
        if (device) {
          elder.device = device;
        }
      }
      
      return { data: elder };
    } catch (error) {
      console.error('Failed to get elder:', error);
      throw error;
    }
  },

  // 獲取長者活動記錄（從設備的 activities 子集合讀取）
  getActivities: async (elderId: string, hours: number = 24) => {
    try {
      // 先獲取長者資料以取得綁定的設備 ID
      const elderDoc = await getDocument('elders', elderId);
      const deviceId = (elderDoc as any)?.deviceId;
      
      if (!deviceId) {
        console.log('Elder has no bound device, no activities to show');
        return { data: [] };
      }
      
      console.log(`Loading activities for elder ${elderId}, device ${deviceId}`);
      
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hours);
      
      // 從設備的子集合查詢活動記錄
      const activitiesQuery = query(
        collection(db, 'devices', deviceId, 'activities'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      const activitiesSnap = await getDocs(activitiesQuery);
      console.log(`Found ${activitiesSnap.docs.length} total activities for device`);
      
      // 在客戶端過濾時間範圍和綁定類型
      const activities = activitiesSnap.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            timestamp: data.timestamp,
            gateway: data.gateway || {
              name: data.gatewayName,
              location: data.gatewayLocation,
            },
            latitude: data.latitude,
            longitude: data.longitude,
            rssi: data.rssi,
            bindingType: data.bindingType,
          };
        })
        .filter((activity: any) => {
          // 只顯示 ELDER 類型的活動
          if (activity.bindingType !== 'ELDER') return false;
          
          // 時間範圍過濾
          let activityDate: Date;
          const timestamp = activity.timestamp;
          if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
            activityDate = timestamp.toDate();
          } else if (timestamp?.seconds) {
            activityDate = new Date(timestamp.seconds * 1000);
          } else {
            activityDate = new Date(timestamp);
          }
          
          return activityDate >= startTime;
        }) as Activity[];

      console.log(`After filtering: ${activities.length} ELDER activities in time range`);
      return { data: activities };
    } catch (error) {
      console.error('Failed to get elder activities:', error);
      // 如果查詢失敗，返回空陣列而不是拋出錯誤
      console.error('Returning empty array due to error');
      return { data: [] };
    }
  },

  // 新增長者
  create: async (data: Partial<Elder>) => {
    try {
      const id = await createDocument('elders', {
        ...data,
        status: data.status || 'ACTIVE',
        inactiveThresholdHours: data.inactiveThresholdHours || 24,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
      const elder = await getDocument<Elder>('elders', id);
      return { data: elder };
    } catch (error) {
      console.error('Failed to create elder:', error);
      throw error;
    }
  },

  // 更新長者
  update: async (id: string, data: Partial<Elder>) => {
    try {
      await updateDocument('elders', id, data);
      const elder = await getDocument<Elder>('elders', id);
      return { data: elder };
    } catch (error) {
      console.error('Failed to update elder:', error);
      throw error;
    }
  },

  // 刪除長者
  delete: async (id: string) => {
    try {
      await deleteDocument('elders', id);
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to delete elder:', error);
      throw error;
    }
  },

  // 獲取可用設備（該社區 tag 的未綁定設備）
  getAvailableDevices: async (tenantId: string) => {
    try {
      // 使用新的資料結構：tags 陣列包含社區 ID，bindingType 為 UNBOUND
      const devicesQuery = query(
        collection(db, 'devices'),
        where('tags', 'array-contains', tenantId),
        where('bindingType', '==', 'UNBOUND')
      );
      
      const devicesSnap = await getDocs(devicesQuery);
      const availableDevices = devicesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { data: availableDevices };
    } catch (error) {
      console.error('Failed to get available devices:', error);
      throw error;
    }
  },

  // 獲取長者最新位置
  getLatestLocation: async (elderId: string) => {
    try {
      const locationDoc = await getDocument<any>('latest_locations', elderId);
      return { data: locationDoc };
    } catch (error) {
      console.error('Failed to get latest location:', error);
      return { data: null };
    }
  },
};
