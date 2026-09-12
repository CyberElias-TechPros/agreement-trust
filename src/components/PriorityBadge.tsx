import { cn } from "@/lib/utils";
import type { ContractPriority } from "@/types/contracts";
import { ArrowDown, ArrowUp, AlertTriangle, Flame } from "lucide-react";

const priorityConfig: Record<ContractPriority, { label: string; className: string; icon: React.ElementType }> = {
  low: { label: "Low", className: "text-muted-foreground", icon: ArrowDown },
  medium: { label: "Medium", className: "text-status-sent", icon: ArrowUp },
  high: { label: "High", className: "text-warning", icon: AlertTriangle },
  critical: { label: "Critical", className: "text-destructive", icon: Flame },
};

export function PriorityBadge({ priority }: { priority?: ContractPriority }) {
  const config = priority ? priorityConfig[priority] : undefined;
  if (!config) return null;

  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-current/15 bg-current/[0.06] px-2 py-0.5 text-[11px] font-semibold",
        config.className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
