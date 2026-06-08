import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import ResearchPage from './pages/ResearchPage';
import DashboardPage from './pages/DashboardPage';
import SessionDetailPage from './pages/SessionDetailPage';
import SearchHistoryPage from './pages/SearchHistoryPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  function handleLogout() {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>Deep Research</h1>
          <p>Multi-Agent Platform</p>
        </div>
        <nav className="sidebar-nav">
          <a
            href="/"
            className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); window.location.href = '/'; }}
          >
            <span className="icon">🔬</span>
            Research
          </a>
          <a
            href="/history"
            className={`sidebar-link ${location.pathname === '/history' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); window.location.href = '/history'; }}
          >
            <span className="icon">📖</span>
            Search History
          </a>
          <a
            href="/dashboard"
            className={`sidebar-link ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); window.location.href = '/dashboard'; }}
          >
            <span className="icon">📊</span>
            Observability
          </a>
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('auth_token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('auth_token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <AuthPage onLogin={() => setIsAuthenticated(true)} />
            )
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <ResearchPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <Layout>
                <SearchHistoryPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <SessionDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
