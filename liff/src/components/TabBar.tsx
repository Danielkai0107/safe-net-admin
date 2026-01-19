import { Users, Bell, UserCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

export const TabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs: Tab[] = [
    {
      id: 'elders',
      label: '長輩管理',
      icon: <Users className="w-5 h-5" />,
      path: '/elders',
    },
    {
      id: 'alerts',
      label: '警報管理',
      icon: <Bell className="w-5 h-5" />,
      path: '/alerts',
    },
    {
      id: 'profile',
      label: '個人檔案',
      icon: <UserCircle className="w-5 h-5" />,
      path: '/profile',
    },
  ];

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${
              isActive(tab.path)
                ? 'text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span className="text-xs mt-1 font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
