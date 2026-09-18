import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  GitBranch,
  MessageSquare,
  Send,
  AlertTriangle,
  XCircle,
  Stamp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { ContractStatus, ContractPriority, UserRole } from "@/types/contracts";
import type { ApiContract, ApiInteraction, ApiVersion } from "@/types/api";

const typeConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  progress_update: { label: "Progress", icon: Clock, color: "text-info" },
  clarification_request: { label: "Clarification", icon: MessageSquare, color: "text-warning" },
  clarification_response: { label: "Response", icon: MessageSquare, color: "text-info" },
  scope_proposal: { label: "Scope", icon: GitBranch, color: "text-status-accepted" },
  issue_report: { label: "Issue", icon: AlertTriangle, color: "text-destructive" },
  issue_resolution: { label: "Resolved", icon: CheckCircle2, color: "text-success" },
  submission: { label: "Submission", icon: Send, color: "text-status-submitted" },
  approval: { label: "Approved", icon: CheckCircle2, color: "text-success" },
  rejection: { label: "Returned", icon: XCircle, color: "text-destructive" },
  comment: { label: "Comment", icon: MessageSquare, color: "text-muted-foreground" },
  system_note: { label: "System", icon: FileText, color: "text-muted-foreground" },
};

type Participant = { role: string; isLead?: boolean; user?: { id: string; firstName: string; lastName: string; email?: string; avatarUrl?: string } };

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrganization, user } = useAuth();
  const organizationId = currentOrganization?.id;
  const { toast } = useToast();

  const [contract, setContract] = useState<ApiContract | null>(null);
  const [interactions, setInteractions] = useState<ApiInteraction[]>([]);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [audit, setAudit] = useState<{ id: string; action: string; createdAt: string; user?: { firstName: string; lastName: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerType, setComposerType] = useState("comment");
  const [composer, setComposer] = useState("");
  const [progress, setProgress] = useState(55);
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [sealed, setSealed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ title: "", description: "", changeReason: "" });

  usePageMeta(contract ? `${contract.contractNumber} — TaskContract` : "Contract — TaskContract", contract?.title);

  const load = useCallback(async () => {
    if (!organizationId || !id) return;
    try {
      const data = await api.getContract(organizationId, id);
      setContract(data.contract);
      setInteractions(data.interactions || []);
      setVersions(data.versions || []);
      setParticipants((data.participants || []) as Participant[]);
      setEdit({
        title: data.contract.title,
        description: data.contract.description || data.contract.currentDescription || "",
        changeReason: "",
      });
      try {
        const a = await api.getContractAudit(organizationId, id);
        setAudit((a.auditLogs || []) as typeof audit);
      } catch {
        /* observers may not read audit */
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const status = (contract?.currentStatus || contract?.status || "draft") as ContractStatus;
  const isInitiator = contract?.initiator?.id === user?.id;
  const isExecutor = (contract?.executor?.id || contract?.responsibleExecutor?.id) === user?.id;
  const role = currentOrganization?.role || "";

  const actions = useMemo(() => {
    const out: { label: string; action: string; variant?: "default" | "destructive" | "outline"; needsNote?: boolean }[] = [];
    if (status === "draft" && (isInitiator || ["owner", "admin", "manager"].includes(role))) {
      out.push({ label: "Send contract", action: "send" });
    }
    if (status === "sent" && isExecutor) {
      out.push({ label: "Accept", action: "accept" });
      out.push({ label: "Decline", action: "reject", variant: "destructive", needsNote: true });
    }
    if (status === "accepted" && isExecutor) out.push({ label: "Start work", action: "start" });
    if ((status === "accepted" || status === "in_progress" || status === "rejected") && isExecutor) {
      out.push({ label: "Submit work", action: "submit", needsNote: true });
    }
    if (status === "submitted" && (isInitiator || ["owner", "admin", "manager"].includes(role))) {
      out.push({ label: "Seal & approve", action: "approve" });
      out.push({ label: "Request changes", action: "reject", variant: "outline", needsNote: true });
    }
    if (["approved", "rejected"].includes(status) && ["owner", "admin", "manager"].includes(role)) {
      out.push({ label: "Reopen", action: "reopen", variant: "outline" });
    }
    if (!["archived"].includes(status) && ["owner", "admin"].includes(role)) {
      out.push({ label: "Archive", action: "archive", variant: "outline" });
    }
    return out;
  }, [status, isInitiator, isExecutor, role]);

  const runAction = async (action: string, reason?: string) => {
    if (!organizationId || !id) return;
    try {
      switch (action) {
        case "send":
          await api.sendContract(organizationId, id);
          break;
        case "accept":
          await api.acceptContract(organizationId, id);
          break;
        case "reject":
          await api.rejectContract(organizationId, id, reason);
          break;
        case "start":
          await api.startContract(organizationId, id);
          break;
        case "submit":
          await api.submitContract(organizationId, id, reason);
          break;
        case "approve":
          await api.approveContract(organizationId, id);
          setSealed(true);
          setTimeout(() => setSealed(false), 2800);
          break;
        case "archive":
          await api.archiveContract(organizationId, id);
          break;
        case "reopen":
          await api.reopenContract(organizationId, id);
          break;
      }
      toast({ title: "Recorded", description: "The ledger updated." });
      setPendingAction(null);
      setNote("");
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: "Transition blocked", description: e instanceof Error ? e.message : "" });
    }
  };

  const post = async () => {
    if (!organizationId || !id || !composer.trim()) return;
    try {
      await api.createInteraction(organizationId, id, {
        interactionType: composerType,
        content: composer,
        progressPercentage: composerType === "progress_update" ? progress : undefined,
      });
      setComposer("");
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not post", description: e instanceof Error ? e.message : "" });
    }
  };

  const saveVersion = async () => {
    if (!organizationId || !id) return;
    try {
      await api.updateContract(organizationId, id, {
        title: edit.title,
        description: edit.description,
        changeReason: edit.changeReason || (status === "draft" ? "Updated draft" : undefined),
      });
      setEditOpen(false);
      toast({ title: "Version sealed", description: "A new version was appended." });
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : "" });
    }
  };

  const copyId = async () => {
    if (!contract) return;
    await navigator.clipboard.writeText(contract.contractNumber);
    toast({ title: "Copied", description: contract.contractNumber });
  };

  const exportAudit = async () => {
    if (!organizationId || !id || !contract) return;
    const data = await api.exportContract(organizationId, id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contract.contractNumber}-ledger.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-8 w-40 rounded bg-secondary" />
        <div className="shimmer h-64 rounded-2xl bg-secondary" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-muted-foreground">This contract was never sealed.</p>
        <Link to="/contracts">
          <Button variant="outline" className="mt-4">Back to the ledger</Button>
        </Link>
      </div>
    );
  }

  const deadline = contract.deadline || contract.currentDeadline;
  const overdue = deadline && new Date(deadline) < new Date() && !["approved", "archived", "rejected"].includes(status);

  return (
    <div className="relative mx-auto max-w-5xl">
      <AnimatePresence>
        {sealed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[#080a12]/80 backdrop-blur-md"
          >
            <motion.div initial={{ scale: 2.2, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="text-center">
              <div className="seal-stamp mx-auto flex h-36 w-36 items-center justify-center rounded-full border-4 border-brass text-brass shadow-[0_0_80px_rgba(217,164,65,0.45)]">
                <Stamp className="h-16 w-16" />
              </div>
              <p className="mt-6 font-display text-4xl italic text-white">Sealed.</p>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-brass">{contract.contractNumber}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={copyId} className="gap-1.5 font-mono text-xs">
          <Copy className="h-3.5 w-3.5" /> {contract.contractNumber}
        </Button>
        <Button variant="ghost" size="sm" onClick={exportAudit} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
        {actions.map((a) => (
          <Button
            key={a.action}
            variant={a.variant || "default"}
            onClick={() => (a.needsNote ? setPendingAction(a.action) : runAction(a.action))}
            className={a.action === "approve" ? "gap-1.5 bg-gradient-to-r from-indigo to-[#7b5fd3] text-white" : ""}
          >
            {a.action === "approve" && <Stamp className="h-4 w-4" />}
            {a.label}
          </Button>
        ))}
      </div>

      {pendingAction && (
        <div className="glass-card mb-6 p-5">
          <p className="text-sm font-semibold">A note is required</p>
          <Textarea className="mt-3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason, summary, or evidence…" />
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => setPendingAction(null)}>Cancel</Button>
            <Button disabled={!note.trim()} onClick={() => runAction(pendingAction, note)}>Record</Button>
          </div>
        </div>
      )}

      <div className="ledger-sheet glass-card overflow-hidden p-0">
        <div className="relative border-b border-border bg-gradient-to-br from-card to-secondary/40 p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{contract.contractNumber}</span>
                {contract.category && (
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: contract.category.color + "18", color: contract.category.color }}>
                    {contract.category.name}
                  </span>
                )}
                {overdue && <span className="status-badge border border-destructive/30 bg-destructive/10 text-destructive">Overdue</span>}
              </div>
              <h1 className="font-display text-3xl italic tracking-tight text-foreground">{contract.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={status} pulse={status === "sent" || status === "submitted"} />
                <PriorityBadge priority={(contract.currentPriority || contract.priority || "medium") as ContractPriority} />
                {typeof contract.progress === "number" && contract.progress > 0 && (
                  <span className="font-mono text-[11px] text-muted-foreground">{contract.progress}%</span>
                )}
              </div>
            </div>
            {(isInitiator || ["owner", "admin", "manager"].includes(role)) && status !== "archived" && status !== "approved" && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen((v) => !v)}>
                Edit (new version)
              </Button>
            )}
          </div>

          {typeof contract.progress === "number" && contract.progress > 0 && (
            <Progress value={contract.progress} className="mt-6 h-1.5" />
          )}

          <p className="mt-6 max-w-3xl whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/80">
            {contract.description || contract.currentDescription}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            {[
              { label: "Initiator", user: contract.initiator },
              { label: "Executor", user: contract.executor || contract.responsibleExecutor },
              { label: "Deadline", text: deadline ? new Date(deadline).toLocaleString() : "None" },
              { label: "Version", text: `v${versions[0]?.versionNumber || 1}` },
            ].map((cell) => (
              <div key={cell.label}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{cell.label}</p>
                {cell.user ? (
                  <div className="mt-1">
                    <UserAvatar user={{ id: cell.user.id, email: "", firstName: cell.user.firstName, lastName: cell.user.lastName, role: "manager" as UserRole }} size="sm" showName />
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-medium">{cell.text}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {editOpen && (
          <div className="border-b border-border bg-secondary/30 p-6 space-y-3">
            <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <Textarea rows={5} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            {status !== "draft" && (
              <Input placeholder="Change reason (required)" value={edit.changeReason} onChange={(e) => setEdit({ ...edit, changeReason: e.target.value })} />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={saveVersion}>Append version</Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="m-4 mb-0 w-auto bg-secondary/50 p-1">
            <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">Versions</TabsTrigger>
            <TabsTrigger value="parties" className="text-xs">Parties</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="activity">
            <div className="divide-y divide-border">
              {interactions.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No activity yet — the first note becomes the memory.</p>}
              {interactions.map((ix) => {
                const cfg = typeConfig[ix.interactionType] || typeConfig.comment;
                const Icon = cfg.icon;
                return (
                  <motion.div key={ix.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 p-4">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary", cfg.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{ix.author?.firstName} {ix.author?.lastName}</span>
                        <span className={cn("text-[10px] font-semibold uppercase", cfg.color)}>{cfg.label}</span>
                        {ix.statusChangeFrom && ix.statusChangeTo && (
                          <span className="font-mono text-[10px] text-muted-foreground">{ix.statusChangeFrom} → {ix.statusChangeTo}</span>
                        )}
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {new Date(ix.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{ix.content}</p>
                      {typeof ix.progressPercentage === "number" && (
                        <div className="mt-2 max-w-xs">
                          <Progress value={ix.progressPercentage} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {role !== "observer" && (
              <div className="border-t border-border p-4">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Select value={composerType} onValueChange={setComposerType}>
                    <SelectTrigger className="w-[200px] bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comment">Comment</SelectItem>
                      <SelectItem value="progress_update">Progress update</SelectItem>
                      <SelectItem value="clarification_request">Clarification</SelectItem>
                      <SelectItem value="scope_proposal">Scope proposal</SelectItem>
                      <SelectItem value="issue_report">Issue</SelectItem>
                    </SelectContent>
                  </Select>
                  {composerType === "progress_update" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
                      {progress}%
                    </div>
                  )}
                </div>
                <Textarea value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Typed, timestamped, permanent…" className="min-h-[88px]" />
                <div className="mt-2 flex justify-end">
                  <Button onClick={post} disabled={!composer.trim()} className="gap-2">
                    <MessageSquare className="h-4 w-4" /> Post
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-3 p-6">
              {versions.map((v) => (
                <div key={v.id} className="flex gap-4 rounded-xl bg-secondary/30 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm text-primary">v{v.versionNumber}</div>
                  <div>
                    <p className="text-sm font-medium">Version {v.versionNumber} · {new Date(v.changedAt).toLocaleString()}</p>
                    {v.changeReason && <p className="text-xs text-muted-foreground">{v.changeReason}</p>}
                    <p className="mt-2 line-clamp-3 text-sm">{v.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{v.changedBy?.firstName} {v.changedBy?.lastName}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="parties">
            <div className="grid gap-3 p-6 sm:grid-cols-2">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                  {p.user && <UserAvatar user={{ id: p.user.id, email: p.user.email || "", firstName: p.user.firstName, lastName: p.user.lastName, role: "executor" as UserRole }} size="sm" showName />}
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.role}{p.isLead ? " · lead" : ""}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <div className="space-y-2 p-6">
              {audit.length === 0 && <p className="text-sm text-muted-foreground">No audit entries yet, or you don’t have permission to read them.</p>}
              {audit.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b border-border/60 py-2 text-sm">
                  <span className="font-mono text-xs">{a.action}</span>
                  <span className="text-muted-foreground">{a.user?.firstName} {a.user?.lastName}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
