import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('smartstock_token'));
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('smartstock_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncProfile = async () => {
      if (token) {
        try {
          const profile = await authAPI.getMe();
          const userData = {
            username: profile.username,
            role: profile.role,
            can_manage_stock: profile.can_manage_stock,
            can_view_expenses: profile.can_view_expenses,
            can_view_analytics: profile.can_view_analytics
          };
          localStorage.setItem('smartstock_user', JSON.stringify(userData));
          setUser(userData);
        } catch (err) {
          // Token expired or invalid
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

  const login = async (username, password) => {
    try {
      const data = await authAPI.login(username, password);
      localStorage.setItem('smartstock_token', data.access_token);
      setToken(data.access_token);
      
      // Fetch user profile to retrieve role and permissions info
      const profile = await authAPI.getMe();
      const userData = { 
        username: profile.username, 
        role: profile.role,
        can_manage_stock: profile.can_manage_stock,
        can_view_expenses: profile.can_view_expenses,
        can_view_analytics: profile.can_view_analytics
      };
      localStorage.setItem('smartstock_user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Incorrect credentials');
    }
  };

  const logout = () => {
    localStorage.removeItem('smartstock_token');
    localStorage.removeItem('smartstock_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
