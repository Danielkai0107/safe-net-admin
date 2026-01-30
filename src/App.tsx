import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TenantsPage } from "./pages/TenantsPage";
import { UsersPage } from "./pages/UsersPage";
import { SaasUsersPage } from "./pages/SaasUsersPage";
import { MapAppUsersPage } from "./pages/MapAppUsersPage";
import { MapAppUserDetailPage } from "./pages/MapAppUserDetailPage";
import { EldersPage } from "./pages/EldersPage";
import { ElderDetailPage } from "./pages/ElderDetailPage";
import { DevicesPage } from "./pages/DevicesPage";
import { DeviceDetailPage } from "./pages/DeviceDetailPage";
import { UUIDsPage } from "./pages/UUIDsPage";
import { GatewaysPage } from "./pages/GatewaysPage";
import { StoresPage } from "./pages/StoresPage";
import { StoreDetailPage } from "./pages/StoreDetailPage";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuthStore } from "./store/authStore";

function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    // 初始化 Firebase Auth 監聽器
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="saas-users" element={<SaasUsersPage />} />
          <Route path="map-app-users" element={<MapAppUsersPage />} />
          <Route path="map-app-users/:id" element={<MapAppUserDetailPage />} />
          <Route path="elders" element={<EldersPage />} />
          <Route path="elders/:id" element={<ElderDetailPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="devices/:id" element={<DeviceDetailPage />} />
          <Route path="uuids" element={<UUIDsPage />} />
          <Route path="gateways" element={<GatewaysPage />} />
          <Route path="stores" element={<StoresPage />} />
          <Route path="stores/:id" element={<StoreDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
