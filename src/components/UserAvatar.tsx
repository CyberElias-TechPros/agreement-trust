import { cn } from "@/lib/utils";
import type { User, UserRole } from "@/types/contracts";

interface UserAvatarProps {
  user: Partial<User> & { firstName?: string; lastName?: string; id?: string; email?: string; role?: UserRole };
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

const sizeClasses = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

const colors = [
  "bg-indigo/15 text-indigo",
  "bg-success/15 text-success",
  "bg-warning/15 text-warning",
  "bg-destructive/15 text-destructive",
  "bg-[#8B5CF6]/15 text-[#8B5CF6]",
  "bg-brass/15 text-brass-strong",
];

function getColor(id?: string) {
  if (!id) return colors[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function UserAvatar({ user, size = "md", showName }: UserAvatarProps) {
  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() || "?";

  return (
    <div className="flex items-center gap-2">
      <div
        title={showName ? undefined : `${firstName} ${lastName}`.trim()}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10",
          sizeClasses[size],
          getColor(user?.id)
        )}
      >
        {initials}
      </div>
      {showName && (
        <span className="truncate text-sm font-medium text-foreground">
          {firstName} {lastName}
        </span>
      )}
    </div>
  );
}
