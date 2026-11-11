import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from './authApi';
import { setAuthToken } from '../../lib/apiClient';
import { User } from '../../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const queryClient = useQueryClient();

  // Track session check generation to prevent stale in-flight checks from overwriting login
  const sessionCheckIdRef = useRef<number>(0);

  // Check current session on initial load
  useEffect(() => {
    let isMounted = true;
    const currentCheckId = ++sessionCheckIdRef.current;

    const checkSession = async () => {
      try {
        const data = await authApi.me();
        if (isMounted && sessionCheckIdRef.current === currentCheckId) {
          if (data.token) {
            setAuthToken(data.token);
          }
          setUser(data.user);
        }
      } catch (err) {
        // Only clear if this check is still the active check and user was not set by login
        if (isMounted && sessionCheckIdRef.current === currentCheckId) {
          setAuthToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted && sessionCheckIdRef.current === currentCheckId) {
          setIsLoading(false);
        }
      }
    };

    checkSession();

    // Listen for unauthorized events from apiClient
    const handleUnauthorized = () => {
      if (isMounted) {
        sessionCheckIdRef.current++;
        setAuthToken(null);
        setUser(null);
        queryClient.clear();
      }
    };
    window.addEventListener('sifon:unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      window.removeEventListener('sifon:unauthorized', handleUnauthorized);
    };
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    // Invalidate any in-flight pre-login session check
    sessionCheckIdRef.current++;
    const currentCheckId = sessionCheckIdRef.current;

    const data = await authApi.login(email, password);
    if (sessionCheckIdRef.current === currentCheckId) {
      setAuthToken(data.token);
      setUser(data.user);
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    sessionCheckIdRef.current++;
    try {
      await authApi.logout();
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
      setUser(null);
      // Clear TanStack query cache to wipe private data
      queryClient.clear();
    }
  }, [queryClient]);

  const clearSession = useCallback(() => {
    sessionCheckIdRef.current++;
    setAuthToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

