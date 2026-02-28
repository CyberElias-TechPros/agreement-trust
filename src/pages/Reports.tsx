import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Clock, CheckCircle2, Users, FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalContracts: number;
  activeContracts: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
  contractsByStatus?: Record<string, number>;
}

export default function Reports() {
  const { organizations } = useAuth();
  const organizationId = organizations?.[0]?.id;
  const [period, setPeriod] = useState('30d');
  const [stats, setStats] = useState<DashboardStats>({ totalContracts: 0, activeContracts: 0, completed: 0, pending: 0, overdue: 0, completionRate: 0 });
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId, period]);

  const loadData = async () => {
    if (!organizationId) return;
    try {
      const data = await api.getOrganizationAnalytics(organizationId);
      const statsData = data.stats || {};
      setStats({
        totalContracts: statsData.totalContracts || 0,
        activeContracts: statsData.activeContracts || 0,
        completed: statsData.completedThisMonth || 0,
        pending: statsData.pendingReview || 0,
        overdue: statsData.overdue || 0,
        completionRate: statsData.completionRate || 0,
        contractsByStatus: data.contractsByStatus,
      });
      setContracts(data.recentContracts || []);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load analytics data',
      });
    } finally {
      setLoading(false);
    }
  };

  const statusDistribution = stats.contractsByStatus ? [
    { name: 'Draft', value: stats.contractsByStatus.draft || 0, color: 'hsl(215, 15%, 47%)' },
    { name: 'Sent', value: stats.contractsByStatus.sent || 0, color: 'hsl(210, 100%, 50%)' },
    { name: 'In Progress', value: stats.contractsByStatus.in_progress || 0, color: 'hsl(38, 92%, 50%)' },
    { name: 'Submitted', value: stats.contractsByStatus.submitted || 0, color: 'hsl(280, 70%, 55%)' },
    { name: 'Approved', value: stats.contractsByStatus.approved || 0, color: 'hsl(160, 84%, 39%)' },
    { name: 'Rejected', value: stats.contractsByStatus.rejected || 0, color: 'hsl(0, 72%, 51%)' },
  ] : [
    { name: 'Draft', value: 0, color: 'hsl(215, 15%, 47%)' },
    { name: 'In Progress', value: 0, color: 'hsl(38, 92%, 50%)' },
    { name: 'Submitted', value: 0, color: 'hsl(280, 70%, 55%)' },
    { name: 'Approved', value: 0, color: 'hsl(160, 84%, 39%)' },
    { name: 'Rejected', value: 0, color: 'hsl(0, 72%, 51%)' },
    { name: 'Other', value: 0, color: 'hsl(217, 91%, 50%)' },
  ];

  const weeklyData = [
    { week: 'Week 1', created: 3, completed: 2 },
    { week: 'Week 2', created: 5, completed: 3 },
    { week: 'Week 3', created: 2, completed: 4 },
    { week: 'Week 4', created: 4, completed: 2 },
    { week: 'Week 5', created: 6, completed: 5 },
    { week: 'Week 6', created: 3, completed: 3 },
  ];

  const completionTrend = [
    { month: 'Jul', rate: 65 },
    { month: 'Aug', rate: 70 },
    { month: 'Sep', rate: 68 },
    { month: 'Oct', rate: 75 },
    { month: 'Nov', rate: 72 },
    { month: 'Dec', rate: 78 },
  ];

  const teamPerformance = [
    { name: 'Sarah Chen', completed: 8, avgDays: 5.2, onTime: 88 },
    { name: 'James Wilson', completed: 12, avgDays: 4.1, onTime: 92 },
    { name: 'Emma Jones', completed: 6, avgDays: 6.8, onTime: 75 },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Track your organization's performance metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="year">This year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Contracts" value={stats.totalContracts} icon={FileText} variant="primary" delay={0} />
        <StatsCard title="Active" value={stats.activeContracts} icon={Clock} variant="warning" delay={0.05} />
        <StatsCard title="Completed" value={stats.completed} icon={CheckCircle2} variant="success" delay={0.1} />
        <StatsCard title="Pending Review" value={stats.pending} icon={TrendingUp} variant="default" delay={0.15} />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Weekly Activity */}
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Weekly Contract Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 15%, 47%)" opacity={0.2} />
                <XAxis dataKey="week" tick={{ fill: 'hsl(215, 15%, 47%)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(215, 15%, 47%)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(220, 15%, 10%)', border: '1px solid hsl(215, 15%, 47%)', borderRadius: '8px' }}
                  labelStyle={{ color: 'white' }}
                />
                <Bar dataKey="created" name="Created" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Status Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(220, 15%, 10%)', border: '1px solid hsl(215, 15%, 47%)', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {statusDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Completion Trend */}
      <div className="glass-card p-6 mb-8">
        <h3 className="section-title mb-4">Completion Rate Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={completionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 15%, 47%)" opacity={0.2} />
              <XAxis dataKey="month" tick={{ fill: 'hsl(215, 15%, 47%)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(215, 15%, 47%)', fontSize: 12 }} domain={[50, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(220, 15%, 10%)', border: '1px solid hsl(215, 15%, 47%)', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="rate" name="Completion Rate %" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={{ fill: 'hsl(160, 84%, 39%)', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team Performance */}
      <div className="glass-card p-6">
        <h3 className="section-title mb-4">Team Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Team Member</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Completed</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Avg. Days</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">On-Time %</th>
              </tr>
            </thead>
            <tbody>
              {teamPerformance.map((member) => (
                <tr key={member.name} className="border-b border-border/50">
                  <td className="py-3 px-4 text-sm font-medium text-foreground">{member.name}</td>
                  <td className="py-3 px-4 text-sm text-right text-foreground">{member.completed}</td>
                  <td className="py-3 px-4 text-sm text-right text-foreground">{member.avgDays}</td>
                  <td className="py-3 px-4 text-sm text-right">
                    <span className={member.onTime >= 90 ? 'text-success' : member.onTime >= 75 ? 'text-warning' : 'text-destructive'}>
                      {member.onTime}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
