import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Clock, FileText, MessageSquare, GitBranch, Send, CheckCircle2, XCircle, AlertTriangle, Paperclip, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import type { InteractionType, ContractInteraction, ContractStatus, ContractPriority, UserRole } from '@/types/contracts';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const interactionTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  progress_update: { label: 'Progress Update', icon: Clock, color: 'text-info' },
  clarification_request: { label: 'Clarification', icon: MessageSquare, color: 'text-warning' },
  clarification_response: { label: 'Response', icon: MessageSquare, color: 'text-info' },
  scope_proposal: { label: 'Scope Change', icon: GitBranch, color: 'text-status-accepted' },
  issue_report: { label: 'Issue', icon: AlertTriangle, color: 'text-destructive' },
  issue_resolution: { label: 'Resolved', icon: CheckCircle2, color: 'text-success' },
  submission: { label: 'Submission', icon: Send, color: 'text-status-submitted' },
  approval: { label: 'Approved', icon: CheckCircle2, color: 'text-success' },
  rejection: { label: 'Rejected', icon: XCircle, color: 'text-destructive' },
  comment: { label: 'Comment', icon: MessageSquare, color: 'text-muted-foreground' },
  system_note: { label: 'System', icon: FileText, color: 'text-muted-foreground' },
};

interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  description: string;
  currentStatus: string;
  currentPriority: string;
  deadline?: string;
  sentAt?: string;
  acceptedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  category?: { id: string; name: string; color: string };
  initiator: { id: string; firstName: string; lastName: string };
  executor?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

interface Version {
  id: string;
  versionNumber: number;
  description: string;
  priority: string;
  deadline?: string;
  changedBy: { id: string; firstName: string; lastName: string };
  changedAt: string;
  changeReason?: string;
}

interface Interaction {
  id: string;
  author: { id: string; firstName: string; lastName: string };
  interactionType: string;
  content: string;
  createdAt: string;
}

