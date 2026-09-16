import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { FirebaseSetupBanner } from './components/common/FirebaseSetupBanner';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChatAppPage } from './pages/ChatAppPage';
import { LoadingSpinner } from './components/common/LoadingSpinner';

function AppContent() {
  const { currentUser, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => {
    // Check URL hash if available
    const hash = window.location.hash.replace('#', '');
    return hash || 'landing';
  });

  // Keep URL hash in sync for clean browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setCurrentPage(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page) => {
    setCurrentPage(page);
    window.location.hash = page;
  };

  // Redirect to chat if logged in and on auth pages
  useEffect(() => {
    if (!loading && currentUser) {
      if (currentPage === 'login' || currentPage === 'register' || currentPage === 'landing') {
        setCurrentPage('chat');
        window.location.hash = 'chat';
      }
    } else if (!loading && !currentUser && currentPage === 'chat') {
      setCurrentPage('landing');
      window.location.hash = 'landing';
    }
  }, [currentUser, loading, currentPage]);

  // Mobile virtual keyboard height management via visualViewport
  useEffect(() => {
    const updateViewportHeight = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${vh}px`);
    };

    updateViewportHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
      window.visualViewport.addEventListener('scroll', updateViewportHeight);
    } else {
      window.addEventListener('resize', updateViewportHeight);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
        window.visualViewport.removeEventListener('scroll', updateViewportHeight);
      } else {
        window.removeEventListener('resize', updateViewportHeight);
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ height: 'var(--app-height, 100dvh)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Connecting to UChat..." size="lg" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-height, 100dvh)', width: '100%', overflow: 'hidden' }}>
      <FirebaseSetupBanner />
      {currentPage === 'chat' && currentUser ? (
        <ChatAppPage />
      ) : currentPage === 'login' ? (
        <LoginPage onNavigate={navigateTo} />
      ) : currentPage === 'register' ? (
        <RegisterPage onNavigate={navigateTo} />
      ) : (
        <LandingPage onNavigate={navigateTo} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
