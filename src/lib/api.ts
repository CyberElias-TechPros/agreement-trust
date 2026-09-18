import { demoApi } from "./demo/demoApi";
import type {
  ApiAnalytics,
  ApiCategory,
  ApiContract,
  ApiInteraction,
  ApiMembership,
  ApiNotification,
  ApiOrganization,
  ApiPagination,
  ApiTokens,
  ApiUser,
  ApiVersion,
  LoginResponse,
  MeResponse,
  RegisterResponse,
} from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";
const ACCESS_KEY = "taskcontract.accessToken";
const REFRESH_KEY = "taskcontract.refreshToken";
const DEMO_EMAIL = "alex.morgan@northwind.studio";
const DEMO_PASSWORD = "demo1234";

type DemoListener = (active: boolean) => void;

class ApiClient {
  private accessToken: string | null = null;
  private demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  private listeners = new Set<DemoListener>();
  private refreshing: Promise<boolean> | null = null;

  get demoActive(): boolean {
    return this.demoMode;
  }

  subscribeDemo(listener: DemoListener): () => void {
    this.listeners.add(listener);
    listener(this.demoMode);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private enableDemo() {
    if (this.demoMode) return;
    this.demoMode = true;
    this.listeners.forEach((l) => l(true));
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) localStorage.setItem(ACCESS_KEY, token);
    else localStorage.removeItem(ACCESS_KEY);
  }

  setRefreshToken(token: string | null) {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  }

  getAccessToken(): string | null {
    if (!this.accessToken) this.accessToken = localStorage.getItem(ACCESS_KEY);
    return this.accessToken;
  }

  private captureTokens(data: Partial<ApiTokens>) {
    if (data.accessToken) this.setAccessToken(data.accessToken);
    if (data.refreshToken) this.setRefreshToken(data.refreshToken);
  }