function InteractionCard({ interaction }: { interaction: Interaction }) {
  const config = interactionTypeConfig[interaction.interactionType] || interactionTypeConfig.comment;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 p-4"
    >
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-secondary', config.color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">{interaction.author.firstName} {interaction.author.lastName}</span>
          <span className={cn('text-[10px] font-semibold uppercase', config.color)}>{config.label}</span>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {new Date(interaction.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{interaction.content}</p>
      </div>
    </motion.div>
  );
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organizations, user } = useAuth();
  const organizationId = organizations?.[0]?.id;

  const [contract, setContract] = useState<Contract | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (organizationId && id) {
      loadContract();
    }
  }, [organizationId, id]);

  const loadContract = async () => {
    if (!organizationId || !id) return;
    try {
      const data = await api.getContract(organizationId, id);
      setContract(data.contract);
      setInteractions(data.interactions || []);
      setVersions(data.versions || []);
    } catch (error) {
      console.error('Failed to load contract:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!organizationId || !id || !newComment.trim()) return;
    try {
      await api.createInteraction(organizationId, id, {
        interactionType: 'comment',
        content: newComment,
      });
      setNewComment('');
      loadContract();
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleStatusChange = async (action: string) => {
    if (!organizationId || !id) return;
    try {
      switch (action) {
        case 'send':
          await api.sendContract(organizationId, id);
          break;
        case 'accept':
          await api.acceptContract(organizationId, id);
          break;
        case 'reject':
          await api.rejectContract(organizationId, id);
          break;
        case 'submit':
          await api.submitContract(organizationId, id);
          break;
        case 'approve':
          await api.approveContract(organizationId, id);
          break;
        case 'archive':
          await api.archiveContract(organizationId, id);
          break;
      }
      loadContract();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Contract not found</p>
          <Link to="/contracts">
            <Button variant="outline" className="mt-4">Back to Contracts</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusActions: Record<string, { label: string; action: string; variant?: string }[]> = {
    draft: [{ label: 'Send Contract', action: 'send', variant: 'default' }],
    sent: [
      { label: 'Accept', action: 'accept', variant: 'default' },
      { label: 'Decline', action: 'reject', variant: 'destructive' },
    ],
    accepted: [{ label: 'Submit Work', action: 'submit', variant: 'default' }],
    in_progress: [{ label: 'Submit Work', action: 'submit', variant: 'default' }],
    submitted: [
      { label: 'Approve', action: 'approve', variant: 'default' },
      { label: 'Request Changes', action: 'reject', variant: 'destructive' },
    ],
  };

  const currentActions = statusActions[contract.currentStatus] || [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1" />
        {currentActions.map((a) => (
          <Button
            key={a.action}
            variant={a.variant as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"}
            onClick={() => handleStatusChange(a.action)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      {/* Contract Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs text-muted-foreground">{contract.contractNumber}</span>
              {contract.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: contract.category.color + '15', color: contract.category.color }}>
                  {contract.category.name}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">{contract.title}</h1>
            <div className="flex items-center gap-3">
              <StatusBadge status={contract.currentStatus as ContractStatus} />
              <PriorityBadge priority={contract.currentPriority as ContractPriority} />
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">{contract.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Initiator</p>
            <div className="flex items-center gap-2">
              <UserAvatar user={{ id: contract.initiator.id, email: '', firstName: contract.initiator.firstName, lastName: contract.initiator.lastName, role: 'manager' as UserRole }} size="sm" />
              <span className="font-medium text-foreground">{contract.initiator.firstName} {contract.initiator.lastName}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Executor</p>
            {contract.executor ? (
              <div className="flex items-center gap-2">
                <UserAvatar user={{ id: contract.executor.id, email: '', firstName: contract.executor.firstName, lastName: contract.executor.lastName, role: 'executor' as UserRole }} size="sm" />
                <span className="font-medium text-foreground">{contract.executor.firstName} {contract.executor.lastName}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Deadline</p>
            <span className="font-medium text-foreground">
              {contract.deadline ? new Date(contract.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline'}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created</p>
            <span className="font-medium text-foreground">
              {new Date(contract.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Interactions */}
      <div className="glass-card">
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="bg-secondary/50 p-1 m-4 mb-0 w-auto">
            <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          </TabsList>

          <TabsContent value="activity">
            <div className="divide-y divide-border">
              {interactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No activity yet</div>
              ) : (
                interactions.map((interaction) => (
                  <InteractionCard key={interaction.id} interaction={interaction} />
                ))
              )}
            </div>

            {/* Add Comment */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-3">
                <UserAvatar user={user || { id: '', email: '', firstName: '', lastName: '', role: 'executor' }} size="sm" />
                <div className="flex-1">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px] bg-secondary/50 border-0"
                  />
                  <div className="flex justify-end mt-2">
                    <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                      <MessageSquare className="w-4 h-4 mr-2" /> Post Comment
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details">
            <div className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Contract Details</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Contract Number</span>
                  <span className="font-mono text-foreground">{contract.contractNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={contract.currentStatus as ContractStatus} />
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Priority</span>
                  <PriorityBadge priority={contract.currentPriority as ContractPriority} />
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Deadline</span>
                  <span className="text-foreground">{contract.deadline ? new Date(contract.deadline).toLocaleDateString() : 'Not set'}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Version History</h3>
              {versions.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No version history available
                </div>
              ) : (
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div key={version.id} className="flex gap-4 p-4 rounded-lg bg-secondary/30">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">v{version.versionNumber}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            Version {version.versionNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(version.changedAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {version.changeReason && (
                          <p className="text-xs text-muted-foreground mb-2">{version.changeReason}</p>
                        )}
                        <p className="text-sm text-foreground line-clamp-2">{version.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Changed by {version.changedBy?.firstName} {version.changedBy?.lastName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
