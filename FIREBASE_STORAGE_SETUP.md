# Firebase Storage CORS 設定指南

## 問題描述

當嘗試上傳圖片到 Firebase Storage 時遇到 CORS 錯誤：

```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' has been blocked by CORS policy
```

## 解決方案

### 1. 設定 CORS 配置

#### 方法 A：使用 Google Cloud Shell（推薦）

1. 前往 [Google Cloud Storage Console](https://console.cloud.google.com/storage/browser?project=safe-net-tw)
2. 點擊右上角的 **Activate Cloud Shell** 按鈕
3. 在 Cloud Shell 中執行：

```bash
# 創建 CORS 配置文件
cat > cors.json << 'EOF'
[
  {
    "origin": ["http://localhost:3000", "http://localhost:5173", "https://admin.safe-net.tw"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization", "Content-Length"]
  }
]
EOF

# 應用 CORS 配置到 Storage Bucket
gsutil cors set cors.json gs://safe-net-tw.appspot.com

# 驗證配置是否成功
gsutil cors get gs://safe-net-tw.appspot.com
```

#### 方法 B：使用本機的 Google Cloud SDK

如果您已安裝 Google Cloud SDK：

```bash
# 登入 Google Cloud
gcloud auth login

# 設定項目
gcloud config set project safe-net-tw

# 應用 CORS 配置（使用項目根目錄的 cors.json）
gsutil cors set cors.json gs://safe-net-tw.appspot.com
```

### 2. 設定 Firebase Storage Security Rules

1. 前往 [Firebase Storage Rules](https://console.firebase.google.com/project/safe-net-tw/storage/safe-net-tw.appspot.com/rules)
2. 更新規則為：

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // 店家相關圖片：已認證用戶可上傳，所有人可讀取
    match /stores/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.resource.size < 5 * 1024 * 1024; // 限制 5MB
    }

    // 其他檔案：需要認證
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. 點擊 **發布** 按鈕

### 3. 驗證設定

完成上述步驟後：

1. 重新整理瀏覽器
2. 嘗試上傳圖片
3. 應該可以成功上傳

## 注意事項

- CORS 配置需要在 Google Cloud Storage 層級設定，無法在 Firebase Console 中設定
- Security Rules 在 Firebase Console 中設定
- 如果要新增更多允許的來源網域，請在 `origin` 陣列中添加
- 生產環境部署後，記得將生產環境的網域加入 CORS 配置

## 故障排除

### 如果仍然遇到 CORS 錯誤：

1. **清除瀏覽器快取**：按 Cmd + Shift + R (Mac) 或 Ctrl + Shift + R (Windows)
2. **確認 Storage Rules 已發布**：在 Firebase Console 中檢查
3. **等待幾分鐘**：CORS 設定可能需要幾分鐘才能生效
4. **檢查 Network 標籤**：在瀏覽器開發者工具中查看實際的請求和回應

### 如果上傳仍然失敗：

1. 確認使用者已登入（StoresPage 需要在 ProtectedRoute 內）
2. 檢查 Firebase Authentication 是否正常運作
3. 查看瀏覽器 Console 的完整錯誤訊息

## 相關檔案

- `cors.json` - CORS 配置文件
- `src/services/storageService.ts` - 檔案上傳服務
- `src/pages/StoresPage.tsx` - 店家管理頁面
- `src/config/firebase.ts` - Firebase 配置
