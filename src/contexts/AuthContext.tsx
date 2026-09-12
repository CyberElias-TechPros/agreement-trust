import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '@/lib/api';
import type { ApiOrganization, ApiUser } from '@/types/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization) => void;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  demoMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, orgName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toUser(u: ApiUser): User {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    avatarUrl: u.avatarUrl ?? null,
  };
}

function toOrg(o: ApiOrganization): Organization {
  return { id: o.id, name: o.name, slug: o.slug, role: o.role ?? '' };
}

const STORAGE_ORG_KEY = 'taskcontract.activeOrg';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(api.demoActive);

  const applySession = useCallback((u: ApiUser, orgs: ApiOrganization[]) => {
    setUser(toUser(u));
    const orgList = orgs.map(toOrg);
    setOrganizations(orgList);
    const storedId = localStorage.getItem(STORAGE_ORG_KEY);
    const active = orgList.find((o) => o.id === storedId) ?? orgList[0] ?? null;
    setCurrentOrganizationState(active);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.getMe();
      applySession(me.user, me.organizations);
    } catch {
      // Session gone — stay signed in in demo mode, otherwise clear.
      if (!api.demoActive) {
        setUser(null);
        setOrganizations([]);
        setCurrentOrganizationState(null);
      }
    }
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    const unsub = api.subscribeDemo((active) => {
      if (!cancelled) setDemoMode(active);
    });

    const boot = async () => {
      const token = localStorage.getItem('taskcontract.accessToken');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        await refreshUser();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    boot();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [refreshUser]);

  const setCurrentOrganization = useCallback((org: Organization) => {
    setCurrentOrganizationState(org);
    localStorage.setItem(STORAGE_ORG_KEY, org.id);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    applySession(res.user, res.organizations);
    setCurrentOrganizationState(res.organizations.map(toOrg)[0] ?? null);
  }, [applySession]);

  const register = useCallback(
    async (email: string, password: string, firstName: string, lastName: string, orgName?: string) => {
      const res = await api.register(email, password, firstName, lastName, orgName);
      applySession(res.user, [res.organization]);
      setCurrentOrganizationState(toOrg(res.organization));
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore — token cleared locally below either way
    }
    localStorage.removeItem('taskcontract.accessToken');
    localStorage.removeItem(STORAGE_ORG_KEY);
    setUser(null);
    setOrganizations([]);
    setCurrentOrganizationState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        currentOrganization,
        setCurrentOrganization,
        loading,
        isLoading: loading,
        isAuthenticated: Boolean(user),
        demoMode,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
