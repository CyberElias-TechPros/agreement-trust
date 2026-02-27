import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
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

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      const { user: userData, organizations: orgs } = await api.getMe();
      setUser(userData);
      setOrganizations(orgs);
      
      // Set current organization from localStorage or first org
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      const currentOrg = orgs.find((o: Organization) => o.id === savedOrgId) || orgs[0];
      if (currentOrg) {
        setCurrentOrganization(currentOrg);
        localStorage.setItem('currentOrganizationId', currentOrg.id);
      }
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
  }, []);

  const login = async (email: string, password: string) => {
    const { user: userData, organizations: orgs } = await api.login(email, password);
    setUser(userData);
    setOrganizations(orgs);
    
    if (orgs.length > 0) {
      const firstOrg = orgs[0];
      setCurrentOrganization(firstOrg);
      localStorage.setItem('currentOrganizationId', firstOrg.id);
    }
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    const { user: userData, organization: org } = await api.register(email, password, firstName, lastName);
    setUser(userData);
    setOrganizations([org]);
    setCurrentOrganization(org);
    localStorage.setItem('currentOrganizationId', org.id);
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
