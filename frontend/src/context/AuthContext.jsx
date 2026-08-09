import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/clerk-react';
import { authAPI, setTokenResolver } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { isSignedIn, isLoaded, signOut, getToken } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();
  const [user, setUser] = useState(null);
  const [isLinked, setIsLinked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded) {
      setTokenResolver(getToken);
    }
  }, [isLoaded, getToken]);

  const syncProfile = async () => {
    if (isSignedIn) {
      try {
        const profile = await authAPI.getMe();
        const userData = {
          username: profile.username,
          role: profile.role,
          can_manage_stock: profile.can_manage_stock,
          can_view_expenses: profile.can_view_expenses,
          can_view_analytics: profile.can_view_analytics
        };
        setUser(userData);
        setIsLinked(true);
      } catch (err) {
        console.error("AuthContext syncProfile error:", err);
        setUser(null);
        setIsLinked(false);
      } finally {
        setLoading(false);
      }
    } else {
      setUser(null);
      setIsLinked(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      syncProfile();
    }
  }, [isSignedIn, isLoaded, clerkUser]);

  const login = async () => {
    // Dummy login method for backwards compatibility, login is managed by Clerk UI components
    return true;
  };

  const logout = async () => {
    setLoading(true);
    await signOut();
    setUser(null);
    setIsLinked(false);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: isSignedIn && isLinked, 
      isLinked,
      isSignedIn: !!isSignedIn,
      loading: !isLoaded || loading,
      syncProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
