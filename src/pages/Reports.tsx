import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Clock, CheckCircle2, Users, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { contracts, dashboardStats } from '@/data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useState } from 'react';

const statusDistribution = [
  { name: 'Draft', value: contracts.filter(c => c.status === 'draft').length, color: 'hsl(215, 15%, 47%)' },
  { name: 'In Progress', value: contracts.filter(c => c.status === 'in_progress').length, color: 'hsl(38, 92%, 50%)' },
  { name: 'Submitted', value: contracts.filter(c => c.status === 'submitted').length, color: 'hsl(280, 70%, 55%)' },
  { name: 'Approved', value: contracts.filter(c => c.status === 'approved').length, color: 'hsl(160, 84%, 39%)' },
  { name: 'Rejected', value: contracts.filter(c => c.status === 'rejected').length, color: 'hsl(0, 72%, 51%)' },
  { name: 'Other', value: contracts.filter(c => ['sent', 'accepted', 'archived'].includes(c.status)).length, color: 'hsl(217, 91%, 50%)' },
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

export default function Reports() {
  const [period, setPeriod] = useState('30d');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Track performance and contract metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] bg-secondary/50 border-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Contracts" value={dashboardStats.totalContracts} icon={FileText} variant="primary" delay={0} />
        <StatsCard title="Completion Rate" value={`${dashboardStats.completionRate}%`} icon={TrendingUp} variant="success" trend={{ value: 5, label: 'vs last period' }} delay={0.05} />
        <StatsCard title="Avg. Time to Complete" value="4.8 days" icon={Clock} delay={0.1} />
        <StatsCard title="Active Members" value={6} icon={Users} delay={0.15} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Contracts Over Time */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
          <h3 className="section-title">Contracts Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 91%)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 47%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 47%)' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(215, 20%, 91%)', fontSize: '12px' }} />
              <Bar dataKey="created" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} name="Created" />
              <Bar dataKey="completed" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Status Distribution */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-6">
          <h3 className="section-title">Status Distribution</h3>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={statusDistribution.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                  {statusDistribution.filter(d => d.value > 0).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(215, 20%, 91%)', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {statusDistribution.filter(d => d.value > 0).map(d => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-semibold text-foreground ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Completion Trend */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 mb-6">
        <h3 className="section-title">Completion Rate Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={completionTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 91%)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 47%)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 47%)' }} domain={[50, 100]} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(215, 20%, 91%)', fontSize: '12px' }} />
            <Line type="monotone" dataKey="rate" stroke="hsl(217, 91%, 50%)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(217, 91%, 50%)' }} name="Completion %" />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Team Performance */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card">
        <div className="p-4 border-b border-border">
          <h3 className="section-title mb-0">Team Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Team Member</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Completed</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Avg. Days</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">On-Time %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teamPerformance.map(member => (
                <tr key={member.name} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.completed}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.avgDays}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${member.onTime >= 90 ? 'text-success' : member.onTime >= 80 ? 'text-warning' : 'text-destructive'}`}>
                      {member.onTime}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
