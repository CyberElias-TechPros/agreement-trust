import { cn } from '@/lib/utils';
import type { User, UserRole } from '@/types/contracts';

interface UserAvatarProps {
  user: Partial<User> & { firstName?: string; lastName?: string; id?: string; email?: string; role?: UserRole };
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
  'bg-blue-100 text-blue-600',
  'bg-purple-100 text-purple-600',
];

function getColor(id?: string) {
  if (!id) return colors[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function UserAvatar({ user, size = 'md', showName }: UserAvatarProps) {
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?';
  
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold shrink-0',
          sizeClasses[size],
          getColor(user?.id)
        )}
      >
        {initials}
      </div>
      {showName && (
        <span className="text-sm font-medium text-foreground truncate">
          {firstName} {lastName}
        </span>
      )}
    </div>
  );
}
