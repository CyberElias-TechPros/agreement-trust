import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, Plus, ArrowUpDown, Grid3X3, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import type { ContractStatus } from '@/types/contracts';
import { cn } from '@/lib/utils';

interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline?: string;
  category?: { id: string; name: string; color: string };
  executor?: { id: string; firstName: string; lastName: string };
  initiator: { id: string; firstName: string; lastName: string };
  tags: string[];
  createdAt: string;
}

export default function ContractList() {
  const { user, organizations } = useAuth();
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'date' | 'deadline' | 'priority'>('date');

  const organizationId = organizations?.[0]?.id;

  useEffect(() => {
    if (organizationId) {
      loadContracts();
    }
  }, [organizationId, statusFilter, priorityFilter]);

  const loadContracts = async () => {
    if (!organizationId) return;
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (search) params.search = search;
      
      const data = await api.getContracts(organizationId, params);
      setContracts(data.contracts);
    } catch (error) {
      console.error('Failed to load contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...contracts];

    // Apply URL filter
    if (filterParam === 'created') result = result.filter(c => c.initiator.id === user?.id);
    if (filterParam === 'review') result = result.filter(c => c.status === 'submitted');
    if (filterParam === 'overdue') result = result.filter(c => c.deadline && new Date(c.deadline) < new Date() && !['approved', 'archived'].includes(c.status));
    if (filterParam === 'archived') result = result.filter(c => c.status === 'archived');

    // Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c => c.title.toLowerCase().includes(s) || c.contractNumber.toLowerCase().includes(s));
    }

    // Sort
    if (sortBy === 'date') result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortBy === 'deadline') result.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
    if (sortBy === 'priority') {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      result.sort((a, b) => (order[a.priority] || 3) - (order[b.priority] || 3));
    }

    return result;
  }, [contracts, search, statusFilter, priorityFilter, sortBy, filterParam, user]);

  const pageTitle = filterParam === 'created' ? 'Created by Me' : filterParam === 'review' ? 'Awaiting Review' : filterParam === 'overdue' ? 'Overdue' : filterParam === 'archived' ? 'Archived' : 'All Contracts';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">{filtered.length} contract{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/contracts/new">
          <Button className="gradient-hero text-primary-foreground border-0 shadow-glow">
            <Plus className="w-4 h-4 mr-2" /> New Contract
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by title, ID, or tag..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && loadContracts()}
              className="pl-9 bg-secondary/50 border-0" 
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-secondary/50 border-0"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px] bg-secondary/50 border-0"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-[140px] bg-secondary/50 border-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest First</SelectItem>
              <SelectItem value="deadline">By Deadline</SelectItem>
              <SelectItem value="priority">By Priority</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
            <button onClick={() => setView('list')} className={cn('p-1.5 rounded-md transition-colors', view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground')}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView('grid')} className={cn('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground')}>
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Loading contracts...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground mb-4">No contracts match your filters.</p>
          <Link to="/contracts/new">
            <Button variant="outline">Create First Contract</Button>
          </Link>
        </div>
      ) : view === 'list' ? (
        <div className="glass-card overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px_100px_60px] gap-4 px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Contract</span>
            <span>Status</span>
            <span>Assignee</span>
            <span>Deadline</span>
            <span>Priority</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <Link to={`/contracts/${c.id}`} className="grid grid-cols-[1fr_120px_120px_100px_60px] gap-4 px-4 py-3.5 items-center hover:bg-secondary/30 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-[11px] text-muted-foreground">{c.contractNumber}</span>
                      {c.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.category.color + '15', color: c.category.color }}>
                          {c.category.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                  </div>
                  <StatusBadge status={c.status as ContractStatus} />
                  <div>{c.executor ? <UserAvatar user={{ id: c.executor.id, email: '', firstName: c.executor.firstName, lastName: c.executor.lastName, role: 'executor' }} size="sm" showName /> : <span className="text-xs text-muted-foreground">Unassigned</span>}</div>
                  <span className="text-xs text-muted-foreground">{c.deadline ? new Date(c.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                  <PriorityBadge priority={c.priority as any} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/contracts/${c.id}`} className="glass-card-hover p-5 block">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] text-muted-foreground">{c.contractNumber}</span>
                  <StatusBadge status={c.status as ContractStatus} />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-2">{c.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{c.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    {c.executor && <UserAvatar user={{ id: c.executor.id, email: '', firstName: c.executor.firstName, lastName: c.executor.lastName, role: 'executor' }} size="sm" />}
                    <PriorityBadge priority={c.priority as any} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {c.deadline ? new Date(c.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No deadline'}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
