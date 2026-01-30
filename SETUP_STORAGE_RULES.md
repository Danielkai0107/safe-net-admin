# Firebase Storage Rules 設置指南

## 步驟 1：初始化 Firebase Storage（如果尚未初始化）

1. 前往：https://console.firebase.google.com/project/safe-net-tw/storage
2. 如果看到 "Get Started" 按鈕，點擊它
3. 選擇「以正式版模式啟動」或「以測試模式啟動」（建議選測試模式，稍後會更新規則）
4. 選擇位置（建議：asia-east1 或 asia-northeast1）
5. 點擊「完成」

## 步驟 2：手動設置 Storage Rules（方法 A - 推薦）

1. 在 Firebase Console 的 Storage 頁面
2. 點擊 **Rules** 標籤
3. 將以下規則複製貼上：

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // 店家相關圖片：已認證用戶可上傳，所有人可讀取
    match /stores/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // 其他檔案：需要認證
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

4. 點擊 **發布** 按鈕

## 步驟 3：使用 Firebase CLI 部署（方法 B - 自動化）

初始化完成後，在終端執行：

```bash
firebase deploy --only storage
```

## 步驟 4：設置 CORS（重要！）

在 Google Cloud Console 中設置 CORS：

1. 前往：https://console.cloud.google.com/storage/browser?project=safe-net-tw
2. 點擊右上角的 **Activate Cloud Shell**
3. 執行以下命令：

```bash
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

gsutil cors set cors.json gs://safe-net-tw.appspot.com
gsutil cors get gs://safe-net-tw.appspot.com
```

## 驗證設置

完成後：

1. 重新整理瀏覽器（Cmd + Shift + R）
2. 嘗試上傳圖片
3. 應該可以成功！

## 規則說明

### stores/\*\* 路徑

- **讀取**：任何人都可以（公開圖片）
- **寫入**：
  - 必須已登入
  - 檔案大小 < 5MB
  - 只能上傳圖片格式

### 其他路徑

- **讀取/寫入**：只有已登入用戶
- 檔案大小限制 < 10MB

## 故障排除

### 如果部署失敗

- 確認已在 Firebase Console 中初始化 Storage
- 檢查 Firebase CLI 是否已登入：`firebase login`
- 確認項目正確：`firebase use safe-net-tw`

### 如果仍有 CORS 錯誤

- 清除瀏覽器快取
- 等待 2-3 分鐘讓 CORS 設置生效
- 確認 Storage Rules 已發布

## 相關文件

- `storage.rules` - Storage 安全規則文件
- `cors.json` - CORS 配置文件
- `firebase.json` - Firebase 專案配置
