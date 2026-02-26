import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Send,
  Clock,
  AlertCircle,
  Archive,
  BarChart3,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  User,
  FileCheck,
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { currentUser } from '@/data/mockData';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const mainNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'All Contracts', icon: FileText, path: '/contracts' },
  { label: 'Created by Me', icon: Send, path: '/contracts?filter=created' },
  { label: 'Awaiting Review', icon: FileCheck, path: '/contracts?filter=review' },
  { label: 'Overdue', icon: AlertCircle, path: '/contracts?filter=overdue' },
  { label: 'Archived', icon: Archive, path: '/contracts?filter=archived' },
];

const secondaryNav = [
  { label: 'Reports', icon: BarChart3, path: '/reports' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path.includes('?')) return location.pathname + location.search === path;
    return location.pathname === path;
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-sm text-sidebar-accent-foreground whitespace-nowrap"
              >
                TaskContract
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Contract */}
      <div className="px-3 pt-4 pb-2">
        <Button
          onClick={() => navigate('/contracts/new')}
          className={cn(
            'w-full gradient-hero text-primary-foreground border-0 shadow-glow',
            collapsed ? 'px-0 justify-center' : 'justify-start'
          )}
          size={collapsed ? 'icon' : 'default'}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="ml-2">New Contract</span>}
        </Button>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">
        <p className={cn('text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold mb-2', collapsed && 'text-center')}>
          {collapsed ? '—' : 'Contracts'}
        </p>
        {mainNav.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive(item.path)
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        <div className="pt-4">
          <p className={cn('text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold mb-2', collapsed && 'text-center')}>
            {collapsed ? '—' : 'Workspace'}
          </p>
          {secondaryNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent/50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>

        <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <Link to="/profile" className="shrink-0">
            <UserAvatar user={currentUser} size="md" />
          </Link>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{currentUser.email}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
