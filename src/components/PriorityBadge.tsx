import { cn } from '@/lib/utils';
import type { ContractPriority } from '@/types/contracts';
import { AlertTriangle, ArrowDown, ArrowUp, Flame } from 'lucide-react';

const priorityConfig: Record<ContractPriority, { label: string; className: string; icon: React.ElementType }> = {
  low: { label: 'Low', className: 'text-muted-foreground', icon: ArrowDown },
  medium: { label: 'Medium', className: 'text-status-sent', icon: ArrowUp },
  high: { label: 'High', className: 'text-warning', icon: AlertTriangle },
  critical: { label: 'Critical', className: 'text-destructive', icon: Flame },
};

export function PriorityBadge({ priority }: { priority: ContractPriority }) {
  const config = priorityConfig[priority];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', config.className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
