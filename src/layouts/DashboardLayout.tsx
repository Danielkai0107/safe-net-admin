import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  Home,
  Users,
  Smartphone,
  Radio,
  LogOut,
  Building2,
  UserCog,
  Tag,
  MapPin,
  Shield,
  Menu,
  Store,
} from "lucide-react";
import { useState } from "react";
import haloLogo from "../assets/halo_logo.png";

export const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const navigationItems = [
    { path: "/dashboard", label: "總覽", icon: Home },
    { type: "divider" as const },
    { path: "/tenants", label: "Line OA 管理", icon: Building2 },
    { path: "/elders", label: "長者管理", icon: Users },
    { path: "/map-app-users", label: "Line 用戶管理", icon: MapPin },
    { type: "divider" as const },
    { path: "/uuids", label: "UUID 管理", icon: Tag },
    { path: "/devices", label: "Beacon 管理", icon: Smartphone },
    { path: "/gateways", label: "GateWay 管理", icon: Radio },
    { path: "/stores", label: "商店管理", icon: Store },
    { type: "divider" as const },
    { path: "/users", label: "系統人員管理", icon: UserCog },
    { path: "/saas-users", label: "SaaS 用戶管理", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部欄 */}
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          {/* 左側：選單按鈕 */}
          <div className="flex items-center">
            <button
              onClick={toggleSidebar}
              className="btn btn--ghost btn--icon"
              title={sidebarCollapsed ? "展開側邊欄" : "收起側邊欄"}
            >
              <Menu
                className="btn__icon"
                style={{ width: "1.5rem", height: "1.5rem" }}
              />
            </button>
          </div>

          {/* 中間：Logo */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <img src={haloLogo} alt="Halo Logo" className="admin-logo" />
          </div>

          {/* 右側：保留空間平衡布局 */}
          <div className="w-10"></div>
        </div>
      </header>

      {/* 側邊欄 */}
      <aside
        className={`sidebar ${sidebarCollapsed ? "sidebar--collapsed" : ""}`}
      >
        <div className="flex flex-col h-full">
          <nav className="sidebar__nav flex-1">
            {navigationItems.map((item, index) => {
              if (item.type === "divider") {
                return (
                  <div key={`divider-${index}`} className="sidebar__divider" />
                );
              }

              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                  }
                  title={sidebarCollapsed ? item.label : ""}
                >
                  <Icon className="sidebar__icon" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* 用戶資訊 */}
          {user && (
            <div className="border-t border-gray-200 p-4">
              <div
                className={`flex items-center ${sidebarCollapsed ? "justify-center" : "space-x-3"}`}
              >
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.email}
                    </p>
                    <button
                      onClick={handleLogout}
                      className="mt-2 text-xs text-primary hover:text-primary-dark transition-colors"
                    >
                      登出
                    </button>
                  </div>
                )}
                {sidebarCollapsed && (
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="登出"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* 主內容區 */}
      <main
        className={`pt-14 transition-all duration-200 ${sidebarCollapsed ? "pl-20" : "pl-64"}`}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
