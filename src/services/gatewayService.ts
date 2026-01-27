import {
  where,
  orderBy,
} from 'firebase/firestore';
import {
  getDocument,
  getAllDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  subscribeToCollection,
  toPaginatedResponse,
} from '../lib/firestore';
import type { Gateway, GatewayType } from '../types';

export const gatewayService = {
  // 獲取所有閘道器（分頁）
  getAll: async (page: number = 1, limit: number = 10, tenantId?: string, type?: GatewayType) => {
    try {
      const constraints = [];
      
      if (tenantId) {
        constraints.push(where('tenantId', '==', tenantId));
      }
      if (type) {
        constraints.push(where('type', '==', type));
      }
      
      constraints.push(orderBy('createdAt', 'desc'));
      
      const allGateways = await getAllDocuments<Gateway>('gateways', constraints);
      
      // 手動實現分頁
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = allGateways.slice(startIndex, endIndex);
      
      const response = toPaginatedResponse(paginatedData, page, limit, allGateways.length);
      return { data: response };
    } catch (error) {
      console.error('Failed to get gateways:', error);
      throw error;
    }
  },

  // 訂閱閘道器列表（即時監聽）
  subscribe: (callback: (data: Gateway[]) => void, tenantId?: string, type?: GatewayType) => {
    const constraints = [];
    
    if (tenantId) {
      constraints.push(where('tenantId', '==', tenantId));
    }
    if (type) {
      constraints.push(where('type', '==', type));
    }
    
    constraints.push(orderBy('createdAt', 'desc'));
    
    return subscribeToCollection<Gateway>('gateways', constraints, callback);
  },

  // 獲取單個閘道器
  getOne: async (id: string) => {
    try {
      const gateway = await getDocument<Gateway>('gateways', id);
      return { data: gateway };
    } catch (error) {
      console.error('Failed to get gateway:', error);
      throw error;
    }
  },

  // 新增閘道器（可選擇標記所在社區）
  create: async (data: Partial<Gateway>) => {
    try {
      const id = await createDocument('gateways', {
        ...data,
        type: data.type || 'SAFE_ZONE',
        // tenantId 可以是 null 或社區 ID（僅用於標記位置）
        isActive: data.isActive !== undefined ? data.isActive : true,
        isAD: data.isAD !== undefined ? data.isAD : false,
      });
      const gateway = await getDocument<Gateway>('gateways', id);
      return { data: gateway };
    } catch (error) {
      console.error('Failed to create gateway:', error);
      throw error;
    }
  },

  // 更新閘道器
  update: async (id: string, data: Partial<Gateway>) => {
    try {
      await updateDocument('gateways', id, data);
      const gateway = await getDocument<Gateway>('gateways', id);
      return { data: gateway };
    } catch (error) {
      console.error('Failed to update gateway:', error);
      throw error;
    }
  },

  // 刪除閘道器
  delete: async (id: string) => {
    try {
      await deleteDocument('gateways', id);
      return { data: { success: true } };
    } catch (error) {
      console.error('Failed to delete gateway:', error);
      throw error;
    }
  },
};
