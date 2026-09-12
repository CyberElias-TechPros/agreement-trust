import { cn } from "@/lib/utils";
import type { ContractStatus } from "@/types/contracts";

const statusConfig: Record<ContractStatus, { label: string; className: string; dot: string }> = {
  draft: { label: "Draft", className: "bg-status-draft/10 text-status-draft border-status-draft/20", dot: "bg-status-draft" },
  sent: { label: "Sent", className: "bg-status-sent/10 text-status-sent border-status-sent/20", dot: "bg-status-sent" },
  accepted: { label: "Accepted", className: "bg-status-accepted/10 text-status-accepted border-status-accepted/20", dot: "bg-status-accepted" },
  in_progress: { label: "In Progress", className: "bg-status-in-progress/10 text-status-in-progress border-status-in-progress/20", dot: "bg-status-in-progress" },
  submitted: { label: "Submitted", className: "bg-status-submitted/10 text-status-submitted border-status-submitted/20", dot: "bg-status-submitted" },
  approved: { label: "Approved", className: "bg-status-approved/10 text-status-approved border-status-approved/20", dot: "bg-status-approved" },
  rejected: { label: "Rejected", className: "bg-status-rejected/10 text-status-rejected border-status-rejected/20", dot: "bg-status-rejected" },
  archived: { label: "Archived", className: "bg-status-archived/10 text-status-archived border-status-archived/20", dot: "bg-status-archived" },
};

interface StatusBadgeProps {
  status: ContractStatus;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

export function StatusBadge({ status, size = "sm", pulse }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;
  return (
    <span
      className={cn(
        "status-badge border",
        config.className,
        size === "md" && "px-3 py-1 text-xs",
        size === "lg" && "px-4 py-1.5 text-xs"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot, pulse && "animate-pulse")} />
      {config.label}
    </span>
  );
}
