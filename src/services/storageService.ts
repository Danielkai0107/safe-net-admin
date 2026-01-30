import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../config/firebase";

const STORES_PREFIX = "stores";

/** 將檔名中的非安全字元替換為底線 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * 上傳店家相關圖片到 Firebase Storage。
 * 路徑：stores/{folder}/{timestamp}_{檔名}
 * @param file 檔案
 * @param folder 子資料夾，例如 "logos" | "images"
 * @returns 下載 URL
 */
export async function uploadStoreImage(
  file: File,
  folder: "logos" | "images"
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
  const path = `${STORES_PREFIX}/${folder}/${Date.now()}_${safeName}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "image/jpeg",
  });
  return getDownloadURL(storageRef);
}
