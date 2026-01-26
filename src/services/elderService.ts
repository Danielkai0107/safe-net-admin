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
  subscribeToCollection,
  toPaginatedResponse,
} from '../lib/firestore';
import type { Elder } from '../types';
import { anonymizeDeviceActivities } from '../utils/anonymizeDeviceActivities';

export const elderService = {
  // 獲取所有長者（分頁）
  getAll: async (page: number = 1, limit: number = 10, tenantId?: string) => {
    try {
      const constraints = [];
      if (tenantId) {
        constraints.push(where('tenantId', '==', tenantId));
      }
      // 只顯示啟用的長者（與 Community Portal 一致）
      constraints.push(where('isActive', '==', true));
      
      const allElders = await getAllDocuments<Elder>('elders', constraints);
      
      // 在記憶體中排序
      allElders.sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      // 手動實現分頁
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = allElders.slice(startIndex, endIndex);
      
      const response = toPaginatedResponse(paginatedData, page, limit, allElders.length);
      return { data: response };
    } catch (error) {
      console.error('Failed to get elders:', error);
      throw error;
    }
  },

  // 訂閱長者列表（即時監聽）
  subscribe: (callback: (data: Elder[]) => void, tenantId?: string) => {
    const constraints = [];
    if (tenantId) {
      constraints.push(where('tenantId', '==', tenantId));
    }
    // 只顯示啟用的長者（與 Community Portal 一致）
    constraints.push(where('isActive', '==', true));
    
    return subscribeToCollection<Elder>('elders', constraints, (data) => {
      // 在記憶體中排序
      const sortedData = [...data].sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      callback(sortedData);
    });
  },

  // 獲取單個長者
  getOne: async (id: string) => {
    try {
      const elder = await getDocument<Elder>('elders', id);
      return { data: elder };
    } catch (error) {
      console.error('Failed to get elder:', error);
      throw error;
    }
  },

  // 獲取長者活動記錄（從設備的 activities 子集合讀取）
  getActivity: async (id: string, hours: number = 24) => {
    try {
      // 先獲取長者資料以取得綁定的設備 ID
      const elderDoc = await getDocument('elders', id);
      const deviceId = (elderDoc as any)?.deviceId;
      
      if (!deviceId) {
        console.log('Elder has no bound device, no activities to show');
        return { data: [] };
      }
      
      console.log(`Loading activities for elder ${id}, device ${deviceId}`);
      
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hours);
      
      // 從設備的子集合查詢活動記錄
      const activityQuery = query(
        collection(db, 'devices', deviceId, 'activities'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      const activitySnap = await getDocs(activityQuery);
      console.log(`Found ${activitySnap.docs.length} total activities for device`);
      
      // 在客戶端過濾時間範圍和綁定類型
      const activities = activitySnap.docs
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
        });

      console.log(`After filtering: ${activities.length} ELDER activities in time range`);
      return { data: activities };
    } catch (error) {
      console.error('Failed to get elder activity:', error);
      throw error;
    }
  },

  // 獲取長者位置記錄
  getLocation: async (id: string, limitCount: number = 50) => {
    try {
      const locationQuery = query(
        collection(db, 'elders', id, 'locations'),
        orderBy('timestamp', 'desc')
      );
      
      const locationSnap = await getDocs(locationQuery);
      const locations = locationSnap.docs
        .slice(0, limitCount)
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

      return { data: locations };
    } catch (error) {
      console.error('Failed to get elder location:', error);
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
        deviceId: data.deviceId || null,
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

  // 刪除長者（與 Community Portal 一致：軟刪除）
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
      
      // 軟刪除長者（與 Community Portal 一致）
      await updateDocument('elders', id, {
        isActive: false,
        deviceId: null,
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
