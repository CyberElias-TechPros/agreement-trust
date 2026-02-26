import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Clock, FileText, MessageSquare, GitBranch, Send, CheckCircle2, XCircle, AlertTriangle, Paperclip, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { contracts } from '@/data/mockData';
import { cn } from '@/lib/utils';
import type { InteractionType, ContractInteraction } from '@/types/contracts';
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

function InteractionCard({ interaction }: { interaction: ContractInteraction }) {
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
        <p className="text-sm text-muted-foreground leading-relaxed">{interaction.content}</p>
        {interaction.progressPercentage !== undefined && (
          <div className="mt-2 flex items-center gap-3">
            <Progress value={interaction.progressPercentage} className="h-2 flex-1" />
            <span className="text-xs font-semibold text-foreground">{interaction.progressPercentage}%</span>
          </div>
        )}
        {interaction.statusChangeFrom && interaction.statusChangeTo && (
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={interaction.statusChangeFrom} />
            <span className="text-muted-foreground">→</span>
            <StatusBadge status={interaction.statusChangeTo} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const contract = contracts.find(c => c.id === id);
  const [newInteractionType, setNewInteractionType] = useState<string>('comment');
  const [newInteractionContent, setNewInteractionContent] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!contract) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Contract not found.</p>
          <Link to="/contracts"><Button variant="outline">Back to Contracts</Button></Link>
        </div>
      </div>
    );
  }

  const copyId = () => {
    navigator.clipboard.writeText(contract.contractNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const latestProgress = contract.interactions.filter(i => i.progressPercentage !== undefined).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span>/</span>
        <Link to="/contracts" className="hover:text-foreground transition-colors">Contracts</Link>
        <span>/</span>
        <span className="text-foreground font-mono text-xs">{contract.contractNumber}</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Header Card */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={copyId} className="font-mono text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    {contract.contractNumber}
                    <Copy className="w-3 h-3" />
                    {copied && <span className="text-[10px] text-success">Copied!</span>}
                  </button>
                  <StatusBadge status={contract.status} size="md" />
                  <PriorityBadge priority={contract.priority} />
                </div>
                <h1 className="text-xl font-bold text-foreground">{contract.title}</h1>
              </div>
            </div>

            {/* Action buttons based on status */}
            <div className="flex items-center gap-2 mt-4">
              {contract.status === 'sent' && (
                <>
                  <Button className="bg-success text-success-foreground hover:bg-success/90"><CheckCircle2 className="w-4 h-4 mr-2" /> Accept Contract</Button>
                  <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/5"><XCircle className="w-4 h-4 mr-2" /> Decline</Button>
                </>
              )}
              {contract.status === 'in_progress' && (
                <Button className="gradient-hero text-primary-foreground border-0"><Send className="w-4 h-4 mr-2" /> Submit for Review</Button>
              )}
              {contract.status === 'submitted' && (
                <>
                  <Button className="bg-success text-success-foreground hover:bg-success/90"><CheckCircle2 className="w-4 h-4 mr-2" /> Approve</Button>
                  <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/5"><XCircle className="w-4 h-4 mr-2" /> Reject</Button>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Current Agreement <span className="text-muted-foreground font-normal">(v{contract.currentVersion})</span>
              </h2>
              <button onClick={() => setShowVersionHistory(!showVersionHistory)} className="text-xs text-primary hover:underline flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> Version History
              </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{contract.description}</p>

            {/* Progress */}
            {latestProgress && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Current Progress</span>
                  <span className="text-sm font-bold text-foreground">{latestProgress.progressPercentage}%</span>
                </div>
                <Progress value={latestProgress.progressPercentage} className="h-2" />
              </div>
            )}
          </div>

          {/* Version History Modal */}
          <AnimatePresence>
            {showVersionHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-card p-6 border-primary/20">
                  <h3 className="section-title flex items-center gap-2"><GitBranch className="w-4 h-4 text-primary" /> Version History</h3>
                  <div className="space-y-4">
                    {contract.versions.map((v, i) => (
                      <div key={v.id} className={cn('relative pl-6 pb-4', i < contract.versions.length - 1 && 'border-l-2 border-border')}>
                        <div className="absolute left-0 top-0 w-3 h-3 rounded-full -translate-x-[7px] bg-card border-2 border-primary" />
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-foreground">Version {v.versionNumber}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(v.changedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{v.description}</p>
                        {v.changeReason && (
                          <p className="text-xs text-warning mt-1">Reason: {v.changeReason}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">by {v.changedBy.firstName} {v.changedBy.lastName}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactions */}
          <div className="glass-card">
            <Tabs defaultValue="all" className="w-full">
              <div className="border-b border-border px-4 pt-4">
                <TabsList className="bg-transparent p-0 h-auto gap-4">
                  <TabsTrigger value="all" className="px-0 py-2 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-xs">All ({contract.interactions.length})</TabsTrigger>
                  <TabsTrigger value="updates" className="px-0 py-2 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-xs">Updates</TabsTrigger>
                  <TabsTrigger value="issues" className="px-0 py-2 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-xs">Issues</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="all" className="m-0">
                {contract.interactions.length > 0 ? (
                  <div className="divide-y divide-border">
                    {[...contract.interactions].reverse().map(interaction => (
                      <InteractionCard key={interaction.id} interaction={interaction} />
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">No interactions yet.</div>
                )}
              </TabsContent>
              <TabsContent value="updates" className="m-0">
                <div className="divide-y divide-border">
                  {contract.interactions.filter(i => i.interactionType === 'progress_update').reverse().map(interaction => (
                    <InteractionCard key={interaction.id} interaction={interaction} />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="issues" className="m-0">
                <div className="divide-y divide-border">
                  {contract.interactions.filter(i => ['issue_report', 'issue_resolution'].includes(i.interactionType)).reverse().map(interaction => (
                    <InteractionCard key={interaction.id} interaction={interaction} />
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* Composer */}
            {!['approved', 'rejected', 'archived', 'draft'].includes(contract.status) && (
              <div className="border-t border-border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Select value={newInteractionType} onValueChange={setNewInteractionType}>
                    <SelectTrigger className="w-[180px] bg-secondary/50 border-0 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comment">Comment</SelectItem>
                      <SelectItem value="progress_update">Progress Update</SelectItem>
                      <SelectItem value="clarification_request">Clarification</SelectItem>
                      <SelectItem value="issue_report">Report Issue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Add an interaction..."
                  value={newInteractionContent}
                  onChange={e => setNewInteractionContent(e.target.value)}
                  rows={3}
                  className="bg-secondary/30 border-0 resize-none"
                />
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="text-muted-foreground"><Paperclip className="w-4 h-4 mr-1" /> Attach</Button>
                  <Button size="sm" className="gradient-hero text-primary-foreground border-0" disabled={!newInteractionContent.trim()}>
                    <Send className="w-3 h-3 mr-1" /> Send
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Parties */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Parties</h3>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Initiator</p>
                <UserAvatar user={contract.initiator} showName />
              </div>
              {contract.executor && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Executor</p>
                  <UserAvatar user={contract.executor} showName />
                </div>
              )}
              {contract.participants.filter(p => p.role === 'observer').map(p => (
                <div key={p.user.id}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Observer</p>
                  <UserAvatar user={p.user} showName />
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><span className="font-medium text-foreground">{contract.deadline ? new Date(contract.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'None'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium text-foreground">{contract.category?.name || 'None'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium text-foreground">v{contract.currentVersion}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium text-foreground">{new Date(contract.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
              {contract.tags.length > 0 && (
                <div>
                  <span className="text-muted-foreground block mb-1.5">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {contract.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Timeline</h3>
            <div className="space-y-3">
              {[
                { label: 'Created', date: contract.createdAt, active: true },
                { label: 'Sent', date: contract.sentAt, active: !!contract.sentAt },
                { label: 'Accepted', date: contract.acceptedAt, active: !!contract.acceptedAt },
                { label: 'Completed', date: contract.completedAt, active: !!contract.completedAt },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', step.active ? 'bg-primary' : 'bg-border')} />
                  <span className={cn('text-xs', step.active ? 'text-foreground font-medium' : 'text-muted-foreground')}>{step.label}</span>
                  {step.date && (
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {new Date(step.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
