import {
  query,
  where,
  orderBy,
  collection,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  getDocument,
  getAllDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  subscribeToCollection,
  toPaginatedResponse,
} from "../lib/firestore";
import type { Device } from "../types";
import { anonymizeDeviceActivities } from "../utils/anonymizeDeviceActivities";

// 生成設備序號：6碼大寫英文字母 + 4碼數字
const generateDeviceSerial = (): string => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";

  let letterPart = "";
  for (let i = 0; i < 6; i++) {
    letterPart += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  let numberPart = "";
  for (let i = 0; i < 4; i++) {
    numberPart += digits.charAt(Math.floor(Math.random() * digits.length));
  }

  return letterPart + numberPart;
};

// 驗證設備序號格式：6碼英文字母 + 4碼數字
const isValidDeviceSerial = (serial: string): boolean => {
  const pattern = /^[A-Za-z]{6}[0-9]{4}$/;
  return pattern.test(serial);
};

export const deviceService = {
  // 獲取所有設備
  getAll: async (page: number = 1, limit: number = 10, tenantId?: string) => {
    try {
      const constraints = [];
      if (tenantId) {
        constraints.push(where("tenantId", "==", tenantId));
      }

      const allDevices = await getAllDocuments<Device>("devices", constraints);

      // 在記憶體中排序
      allDevices.sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      // 手動分頁
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = allDevices.slice(startIndex, endIndex);

      const response = toPaginatedResponse(
        paginatedData,
        page,
        limit,
        allDevices.length,
      );
      return { data: response };
    } catch (error) {
      console.error("Failed to get devices:", error);
      throw error;
    }
  },

  // 訂閱設備列表（即時監聽）
  subscribe: (callback: (data: Device[]) => void, tenantId?: string) => {
    const constraints = [];
    if (tenantId) {
      constraints.push(where("tenantId", "==", tenantId));
    }

    return subscribeToCollection<Device>("devices", constraints, (data) => {
      // 在記憶體中排序
      const sortedData = [...data].sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      callback(sortedData);
    });
  },

  // 獲取單個設備
  getOne: async (id: string) => {
    try {
      const device = await getDocument<Device>("devices", id);
      return { data: device };
    } catch (error) {
      console.error("Failed to get device:", error);
      throw error;
    }
  },

  // 根據 UUID 獲取設備（主要判定指標）
  // Note: UUID is normalized to lowercase for case-insensitive matching
  getByUuid: async (uuid: string) => {
    try {
      const normalizedUuid = uuid.toLowerCase();
      const devicesQuery = query(
        collection(db, "devices"),
        where("uuid", "==", normalizedUuid),
      );

      const devicesSnap = await getDocs(devicesQuery);
      if (devicesSnap.empty) {
        return { data: null };
      }

      const device = {
        id: devicesSnap.docs[0].id,
        ...devicesSnap.docs[0].data(),
      };

      return { data: device };
    } catch (error) {
      console.error("Failed to get device by UUID:", error);
      throw error;
    }
  },

  // 根據 MAC Address 獲取設備（輔助查詢）
  getByMacAddress: async (macAddress: string) => {
    try {
      const devicesQuery = query(
        collection(db, "devices"),
        where("macAddress", "==", macAddress),
      );

      const devicesSnap = await getDocs(devicesQuery);
      if (devicesSnap.empty) {
        return { data: null };
      }

      const device = {
        id: devicesSnap.docs[0].id,
        ...devicesSnap.docs[0].data(),
      };

      return { data: device };
    } catch (error) {
      console.error("Failed to get device by MAC address:", error);
      throw error;
    }
  },

  // 根據設備序號獲取設備（檢查重複用）
  getByDeviceName: async (deviceName: string) => {
    try {
      const devicesQuery = query(
        collection(db, "devices"),
        where("deviceName", "==", deviceName.toUpperCase()),
      );

      const devicesSnap = await getDocs(devicesQuery);
      if (devicesSnap.empty) {
        return { data: null };
      }

      const device = {
        id: devicesSnap.docs[0].id,
        ...devicesSnap.docs[0].data(),
      };

      return { data: device };
    } catch (error) {
      console.error("Failed to get device by device name:", error);
      throw error;
    }
  },

  // 生成唯一的設備序號
  generateUniqueSerial: async (): Promise<string> => {
    let serial = generateDeviceSerial();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existing = await deviceService.getByDeviceName(serial);
      if (!existing.data) {
        return serial;
      }
      serial = generateDeviceSerial();
      attempts++;
    }

    throw new Error("無法生成唯一的設備序號，請稍後再試");
  },

  // 驗證設備序號格式
  validateSerial: (serial: string): boolean => {
    return isValidDeviceSerial(serial);
  },

  // 根據 UUID + Major + Minor 獲取設備（Beacon 主要查詢方式）
  // Note: UUID is normalized to lowercase for case-insensitive matching
  getByMajorMinor: async (uuid: string, major: number, minor: number) => {
    try {
      const normalizedUuid = uuid.toLowerCase();
      const devicesQuery = query(
        collection(db, "devices"),
        where("uuid", "==", normalizedUuid),
        where("major", "==", major),
        where("minor", "==", minor),
      );

      const devicesSnap = await getDocs(devicesQuery);
      if (devicesSnap.empty) {
        return { data: null };
      }

      const device = {
        id: devicesSnap.docs[0].id,
        ...devicesSnap.docs[0].data(),
      };

      return { data: device };
    } catch (error) {
      console.error("Failed to get device by UUID/Major/Minor:", error);
      throw error;
    }
  },

  // 新增設備（初始登記，不綁定）
  // Note: UUID is normalized to lowercase for case-insensitive matching
  create: async (data: Partial<Device>) => {
    try {
      // Normalize UUID to lowercase before saving
      const normalizedData = {
        ...data,
        uuid: data.uuid ? data.uuid.toLowerCase() : data.uuid,
      };

      // 統一通知架構：如果有社區 tag，查詢並設定 inheritedNotificationPointIds
      let inheritedNotificationPointIds: string[] | null = null;
      
      if (normalizedData.tags && normalizedData.tags.length > 0) {
        const tenantId = normalizedData.tags[0]; // 取第一個 tag 作為社區 ID
        console.log(`Device create: querying notification points for tenant ${tenantId}`);
        
        try {
          const notificationPointsQuery = query(
            collection(db, 'tenantNotificationPoints'),
            where('tenantId', '==', tenantId),
            where('isActive', '==', true)
          );
          const notificationPointsSnapshot = await getDocs(notificationPointsQuery);
          const gatewayIds = notificationPointsSnapshot.docs.map(doc => doc.data().gatewayId as string);
          
          if (gatewayIds.length > 0) {
            inheritedNotificationPointIds = gatewayIds;
            console.log(`Device create: found ${gatewayIds.length} notification points for tenant ${tenantId}`);
          }
        } catch (error) {
          console.error(`Failed to query notification points for tenant ${tenantId}:`, error);
          // 繼續創建設備，即使查詢失敗
        }
      }

      const id = await createDocument("devices", {
        ...normalizedData,
        type: normalizedData.type || "GENERIC_BLE",
        bindingType: "UNBOUND", // 初始登記時未綁定
        boundTo: null,
        boundAt: null,
        tags: normalizedData.tags || [], // 標籤（例如社區 ID）
        inheritedNotificationPointIds: inheritedNotificationPointIds, // 統一通知架構：繼承通知點
        mapUserNickname: null,
        mapUserAge: null,
        mapUserGender: null,
        isActive:
          normalizedData.isActive !== undefined
            ? normalizedData.isActive
            : true,
      });
      const device = await getDocument<Device>("devices", id);
      return { data: device };
    } catch (error) {
      console.error("Failed to create device:", error);
      throw error;
    }
  },

  // 更新設備
  // Note: UUID is normalized to lowercase for case-insensitive matching
  update: async (id: string, data: Partial<Device>) => {
    try {
      // Normalize UUID to lowercase if provided
      const normalizedData = { ...data };
      if (normalizedData.uuid) {
        normalizedData.uuid = normalizedData.uuid.toLowerCase();
      }

      // 統一通知架構：檢查 tags 變更，同步 inheritedNotificationPointIds
      if (normalizedData.tags !== undefined) {
        console.log(`Device ${id}: checking tags for changes...`);
        
        const currentDevice = await getDocument<Device>("devices", id);
        const oldTags = currentDevice?.tags || [];
        const newTags = normalizedData.tags || [];
        
        console.log(`Device ${id}: oldTags = [${oldTags.join(', ')}], newTags = [${newTags.join(', ')}]`);
        
        // 檢查是否有社區 tag 變更
        const tagsChanged = 
          oldTags.length !== newTags.length ||
          !oldTags.every(tag => newTags.includes(tag)) ||
          !newTags.every(tag => oldTags.includes(tag));
        
        if (tagsChanged) {
          console.log(`Device ${id}: tags changed from [${oldTags.join(', ')}] to [${newTags.join(', ')}]`);
          
          // 如果移除了所有 tag 或清空 tag
          if (newTags.length === 0) {
            // 清空繼承的通知點
            (normalizedData as any).inheritedNotificationPointIds = null;
            console.log(`Device ${id}: cleared inheritedNotificationPointIds (no tags)`);
          } else {
            // 如果有新的社區 tag，重新查詢通知點
            const tenantId = newTags[0]; // 取第一個 tag 作為社區 ID
            console.log(`Device ${id}: querying notification points for tenant ${tenantId}`);
            
            const notificationPointsQuery = query(
              collection(db, 'tenantNotificationPoints'),
              where('tenantId', '==', tenantId),
              where('isActive', '==', true)
            );
            const notificationPointsSnapshot = await getDocs(notificationPointsQuery);
            const gatewayIds = notificationPointsSnapshot.docs.map(doc => doc.data().gatewayId as string);
            
            console.log(`Device ${id}: found ${gatewayIds.length} notification points for tenant ${tenantId}`);
            
            // 更新繼承的通知點
            (normalizedData as any).inheritedNotificationPointIds = gatewayIds.length > 0 ? gatewayIds : null;
            console.log(`Device ${id}: updated inheritedNotificationPointIds = [${gatewayIds.join(', ')}]`);
          }
        } else {
          console.log(`Device ${id}: tags unchanged, skipping notification points sync`);
        }
      }

      await updateDocument("devices", id, normalizedData);
      const device = await getDocument<Device>("devices", id);
      return { data: device };
    } catch (error) {
      console.error("Failed to update device:", error);
      throw error;
    }
  },

  // 刪除設備
  delete: async (id: string) => {
    try {
      await deleteDocument("devices", id);
      return { data: { success: true } };
    } catch (error) {
      console.error("Failed to delete device:", error);
      throw error;
    }
  },

  // 關聯設備到長者 - 使用新的 bindingType 架構
  assignToElder: async (deviceId: string, elderId: string | null) => {
    try {
      const batch = writeBatch(db);
      const timestamp = serverTimestamp();

      const deviceRef = doc(db, "devices", deviceId);

      if (!elderId) {
        // 解綁：將設備設為 UNBOUND
        
        // 先匿名化活動記錄（在 batch 操作前執行）
        console.log(`Anonymizing activities for device ${deviceId} before unbinding...`);
        try {
          const activitiesArchived = await anonymizeDeviceActivities(deviceId, "ELDER_UNBIND");
          console.log(`Archived ${activitiesArchived} activities for device ${deviceId}`);
        } catch (error) {
          console.error(`Failed to anonymize activities for device ${deviceId}:`, error);
          // 繼續執行解綁，即使匿名化失敗
        }
        
        const eldersQuery = query(
          collection(db, "elders"),
          where("deviceId", "==", deviceId),
        );
        const eldersSnap = await getDocs(eldersQuery);
        eldersSnap.forEach((elderDoc) => {
          batch.update(elderDoc.ref, { deviceId: null, updatedAt: timestamp });
        });

        batch.update(deviceRef, {
          bindingType: "UNBOUND",
          boundTo: null,
          boundAt: null,
          updatedAt: timestamp,
        });
      } else {
        // 綁定：設為 ELDER 類型

        // A. 解除該長者原本綁定的設備
        const oldDevicesQuery = query(
          collection(db, "devices"),
          where("boundTo", "==", elderId),
          where("bindingType", "==", "ELDER"),
        );
        const oldDevicesSnap = await getDocs(oldDevicesQuery);
        oldDevicesSnap.forEach((deviceDoc) => {
          if (deviceDoc.id !== deviceId) {
            batch.update(deviceDoc.ref, {
              bindingType: "UNBOUND",
              boundTo: null,
              boundAt: null,
              updatedAt: timestamp,
            });
          }
        });

        // B. 解除該設備原本綁定的長者
        const oldEldersQuery = query(
          collection(db, "elders"),
          where("deviceId", "==", deviceId),
        );
        const oldEldersSnap = await getDocs(oldEldersQuery);
        oldEldersSnap.forEach((elderDoc) => {
          if (elderDoc.id !== elderId) {
            batch.update(elderDoc.ref, {
              deviceId: null,
              updatedAt: timestamp,
            });
          }
        });

        // C. 更新長者的 deviceId
        const elderRef = doc(db, "elders", elderId);
        batch.update(elderRef, { deviceId: deviceId, updatedAt: timestamp });

        // D. 執行新的綁定（使用新的資料結構）
        batch.update(deviceRef, {
          bindingType: "ELDER",
          boundTo: elderId,
          boundAt: timestamp,
          updatedAt: timestamp,
        });
      }

      await batch.commit();
      const updatedDevice = await getDocument<Device>("devices", deviceId);
      return { data: updatedDevice };
    } catch (error) {
      console.error("Failed to assign device to elder:", error);
      throw error;
    }
  },

  // 獲取未綁定的設備（使用新的 bindingType）
  getUnboundDevices: async () => {
    try {
      const constraints = [
        where("bindingType", "==", "UNBOUND"),
        orderBy("createdAt", "desc"),
      ];
      const devices = await getAllDocuments<Device>("devices", constraints);
      return { data: devices };
    } catch (error) {
      console.error("Failed to get unbound devices:", error);
      throw error;
    }
  },

  // 獲取有特定標籤但未綁定的設備（例如：某社區的可用設備）
  getAvailableDevicesByTag: async (tag: string) => {
    try {
      const constraints = [
        where("tags", "array-contains", tag),
        where("bindingType", "==", "UNBOUND"),
        orderBy("createdAt", "desc"),
      ];
      const devices = await getAllDocuments<Device>("devices", constraints);
      return { data: devices };
    } catch (error) {
      console.error("Failed to get available devices by tag:", error);
      throw error;
    }
  },

  // 向後相容：獲取未分配社區的設備（舊函數名，內部使用新邏輯）
  getUnassignedDevices: async () => {
    return deviceService.getUnboundDevices();
  },

  // 向後相容：獲取社區可用設備（舊函數名，內部使用新邏輯）
  getAvailableDevicesInTenant: async (tenantId: string) => {
    return deviceService.getAvailableDevicesByTag(tenantId);
  },

  // 解除設備綁定（通用方法，支援 ELDER 和 MAP_USER）
  unbindDevice: async (deviceId: string) => {
    try {
      // 取得設備資料
      const device = await getDocument<Device>("devices", deviceId);
      if (!device) {
        throw new Error("找不到設備");
      }

      // 統一匿名化：先匿名化活動記錄（在解綁前執行）
      console.log(`Anonymizing activities for device ${deviceId} before unbinding...`);
      const unbindReason = device.bindingType === "ELDER" ? "ELDER_UNBIND" : 
                           device.bindingType === "MAP_USER" ? "MAP_USER_UNBIND" : 
                           "DEVICE_UNBIND";
      
      try {
        const activitiesArchived = await anonymizeDeviceActivities(deviceId, unbindReason);
        console.log(`Archived ${activitiesArchived} activities for device ${deviceId}`);
      } catch (error) {
        console.error(`Failed to anonymize activities for device ${deviceId}:`, error);
        // 繼續執行解綁，即使匿名化失敗
      }

      const batch = writeBatch(db);
      const timestamp = serverTimestamp();
      const deviceRef = doc(db, "devices", deviceId);

      if (device.bindingType === "ELDER" && device.boundTo) {
        // 解除長者綁定：同時更新長者的 deviceId
        const elderRef = doc(db, "elders", device.boundTo);
        batch.update(elderRef, {
          deviceId: null,
          updatedAt: timestamp,
        });
      } else if (device.bindingType === "MAP_USER" && device.boundTo) {
        // 解除 MAP_USER 綁定：同時更新 mapAppUsers 的 boundDeviceId
        const userRef = doc(db, "app_users", device.boundTo);
        batch.update(userRef, {
          boundDeviceId: null,
          updatedAt: timestamp,
        });
      }

      // 清除設備的綁定資訊
      batch.update(deviceRef, {
        bindingType: "UNBOUND",
        boundTo: null,
        boundAt: null,
        mapUserNickname: null,
        mapUserAge: null,
        mapUserGender: null,
        updatedAt: timestamp,
      });

      await batch.commit();
      const updatedDevice = await getDocument<Device>("devices", deviceId);
      return { data: updatedDevice };
    } catch (error) {
      console.error("Failed to unbind device:", error);
      throw error;
    }
  },
};
