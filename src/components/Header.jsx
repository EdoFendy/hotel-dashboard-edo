// src/components/Header.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Header.css';

const PAGE_TITLES = [
  { path: '/', label: 'Dashboard' },
  { path: '/reservations', label: 'Prenotazioni' },
  { path: '/reservations/new', label: 'Nuova Prenotazione' },
  { path: '/calendar', label: 'Calendario' },
  { path: '/expenses', label: 'Gestione Spese' },
  { path: '/expenses/add', label: 'Aggiungi Spesa' },
];

const derivePageTitle = (pathname) => {
  const staticMatch = PAGE_TITLES.find(({ path }) => path === pathname);
  if (staticMatch) {
    return staticMatch.label;
  }

  if (pathname.startsWith('/reservations/edit')) {
    return 'Modifica Prenotazione';
  }

  if (pathname.startsWith('/reservations/delete')) {
    return 'Elimina Prenotazione';
  }

  if (pathname.startsWith('/expenses/edit')) {
    return 'Modifica Spesa';
  }

  return 'Paradiso delle Madonie Dashboard';
};

const Header = ({ onToggleSidebar }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Stato per gestire visibilità header su mobile/tablet
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const scrollDifference = currentScrollY - lastScrollY;
          
          // Se siamo in cima (primi 10px), mostra sempre
          if (currentScrollY <= 10) {
            setIsVisible(true);
          } 
          // Se scrolliamo giù di almeno 5px e siamo oltre 80px, nascondi
          else if (scrollDifference > 5 && currentScrollY > 80) {
            setIsVisible(false);
          } 
          // Se scrolliamo su di almeno 5px, mostra
          else if (scrollDifference < -5) {
            setIsVisible(true);
          }
          
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        
        ticking = true;
      }
    };

    // Gestisci anche il resize per assicurarti che tutto funzioni
    const handleResize = () => {
      setIsVisible(true);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [lastScrollY]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const pageTitle = derivePageTitle(location.pathname);

  return (
    <header className={`header ${isVisible ? 'header--visible' : 'header--hidden'}`}>
      <div className="header__left">
        <button
          type="button"
          className="header__menu-btn"
          aria-label="Apri menu"
          onClick={onToggleSidebar}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="header__titles">
          <p className="header__eyebrow">Paradiso delle Madonie</p>
          <h1 className="header__page-title">{pageTitle}</h1>
        </div>
      </div>
      <div className="header__right">
        <div className="header__user">
          <div className="header__avatar" aria-hidden="true">
            PM
          </div>
          <div className="header__user-info">
            <span className="header__user-name">Gestione Hotel</span>
            <span className="header__user-role">Amministratore</span>
          </div>
        </div>
        <button type="button" className="header__logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
