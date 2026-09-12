import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Plus,
  PenLine,
  CheckCircle2,
} from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { CountUp } from "@/components/motion/CountUp";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { ContractPriority, ContractStatus } from "@/types/contracts";
import type { ApiContract } from "@/types/api";

interface DashboardStats {
  totalContracts: number;
  activeContracts: number;
  pendingReview: number;
  overdue: number;
  completionRate: number;
  completed?: number;
  completedThisMonth?: number;
  pending?: number;
  thisWeekCreated?: number;
}

type ContractData = ApiContract;

interface NotificationData {
  id: string;
  title: string;
  content?: string;
  type: string;
  createdAt: string;
  contract?: { title: string; contractNumber: string };
}

export default function Dashboard() {
  const { user, currentOrganization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  usePageMeta("Dashboard — TaskContract", "Your contracts, your team, and the state of delegated work.");

  useEffect(() => {
    if (!currentOrganization) return;

    let cancelled = false;
    const fetchData = async () => {
      try {
        const orgId = currentOrganization.id;
        const [analyticsData, contractsData, notificationsData] = await Promise.all([
          api.getOrganizationAnalytics(orgId),
          api.getContracts(orgId, { limit: 6 }),
          api.getNotifications({ limit: 6 }),
        ]);
        if (cancelled) return;
        setStats(analyticsData.stats);
        setContracts(analyticsData.recentContracts?.length ? analyticsData.recentContracts.slice(0, 6) : contractsData.contracts || []);
        setNotifications(notificationsData.notifications || []);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization]);

  const awaitingReview = contracts.filter((c) => c.status === "submitted");
  const hours = new Date().getHours();
  const greeting = hours < 12 ? "Good morning" : hours < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="shimmer h-8 w-64 rounded-lg bg-secondary" />
          <div className="shimmer h-4 w-40 rounded bg-secondary" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-28 rounded-xl bg-secondary" />
          ))}
        </div>
        <div className="shimmer h-64 rounded-xl bg-secondary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{today}</p>
          <h2 className="mt-1.5 font-display text-3xl italic tracking-tight text-foreground" style={{ fontVariationSettings: "'opsz' 56" }}>
            {greeting}, {user?.firstName || "there"}.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Here's the state of the ledger today.</p>
        </div>
        <Link to="/contracts/new">
          <Button className="gap-2 rounded-full bg-gradient-to-r from-indigo to-[#7b5fd3] text-white shadow-[0_4px_20px_rgba(111,124,255,0.35)] transition-all duration-300 hover:shadow-[0_6px_28px_rgba(111,124,255,0.5)]">
            <Plus className="h-4 w-4" /> New Contract
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Active Contracts" value={<CountUp to={stats?.activeContracts || 0} />} icon={FileText} variant="primary" delay={0} />
        <StatsCard title="Pending Review" value={<CountUp to={stats?.pendingReview || 0} />} icon={Clock} variant="warning" delay={0.05} />
        <StatsCard
          title="Overdue"
          value={<CountUp to={stats?.overdue || 0} />}
          icon={AlertCircle}
          variant={(stats?.overdue || 0) > 0 ? "danger" : "success"}
          delay={0.1}
        />
        <StatsCard title="Completion Rate" value={<CountUp to={stats?.completionRate || 0} suffix="%" />} icon={TrendingUp} variant="success" delay={0.15} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent contracts */}
        <div className="lg:col-span-2">
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Recent Contracts</h3>
              <Link to="/contracts" className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {contracts.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8">
                  <PenLine className="h-5 w-5 text-primary/60" />
                </div>
                <p className="text-sm font-medium text-foreground">The ledger is empty</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Draft your first contract and give your delegated work a memory.
                </p>
                <Link to="/contracts/new">
                  <Button size="sm" className="mt-4 gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Create your first contract
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {contracts.map((contract, i) => (
                  <motion.div
                    key={contract.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      to={`/contracts/${contract.id}`}
                      className="group flex items-center gap-4 p-4 transition-colors hover:bg-secondary/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">{contract.contractNumber}</span>
                          <StatusBadge status={contract.status as ContractStatus} />
                          {contract.category && (
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: contract.category.color + "18", color: contract.category.color }}
                            >
                              {contract.category.name}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {contract.title}
                        </p>
                        {typeof contract.progress === "number" && contract.progress > 0 && (
                          <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${contract.progress}%` }}
                              transition={{ delay: 0.3 + i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full rounded-full bg-gradient-to-r from-indigo to-[#7b5fd3]"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <PriorityBadge priority={contract.currentPriority as ContractPriority} />
                        {contract.responsibleExecutor && (
                          <UserAvatar
                            user={{
                              id: contract.responsibleExecutor.firstName,
                              email: "",
                              firstName: contract.responsibleExecutor.firstName,
                              lastName: contract.responsibleExecutor.lastName,
                              avatarUrl: contract.responsibleExecutor.avatarUrl,
                            }}
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

        {/* Right rail */}
        <div className="space-y-6">
          {awaitingReview.length > 0 && (
            <div className="glass-card overflow-hidden border-warning/25">
              <div className="border-b border-border p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="h-4 w-4 text-warning" /> Awaiting your review
                </h3>
              </div>
              {awaitingReview.map((c) => (
                <Link key={c.id} to={`/contracts/${c.id}`} className="block border-b border-border/60 p-4 transition-colors last:border-0 hover:bg-secondary/40">
                  <p className="text-sm font-medium text-foreground">{c.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.responsibleExecutor?.firstName} {c.responsibleExecutor?.lastName} submitted for review
                  </p>
                </Link>
              ))}
            </div>
          )}

          <div className="glass-card">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            </div>
            <div className="p-4">
              {notifications.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-success/50" />
                  <p className="mt-2 text-xs text-muted-foreground">All quiet in the ledger.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.slice(0, 5).map((n, i) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.05, duration: 0.35 }}
                      className="flex gap-3"
                    >
                      <span className="relative mt-2 flex h-1.5 w-1.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">{n.title}</p>
                        {n.content && <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{n.content}</p>}
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                          {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
