import { cn } from '@/lib/utils';
import type { ContractStatus } from '@/types/contracts';

const statusConfig: Record<ContractStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-status-draft/10 text-status-draft' },
  sent: { label: 'Sent', className: 'bg-status-sent/10 text-status-sent' },
  accepted: { label: 'Accepted', className: 'bg-status-accepted/10 text-status-accepted' },
  in_progress: { label: 'In Progress', className: 'bg-status-in-progress/10 text-status-in-progress' },
  submitted: { label: 'Submitted', className: 'bg-status-submitted/10 text-status-submitted' },
  approved: { label: 'Approved', className: 'bg-status-approved/10 text-status-approved' },
  rejected: { label: 'Rejected', className: 'bg-status-rejected/10 text-status-rejected' },
  archived: { label: 'Archived', className: 'bg-status-archived/10 text-status-archived' },
};

interface StatusBadgeProps {
  status: ContractStatus;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function StatusBadge({ status, size = 'sm', pulse }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'status-badge',
        config.className,
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-sm',
        pulse && 'animate-pulse'
      )}
    >
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        status === 'draft' && 'bg-status-draft',
        status === 'sent' && 'bg-status-sent',
        status === 'accepted' && 'bg-status-accepted',
        status === 'in_progress' && 'bg-status-in-progress',
        status === 'submitted' && 'bg-status-submitted',
        status === 'approved' && 'bg-status-approved',
        status === 'rejected' && 'bg-status-rejected',
        status === 'archived' && 'bg-status-archived',
      )} />
      {config.label}
    </span>
  );
}
