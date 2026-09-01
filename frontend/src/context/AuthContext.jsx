import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { authAPI, setOnUnauthorizedCallback } from '../services/api';
import { useClerk } from '@clerk/clerk-react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('smartstock_token'));
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('smartstock_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [kioskShopId, setKioskShopId] = useState(() => localStorage.getItem('smartstock_kiosk_shop_id') || '');
  const [loading, setLoading] = useState(true);
  const [isAuthenticatingBackend, setIsAuthenticatingBackend] = useState(false);

  // Safely get clerk signOut if Clerk is initialized
  let clerk = null;
  try {
    clerk = useClerk();
  } catch (e) {
    // Clerk not wrapped or not loaded
  }

  // Coordinated full logout helper
  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      // Ignore API logout error
    } finally {
      localStorage.removeItem('smartstock_token');
      localStorage.removeItem('smartstock_user');
      setToken(null);
      setUser(null);

      if (clerk && clerk.signOut) {
        try {
          await clerk.signOut();
        } catch (e) {
          // Ignore clerk signout error
        }
      }
    }
  }, [clerk]);

  // Register 401 eviction handler with api module
  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      logout();
    });
  }, [logout]);

  // Sync user profile from backend token on mount or token update
  useEffect(() => {
    const syncProfile = async () => {
      if (token) {
        try {
          const profile = await authAPI.getMe();
          const userData = {
            username: profile.username.includes(':') ? profile.username.split(':').slice(1).join(':') : profile.username,
            role: profile.role,
            owner_username: profile.owner_username || profile.username,
            full_name: profile.full_name,
            email: profile.email,
            can_manage_stock: profile.can_manage_stock,
            can_view_expenses: profile.can_view_expenses,
            can_view_analytics: profile.can_view_analytics
          };
          localStorage.setItem('smartstock_user', JSON.stringify(userData));
          setUser(userData);
        } catch (err) {
          localStorage.removeItem('smartstock_token');
          localStorage.removeItem('smartstock_user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    syncProfile();
  }, [token]);

  // Aggressive 15-minute idle timeout for counter worker sessions
  useEffect(() => {
    if (!user || user.role !== 'worker') return;

    let timeoutId;
    const IDLE_LIMIT = 15 * 60 * 1000; // 15 minutes

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.warn('Counter Worker session idle timeout (15 mins). Logging out...');
        logout();
      }, IDLE_LIMIT);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, resetTimer));
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [user, logout]);

  // Login handler
  const login = async (username, password) => {
    setIsAuthenticatingBackend(true);
    try {
      const data = await authAPI.login(username, password);
      localStorage.setItem('smartstock_token', data.access_token);
      setToken(data.access_token);

      const profile = await authAPI.getMe();
      const userData = {
        username: profile.username.includes(':') ? profile.username.split(':').slice(1).join(':') : profile.username,
        role: profile.role,
        owner_username: profile.owner_username || profile.username,
        full_name: profile.full_name,
        email: profile.email,
        can_manage_stock: profile.can_manage_stock,
        can_view_expenses: profile.can_view_expenses,
        can_view_analytics: profile.can_view_analytics
      };
      localStorage.setItem('smartstock_user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Incorrect username or password');
    } finally {
      setIsAuthenticatingBackend(false);
    }
  };

  // 4-Digit Counter PIN Login
  const loginCounterPin = async (owner_username, pin) => {
    setIsAuthenticatingBackend(true);
    try {
      const data = await authAPI.counterPinLogin(owner_username, pin);
      localStorage.setItem('smartstock_token', data.access_token);
      setToken(data.access_token);

      const profile = await authAPI.getMe();
      const userData = {
        username: profile.username.includes(':') ? profile.username.split(':').slice(1).join(':') : profile.username,
        role: profile.role,
        owner_username: profile.owner_username || profile.username,
        full_name: profile.full_name,
        email: profile.email,
        can_manage_stock: profile.can_manage_stock,
        can_view_expenses: profile.can_view_expenses,
        can_view_analytics: profile.can_view_analytics
      };
      localStorage.setItem('smartstock_user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Invalid 4-digit POS PIN');
    } finally {
      setIsAuthenticatingBackend(false);
    }
  };

  // Register Shop Onboarding
  const registerShop = async (shop_name, owner_username, password, clerk_token = null, email = null, counter_pin = null) => {
    setIsAuthenticatingBackend(true);
    try {
      const data = await authAPI.registerShop(shop_name, owner_username, password, clerk_token, email, counter_pin);
      localStorage.setItem('smartstock_token', data.access_token);
      setToken(data.access_token);

      // Save device kiosk shop ID for counter workers on this physical machine
      localStorage.setItem('smartstock_kiosk_shop_id', owner_username);
      setKioskShopId(owner_username);

      const profile = await authAPI.getMe();
      const userData = {
        username: profile.username.includes(':') ? profile.username.split(':').slice(1).join(':') : profile.username,
        role: profile.role,
        owner_username: profile.owner_username || profile.username,
        full_name: profile.full_name,
        email: profile.email,
        can_manage_stock: profile.can_manage_stock,
        can_view_expenses: profile.can_view_expenses,
        can_view_analytics: profile.can_view_analytics
      };
      localStorage.setItem('smartstock_user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Failed to register shop');
    } finally {
      setIsAuthenticatingBackend(false);
    }
  };

  // Register physical device as POS Kiosk
  const registerDeviceAsKiosk = (shop_id) => {
    const target = shop_id || user?.owner_username || user?.username;
    if (target) {
      localStorage.setItem('smartstock_kiosk_shop_id', target);
      setKioskShopId(target);
    }
  };

  return (
    <AuthContext.Provider value={{
      token,
      setToken,
      user,
      setUser,
      login,
      loginCounterPin,
      registerShop,
      logout,
      kioskShopId,
      registerDeviceAsKiosk,
      isAuthenticated: !!token,
      loading,
      isAuthenticatingBackend,
      setIsAuthenticatingBackend
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
