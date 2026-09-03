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
            username: profile.username.includes(':') ? profile.username.split(':').slice(1).join(':') : profile.username,
            full_username: profile.username,
            owner_username: profile.owner_username,
            shop_code: profile.shop_code,
            role: profile.role,
            can_manage_stock: profile.can_manage_stock,
            can_view_expenses: profile.can_view_expenses,
            can_view_analytics: profile.can_view_analytics,
            full_name: profile.full_name,
            email: profile.email
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
      
      const profile = await authAPI.getMe();
      const userData = { 
        username: profile.username.includes(':') ? profile.username.split(':').slice(1).join(':') : profile.username, 
        full_username: profile.username,
        role: profile.role,
        can_manage_stock: profile.can_manage_stock,
        can_view_expenses: profile.can_view_expenses,
        can_view_analytics: profile.can_view_analytics,
        full_name: profile.full_name,
        email: profile.email
      };
      localStorage.setItem('smartstock_user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Incorrect username or password');
    }
  };

  const loginOwner = async (owner_username, password, email, clerk_id = 'clerk_user') => {
    try {
      const data = await authAPI.clerkLogin(email, clerk_id, null, 'admin', password, owner_username);
      localStorage.setItem('smartstock_token', data.access_token);
      setToken(data.access_token);

      const profile = await authAPI.getMe();
      const userData = {
        username: profile.username.includes(':') ? profile.username.split(':').slice(1).join(':') : profile.username,
        full_username: profile.username,
        role: profile.role,
        can_manage_stock: profile.can_manage_stock,
        can_view_expenses: profile.can_view_expenses,
        can_view_analytics: profile.can_view_analytics,
        full_name: profile.full_name,
        email: profile.email
      };
      localStorage.setItem('smartstock_user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Incorrect owner username or password');
    }
  };

  const loginCounter = async (owner_username, counter_username, password) => {
    const fullUsername = counter_username.includes(':') ? counter_username : `${owner_username}:${counter_username}`;
    try {
      const data = await authAPI.login(fullUsername, password);
      localStorage.setItem('smartstock_token', data.access_token);
      setToken(data.access_token);

      const profile = await authAPI.getMe();
      const userData = {
        username: counter_username,
        full_username: profile.username,
        role: profile.role,
        can_manage_stock: profile.can_manage_stock,
        can_view_expenses: profile.can_view_expenses,
        can_view_analytics: profile.can_view_analytics,
        full_name: profile.full_name,
        email: profile.email
      };
      localStorage.setItem('smartstock_user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Incorrect counter username or password');
    }
  };

  const loginCounterDirect = async (shop_code, counter_username, password) => {
    try {
      const data = await authAPI.counterLogin(shop_code, counter_username, password);
      localStorage.setItem('smartstock_token', data.access_token);
      setToken(data.access_token);

      const profile = await authAPI.getMe();
      const userData = {
        username: counter_username,
        full_username: profile.username,
        role: profile.role,
        can_manage_stock: profile.can_manage_stock,
        can_view_expenses: profile.can_view_expenses,
        can_view_analytics: profile.can_view_analytics,
        full_name: profile.full_name,
        email: profile.email
      };
      localStorage.setItem('smartstock_user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Incorrect Shop Code, Counter Username, or Password');
    }
  };

  const registerShop = async (shop_name, owner_username, email, password, clerk_id = null) => {
    try {
      const data = await authAPI.registerShop(shop_name, owner_username, email, password, clerk_id);
      if (data.access_token) {
        localStorage.setItem('smartstock_token', data.access_token);
        setToken(data.access_token);
        const profile = await authAPI.getMe();
        const userData = {
          username: profile.username.includes(':') ? profile.username.split(':').slice(1).join(':') : profile.username,
          full_username: profile.username,
          role: profile.role,
          can_manage_stock: profile.can_manage_stock,
          can_view_expenses: profile.can_view_expenses,
          can_view_analytics: profile.can_view_analytics,
          full_name: profile.full_name,
          email: profile.email
        };
        localStorage.setItem('smartstock_user', JSON.stringify(userData));
        setUser(userData);
      }
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Shop registration failed');
    }
  };

  const deleteAccount = async () => {
    try {
      const data = await authAPI.deleteAccount();
      logout();
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Failed to delete store account');
    }
  };

  const requestOTP = async (email) => {
    try {
      return await authAPI.requestOTP(email);
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Failed to send OTP code');
    }
  };

  const verifyOTP = async (email, otp) => {
    try {
      return await authAPI.verifyOTP(email, otp);
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Invalid or expired OTP code');
    }
  };

  const resetPasswordOTP = async (email, otp, newPassword) => {
    try {
      return await authAPI.resetPasswordOTP(email, otp, newPassword);
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  const logout = () => {
    localStorage.removeItem('smartstock_token');
    localStorage.removeItem('smartstock_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      token, setToken, user, setUser, login, loginOwner, loginCounter, loginCounterDirect, registerShop, deleteAccount, requestOTP, verifyOTP, resetPasswordOTP, logout, isAuthenticated: !!token, loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => useContext(AuthContext);


