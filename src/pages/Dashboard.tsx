import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, ArrowRight, Plus } from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { contracts, dashboardStats, notifications, currentUser } from '@/data/mockData';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const activeContracts = contracts.filter(c => ['in_progress', 'accepted', 'sent'].includes(c.status));
  const awaitingReview = contracts.filter(c => c.status === 'submitted');
  const recentContracts = [...contracts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {currentUser.firstName}</h1>
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
        <StatsCard title="Active Contracts" value={dashboardStats.activeContracts} icon={FileText} variant="primary" trend={{ value: 12, label: 'vs last week' }} delay={0} />
        <StatsCard title="Pending Review" value={dashboardStats.pendingReview} icon={Clock} variant="warning" delay={0.05} />
        <StatsCard title="Overdue" value={dashboardStats.overdue} icon={AlertCircle} variant={dashboardStats.overdue > 0 ? 'danger' : 'success'} delay={0.1} />
        <StatsCard title="Completion Rate" value={`${dashboardStats.completionRate}%`} icon={TrendingUp} variant="success" trend={{ value: 5, label: 'vs last month' }} delay={0.15} />
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
                        <StatusBadge status={contract.status} />
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{contract.title}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <PriorityBadge priority={contract.priority} />
                      {contract.executor && <UserAvatar user={contract.executor} size="sm" />}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
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
                  <p className="text-xs text-muted-foreground mt-1">{c.executor?.firstName} {c.executor?.lastName} submitted for review</p>
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
              {notifications.slice(0, 4).map((n, i) => (
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">{n.content}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
