import { cn } from '@/lib/utils';
import type { User } from '@/types/contracts';

interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

const colors = [
  'bg-primary/10 text-primary',
  'bg-success/10 text-success',
  'bg-warning/10 text-warning',
  'bg-destructive/10 text-destructive',
  'bg-status-accepted/10 text-status-accepted',
  'bg-status-submitted/10 text-status-submitted',
];

function getColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function UserAvatar({ user, size = 'md', showName }: UserAvatarProps) {
  const initials = `${user.firstName[0]}${user.lastName[0]}`;
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold shrink-0',
          sizeClasses[size],
          getColor(user.id)
        )}
      >
        {initials}
      </div>
      {showName && (
        <span className="text-sm font-medium text-foreground truncate">
          {user.firstName} {user.lastName}
        </span>
      )}
    </div>
  );
}
