import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { IUser, ILoginInput, IRegisterInput } from '@hera/shared';
import { authApi } from '../api/auth';

interface AuthContextValue {
  user: IUser | null;
  loading: boolean;
  login: (input: ILoginInput) => Promise<IUser>;
  register: (input: IRegisterInput) => Promise<IUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('hera_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
      localStorage.removeItem('hera_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (input: ILoginInput) => {
    const result = await authApi.login(input);
    localStorage.setItem('hera_token', result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (input: IRegisterInput) => {
    const result = await authApi.register(input);
    localStorage.setItem('hera_token', result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hera_token');
    setUser(null);
    window.location.href = '/';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
