import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Check, CheckCheck, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifications as allNotifications } from '@/data/mockData';
import { cn } from '@/lib/utils';

export default function Notifications() {
  const [notifications, setNotifications] = useState(allNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(notifications.map(n => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));

  const typeIcon: Record<string, string> = {
    submission: '📤',
    progress: '📊',
    issue: '⚠️',
    approval: '✅',
    deadline: '⏰',
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
            <button onClick={() => setFilter('all')} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', filter === 'all' ? 'bg-secondary text-foreground' : 'text-muted-foreground')}>All</button>
            <button onClick={() => setFilter('unread')} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', filter === 'unread' ? 'bg-secondary text-foreground' : 'text-muted-foreground')}>Unread</button>
          </div>
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="w-4 h-4 mr-1" /> Mark all read
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No notifications to show.</p>
        </div>
      ) : (
        <div className="glass-card divide-y divide-border">
          {filtered.map((n, i) => (
            <motion.button
              key={n.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => {
                markRead(n.id);
                if (n.contractId) navigate(`/contracts/${n.contractId}`);
              }}
              className={cn(
                'w-full text-left flex items-start gap-4 p-4 hover:bg-secondary/30 transition-colors',
                !n.read && 'bg-primary/[0.02]'
              )}
            >
              <span className="text-lg mt-0.5">{typeIcon[n.type] || '📋'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.content}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!n.read && (
                <button
                  onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                  className="text-muted-foreground hover:text-foreground p-1 shrink-0"
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
