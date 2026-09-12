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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

type DemoListener = (active: boolean) => void;

/**
 * ApiClient — single entry point for all server communication.
 *
 * Live mode  : talks to the Express/MongoDB backend at VITE_API_URL.
 * Demo mode  : activates automatically when the backend is unreachable
 *              (e.g. preview environments without a database). The entire
 *              product then runs against an in-browser store with the
 *              same business rules, and the UI clearly flags demo mode.
 */
class ApiClient {
  private accessToken: string | null = null;
  private demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  private listeners = new Set<DemoListener>();

  get demoActive(): boolean {
    return this.demoMode;
  }

  /** Subscribe to demo-mode changes (used by the banner). */
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
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  }

  getAccessToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem("accessToken");
    }
    return this.accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch {
      // Network-level failure (backend down) — gracefully degrade to demo.
      this.enableDemo();
      throw new Error("API unreachable — switching to demo mode");
    }

    if (response.status === 401) {
      this.setAccessToken(null);
      window.location.href = "/login";
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

  /** Demo-mode entry point: sign into the seeded workspace. */
  enterDemo() {
    this.enableDemo();
    return demoApi.enterDemo() as unknown as Promise<LoginResponse>;
  }

  /* ---------- auth ---------- */

  async register(email: string, password: string, firstName: string, lastName: string, organizationName?: string): Promise<RegisterResponse> {
    if (this.demoMode) {
      const data = await demoApi.register(email, password, firstName, lastName, organizationName);
      this.setAccessToken(data.accessToken);
      return data as unknown as RegisterResponse;
    }
    const data = await this.request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, firstName, lastName, organizationName }),
    });
    this.setAccessToken(data.accessToken);
    return data;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    if (this.demoMode) {
      const data = await demoApi.login(email, password);
      this.setAccessToken(data.accessToken);
      return data as unknown as LoginResponse;
    }
    const data = await this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setAccessToken(data.accessToken);
    return data;
  }

  async logout(): Promise<void> {
    try {
      if (this.demoMode) {
        await demoApi.logout();
      } else {
        const refreshToken = localStorage.getItem("refreshToken");
        await this.request("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.setAccessToken(null);
      localStorage.removeItem("refreshToken");
    }
  }

  async getMe(): Promise<MeResponse> {
    if (this.demoMode) return demoApi.getMe() as unknown as Promise<MeResponse>;
    return this.request<MeResponse>("/auth/me");
  }

  async updateProfile(data: { firstName?: string; lastName?: string; avatarUrl?: string }): Promise<{ user: ApiUser }> {
    if (this.demoMode) return demoApi.updateProfile(data) as unknown as Promise<{ user: ApiUser }>;
    return this.request<{ user: ApiUser }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string } & Partial<ApiTokens>> {
    if (this.demoMode) return demoApi.changePassword(currentPassword, newPassword);
    return this.request<{ message: string } & Partial<ApiTokens>>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  /* ---------- organizations ---------- */

  async getOrganizations(): Promise<{ organizations: ApiOrganization[] }> {
    if (this.demoMode) return demoApi.getOrganizations() as unknown as Promise<{ organizations: ApiOrganization[] }>;
    return this.request<{ organizations: ApiOrganization[] }>("/organizations");
  }

  async createOrganization(name: string, slug?: string): Promise<{ organization: ApiOrganization }> {
    if (this.demoMode) return demoApi.createOrganization(name, slug) as unknown as Promise<{ organization: ApiOrganization }>;
    return this.request<{ organization: ApiOrganization }>("/organizations", {
      method: "POST",
      body: JSON.stringify({ name, slug }),
    });
  }

  async getOrganization(organizationId: string): Promise<{ organization: ApiOrganization }> {
    if (this.demoMode) return demoApi.getOrganization(organizationId) as unknown as Promise<{ organization: ApiOrganization }>;
    return this.request<{ organization: ApiOrganization }>(`/organizations/${organizationId}`);
  }

  async updateOrganization(
    organizationId: string,
    data: { name?: string; branding?: ApiOrganization["branding"]; settings?: ApiOrganization["settings"] }
  ): Promise<{ organization: ApiOrganization }> {
    if (this.demoMode) return demoApi.updateOrganization(organizationId, data) as unknown as Promise<{ organization: ApiOrganization }>;
    return this.request<{ organization: ApiOrganization }>(`/organizations/${organizationId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getOrganizationMembers(organizationId: string): Promise<{ members: ApiMembership[] }> {
    if (this.demoMode) return demoApi.getOrganizationMembers(organizationId) as unknown as Promise<{ members: ApiMembership[] }>;
    return this.request<{ members: ApiMembership[] }>(`/organizations/${organizationId}/members`);
  }

  async inviteMember(organizationId: string, email: string, role?: string): Promise<{ membership: ApiMembership }> {
    if (this.demoMode) return demoApi.inviteMember(organizationId, email, role) as unknown as Promise<{ membership: ApiMembership }>;
    return this.request<{ membership: ApiMembership }>(`/organizations/${organizationId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: string,
    status?: string
  ): Promise<{ membership: ApiMembership }> {
    if (this.demoMode) return demoApi.updateMemberRole(organizationId, memberId, role, status) as unknown as Promise<{ membership: ApiMembership }>;
    return this.request<{ membership: ApiMembership }>(`/organizations/${organizationId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ role, status }),
    });
  }

  async removeMember(organizationId: string, memberId: string): Promise<{ message: string }> {
    if (this.demoMode) return demoApi.removeMember(organizationId, memberId);
    return this.request<{ message: string }>(`/organizations/${organizationId}/members/${memberId}`, {
      method: "DELETE",
    });
  }

  async getOrganizationAnalytics(organizationId: string): Promise<ApiAnalytics> {
    if (this.demoMode) return demoApi.getOrganizationAnalytics(organizationId) as unknown as Promise<ApiAnalytics>;
    return this.request<ApiAnalytics>(`/organizations/${organizationId}/analytics`);
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
    return this.request<{ contracts: ApiContract[]; pagination: ApiPagination }>(
      `/organizations/${organizationId}/contracts${query}`
    );
  }

  async getContract(
    organizationId: string,
    contractId: string
  ): Promise<{ contract: ApiContract; participants: unknown[]; versions: ApiVersion[]; interactions: ApiInteraction[] }> {
    if (this.demoMode) return demoApi.getContract(organizationId, contractId) as unknown as Promise<{
      contract: ApiContract;
      participants: unknown[];
      versions: ApiVersion[];
      interactions: ApiInteraction[];
    }>;
    return this.request<{ contract: ApiContract; participants: unknown[]; versions: ApiVersion[]; interactions: ApiInteraction[] }>(
      `/organizations/${organizationId}/contracts/${contractId}`
    );
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
    }
  ): Promise<{ contract: ApiContract }> {
    if (this.demoMode) return demoApi.createContract(organizationId, data) as unknown as Promise<{ contract: ApiContract }>;
    return this.request<{ contract: ApiContract }>(`/organizations/${organizationId}/contracts`, {
      method: "POST",
      body: JSON.stringify(data),
    });
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
    return this.request<{ contract: ApiContract }>(`/organizations/${organizationId}/contracts/${contractId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  private async transition(
    organizationId: string,
    contractId: string,
    action: "send" | "accept" | "reject" | "submit" | "approve" | "archive",
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
      }
    }
    const body: Record<string, unknown> | undefined =
      action === "reject" || action === "submit" ? { summary: note, reason: note } : undefined;
    return this.request<{ contract: ApiContract }>(
      `/organizations/${organizationId}/contracts/${contractId}/${action}`,
      { method: "POST", body: body ? JSON.stringify(body) : undefined }
    );
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

  submitContract(organizationId: string, contractId: string, summary?: string, _attachments?: unknown[]) {
    return this.transition(organizationId, contractId, "submit", summary);
  }

  approveContract(organizationId: string, contractId: string) {
    return this.transition(organizationId, contractId, "approve");
  }

  archiveContract(organizationId: string, contractId: string) {
    return this.transition(organizationId, contractId, "archive");
  }

  async getContractHistory(organizationId: string, contractId: string): Promise<{ versions: unknown[] }> {
    if (this.demoMode) return demoApi.getContractHistory(organizationId, contractId) as unknown as Promise<{ versions: unknown[] }>;
    return this.request<{ versions: unknown[] }>(`/organizations/${organizationId}/contracts/${contractId}/history`);
  }

  async getContractAudit(organizationId: string, contractId: string): Promise<{ auditLogs: unknown[] }> {
    if (this.demoMode) return demoApi.getContractAudit(organizationId, contractId) as unknown as Promise<{ auditLogs: unknown[] }>;
    return this.request<{ auditLogs: unknown[] }>(`/organizations/${organizationId}/contracts/${contractId}/audit`);
  }

  /* ---------- interactions ---------- */

  async getInteractions(
    organizationId: string,
    contractId: string,
    type?: string
  ): Promise<{ interactions: ApiInteraction[]; pagination: ApiPagination }> {
    if (this.demoMode) return demoApi.getInteractions(organizationId, contractId, type) as unknown as Promise<{ interactions: ApiInteraction[]; pagination: ApiPagination }>;
    const query = type ? `?type=${type}` : "";
    return this.request<{ interactions: ApiInteraction[]; pagination: ApiPagination }>(
      `/organizations/${organizationId}/contracts/${contractId}/interactions${query}`
    );
  }

  async createInteraction(
    organizationId: string,
    contractId: string,
    data: { interactionType: string; content: string; structuredData?: Record<string, unknown>; progressPercentage?: number; attachments?: unknown[] }
  ): Promise<{ interaction: ApiInteraction }> {
    if (this.demoMode) return demoApi.createInteraction(organizationId, contractId, data) as unknown as Promise<{ interaction: ApiInteraction }>;
    return this.request<{ interaction: ApiInteraction }>(
      `/organizations/${organizationId}/contracts/${contractId}/interactions`,
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  /* ---------- notifications ---------- */

  async getNotifications(params?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ notifications: ApiNotification[]; unreadCount: number; pagination: ApiPagination }> {
    if (this.demoMode) return demoApi.getNotifications(params) as unknown as Promise<{ notifications: ApiNotification[]; unreadCount: number; pagination: ApiPagination }>;
    const queryParams = new URLSearchParams();
    if (params?.unreadOnly) queryParams.append("unreadOnly", "true");
    if (params?.limit) queryParams.append("limit", String(params.limit));
    if (params?.offset) queryParams.append("offset", String(params.offset));

    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return this.request<{ notifications: ApiNotification[]; unreadCount: number; pagination: ApiPagination }>(
      `/notifications${query}`
    );
  }

  async markNotificationRead(notificationId: string): Promise<{ notification: ApiNotification }> {
    if (this.demoMode) return demoApi.markNotificationRead(notificationId) as unknown as Promise<{ notification: ApiNotification }>;
    return this.request<{ notification: ApiNotification }>(`/notifications/${notificationId}/read`, {
      method: "POST",
    });
  }

  async markAllNotificationsRead(): Promise<{ message: string }> {
    if (this.demoMode) return demoApi.markAllNotificationsRead();
    return this.request<{ message: string }>("/notifications/read-all", {
      method: "POST",
    });
  }

  /* ---------- categories ---------- */

  async getCategories(organizationId: string): Promise<{ categories: ApiCategory[] }> {
    if (this.demoMode) return demoApi.getCategories(organizationId) as unknown as Promise<{ categories: ApiCategory[] }>;
    return this.request<{ categories: ApiCategory[] }>(`/organizations/${organizationId}/categories`);
  }

  async createCategory(
    organizationId: string,
    data: { name: string; color?: string; description?: string }
  ): Promise<{ category: ApiCategory }> {
    if (this.demoMode) return demoApi.createCategory(organizationId, data) as unknown as Promise<{ category: ApiCategory }>;
    return this.request<{ category: ApiCategory }>(`/organizations/${organizationId}/categories`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCategory(
    organizationId: string,
    categoryId: string,
    data: { name?: string; color?: string; description?: string }
  ): Promise<{ category: ApiCategory }> {
    if (this.demoMode) return demoApi.updateCategory(organizationId, categoryId, data) as unknown as Promise<{ category: ApiCategory }>;
    return this.request<{ category: ApiCategory }>(`/organizations/${organizationId}/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(organizationId: string, categoryId: string): Promise<{ message: string }> {
    if (this.demoMode) return demoApi.deleteCategory(organizationId, categoryId);
    return this.request<{ message: string }>(`/organizations/${organizationId}/categories/${categoryId}`, {
      method: "DELETE",
    });
  }

  /* ---------- users ---------- */

  async getOrganizationUsers(organizationId: string): Promise<{ users: ApiUser[] }> {
    if (this.demoMode) return demoApi.getOrganizationUsers(organizationId) as unknown as Promise<{ users: ApiUser[] }>;
    return this.request<{ users: ApiUser[] }>(`/organizations/${organizationId}/users`);
  }

  async searchUsers(organizationId: string, query: string): Promise<{ users: ApiUser[] }> {
    if (this.demoMode) return demoApi.searchUsers(organizationId, query) as unknown as Promise<{ users: ApiUser[] }>;
    return this.request<{ users: ApiUser[] }>(`/organizations/${organizationId}/users/search?q=${encodeURIComponent(query)}`);
  }
}

export const api = new ApiClient();
export default api;
