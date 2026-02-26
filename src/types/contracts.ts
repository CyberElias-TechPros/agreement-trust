export type ContractStatus = 
  | 'draft' 
  | 'sent' 
  | 'accepted' 
  | 'in_progress' 
  | 'submitted' 
  | 'approved' 
  | 'rejected' 
  | 'archived';

export type ContractPriority = 'low' | 'medium' | 'high' | 'critical';

export type InteractionType = 
  | 'progress_update' 
  | 'clarification_request' 
  | 'clarification_response'
  | 'scope_proposal' 
  | 'issue_report' 
  | 'issue_resolution'
  | 'submission' 
  | 'approval' 
  | 'rejection' 
  | 'comment' 
  | 'system_note';

export type UserRole = 'owner' | 'admin' | 'manager' | 'executor' | 'observer' | 'auditor';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  planType: 'free' | 'pro' | 'enterprise';
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface ContractParticipant {
  user: User;
  role: 'initiator' | 'executor' | 'observer';
  isLead: boolean;
}

export interface ContractVersion {
  id: string;
  versionNumber: number;
  description: string;
  deadline?: string;
  priority: ContractPriority;
  changedBy: User;
  changedAt: string;
  changeReason?: string;
}

export interface ContractInteraction {
  id: string;
  contractId: string;
  author: User;
  interactionType: InteractionType;
  content: string;
  progressPercentage?: number;
  attachments?: { id: string; filename: string; url: string }[];
  statusChangeFrom?: ContractStatus;
  statusChangeTo?: ContractStatus;
  createdAt: string;
}

export interface TaskContract {
  id: string;
  contractNumber: string;
  title: string;
  description: string;
  status: ContractStatus;
  priority: ContractPriority;
  initiator: User;
  executor?: User;
  participants: ContractParticipant[];
  category?: Category;
  tags: string[];
  deadline?: string;
  currentVersion: number;
  versions: ContractVersion[];
  interactions: ContractInteraction[];
  createdAt: string;
  sentAt?: string;
  acceptedAt?: string;
  completedAt?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  contractId?: string;
  read: boolean;
  createdAt: string;
}

export interface DashboardStats {
  activeContracts: number;
  pendingReview: number;
  overdue: number;
  completionRate: number;
  totalContracts: number;
  thisWeekCreated: number;
}
