const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }

  getAccessToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('accessToken');
    }
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAccessToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setAccessToken(null);
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async register(email: string, password: string, firstName: string, lastName: string) {
    const data = await this.request<{ user: any; organization: any; accessToken: string; refreshToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
    this.setAccessToken(data.accessToken);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ user: any; organizations: any[]; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setAccessToken(data.accessToken);
    return data;
  }

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    this.setAccessToken(null);
    localStorage.removeItem('refreshToken');
  }

  async getMe() {
    return this.request<{ user: any; organizations: any[] }>('/auth/me');
  }

  async updateProfile(data: { firstName?: string; lastName?: string; avatarUrl?: string }) {
    return this.request<{ user: any }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Organizations
  async getOrganizations() {
    return this.request<{ organizations: any[] }>('/organizations');
  }

  async createOrganization(name: string, slug?: string) {
    return this.request<{ organization: any }>('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
  }

  async getOrganization(organizationId: string) {
    return this.request<{ organization: any }>(`/organizations/${organizationId}`);
  }

  async updateOrganization(organizationId: string, data: { name?: string; branding?: any; settings?: any }) {
    return this.request<{ organization: any }>(`/organizations/${organizationId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getOrganizationMembers(organizationId: string) {
    return this.request<{ members: any[] }>(`/organizations/${organizationId}/members`);
  }

  async inviteMember(organizationId: string, email: string, role?: string) {
    return this.request<{ membership: any }>(`/organizations/${organizationId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async updateMemberRole(organizationId: string, memberId: string, role: string, status?: string) {
    return this.request<{ membership: any }>(`/organizations/${organizationId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role, status }),
    });
  }

  async removeMember(organizationId: string, memberId: string) {
    return this.request<{ message: string }>(`/organizations/${organizationId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async getOrganizationAnalytics(organizationId: string) {
    return this.request<{ stats: any; contractsByStatus: any; recentContracts: any[] }>(
      `/organizations/${organizationId}/analytics`
    );
  }

  // Contracts
  async getContracts(organizationId: string, params?: { status?: string; priority?: string; search?: string; page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<{ contracts: any[]; pagination: any }>(
      `/organizations/${organizationId}/contracts${query}`
    );
  }

  async getContract(organizationId: string, contractId: string) {
    return this.request<{ contract: any; participants: any[]; versions: any[]; interactions: any[] }>(
      `/organizations/${organizationId}/contracts/${contractId}`
    );
  }

  async createContract(organizationId: string, data: {
    title: string;
    description: string;
    deadline?: string;
    priority?: string;
    categoryId?: string;
    executorId?: string;
    tags?: string[];
  }) {
    return this.request<{ contract: any }>(`/organizations/${organizationId}/contracts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContract(organizationId: string, contractId: string, data: {
    title?: string;
    description?: string;
    deadline?: string;
    priority?: string;
    categoryId?: string;
    tags?: string[];
    changeReason?: string;
  }) {
    return this.request<{ contract: any }>(`/organizations/${organizationId}/contracts/${contractId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async sendContract(organizationId: string, contractId: string) {
    return this.request<{ contract: any }>(`/organizations/${organizationId}/contracts/${contractId}/send`, {
      method: 'POST',
    });
  }

  async acceptContract(organizationId: string, contractId: string) {
    return this.request<{ contract: any }>(`/organizations/${organizationId}/contracts/${contractId}/accept`, {
      method: 'POST',
    });
  }

  async rejectContract(organizationId: string, contractId: string, reason?: string) {
    return this.request<{ contract: any }>(`/organizations/${organizationId}/contracts/${contractId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async submitContract(organizationId: string, contractId: string, summary?: string, attachments?: any[]) {
    return this.request<{ contract: any }>(`/organizations/${organizationId}/contracts/${contractId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ summary, attachments }),
    });
  }

  async approveContract(organizationId: string, contractId: string) {
    return this.request<{ contract: any }>(`/organizations/${organizationId}/contracts/${contractId}/approve`, {
      method: 'POST',
    });
  }

  async archiveContract(organizationId: string, contractId: string) {
    return this.request<{ contract: any }>(`/organizations/${organizationId}/contracts/${contractId}/archive`, {
      method: 'POST',
    });
  }

  async getContractHistory(organizationId: string, contractId: string) {
    return this.request<{ versions: any[] }>(
      `/organizations/${organizationId}/contracts/${contractId}/history`
    );
  }

  async getContractAudit(organizationId: string, contractId: string) {
    return this.request<{ auditLogs: any[] }>(
      `/organizations/${organizationId}/contracts/${contractId}/audit`
    );
  }

  // Interactions
  async getInteractions(organizationId: string, contractId: string, type?: string) {
    const query = type ? `?type=${type}` : '';
    return this.request<{ interactions: any[]; pagination: any }>(
      `/organizations/${organizationId}/contracts/${contractId}/interactions${query}`
    );
  }

  async createInteraction(organizationId: string, contractId: string, data: {
    interactionType: string;
    content: string;
    structuredData?: any;
    progressPercentage?: number;
    attachments?: any[];
  }) {
    return this.request<{ interaction: any }>(
      `/organizations/${organizationId}/contracts/${contractId}/interactions`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  // Notifications
  async getNotifications(params?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.unreadOnly) queryParams.append('unreadOnly', 'true');
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.offset) queryParams.append('offset', String(params.offset));
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<{ notifications: any[]; unreadCount: number; pagination: any }>(
      `/notifications${query}`
    );
  }

  async markNotificationRead(notificationId: string) {
    return this.request<{ notification: any }>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request<{ message: string }>('/notifications/read-all', {
      method: 'POST',
    });
  }

  async deleteNotification(notificationId: string) {
    return this.request<{ message: string }>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  async getUnreadNotificationCount() {
    return this.request<{ count: number }>('/notifications/unread-count');
  }

  // Categories
  async getCategories(organizationId: string) {
    return this.request<{ categories: any[] }>(`/organizations/${organizationId}/categories`);
  }

  async createCategory(organizationId: string, data: { name: string; color?: string; description?: string }) {
    return this.request<{ category: any }>(`/organizations/${organizationId}/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(organizationId: string, categoryId: string, data: { name?: string; color?: string; description?: string }) {
    return this.request<{ category: any }>(`/organizations/${organizationId}/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(organizationId: string, categoryId: string) {
    return this.request<{ message: string }>(`/organizations/${organizationId}/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  // Users
  async searchUsers(organizationId: string, query: string) {
    return this.request<{ users: any[] }>(
      `/organizations/${organizationId}/users/search?q=${encodeURIComponent(query)}`
    );
  }

  async getUser(organizationId: string, userId: string) {
    return this.request<{ user: any }>(`/organizations/${organizationId}/users/${userId}`);
  }
}

export const api = new ApiClient();
export default api;
