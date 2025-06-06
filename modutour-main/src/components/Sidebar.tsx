import React from 'react';
import { Home, Package, Rss, Settings, User, Target } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage }) => {
  const menuItems = [
    { id: 'dashboard', label: '대시보드', icon: Home },
    { id: 'shop', label: '상품 관리', icon: Package },
    { id: 'feed', label: '피드 관리', icon: Rss },
    { id: 'crawling', label: '크롤링 설정', icon: Target },
    { id: 'account', label: '계정 설정', icon: User },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen">
      <div className="p-6 pb-2">
        <h1 className="text-lg font-semibold text-gray-900">모두투어 DB 관리 시스템</h1>
      </div>
      
      <nav>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center px-6 py-3 text-sm font-medium text-left transition-colors ${
                currentPage === item.id
                  ? 'text-blue-600 bg-gray-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
