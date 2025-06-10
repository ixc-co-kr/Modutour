import React from 'react';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage }) => {
  const menuItems = [
    { id: 'dashboard', label: '대시보드', icon: 'DashboardOutlined.png' },
    { id: 'shop', label: '상품 관리', icon: 'UnorderedListOutlined.png' },
    { id: 'feed', label: '피드 관리', icon: 'DatabaseOutlined.png' },
    { id: 'crawling', label: '크롤링 설정', icon: 'BulbOutlined.png' },
    { id: 'account', label: '계정 설정', icon: 'DatabaseOutlined.png' },
  ];

  return (
    <div 
      className="bg-white border-r border-gray-200"
      style={{
        width: '272px',
        height: '1066px',
        borderRightWidth: '1px',
        flexShrink: 0, // 절대 줄어들지 않도록 설정
        minWidth: '272px', // 최소 너비 보장
        maxWidth: '272px' // 최대 너비 제한
      }}
    >
      <div className="p-6 pb-2">
        <h1 className="text-lg font-semibold text-gray-900">모두투어 DB 관리 시스템</h1>
      </div>
      
      <nav>
        {menuItems.map((item) => {
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
              <img 
                src={`/icons/${item.icon}`} 
                alt={item.label}
                className="w-5 h-5 mr-3"
              />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
