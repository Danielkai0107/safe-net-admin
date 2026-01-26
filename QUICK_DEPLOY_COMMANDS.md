# 快速部署指令

## 🚀 一鍵部署所有變更

```bash
# 在專案根目錄執行
cd /Users/danielkai/Desktop/admin

# 1. 構建所有專案
echo "📦 構建 Admin Portal..."
npm run build

echo "📦 構建 Community Portal..."
cd community-portal && npm run build && cd ..

echo "📦 構建 Cloud Functions..."
cd functions && npm run build && cd ..

# 2. 部署
echo "🚀 開始部署..."
firebase deploy

echo "✅ 部署完成！"
```

## 📋 分步驟部署（推薦）

### 步驟 1：部署 Cloud Functions（最重要）

```bash
cd /Users/danielkai/Desktop/admin/functions
npm run build
firebase deploy --only functions
```

**新增的 Functions：**
- `unbindDeviceFromElder` - 長者解綁 API

**預計時間：** 3-5 分鐘

---

### 步驟 2：部署 Admin Portal

```bash
cd /Users/danielkai/Desktop/admin
npm run build
firebase deploy --only hosting:admin
```

**主要變更：**
- 裝置編輯 UUID 自動選中
- Tag 變更自動同步通知點
- 長者解綁匿名化

**預計時間：** 1-2 分鐘

---

### 步驟 3：部署 Community Portal

```bash
cd /Users/danielkai/Desktop/admin/community-portal
npm run build
firebase deploy --only hosting:community-portal
```

**主要變更：**
- 通知點變更自動同步
- 長者解綁/刪除匿名化

**預計時間：** 1-2 分鐘

---

### 步驟 4：執行資料遷移與清理

```bash
cd /Users/danielkai/Desktop/admin/functions

# 4.1 遷移通知架構資料（Dry Run）
echo "📊 預覽資料遷移..."
npx ts-node src/migrations/migrateNotificationArchitecture.ts

# 確認無誤後執行
echo "🔄 執行資料遷移..."
npx ts-node src/migrations/migrateNotificationArchitecture.ts --live

# 4.2 同步社區通知點
echo "🔄 同步社區通知點到設備..."
npx ts-node src/utils/syncTenantNotificationPoints.ts

# 4.3 清理幽靈設備（Dry Run）
echo "🧹 預覽清理幽靈設備..."
npx ts-node src/utils/cleanupGhostDeviceActivities.ts

# 確認無誤後執行
echo "🧹 執行清理幽靈設備..."
npx ts-node src/utils/cleanupGhostDeviceActivities.ts --live

echo "✅ 所有資料處理完成！"
```

**預計時間：** 5-15 分鐘（取決於資料量）

---

## 🔍 部署後驗證

```bash
# 檢查 Cloud Functions 狀態
firebase functions:list

# 查看最新日誌
firebase functions:log --limit 50

# 檢查特定 Function
firebase functions:log --only unbindDeviceFromElder
```

## 📱 功能測試清單

### Admin Portal

```bash
# 打開 Admin Portal
open https://admin-[YOUR-PROJECT].web.app
```

- [ ] 裝置管理 → 編輯設備 → UUID 自動選中
- [ ] 裝置管理 → 變更社區 → 檢查 Console 日誌
- [ ] 長者管理 → 解綁設備 → 檢查匿名化日誌
- [ ] 長者管理 → 刪除長者 → 檢查設備解綁

### Community Portal

```bash
# 打開 Community Portal
open https://community-[YOUR-PROJECT].web.app
```

- [ ] 通知點管理 → 新增通知點 → 檢查設備更新
- [ ] 通知點管理 → 刪除通知點 → 檢查設備更新
- [ ] 長者管理 → 解綁設備 → 檢查匿名化
- [ ] 長者管理 → 刪除長者 → 檢查資料清理

### Firestore 驗證

在 Firebase Console 檢查：

```bash
# 打開 Firestore Console
open https://console.firebase.google.com/project/[YOUR-PROJECT]/firestore
```

- [ ] `devices` → 選一個設備 → 檢查新欄位
  - `fcmToken`（MAP_USER 設備）
  - `inheritedNotificationPointIds`（社區設備）
  - `notificationPoints` 子集合（MAP_USER 設備）

- [ ] `anonymousActivities` → 檢查新記錄
  - `bindingType: "ANONYMOUS"`
  - `boundTo: null`
  - `anonymizedReason` 欄位

## 🆘 回滾指令

如果出現問題需要緊急回滾：

```bash
cd /Users/danielkai/Desktop/admin

# 查看最近的 commit
git log --oneline -5

# 回滾到上一個版本
git revert HEAD

# 重新部署
npm run build
cd community-portal && npm run build && cd ..
cd functions && npm run build && cd ..
firebase deploy

echo "⚠️ 已回滾到前一個版本"
```

## 📊 預期結果

### 資料庫變化

**新增集合：**
- `anonymousActivities` - 大量增長

**清空子集合：**
- `devices/{unboundDeviceId}/activities` - 解綁後清空

**新增欄位：**
- `devices.fcmToken` - MAP_USER 設備
- `devices.notificationEnabled` - MAP_USER 設備
- `devices.inheritedNotificationPointIds` - 社區設備

### 用戶體驗

- ⬆️ 通知點管理：更自動化
- ⬆️ 設備管理：更智能
- ⬆️ 隱私保護：更完善
- ➡️ 操作流程：無變化

## 🎯 成功指標

部署成功的標誌：

✅ 所有 Firebase Functions 部署成功  
✅ 兩個 Portal 網站正常訪問  
✅ 通知功能正常運作  
✅ 資料遷移無錯誤  
✅ 清理腳本執行成功  
✅ 無用戶投訴  

## 📞 支援

如有問題：

1. **查看文檔：**
   - `COMPLETE_IMPLEMENTATION_SUMMARY.md` - 完整總結
   - `NOTIFICATION_ARCHITECTURE_DEPLOYMENT.md` - 部署指南
   - `ELDER_UNBIND_ANONYMIZATION.md` - 匿名化說明

2. **檢查日誌：**
   ```bash
   firebase functions:log --limit 100
   ```

3. **執行診斷：**
   ```bash
   # 檢查幽靈設備數量
   cd functions
   npx ts-node src/utils/cleanupGhostDeviceActivities.ts
   ```

---

**準備就緒！** 🎉

所有程式碼已完成並構建成功，文檔齊全，可以開始部署流程。

建議順序：
1. 先部署 Cloud Functions（最重要）
2. 再部署兩個 Portal
3. 最後執行資料遷移和清理

祝部署順利！🚀
