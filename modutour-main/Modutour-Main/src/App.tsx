import React, { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ShopManagement from './pages/ShopManagement';
import FeedManagement from './pages/FeedManagement';
import CrawlingSettings from './pages/CrawlingSettings';
import AccountSettings from './pages/AccountSettings';
import Login from './pages/Login';
import { productAPI } from './services/api';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // 백엔드 연결 상태 확인
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const result = await productAPI.healthCheck();
        setBackendStatus(result.status === 'offline' ? 'offline' : 'online');
      } catch (error) {
        setBackendStatus('offline');
      }
    };

    checkBackendStatus();
    
    // 5분마다 백엔드 상태 확인
    const interval = setInterval(checkBackendStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
    return (
      <ErrorBoundary>
        <Login onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
        <main className="flex-1 p-5">
          {/* 백엔드 상태 표시 */}
          {backendStatus === 'offline' && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                백엔드 서버에 연결할 수 없습니다. 로컬 데이터만 사용됩니다.
              </div>
            </div>
          )}
          
          <div className="bg-white shadow-sm h-full p-6">
            {renderPage()}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
