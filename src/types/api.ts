/**
 * API contract types — the shapes exchanged between the frontend and
 * the backend (and mirrored by the demo adapter). Keeping these here
 * prevents contract drift between layers.
 */

export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role?: string;
  title?: string;
}

export interface ApiOrganization {
  id: string;
  name: string;
  slug: string;
  planType: "free" | "pro" | "enterprise";
  branding?: { primaryColor?: string; accentColor?: string };
  settings?: Record<string, unknown>;
  role?: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface ApiMembership {
  id: string;
  user?: ApiUser;
  userDetails?: ApiUser;
  role: string;
  status: string;
  joinedAt?: string;
}

export interface ApiVersion {
  id: string;
  versionNumber: number;
  title?: string;
  description: string;
  deadline?: string;
  priority: string;
  changeReason?: string;
  changedBy?: ApiUser;
  changedAt: string;
}

export interface ApiInteraction {
  id: string;
  contractId: string;
  author?: ApiUser;
  interactionType: string;
  content: string;
  progressPercentage?: number;
  statusChangeFrom?: string;
  statusChangeTo?: string;
  createdAt: string;
}

export interface ApiContract {
  id: string;
  contractNumber: string;
  title: string;
  description: string;
  currentDescription?: string;
  status: string;
  currentStatus?: string;
  priority: string;
  currentPriority?: string;
  deadline?: string;
  currentDeadline?: string;
  progress?: number;
  category?: ApiCategory | null;
  initiator?: ApiUser;
  executor?: ApiUser | null;
  responsibleExecutor?: ApiUser | null;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface ApiAnalytics {
  stats: {
    totalContracts: number;
    activeContracts: number;
    pendingReview: number;
    overdue: number;
    completionRate: number;
    completed?: number;
    completedThisMonth?: number;
    pending?: number;
    thisWeekCreated?: number;
  };
  contractsByStatus: Record<string, number>;
  recentContracts: ApiContract[];
  weeklyActivity?: { week: string; created: number; completed: number }[];
  sealedPerMonth?: { month: string; sealed: number }[];
  teamPerformance?: { name: string; completed: number; avgDays: number; onTime: number }[];
}

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  content: string;
  contractId?: string;
  contract?: { title: string; contractNumber: string };
  read: boolean;
  createdAt: string;
}

export interface ApiPagination {
  page?: number;
  limit?: number;
  offset?: number;
  total: number;
  pages?: number;
}

export interface ApiTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends ApiTokens {
  user: ApiUser;
  organizations: ApiOrganization[];
}

export interface RegisterResponse extends ApiTokens {
  user: ApiUser;
  organization: ApiOrganization;
}

export interface MeResponse {
  user: ApiUser;
  organizations: ApiOrganization[];
}
