// src/components/Layout.jsx

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import '../styles/Layout.css';

/**
 * Componente di layout che include la sidebar e il contenuto principale
 * @param {object} props
 */
function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`layout ${isSidebarOpen ? 'layout--sidebar-open' : ''}`}>
      <Sidebar isOpen={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />
      <Header onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
      <div className="layout__body">
        <main className="layout__content">{children}</main>
      </div>
      {isSidebarOpen && <div className="layout__backdrop" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
}

export default Layout;
