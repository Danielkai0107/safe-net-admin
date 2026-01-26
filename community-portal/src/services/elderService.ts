import {
  query,
  where,
  orderBy,
  collection,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  getDocument,
  getAllDocuments,
  createDocument,
  updateDocument,
  subscribeToCollection,
} from '../lib/firestore';
import type { Elder } from '../types';
import { anonymizeDeviceActivities } from '../utils/anonymizeDeviceActivities';

export const elderService = {
  // 獲取社區的所有長者
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

  // 訂閱長者列表（即時監聽）
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

  // 刪除長者（軟刪除）
  delete: async (id: string) => {
    try {
      // 先獲取長者資料，檢查是否有綁定設備
      const elder = await getDocument('elders', id);
      
      // 如果有綁定設備，先解除綁定並匿名化活動記錄
      if ((elder as any)?.deviceId) {
        const deviceId = (elder as any).deviceId;
        
        // 先匿名化活動記錄
        console.log(`Anonymizing activities for device ${deviceId} before elder deletion...`);
        try {
          const activitiesArchived = await anonymizeDeviceActivities(deviceId, "ELDER_DELETION");
          console.log(`Archived ${activitiesArchived} activities for device ${deviceId}`);
        } catch (error) {
          console.error(`Failed to anonymize activities for device ${deviceId}:`, error);
          // 繼續執行刪除，即使匿名化失敗
        }
        
        // 解綁設備
        await updateDocument('devices', deviceId, {
          bindingType: 'UNBOUND',
          boundTo: null,
          boundAt: null,
        });
        
        console.log(`Unbound device ${deviceId} from elder ${id} before deletion`);
      }
      
      // 軟刪除長者
      await updateDocument('elders', id, { 
        isActive: false,
        deviceId: null,  // 清除 deviceId 引用
      });
      
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to delete elder:', error);
      throw error;
    }
  },

  // 獲取可用設備（該社區 tag 的未綁定設備）
  getAvailableDevices: async (tenantId: string) => {
    try {
      const devicesQuery = query(
        collection(db, 'devices'),
        where('tags', 'array-contains', tenantId),
        where('bindingType', '==', 'UNBOUND'),
        where('isActive', '==', true)
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

  // 綁定設備到長者
  bindDevice: async (elderId: string, deviceId: string) => {
    try {
      // 更新長者記錄
      await updateDocument('elders', elderId, {
        deviceId: deviceId,
      });

      // 更新設備記錄
      await updateDocument('devices', deviceId, {
        bindingType: 'ELDER',
        boundTo: elderId,
        boundAt: new Date().toISOString(),
      });

      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to bind device:', error);
      throw error;
    }
  },

  // 解綁設備
  unbindDevice: async (elderId: string, deviceId: string) => {
    try {
      // 先匿名化活動記錄
      console.log(`Anonymizing activities for device ${deviceId} before unbinding...`);
      try {
        const activitiesArchived = await anonymizeDeviceActivities(deviceId, "ELDER_UNBIND");
        console.log(`Archived ${activitiesArchived} activities for device ${deviceId}`);
      } catch (error) {
        console.error(`Failed to anonymize activities for device ${deviceId}:`, error);
        // 繼續執行解綁，即使匿名化失敗
      }
      
      // 更新長者記錄
      await updateDocument('elders', elderId, {
        deviceId: null,
      });

      // 更新設備記錄
      await updateDocument('devices', deviceId, {
        bindingType: 'UNBOUND',
        boundTo: null,
        boundAt: null,
      });

      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to unbind device:', error);
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
            gatewayId: data.gatewayId,
            gatewayName: data.gatewayName,
            gatewayType: data.gatewayType,
            latitude: data.latitude,
            longitude: data.longitude,
            rssi: data.rssi,
            bindingType: data.bindingType,
            triggeredNotification: data.triggeredNotification,
            notificationType: data.notificationType,
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
        });

      console.log(`After filtering: ${activities.length} ELDER activities in time range`);
      return { data: activities };
    } catch (error) {
      console.error('Failed to get elder activities:', error);
      return { data: [] };
    }
  },
};