  private async tryRefresh(): Promise<boolean> {
    if (this.demoMode) return false;
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as ApiTokens;
      this.captureTokens(data);
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch {
      throw new Error("The ledger is unreachable. Check the API, or explore the demo workspace.");
    }

    if (response.status === 401 && retry && !endpoint.startsWith("/auth/login") && !endpoint.startsWith("/auth/refresh")) {
      if (!this.refreshing) this.refreshing = this.tryRefresh().finally(() => { this.refreshing = null; });
      const ok = await this.refreshing;
      if (ok) return this.request<T>(endpoint, options, false);
      this.setAccessToken(null);
      this.setRefreshToken(null);
      if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data === "object" && data && "error" in data ? String((data as { error: unknown }).error) : "Request failed"
      );
    }
    return data as T;
  }

  async enterDemo() {
    try {
      const data = await this.request<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      });
      this.captureTokens(data);
      return data;
    } catch {
      this.enableDemo();
      const data = await demoApi.enterDemo();
      this.setAccessToken(data.accessToken);
      this.setRefreshToken(data.refreshToken);
      return data as unknown as LoginResponse;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const r = await fetch(`${API_BASE_URL.replace(/\/api\/v1$/, "")}/health`, { method: "GET" });
      return r.ok;
    } catch {
      return false;
    }
  }

  /* ---------- auth ---------- */

  async register(email: string, password: string, firstName: string, lastName: string, organizationName?: string): Promise<RegisterResponse> {
    if (this.demoMode) {
      const data = await demoApi.register(email, password, firstName, lastName, organizationName);
      this.captureTokens(data);
      return data as unknown as RegisterResponse;
    }
    const data = await this.request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, firstName, lastName, organizationName }),
    });
    this.captureTokens(data);
    return data;
  }

  async login(email: string, password: string, otp?: string): Promise<LoginResponse & { requires2fa?: boolean; challengeToken?: string }> {
    if (this.demoMode) {
      const data = await demoApi.login(email, password);
      this.captureTokens(data);
      return data as unknown as LoginResponse;
    }
    const data = await this.request<LoginResponse & { requires2fa?: boolean; challengeToken?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, otp }),
    });
    if (!data.requires2fa) this.captureTokens(data);
    return data;
  }

  async verify2fa(challengeToken: string, code: string): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>("/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ challengeToken, code }),
    });
    this.captureTokens(data);
    return data;
  }

  async logout(): Promise<void> {
    try {
      if (this.demoMode) await demoApi.logout();
      else {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        await this.request("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.setAccessToken(null);
      this.setRefreshToken(null);
    }
  }

  async getMe(): Promise<MeResponse> {
    if (this.demoMode) return demoApi.getMe() as unknown as Promise<MeResponse>;
    return this.request<MeResponse>("/auth/me");
  }

  async updateProfile(data: { firstName?: string; lastName?: string; avatarUrl?: string; title?: string }): Promise<{ user: ApiUser }> {
    if (this.demoMode) return demoApi.updateProfile(data) as unknown as Promise<{ user: ApiUser }>;
    return this.request<{ user: ApiUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(data) });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string } & Partial<ApiTokens>> {
    if (this.demoMode) return demoApi.changePassword(currentPassword, newPassword);
    const data = await this.request<{ message: string } & Partial<ApiTokens>>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    this.captureTokens(data);
    return data;
  }

  async forgotPassword(email: string): Promise<{ sent: boolean; resetUrl?: string; resetToken?: string; message?: string }> {
    if (this.demoMode) {
      return { sent: true, resetUrl: "/reset-password?token=demo-reset", resetToken: "demo-reset", message: "Demo reset ready." };
    }
    return this.request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  }

  async resetPassword(token: string, password: string): Promise<LoginResponse> {
    if (this.demoMode) {
      const data = await demoApi.login(DEMO_EMAIL, DEMO_PASSWORD);
      this.captureTokens(data);
      return data as unknown as LoginResponse;
    }
    const data = await this.request<LoginResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    this.captureTokens(data);
    return data;
  }

  async getSessions(): Promise<{ sessions: { id: string; userAgent?: string; ipAddress?: string; createdAt: string; lastSeenAt?: string; current?: boolean; revoked?: boolean }[] }> {
    if (this.demoMode) {
      return {
        sessions: [
          {
            id: "current",
            userAgent: navigator.userAgent,
            ipAddress: "127.0.0.1",
            createdAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            current: true,
          },
        ],
      };
    }
    return this.request("/auth/sessions");
  }

  async revokeSession(sessionId: string): Promise<{ message: string }> {
    if (this.demoMode) return { message: "Session revoked" };
    return this.request(`/auth/sessions/${sessionId}`, { method: "DELETE" });
  }

  async revokeOtherSessions(): Promise<{ message: string }> {
    if (this.demoMode) return { message: "Other sessions revoked" };
    return this.request("/auth/sessions/revoke-others", { method: "POST" });
  }

  async getPreferences(): Promise<{ preferences: Record<string, boolean> }> {
    if (this.demoMode) {
      return {
        preferences: { contract_assigned: true, status_changed: true, deadline_reminder: true, comments: true, email_digest: false },
      };
    }
    return this.request("/auth/preferences");
  }

  async updatePreferences(preferences: Record<string, boolean>): Promise<{ preferences: Record<string, boolean> }> {
    if (this.demoMode) return { preferences };
    return this.request("/auth/preferences", { method: "PATCH", body: JSON.stringify(preferences) });
  }

  async setup2fa(): Promise<{ secret: string; otpauthUrl: string }> {
    if (this.demoMode) return { secret: "DEMO2FASECRET", otpauthUrl: "otpauth://totp/TaskContract:demo?secret=DEMO2FASECRET" };
    return this.request("/auth/2fa/setup", { method: "POST" });
  }

  async enable2fa(code: string): Promise<{ message: string; backupCodes: string[] }> {
    if (this.demoMode) return { message: "Enabled", backupCodes: ["DEMO-CODE"] };
    return this.request("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
  }

  async disable2fa(password: string): Promise<{ message: string }> {
    if (this.demoMode) return { message: "Disabled" };
    return this.request("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) });
  }

  async getInvite(token: string): Promise<{ email: string; role: string; organization: { id: string; name: string; slug: string } }> {
    return this.request(`/auth/invites/${token}`);
  }

  async acceptInvite(token: string, data: { firstName?: string; lastName?: string; password?: string }): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>(`/auth/invites/${token}/accept`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    this.captureTokens(res);
    return res;
  }

  /* ---------- organizations ---------- */

  async getOrganizations(): Promise<{ organizations: ApiOrganization[] }> {
    if (this.demoMode) return demoApi.getOrganizations() as unknown as Promise<{ organizations: ApiOrganization[] }>;
    return this.request("/organizations");
  }

  async createOrganization(name: string, slug?: string): Promise<{ organization: ApiOrganization }> {
    if (this.demoMode) return demoApi.createOrganization(name, slug) as unknown as Promise<{ organization: ApiOrganization }>;
    return this.request("/organizations", { method: "POST", body: JSON.stringify({ name, slug }) });
  }

  async getOrganization(organizationId: string): Promise<{ organization: ApiOrganization }> {
    if (this.demoMode) return demoApi.getOrganization(organizationId) as unknown as Promise<{ organization: ApiOrganization }>;
    return this.request(`/organizations/${organizationId}`);
  }

  async updateOrganization(
    organizationId: string,
    data: { name?: string; branding?: ApiOrganization["branding"]; settings?: ApiOrganization["settings"] }
  ): Promise<{ organization: ApiOrganization }> {
    if (this.demoMode) return demoApi.updateOrganization(organizationId, data) as unknown as Promise<{ organization: ApiOrganization }>;
    return this.request(`/organizations/${organizationId}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  async getOrganizationMembers(organizationId: string): Promise<{ members: ApiMembership[] }> {
    if (this.demoMode) return demoApi.getOrganizationMembers(organizationId) as unknown as Promise<{ members: ApiMembership[] }>;
    return this.request(`/organizations/${organizationId}/members`);
  }

  async inviteMember(organizationId: string, email: string, role?: string): Promise<{ membership: ApiMembership; inviteUrl?: string; token?: string }> {
    if (this.demoMode) return demoApi.inviteMember(organizationId, email, role) as unknown as Promise<{ membership: ApiMembership }>;
    return this.request(`/organizations/${organizationId}/members`, { method: "POST", body: JSON.stringify({ email, role }) });
  }

  async updateMemberRole(organizationId: string, memberId: string, role: string, status?: string): Promise<{ membership: ApiMembership }> {
    if (this.demoMode) return demoApi.updateMemberRole(organizationId, memberId, role, status) as unknown as Promise<{ membership: ApiMembership }>;
    return this.request(`/organizations/${organizationId}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role, status }) });
  }

  async removeMember(organizationId: string, memberId: string): Promise<{ message: string }> {
    if (this.demoMode) return demoApi.removeMember(organizationId, memberId);
    return this.request(`/organizations/${organizationId}/members/${memberId}`, { method: "DELETE" });
  }

  async getOrganizationAnalytics(organizationId: string): Promise<ApiAnalytics> {
    if (this.demoMode) return demoApi.getOrganizationAnalytics(organizationId) as unknown as Promise<ApiAnalytics>;
    return this.request(`/organizations/${organizationId}/analytics`);
  }

  async getBilling(organizationId: string): Promise<{ plan: string; seats: number; contracts: number; limits: { seats: number; contracts: number } }> {
    if (this.demoMode) return { plan: "pro", seats: 6, contracts: 7, limits: { seats: 1000, contracts: 100000 } };
    return this.request(`/organizations/${organizationId}/billing`);
  }

  async upgradePlan(organizationId: string, planType: string): Promise<{ organization: ApiOrganization; message: string }> {
    if (this.demoMode) return { organization: { id: organizationId, name: "Demo", slug: "demo", planType: planType as "pro" }, message: "Plan updated" };
    return this.request(`/organizations/${organizationId}/billing/upgrade`, { method: "POST", body: JSON.stringify({ planType }) });
  }

  /* ---------- contracts ---------- */

  async getContracts(
    organizationId: string,
    params?: { status?: string; priority?: string; search?: string; page?: number; limit?: number }
  ): Promise<{ contracts: ApiContract[]; pagination: ApiPagination }> {
    if (this.demoMode) return demoApi.getContracts(organizationId, params) as unknown as Promise<{ contracts: ApiContract[]; pagination: ApiPagination }>;
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append("status", params.status);
    if (params?.priority) queryParams.append("priority", params.priority);
    if (params?.search) queryParams.append("search", params.search);
    if (params?.page) queryParams.append("page", String(params.page));
    if (params?.limit) queryParams.append("limit", String(params.limit));
    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return this.request(`/organizations/${organizationId}/contracts${query}`);
  }

  async getContract(
    organizationId: string,
    contractId: string
  ): Promise<{ contract: ApiContract; participants: unknown[]; versions: ApiVersion[]; interactions: ApiInteraction[] }> {
    if (this.demoMode) {
      return demoApi.getContract(organizationId, contractId) as unknown as Promise<{
        contract: ApiContract;
        participants: unknown[];
        versions: ApiVersion[];
        interactions: ApiInteraction[];
      }>;
    }
    return this.request(`/organizations/${organizationId}/contracts/${contractId}`);
  }

  async createContract(
    organizationId: string,
    data: {
      title: string;
      description: string;
      deadline?: string;
      priority?: string;
      categoryId?: string;
      executorId?: string;
      observerIds?: string[];
      tags?: string[];
      send?: boolean;
    }
  ): Promise<{ contract: ApiContract }> {
    if (this.demoMode) {
      const created = await demoApi.createContract(organizationId, data);
      if (data.send && created.contract.id) {
        return demoApi.sendContract(organizationId, created.contract.id) as unknown as Promise<{ contract: ApiContract }>;
      }
      return created as unknown as Promise<{ contract: ApiContract }>;
    }
    return this.request(`/organizations/${organizationId}/contracts`, { method: "POST", body: JSON.stringify(data) });
  }

  async updateContract(
    organizationId: string,
    contractId: string,
    data: {
      title?: string;
      description?: string;
      deadline?: string;
      priority?: string;
      categoryId?: string;
      tags?: string[];
      changeReason?: string;
    }
  ): Promise<{ contract: ApiContract }> {
    if (this.demoMode) return demoApi.updateContract(organizationId, contractId, data) as unknown as Promise<{ contract: ApiContract }>;
    return this.request(`/organizations/${organizationId}/contracts/${contractId}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  private async transition(
    organizationId: string,
    contractId: string,
    action: "send" | "accept" | "reject" | "submit" | "approve" | "archive" | "start" | "reopen",
    note?: string
  ): Promise<{ contract: ApiContract }> {
    if (this.demoMode) {
      switch (action) {
        case "send":
          return demoApi.sendContract(organizationId, contractId) as unknown as Promise<{ contract: ApiContract }>;
        case "accept":
          return demoApi.acceptContract(organizationId, contractId) as unknown as Promise<{ contract: ApiContract }>;
        case "reject":
          return demoApi.rejectContract(organizationId, contractId, note) as unknown as Promise<{ contract: ApiContract }>;
        case "submit":
          return demoApi.submitContract(organizationId, contractId, note) as unknown as Promise<{ contract: ApiContract }>;
        case "approve":
          return demoApi.approveContract(organizationId, contractId) as unknown as Promise<{ contract: ApiContract }>;
        case "archive":
          return demoApi.archiveContract(organizationId, contractId) as unknown as Promise<{ contract: ApiContract }>;
        case "start":
          return demoApi.acceptContract(organizationId, contractId) as unknown as Promise<{ contract: ApiContract }>;
        case "reopen":
          return demoApi.sendContract(organizationId, contractId) as unknown as Promise<{ contract: ApiContract }>;
      }
    }
    const body = note ? { summary: note, reason: note } : {};
    return this.request(`/organizations/${organizationId}/contracts/${contractId}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  sendContract(organizationId: string, contractId: string) {
    return this.transition(organizationId, contractId, "send");
  }
  acceptContract(organizationId: string, contractId: string) {
    return this.transition(organizationId, contractId, "accept");
  }
  rejectContract(organizationId: string, contractId: string, reason?: string) {
    return this.transition(organizationId, contractId, "reject", reason);
  }
  submitContract(organizationId: string, contractId: string, summary?: string) {
    return this.transition(organizationId, contractId, "submit", summary);
  }
  approveContract(organizationId: string, contractId: string) {
    return this.transition(organizationId, contractId, "approve");
  }
  archiveContract(organizationId: string, contractId: string) {
    return this.transition(organizationId, contractId, "archive");
  }
  startContract(organizationId: string, contractId: string) {
    return this.transition(organizationId, contractId, "start");
  }
  reopenContract(organizationId: string, contractId: string) {
    return this.transition(organizationId, contractId, "reopen");
  }

  async acknowledgeVersion(organizationId: string, contractId: string): Promise<{ message: string }> {
    if (this.demoMode) return { message: "Version acknowledged" };
    return this.request(`/organizations/${organizationId}/contracts/${contractId}/acknowledge`, { method: "POST" });
  }

  async getContractHistory(organizationId: string, contractId: string): Promise<{ versions: unknown[] }> {
    if (this.demoMode) return demoApi.getContractHistory(organizationId, contractId) as unknown as Promise<{ versions: unknown[] }>;
    return this.request(`/organizations/${organizationId}/contracts/${contractId}/history`);
  }

  async getContractAudit(organizationId: string, contractId: string): Promise<{ auditLogs: unknown[] }> {
    if (this.demoMode) return demoApi.getContractAudit(organizationId, contractId) as unknown as Promise<{ auditLogs: unknown[] }>;
    return this.request(`/organizations/${organizationId}/contracts/${contractId}/audit`);
  }

  async exportContract(organizationId: string, contractId: string): Promise<{ exportedAt: string; contract: ApiContract; versions: ApiVersion[]; interactions: ApiInteraction[] }> {
    if (this.demoMode) {
      const d = await demoApi.getContract(organizationId, contractId);
      return { exportedAt: new Date().toISOString(), ...d } as never;
    }
    return this.request(`/organizations/${organizationId}/contracts/${contractId}/export`);
  }

  async uploadAttachment(organizationId: string, contractId: string, file: { filename: string; contentType: string; data: string }) {
    if (this.demoMode) return { attachment: { id: "att-demo", filename: file.filename, url: "#" } };
    return this.request(`/organizations/${organizationId}/contracts/${contractId}/attachments`, {
      method: "POST",
      body: JSON.stringify(file),
    });
  }

  /* ---------- interactions ---------- */

  async getInteractions(organizationId: string, contractId: string, type?: string): Promise<{ interactions: ApiInteraction[]; pagination: ApiPagination }> {
    if (this.demoMode) return demoApi.getInteractions(organizationId, contractId, type) as unknown as Promise<{ interactions: ApiInteraction[]; pagination: ApiPagination }>;
    const query = type ? `?type=${type}` : "";
    return this.request(`/organizations/${organizationId}/contracts/${contractId}/interactions${query}`);
  }

  async createInteraction(
    organizationId: string,
    contractId: string,
    data: { interactionType: string; content: string; structuredData?: Record<string, unknown>; progressPercentage?: number; attachments?: unknown[] }
  ): Promise<{ interaction: ApiInteraction }> {
    if (this.demoMode) return demoApi.createInteraction(organizationId, contractId, data) as unknown as Promise<{ interaction: ApiInteraction }>;
    return this.request(`/organizations/${organizationId}/contracts/${contractId}/interactions`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /* ---------- notifications ---------- */

  async getNotifications(params?: { unreadOnly?: boolean; limit?: number; offset?: number }): Promise<{ notifications: ApiNotification[]; unreadCount: number; pagination: ApiPagination }> {
    if (this.demoMode) {
      return demoApi.getNotifications(params) as unknown as Promise<{ notifications: ApiNotification[]; unreadCount: number; pagination: ApiPagination }>;
    }
    const queryParams = new URLSearchParams();
    if (params?.unreadOnly) queryParams.append("unreadOnly", "true");
    if (params?.limit) queryParams.append("limit", String(params.limit));
    if (params?.offset) queryParams.append("offset", String(params.offset));
    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return this.request(`/notifications${query}`);
  }

  async markNotificationRead(notificationId: string): Promise<{ notification: ApiNotification }> {
    if (this.demoMode) return demoApi.markNotificationRead(notificationId) as unknown as Promise<{ notification: ApiNotification }>;
    return this.request(`/notifications/${notificationId}/read`, { method: "POST" });
  }

  async markAllNotificationsRead(): Promise<{ message: string }> {
    if (this.demoMode) return demoApi.markAllNotificationsRead();
    return this.request("/notifications/read-all", { method: "POST" });
  }

  /* ---------- categories ---------- */

  async getCategories(organizationId: string): Promise<{ categories: ApiCategory[] }> {
    if (this.demoMode) return demoApi.getCategories(organizationId) as unknown as Promise<{ categories: ApiCategory[] }>;
    return this.request(`/organizations/${organizationId}/categories`);
  }

  async createCategory(organizationId: string, data: { name: string; color?: string; description?: string }): Promise<{ category: ApiCategory }> {
    if (this.demoMode) return demoApi.createCategory(organizationId, data) as unknown as Promise<{ category: ApiCategory }>;
    return this.request(`/organizations/${organizationId}/categories`, { method: "POST", body: JSON.stringify(data) });
  }

  async updateCategory(organizationId: string, categoryId: string, data: { name?: string; color?: string; description?: string }): Promise<{ category: ApiCategory }> {
    if (this.demoMode) return demoApi.updateCategory(organizationId, categoryId, data) as unknown as Promise<{ category: ApiCategory }>;
    return this.request(`/organizations/${organizationId}/categories/${categoryId}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  async deleteCategory(organizationId: string, categoryId: string): Promise<{ message: string }> {
    if (this.demoMode) return demoApi.deleteCategory(organizationId, categoryId);
    return this.request(`/organizations/${organizationId}/categories/${categoryId}`, { method: "DELETE" });
  }

  /* ---------- users / search / contact ---------- */

  async getOrganizationUsers(organizationId: string): Promise<{ users: ApiUser[] }> {
    if (this.demoMode) return demoApi.getOrganizationUsers(organizationId) as unknown as Promise<{ users: ApiUser[] }>;
    return this.request(`/organizations/${organizationId}/users`);
  }

  async searchUsers(organizationId: string, query: string): Promise<{ users: ApiUser[] }> {
    if (this.demoMode) return demoApi.searchUsers(organizationId, query) as unknown as Promise<{ users: ApiUser[] }>;
    return this.request(`/organizations/${organizationId}/users/search?q=${encodeURIComponent(query)}`);
  }

  async search(organizationId: string, q: string): Promise<{ contracts: ApiContract[]; users: ApiUser[]; total: number }> {
    if (this.demoMode) {
      const c = await demoApi.getContracts(organizationId, { search: q, limit: 20 });
      const u = await demoApi.searchUsers(organizationId, q);
      return { contracts: c.contracts as ApiContract[], users: u.users as ApiUser[], total: c.contracts.length + u.users.length };
    }
    return this.request(`/search?organizationId=${encodeURIComponent(organizationId)}&q=${encodeURIComponent(q)}`);
  }

  async contact(data: { name: string; email: string; message: string }): Promise<{ ok: boolean; message: string }> {
    if (this.demoMode) return { ok: true, message: "Received." };
    return this.request("/public/contact", { method: "POST", body: JSON.stringify(data) });
  }
}

export const api = new ApiClient();
export default api;
