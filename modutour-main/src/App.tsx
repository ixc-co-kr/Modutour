import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ShopManagement from './pages/ShopManagement';
import FeedManagement from './pages/FeedManagement';
import CrawlingSettings from './pages/CrawlingSettings';
import AccountSettings from './pages/AccountSettings';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

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
        return <AccountSettings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="flex-1 p-4">
        <div className="bg-white shadow-sm h-full p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App
