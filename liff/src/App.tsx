import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loading } from './components/Loading';
import { Layout } from './components/Layout';
import { useAuth } from './hooks/useAuth';
import { useTenantStore } from './store/tenantStore';
import { TenantSelectScreen } from './screens/TenantSelectScreen';
import { ElderListScreen } from './screens/elders/ElderListScreen';
import { ElderDetailScreen } from './screens/elders/ElderDetailScreen';
import { AddElderScreen } from './screens/elders/AddElderScreen';
import { AlertListScreen } from './screens/alerts/AlertListScreen';
import { AlertDetailScreen } from './screens/alerts/AlertDetailScreen';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import type { Tenant } from './types';

const App = () => {
  return (
    <BrowserRouter basename="/liff">
      <AppContent />
    </BrowserRouter>
  );
};

const AppContent = () => {
  const { isLoading, isAuthenticated, error, memberships, tenant } = useAuth();
  const { selectTenant } = useTenantStore();
  
  const handleSelectTenant = (_tenantId: string, tenantData: Tenant) => {
    selectTenant(tenantData);
  };

  // 如果用戶只屬於一個社區，自動選擇該社區
  useEffect(() => {
    if (!isLoading && isAuthenticated && !tenant && memberships.length === 1 && memberships[0].tenant) {
      handleSelectTenant(memberships[0].tenantId, memberships[0].tenant);
    }
  }, [isLoading, isAuthenticated, tenant, memberships]);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="text-red-600 text-center mb-4">
            <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold mb-2 text-gray-900">無法載入</h2>
            <p className="text-gray-700 text-sm whitespace-pre-line">{error}</p>
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>提示：</strong>
              <br/>1. 請確認您已在後台設定社區的 LINE LIFF ID
              <br/>2. 請從 LINE 圖文選單點擊進入
              <br/>3. 或使用完整的 LIFF 連結（含 tenantId 參數）
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">正在進行身份驗證...</p>
        </div>
      </div>
    );
  }

  // 如果用戶還沒選擇社區，顯示社區選擇頁面
  // （如果只有一個社區，useEffect 會自動選擇）
  if (!tenant) {
    return <TenantSelectScreen memberships={memberships} onSelectTenant={handleSelectTenant} />;
  }

  // 已選擇社區，顯示主應用
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/elders" replace />} />
        <Route path="/elders" element={<ElderListScreen />} />
        <Route path="/elders/:id" element={<ElderDetailScreen />} />
        <Route path="/elders/add" element={<AddElderScreen />} />
        <Route path="/alerts" element={<AlertListScreen />} />
        <Route path="/alerts/:id" element={<AlertDetailScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/elders" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;
