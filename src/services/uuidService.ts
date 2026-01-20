import { where } from 'firebase/firestore';
import { 
  createDocument, 
  updateDocument, 
  deleteDocument, 
  getDocument,
  subscribeToCollection 
} from '../lib/firestore';
import type { BeaconUUID } from '../types';

export const uuidService = {
  // 訂閱所有 UUID
  subscribe: (callback: (data: BeaconUUID[]) => void) => {
    return subscribeToCollection<BeaconUUID>('beacon_uuids', [], (data) => {
      // 按創建時間排序
      const sortedData = [...data].sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      callback(sortedData);
    });
  },

  // 訂閱活躍的 UUID
  subscribeActive: (callback: (data: BeaconUUID[]) => void) => {
    const constraints = [where('isActive', '==', true)];
    return subscribeToCollection<BeaconUUID>('beacon_uuids', constraints, (data) => {
      const sortedData = [...data].sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      callback(sortedData);
    });
  },

  // 獲取單個 UUID
  getOne: async (id: string) => {
    try {
      const beaconUuid = await getDocument<BeaconUUID>('beacon_uuids', id);
      return { data: beaconUuid };
    } catch (error) {
      console.error('Failed to get beacon UUID:', error);
      throw error;
    }
  },

  // 根據 UUID 字串獲取記錄
  getByUuid: async (uuid: string) => {
    try {
      // 這裡需要實際執行查詢，但為了簡化，我們先返回 null
      // 實際應該使用 getDocs 來查詢
      console.log('Searching for UUID:', uuid);
      return { data: null };
    } catch (error) {
      console.error('Failed to get beacon UUID by uuid string:', error);
      throw error;
    }
  },

  // 新增 UUID
  create: async (data: Partial<BeaconUUID>) => {
    try {
      const id = await createDocument('beacon_uuids', {
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
      const beaconUuid = await getDocument<BeaconUUID>('beacon_uuids', id);
      return { data: beaconUuid };
    } catch (error) {
      console.error('Failed to create beacon UUID:', error);
      throw error;
    }
  },

  // 更新 UUID
  update: async (id: string, data: Partial<BeaconUUID>) => {
    try {
      await updateDocument('beacon_uuids', id, data);
      const beaconUuid = await getDocument<BeaconUUID>('beacon_uuids', id);
      return { data: beaconUuid };
    } catch (error) {
      console.error('Failed to update beacon UUID:', error);
      throw error;
    }
  },

  // 刪除 UUID
  delete: async (id: string) => {
    try {
      await deleteDocument('beacon_uuids', id);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete beacon UUID:', error);
      throw error;
    }
  },
};
