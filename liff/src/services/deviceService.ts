import { Device } from "../types";

// Cloud Functions 的 Base URL
const API_BASE_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL || "https://us-central1-safe-net-tw.cloudfunctions.net";

interface BindDeviceResponse {
  success: boolean;
  device?: {
    id: string;
    uuid: string;
    major: number;
    minor: number;
    deviceName: string;
    nickname?: string;
    age?: number;
    gender?: string;
  };
  boundAt?: string;
  error?: string;
}

interface UnbindDeviceResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface UpdateDeviceProfileResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Update bound device profile (nickname, age, gender only). Product serial cannot be changed.
 */
export const updateDeviceProfile = async (
  lineUserId: string,
  data: { nickname?: string | null; age?: number | null; gender?: "MALE" | "FEMALE" | "OTHER" | null },
): Promise<UpdateDeviceProfileResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/updateLineUserDeviceProfile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId,
        nickname: data.nickname,
        age: data.age,
        gender: data.gender,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to update device profile");
    }
    return result;
  } catch (error: any) {
    console.error("Error updating device profile:", error);
    return {
      success: false,
      error: error.message || "Failed to update device profile",
    };
  }
};

/**
 * Bind device to LINE user
 */
export const bindDevice = async (
  lineUserId: string,
  deviceName: string,
  nickname?: string,
  age?: number,
  gender?: "MALE" | "FEMALE" | "OTHER",
): Promise<BindDeviceResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/bindDeviceToLineUser`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lineUserId,
        deviceName,
        nickname,
        age,
        gender,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to bind device");
    }

    return data;
  } catch (error: any) {
    console.error("Error binding device:", error);
    return {
      success: false,
      error: error.message || "Failed to bind device",
    };
  }
};

/**
 * Unbind device from LINE user
 */
export const unbindDevice = async (
  lineUserId: string,
): Promise<UnbindDeviceResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/unbindDeviceFromLineUser`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lineUserId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to unbind device");
    }

    return data;
  } catch (error: any) {
    console.error("Error unbinding device:", error);
    return {
      success: false,
      error: error.message || "Failed to unbind device",
    };
  }
};

/**
 * Get binding status (check if user has bound device)
 * This function queries Firestore directly
 */
export const getBindingStatus = async (
  lineUserId: string,
): Promise<{
  isBound: boolean;
  deviceId?: string;
  device?: Device;
}> => {
  try {
    const { collection, query, where, getDocs } = await import(
      "firebase/firestore"
    );
    const { db } = await import("../config/firebase");

    // Find LINE user
    const lineUsersQuery = query(
      collection(db, "line_users"),
      where("lineUserId", "==", lineUserId),
    );

    const lineUsersSnapshot = await getDocs(lineUsersQuery);

    if (lineUsersSnapshot.empty) {
      return { isBound: false };
    }

    const lineUserData = lineUsersSnapshot.docs[0].data();
    const boundDeviceId = lineUserData.boundDeviceId;

    if (!boundDeviceId) {
      return { isBound: false };
    }

    // Get device data
    const { doc, getDoc } = await import("firebase/firestore");
    const deviceDoc = await getDoc(doc(db, "devices", boundDeviceId));

    if (!deviceDoc.exists()) {
      return { isBound: false };
    }

    const deviceData = deviceDoc.data();

    return {
      isBound: true,
      deviceId: boundDeviceId,
      device: {
        id: deviceDoc.id,
        ...deviceData,
      } as Device,
    };
  } catch (error) {
    console.error("Error getting binding status:", error);
    return { isBound: false };
  }
};
