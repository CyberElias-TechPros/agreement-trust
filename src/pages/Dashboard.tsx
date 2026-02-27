import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Clock, AlertCircle, TrendingUp, ArrowRight, Plus, Loader2 } from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

interface DashboardStats {
  totalContracts: number;
  activeContracts: number;
  pendingReview: number;
  overdue: number;
  completionRate: number;
}

interface ContractData {
  id: string;
  contractNumber: string;
  title: string;
  status: string;
  currentDeadline?: string;
  currentPriority: string;
  initiator?: {
    firstName: string;
    lastName: string;
  };
  responsibleExecutor?: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  category?: {
    name: string;
    color: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface NotificationData {
  id: string;
  title: string;
  content?: string;
  createdAt: string;
  contract?: {
    title: string;
    contractNumber: string;
  };
}

export default function Dashboard() {
  const { user, currentOrganization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  useEffect(() => {
    if (!currentOrganization) return;

    const fetchData = async () => {
      try {
        const [analyticsData, contractsData, notificationsData] = await Promise.all([
          api.getOrganizationAnalytics(currentOrganization.id),
          api.getContracts(currentOrganization.id, { limit: 5 }),
          api.getNotifications({ limit: 5 }),
        ]);

        setStats(analyticsData.stats);
        setContracts(analyticsData.recentContracts || contractsData.contracts || []);
        setNotifications(notificationsData.notifications || []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentOrganization]);

  const activeContracts = contracts.filter(c => ['in_progress', 'accepted', 'sent'].includes(c.status));
  const awaitingReview = contracts.filter(c => c.status === 'submitted');
  const recentContracts = contracts;

  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {user?.firstName || 'User'}</h1>
          <p className="page-subtitle">Here's what's happening with your contracts today.</p>
        </div>
        <Link to="/contracts/new">
          <Button className="gradient-hero text-primary-foreground border-0 shadow-glow">
            <Plus className="w-4 h-4 mr-2" /> New Contract
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard 
          title="Active Contracts" 
          value={stats?.activeContracts || 0} 
          icon={FileText} 
          variant="primary" 
          delay={0} 
        />
        <StatsCard 
          title="Pending Review" 
          value={stats?.pendingReview || 0} 
          icon={Clock} 
          variant="warning" 
          delay={0.05} 
        />
        <StatsCard 
          title="Overdue" 
          value={stats?.overdue || 0} 
          icon={AlertCircle} 
          variant={(stats?.overdue || 0) > 0 ? 'danger' : 'success'} 
          delay={0.1} 
        />
        <StatsCard 
          title="Completion Rate" 
          value={`${stats?.completionRate || 0}%`} 
          icon={TrendingUp} 
          variant="success" 
          delay={0.15} 
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Contracts */}
        <div className="lg:col-span-2">
          <div className="glass-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="section-title mb-0">Recent Contracts</h2>
              <Link to="/contracts" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentContracts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No contracts yet. Create your first contract!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentContracts.map((contract, i) => (
                  <motion.div
                    key={contract.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={`/contracts/${contract.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[11px] text-muted-foreground">{contract.contractNumber}</span>
                          <StatusBadge status={contract.status as any} />
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{contract.title}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <PriorityBadge priority={contract.currentPriority as any} />
                        {contract.responsibleExecutor && (
                          <UserAvatar 
                            user={{
                              firstName: contract.responsibleExecutor.firstName,
                              lastName: contract.responsibleExecutor.lastName,
                              avatarUrl: contract.responsibleExecutor.avatarUrl,
                            } as any} 
                            size="sm" 
                          />
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity & Notifications */}
        <div className="space-y-6">
          {/* Awaiting Action */}
          {awaitingReview.length > 0 && (
            <div className="glass-card border-warning/20">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warning" /> Awaiting Your Review
                </h3>
              </div>
              {awaitingReview.map((c) => (
                <Link key={c.id} to={`/contracts/${c.id}`} className="block p-4 hover:bg-secondary/30 transition-colors">
                  <p className="text-sm font-medium text-foreground">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.responsibleExecutor?.firstName} {c.responsibleExecutor?.lastName} submitted for review
                  </p>
                </Link>
              ))}
            </div>
          )}

          {/* Recent Activity */}
          <div className="glass-card">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            </div>
            <div className="p-4 space-y-4">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity</p>
              ) : (
                notifications.map((n, i) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    className="flex gap-3"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">{n.title}</p>
                      {n.content && <p className="text-[11px] text-muted-foreground mt-0.5">{n.content}</p>}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
