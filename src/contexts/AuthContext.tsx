import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  [key: string]: unknown;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  demoMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentOrganization: (org: Organization) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(api.demoActive);

  useEffect(() => {
    const unsubscribe = api.subscribeDemo(setDemoMode);
    return unsubscribe;
  }, []);

  const applySession = (userData: User, orgs: Organization[]) => {
    setUser(userData);
    setOrganizations(orgs);
    const savedOrgId = localStorage.getItem('currentOrganizationId');
    const currentOrg = orgs.find((o) => o.id === savedOrgId) || orgs[0];
    if (currentOrg) {
      setCurrentOrganization(currentOrg);
      localStorage.setItem('currentOrganizationId', currentOrg.id);
    }
  };

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token && !api.demoActive) {
        setIsLoading(false);
        return;
      }

      let data: { user: User; organizations: Organization[] };
      try {
        data = await api.getMe();
      } catch (error) {
        // Backend unreachable — the client has switched to demo mode.
        if (api.demoActive) {
          data = await api.getMe();
        } else {
          throw error;
        }
      }
      applySession(data.user, data.organizations);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const { user: userData, organizations: orgs } = await api.login(email, password);
    applySession(userData, orgs);
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    const { user: userData, organization: org } = await api.register(email, password, firstName, lastName);
    applySession(userData, [org]);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setOrganizations([]);
      setCurrentOrganization(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('currentOrganizationId');
    }
  };

  const handleSetCurrentOrganization = (org: Organization) => {
    setCurrentOrganization(org);
    localStorage.setItem('currentOrganizationId', org.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        currentOrganization,
        isAuthenticated: !!user,
        isLoading,
        demoMode,
        login,
        register,
        logout,
        setCurrentOrganization: handleSetCurrentOrganization,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
