import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  Home, Users, Smartphone, Radio, Bell, 
  LayoutDashboard, LogOut, Building2, UserCog, UserCircle, TestTube, Tag,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState } from 'react';

export const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    { path: '/dashboard', icon: Home, label: '總覽' },
    { type: 'divider' as const },
    { path: '/tenants', icon: Building2, label: '社區管理' },
    { path: '/elders', icon: Users, label: '長者管理' },
    { path: '/app-users', icon: UserCircle, label: 'Line 好友成員' },
    { type: 'divider' as const },
    { path: '/uuids', icon: Tag, label: 'UUID 管理' },
    { path: '/devices', icon: Smartphone, label: 'Beacon 管理' },
    { path: '/gateways', icon: Radio, label: 'GateWay 管理' },
    { type: 'divider' as const },
    { path: '/alerts', icon: Bell, label: '警報管理' },
    { type: 'divider' as const },
    { path: '/beacon-test', icon: TestTube, label: 'Line 通知測試' },
    { path: '/users', icon: UserCog, label: '系統人員管理' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 bg-white border-r border-gray-200 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
              <LayoutDashboard className="w-8 h-8 text-primary-600 flex-shrink-0" />
              {!isCollapsed && (
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Safe-Net</h1>
                  <p className="text-xs text-gray-500">社區守護者</p>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Button */}
          <div className="px-4 py-2 border-b border-gray-200">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-full flex items-center justify-center p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              title={isCollapsed ? '展開側邊欄' : '收起側邊欄'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <div className="flex items-center space-x-2">
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-medium">收起</span>
                </div>
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item, index) => {
              if (item.type === 'divider') {
                return (
                  <div 
                    key={`divider-${index}`} 
                    className="my-2 border-t border-gray-200"
                  />
                );
              }
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isCollapsed ? 'justify-center' : 'space-x-3'
                  } ${
                    isActive(item.path)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-medium">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-gray-200">
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="登出"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={`transition-all duration-300 ${
          isCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
