# Safe-Net 社區守護者管理系統

基於 Firebase 的長者照護管理系統，提供即時監控和警報功能。

## 🚀 技術棧

- **前端框架**: React 19 + TypeScript
- **路由**: React Router v7
- **狀態管理**: Zustand
- **UI 框架**: Tailwind CSS
- **表單處理**: React Hook Form
- **後端服務**: Firebase
  - Firebase Authentication（認證）
  - Firestore Database（資料庫）
- **構建工具**: Vite
- **日期處理**: date-fns

## ✨ 主要功能

### 管理功能
- 🏢 **社區管理** - 多社區支援，成員管理
- 👴 **長者管理** - 長者資料、活動追蹤
- 📱 **設備管理** - BLE 設備綁定與監控
- 📡 **閘道器管理** - 接收點配置與管理
- 🚨 **警報管理** - 即時警報處理與追蹤
- 👥 **用戶管理** - 管理員權限控制
- 📊 **儀表板** - 系統總覽與統計

### 技術特點
- ⚡ **即時同步** - 所有資料變更自動推送
- 🔐 **安全認證** - Firebase Authentication
- 📴 **離線支援** - Firestore 離線快取
- 🎯 **TypeScript** - 完整的類型安全
- 🎨 **現代 UI** - Tailwind CSS + Lucide Icons

## 📦 安裝

```bash
# 克隆專案
git clone <repository-url>
cd admin

# 安裝依賴
npm install
```

## 🔧 Firebase 設置

在運行應用之前，您需要完成 Firebase 設置：

1. **閱讀設置指南**
   ```bash
   cat FIREBASE_SETUP.md
   ```

2. **主要步驟**：
   - 在 Firebase Console 設置 Firestore 安全規則
   - 啟用 Firebase Authentication（電子郵件/密碼）
   - 創建測試用戶帳號
   - 在 Firestore 添加對應的用戶資料

詳細步驟請參考 [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md)

## 🏃 運行

```bash
# 開發模式
npm run dev

# 構建生產版本
npm run build

# 預覽生產版本
npm run preview
```

應用將在 `http://localhost:3000` 啟動

## 🔑 測試帳號

設置完成後，使用以下帳號登入：

- **超級管理員**
  - Email: `admin@safenet.com`
  - Password: `admin123456`

- **社區管理員**
  - Email: `admin@dalove.com`
  - Password: `admin123`

## 📁 專案結構

```
src/
├── config/
│   └── firebase.ts          # Firebase 配置
├── lib/
│   └── firestore.ts         # Firestore 工具函數
├── services/
│   ├── authService.ts       # 認證服務
│   ├── tenantService.ts     # 社區服務
│   ├── elderService.ts      # 長者服務
│   ├── deviceService.ts     # 設備服務
│   ├── gatewayService.ts    # 閘道器服務
│   ├── alertService.ts      # 警報服務
│   ├── userService.ts       # 用戶服務
│   ├── appUserService.ts    # App 用戶服務
│   └── dashboardService.ts  # 儀表板服務
├── pages/
│   ├── LoginPage.tsx        # 登入頁面
│   ├── DashboardPage.tsx    # 儀表板
│   ├── TenantsPage.tsx      # 社區管理
│   ├── EldersPage.tsx       # 長者管理
│   ├── DevicesPage.tsx      # 設備管理
│   ├── GatewaysPage.tsx     # 閘道器管理
│   ├── AlertsPage.tsx       # 警報管理
│   ├── UsersPage.tsx        # 用戶管理
│   └── AppUsersPage.tsx     # App 用戶管理
├── components/
│   ├── Modal.tsx            # 通用彈窗
│   ├── ConfirmDialog.tsx    # 確認對話框
│   └── ProtectedRoute.tsx   # 路由保護
├── layouts/
│   └── DashboardLayout.tsx  # 主要佈局
├── store/
│   └── authStore.ts         # 認證狀態管理
├── types/
│   └── index.ts             # TypeScript 類型定義
├── App.tsx                  # 應用入口
└── main.tsx                 # React 入口
```

## 🗄️ 資料結構

Firestore 集合結構：

- `users` - 管理員用戶
- `tenants` - 社區資料
  - `members` (子集合) - 社區成員
- `elders` - 長者資料
  - `activities` (子集合) - 活動記錄
  - `locations` (子集合) - 位置記錄
- `devices` - 設備資料
- `gateways` - 閘道器資料
- `alerts` - 警報記錄
- `appUsers` - App 用戶資料

詳細結構請參考 [`MIGRATION_SUMMARY.md`](./MIGRATION_SUMMARY.md)

## 🔐 權限角色

系統支援三種用戶角色：

- **SUPER_ADMIN** - 超級管理員
  - 管理所有社區
  - 管理所有用戶
  - 系統設置

- **TENANT_ADMIN** - 社區管理員
  - 管理所屬社區
  - 管理社區內的長者和設備
  - 處理警報

- **STAFF** - 一般員工
  - 查看資料
  - 基本操作

## 📊 即時監聽

所有列表頁面都實現了即時監聽功能：

```typescript
// 範例：訂閱社區列表
useEffect(() => {
  const unsubscribe = tenantService.subscribe((data) => {
    setTenants(data);
  });
  
  return () => unsubscribe(); // 清理訂閱
}, []);
```

當資料在 Firestore 中變更時，UI 會自動更新，無需手動刷新。

## 🛠️ 開發指南

### 添加新功能

1. 在 `src/types/index.ts` 定義類型
2. 在 `src/services/` 創建服務
3. 在 `src/pages/` 創建頁面組件
4. 在 `src/App.tsx` 添加路由

### 服務層模式

```typescript
export const myService = {
  // 獲取列表（分頁）
  getAll: async (page, limit) => { /* ... */ },
  
  // 訂閱列表（即時監聽）
  subscribe: (callback) => { /* ... */ },
  
  // 獲取單個
  getOne: async (id) => { /* ... */ },
  
  // 創建
  create: async (data) => { /* ... */ },
  
  // 更新
  update: async (id, data) => { /* ... */ },
  
  // 刪除
  delete: async (id) => { /* ... */ },
};
```

## ⚠️ 注意事項

### 安全規則
- 目前使用開放的安全規則（開發用）
- **生產環境前必須更新安全規則**
- 參考 `FIREBASE_SETUP.md` 中的生產環境規則

### 成本優化
- Firestore 按讀寫次數計費
- 即時監聽會增加讀取次數
- 建議使用查詢限制和快取

### 索引
- 複合查詢需要建立索引
- Firebase 會在錯誤訊息中提供索引創建連結
- 點擊連結即可自動創建

## 📚 文件

- [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) - Firebase 設置指南
- [`MIGRATION_SUMMARY.md`](./MIGRATION_SUMMARY.md) - 遷移總結與資料結構

## 🐛 故障排除

### 登入失敗
- 確認 Firebase Authentication 已啟用電子郵件/密碼登入
- 確認已創建測試用戶
- 確認 Firestore 中有對應的用戶資料

### 無法讀取資料
- 檢查 Firestore 安全規則
- 確認網路連接
- 檢查瀏覽器控制台錯誤

### 索引錯誤
- 點擊錯誤訊息中的連結創建索引
- 等待索引創建完成（通常幾分鐘）

## 📝 授權

[您的授權信息]

## 👥 貢獻

[貢獻指南]

## 📞 聯絡

[聯絡信息]

---

**注意**: 本系統已從 REST API 完全遷移到 Firebase。所有功能都使用 Firebase Authentication 和 Firestore Database。
# safe-net-admin
