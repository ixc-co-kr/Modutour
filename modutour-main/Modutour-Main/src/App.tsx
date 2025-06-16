import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ShopManagement from './pages/ShopManagement';
import FeedManagement from './pages/FeedManagement';
import CrawlingSettings from './pages/CrawlingSettings';
import AccountSettings from './pages/AccountSettings';
import Login from './pages/Login';
import { checkAuth } from './utils/auth';



function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 이미 false로 설정되어 있음

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('dashboard');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'shop':
        return <ShopManagement />;
      case 'feed':
        return <FeedManagement />;
      case 'crawling':
        return <CrawlingSettings />;
      case 'account':
        return <AccountSettings onLogout={handleLogout} />;
      default:
        return <Dashboard />;
    }
  };

  // 로그인하지 않은 경우 로그인 화면 표시
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="flex-1 p-5">
        <div className="bg-white shadow-sm h-full p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;