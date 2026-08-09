import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Import Layout Components
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Import Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Expenses from './pages/Expenses';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Users from './pages/Users';
import AuthSetup from './pages/AuthSetup';

// Private Route Helper (Requires signed in with Clerk AND linked profile)
const PrivateRoute = () => {
  const { isAuthenticated, isSignedIn, isLinked, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isLinked) {
    return <Navigate to="/auth/setup" replace />;
  }
  
  return <Outlet />;
};

// Setup Route Helper (Requires signed in with Clerk but NOT linked profile)
const SetupRoute = () => {
  const { isSignedIn, isLinked, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }
  
  if (isLinked) {
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
};

// Public Route Helper (Bypasses login and setup if already authenticated)
const PublicRoute = () => {
  const { isSignedIn, isLinked, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (isSignedIn) {
    if (!isLinked) {
      return <Navigate to="/auth/setup" replace />;
    }
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
};

// Admin Route Helper
const AdminRoute = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return isAdmin ? <Outlet /> : <Navigate to="/billing" replace />;
};

// Layout Shell for Authenticated Pages
const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar isCollapsed={isSidebarCollapsed} />

      {/* Main Content Area */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isSidebarCollapsed ? 'pl-20' : 'pl-64'}`}>
        <Navbar toggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />
        
        <main className="flex-1 p-6 md:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            {/* Public Login Route */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Account Setup / Linking Route */}
            <Route element={<SetupRoute />}>
              <Route path="/auth/setup" element={<AuthSetup />} />
            </Route>

            {/* Protected Store ERP Pages */}
            <Route element={<PrivateRoute />}>
              <Route element={<MainLayout />}>
                {/* Admin Only Routes */}
                <Route element={<AdminRoute />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/users" element={<Users />} />
                </Route>
                
                {/* Shareable Routes */}
                <Route path="/billing" element={<Billing />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/transactions" element={<Transactions />} />
              </Route>
            </Route>

            {/* Catch-all Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
