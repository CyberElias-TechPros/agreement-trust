/**
 * Demo workspace — a faithful, in-browser implementation of the
 * TaskContract domain model. Used ONLY when the backend API is
 * unreachable (clearly flagged in the UI as "Demo mode").
 *
 * It implements the same business rules as the server:
 *  - Contract state machine: draft → sent → accepted → in_progress
 *    → submitted → approved/rejected → archived
 *  - Every edit produces an append-only version
 *  - Every state change produces an interaction + audit + notification
 */

export type DemoStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected"
  | "archived";

export interface DemoUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  title?: string;
}

export interface DemoOrg {
  id: string;
  name: string;
  slug: string;
  planType: "free" | "pro" | "enterprise";
  branding?: { primaryColor?: string; accentColor?: string };
  settings?: Record<string, unknown>;
}

export interface DemoMembership {
  id: string;
  userId: string;
  orgId: string;
  role: "owner" | "admin" | "manager" | "executor" | "observer";
  status: "active" | "pending" | "suspended";
  joinedAt: string;
}

export interface DemoCategory {
  id: string;
  orgId: string;
  name: string;
  color: string;
  description?: string;
}

export interface DemoVersion {
  id: string;
  contractId: string;
  versionNumber: number;
  title: string;
  description: string;
  deadline?: string;
  priority: string;
  changeReason: string;
  changedBy: string;
  changedAt: string;
}

export interface DemoInteraction {
  id: string;
  contractId: string;
  authorId: string;
  interactionType:
    | "progress_update"
    | "clarification_request"
    | "clarification_response"
    | "scope_proposal"
    | "issue_report"
    | "issue_resolution"
    | "submission"
    | "approval"
    | "rejection"
    | "comment"
    | "system_note";
  content: string;
  progressPercentage?: number;
  statusChangeFrom?: DemoStatus;
  statusChangeTo?: DemoStatus;
  createdAt: string;
}

export interface DemoContract {
  id: string;
  orgId: string;
  contractNumber: string;
  title: string;
  currentDescription: string;
  currentDeadline?: string;
  currentPriority: "low" | "medium" | "high" | "critical";
  currentStatus: DemoStatus;
  progress: number;
  initiatorId: string;
  responsibleExecutorId?: string;
  categoryId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  acceptedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface DemoNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  contractId?: string;
  read: boolean;
  createdAt: string;
}

export interface DemoAudit {
  id: string;
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface DemoDbShape {
  version: number;
  users: DemoUser[];
  orgs: DemoOrg[];
  memberships: DemoMembership[];
  categories: DemoCategory[];
  contracts: DemoContract[];
  versions: DemoVersion[];
  interactions: DemoInteraction[];
  notifications: DemoNotification[];
  audit: DemoAudit[];
  seq: number;
  sessionUserId: string | null;
}

const STORAGE_KEY = "taskcontract.demo.v1";
export const DEMO_USER_ID = "u1"; // Alex Morgan — the demo manager

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();
const daysAhead = (d: number) => new Date(now + d * 86400000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString();
const year = new Date().getFullYear();

const USERS: DemoUser[] = [
  { id: "u1", email: "alex.morgan@northwind.studio", password: "demo1234", firstName: "Alex", lastName: "Morgan", title: "Delivery Manager", avatarUrl: "" },
  { id: "u2", email: "sarah.chen@northwind.studio", password: "demo1234", firstName: "Sarah", lastName: "Chen", title: "Product Designer", avatarUrl: "" },
  { id: "u3", email: "james.wilson@northwind.studio", password: "demo1234", firstName: "James", lastName: "Wilson", title: "Senior Engineer", avatarUrl: "" },
  { id: "u4", email: "maria.garcia@northwind.studio", password: "demo1234", firstName: "Maria", lastName: "Garcia", title: "Marketing Lead", avatarUrl: "" },
  { id: "u5", email: "david.kim@northwind.studio", password: "demo1234", firstName: "David", lastName: "Kim", title: "Engineering Director", avatarUrl: "" },
  { id: "u6", email: "emma.jones@northwind.studio", password: "demo1234", firstName: "Emma", lastName: "Jones", title: "Security Engineer", avatarUrl: "" },
];

const ORGS: DemoOrg[] = [
  { id: "org1", name: "Northwind Studio", slug: "northwind", planType: "pro" },
  { id: "org2", name: "Morgan Consulting", slug: "morgan-consulting", planType: "free" },
];

const MEMBERSHIPS: DemoMembership[] = [
  { id: "m1", userId: "u1", orgId: "org1", role: "manager", status: "active", joinedAt: daysAgo(210) },
  { id: "m2", userId: "u2", orgId: "org1", role: "executor", status: "active", joinedAt: daysAgo(180) },
  { id: "m3", userId: "u3", orgId: "org1", role: "executor", status: "active", joinedAt: daysAgo(165) },
  { id: "m4", userId: "u4", orgId: "org1", role: "executor", status: "active", joinedAt: daysAgo(150) },
  { id: "m5", userId: "u5", orgId: "org1", role: "admin", status: "active", joinedAt: daysAgo(200) },
  { id: "m6", userId: "u6", orgId: "org1", role: "executor", status: "active", joinedAt: daysAgo(90) },
  { id: "m7", userId: "u1", orgId: "org2", role: "owner", status: "active", joinedAt: daysAgo(400) },
];

const CATEGORIES: DemoCategory[] = [
  { id: "c1", orgId: "org1", name: "Design", color: "#8B5CF6", description: "Product & brand design work" },
  { id: "c2", orgId: "org1", name: "Engineering", color: "#4F5BD5", description: "Software engineering tasks" },
  { id: "c3", orgId: "org1", name: "Marketing", color: "#D9A441", description: "Campaigns, content & growth" },
  { id: "c4", orgId: "org1", name: "Operations", color: "#0F9D6E", description: "Process & logistics" },
  { id: "c5", orgId: "org1", name: "Research", color: "#D6577E", description: "Discovery & user research" },
  { id: "c6", orgId: "org2", name: "Client Work", color: "#4F5BD5", description: "Client deliverables" },
];

interface SeedContract {
  id: string;
  number: string;
  title: string;
  description: string;
  status: DemoStatus;
  priority: DemoContract["currentPriority"];
  initiator: string;
  executor?: string;
  category?: string;
  tags: string[];
  deadline?: string;
  created: string;
  updated: string;
  sent?: string;
  accepted?: string;
  submitted?: string;
  approved?: string;
  progress: number;
}

const CONTRACTS: SeedContract[] = [
  {
    id: "tc1",
    number: `TCP-${year}-00042`,
    title: "Redesign Customer Dashboard UI",
    description:
      "Complete redesign of the customer-facing dashboard: new data-visualization components, improved navigation structure and a responsive mobile layout. Must follow brand guidelines v3.2 and pass the accessibility review before hand-off.",
    status: "in_progress",
    priority: "high",
    initiator: "u1",
    executor: "u2",
    category: "c1",
    tags: ["ui", "dashboard", "redesign"],
    deadline: daysAhead(6),
    created: daysAgo(14),
    updated: hoursAgo(3),
    sent: daysAgo(14),
    accepted: daysAgo(13),
    progress: 55,
  },
  {
    id: "tc2",
    number: `TCP-${year}-00043`,
    title: "API Integration for Payment Gateway",
    description:
      "Integrate Stripe as the primary payment provider: tokenised checkout, webhook handling with idempotency keys, and reconciliation reporting. Sandbox credentials are in the shared vault.",
    status: "submitted",
    priority: "critical",
    initiator: "u1",
    executor: "u3",
    category: "c2",
    tags: ["payments", "api", "stripe"],
    deadline: daysAhead(1),
    created: daysAgo(21),
    updated: daysAgo(1),
    sent: daysAgo(21),
    accepted: daysAgo(20),
    submitted: daysAgo(1),
    progress: 100,
  },
  {
    id: "tc3",
    number: `TCP-${year}-00044`,
    title: "Content Strategy for Q2 Campaign",
    description:
      "Deliver a complete content strategy for the Q2 product launch: audience segmentation, channel plan, editorial calendar and 6 pillar pieces with briefs for external writers.",
    status: "sent",
    priority: "medium",
    initiator: "u5",
    executor: "u4",
    category: "c3",
    tags: ["content", "strategy", "q2"],
    deadline: daysAhead(21),
    created: daysAgo(2),
    updated: daysAgo(2),
    sent: daysAgo(2),
    progress: 0,
  },
  {
    id: "tc4",
    number: `TCP-${year}-00045`,
    title: "Security Audit — Authentication Module",
    description:
      "Third-party style audit of the authentication module: session lifecycle, password policy, brute-force protection and token storage. Produce findings report with severity ratings and a remediation plan.",
    status: "approved",
    priority: "high",
    initiator: "u1",
    executor: "u6",
    category: "c2",
    tags: ["security", "audit", "auth"],
    deadline: daysAgo(9),
    created: daysAgo(38),
    updated: daysAgo(8),
    sent: daysAgo(38),
    accepted: daysAgo(37),
    submitted: daysAgo(9),
    approved: daysAgo(8),
    progress: 100,
  },
  {
    id: "tc5",
    number: `TCP-${year}-00046`,
    title: "User Research — Onboarding Flow",
    description:
      "Run 8 moderated sessions on the new onboarding flow. Deliver synthesis, journey map and a prioritised list of fixes. Include recordings (consented) in the hand-off folder.",
    status: "draft",
    priority: "low",
    initiator: "u1",
    category: "c5",
    tags: ["research", "onboarding"],
    deadline: daysAhead(30),
    created: daysAgo(1),
    updated: daysAgo(1),
    progress: 0,
  },
  {
    id: "tc6",
    number: `TCP-${year}-00047`,
    title: "Database Migration to PostgreSQL 16",
    description:
      "Plan and execute the migration of the analytics warehouse to PostgreSQL 16. Includes zero-downtime cutover, rollback plan, and updated runbooks. Maintenance window: first Sunday 02:00 UTC.",
    status: "rejected",
    priority: "high",
    initiator: "u5",
    executor: "u3",
    category: "c2",
    tags: ["database", "migration", "infra"],
    deadline: daysAgo(3),
    created: daysAgo(16),
    updated: daysAgo(2),
    sent: daysAgo(16),
    accepted: daysAgo(15),
    submitted: daysAgo(2),
    progress: 90,
  },
  {
    id: "tc7",
    number: `TCP-${year - 1}-00127`,
    title: "Mobile App Performance Optimization",
    description:
      "Optimise the mobile app to reach the agreed targets: cold start < 2s, TTI < 3.5s on mid-range Android, and a 30% bundle-size reduction.",
    status: "archived",
    priority: "medium",
    initiator: "u1",
    executor: "u3",
    category: "c2",
    tags: ["mobile", "performance"],
    deadline: daysAgo(60),
    created: daysAgo(120),
    updated: daysAgo(58),
    sent: daysAgo(120),
    accepted: daysAgo(119),
    submitted: daysAgo(61),
    approved: daysAgo(59),
    progress: 100,
  },
];

interface SeedInteraction {
  contractId: string;
  authorId: string;
  interactionType: DemoInteraction["interactionType"];
  content: string;
  progressPercentage?: number;
  statusChangeFrom?: DemoStatus;
  statusChangeTo?: DemoStatus;
  createdAt: string;
}

const INTERACTIONS: SeedInteraction[] = [
  { contractId: "tc1", authorId: "u1", interactionType: "system_note", content: "Contract created and sent to Sarah Chen.", statusChangeFrom: "draft", statusChangeTo: "sent", createdAt: daysAgo(14) },
  { contractId: "tc1", authorId: "u2", interactionType: "comment", content: "Reviewed the scope. The mobile breakpoints in the brief are a bit ambiguous — assuming 375/768/1440, will confirm before the hi-fi pass.", createdAt: daysAgo(13) },
  { contractId: "tc1", authorId: "u2", interactionType: "progress_update", content: "Wireframes complete for desktop and mobile. Moving into high-fidelity designs now.", progressPercentage: 55, createdAt: hoursAgo(3) },
  { contractId: "tc1", authorId: "u1", interactionType: "comment", content: "Great pace. Please prioritise the revenue overview — finance want to see it first.", createdAt: hoursAgo(2) },
  { contractId: "tc2", authorId: "u1", interactionType: "system_note", content: "Contract created and sent to James Wilson.", statusChangeFrom: "draft", statusChangeTo: "sent", createdAt: daysAgo(21) },
  { contractId: "tc2", authorId: "u3", interactionType: "scope_proposal", content: "Proposing a small scope addition: idempotent retry handling for webhooks (≈ half a day). Strongly recommended for production safety.", createdAt: daysAgo(15) },
  { contractId: "tc2", authorId: "u1", interactionType: "comment", content: "Approved — fold it into this contract, no deadline change needed.", createdAt: daysAgo(14) },
  { contractId: "tc2", authorId: "u3", interactionType: "submission", content: "Integration complete: checkout, webhooks with idempotency and reconciliation report are all live in sandbox. Ready for review.", progressPercentage: 100, statusChangeFrom: "in_progress", statusChangeTo: "submitted", createdAt: daysAgo(1) },
  { contractId: "tc3", authorId: "u5", interactionType: "system_note", content: "Contract created and sent to Maria Garcia.", statusChangeFrom: "draft", statusChangeTo: "sent", createdAt: daysAgo(2) },
  { contractId: "tc4", authorId: "u6", interactionType: "issue_report", content: "Found a session-fixation vector in the refresh flow — flagged as HIGH in the report. Mitigation available immediately.", createdAt: daysAgo(12) },
  { contractId: "tc4", authorId: "u6", interactionType: "submission", content: "Audit complete. 2 critical, 5 high, 9 medium findings with a phased remediation plan.", progressPercentage: 100, statusChangeFrom: "in_progress", statusChangeTo: "submitted", createdAt: daysAgo(9) },
  { contractId: "tc4", authorId: "u1", interactionType: "approval", content: "Excellent report. Remediation plan accepted — phase 1 work is being contracted separately.", statusChangeFrom: "submitted", statusChangeTo: "approved", createdAt: daysAgo(8) },
  { contractId: "tc6", authorId: "u3", interactionType: "submission", content: "Migration plan complete with rehearsed rollback. Requesting sign-off.", progressPercentage: 90, statusChangeFrom: "in_progress", statusChangeTo: "submitted", createdAt: daysAgo(2) },
  { contractId: "tc6", authorId: "u5", interactionType: "rejection", content: "The rollback runbook misses the read-replica resync step. Please add it and resubmit.", statusChangeFrom: "submitted", statusChangeTo: "rejected", createdAt: daysAgo(2) },
  { contractId: "tc7", authorId: "u1", interactionType: "approval", content: "All performance targets verified in production. Contract closed.", statusChangeFrom: "submitted", statusChangeTo: "approved", createdAt: daysAgo(59) },
];

function seedDb(): DemoDbShape {
  const seq = 48;
  const contracts: DemoContract[] = CONTRACTS.map((c) => ({
    id: c.id,
    orgId: c.id === "tc7" ? "org2" : "org1",
    contractNumber: c.number,
    title: c.title,
    currentDescription: c.description,
    currentDeadline: c.deadline,
    currentPriority: c.priority,
    currentStatus: c.status,
    progress: c.progress,
    initiatorId: c.initiator,
    responsibleExecutorId: c.executor,
    categoryId: c.category,
    tags: c.tags,
    createdAt: c.created,
    updatedAt: c.updated,
    sentAt: c.sent,
    acceptedAt: c.accepted,
    submittedAt: c.submitted,
    approvedAt: c.approved,
    completedAt: c.approved,
  }));

  const versions: DemoVersion[] = CONTRACTS.map((c, i) => ({
    id: `v-${c.id}-1`,
    contractId: c.id,
    versionNumber: 1,
    title: c.title,
    description: c.description,
    deadline: c.deadline,
    priority: c.priority,
    changeReason: "Initial creation",
    changedBy: c.initiator,
    changedAt: c.created,
  }));
  // A second version on tc1 — scope was expanded
  versions.push({
    id: "v-tc1-2",
    contractId: "tc1",
    versionNumber: 2,
    title: "Redesign Customer Dashboard UI",
    description:
      "Complete redesign of the customer-facing dashboard: new data-visualization components, improved navigation structure and a responsive mobile layout. Must follow brand guidelines v3.2 and pass the accessibility review before hand-off. Scope expanded to include the revenue overview screen requested by finance.",
    deadline: daysAhead(6),
    priority: "high",
    changeReason: "Added revenue overview screen after finance stakeholder review",
    changedBy: "u1",
    changedAt: daysAgo(9),
  });

  const interactions: DemoInteraction[] = INTERACTIONS.map((ix, i) => ({
    id: `ix-${i}`,
    contractId: ix.contractId,
    authorId: ix.authorId,
    interactionType: ix.interactionType,
    content: ix.content,
    progressPercentage: ix.progressPercentage,
    statusChangeFrom: ix.statusChangeFrom,
    statusChangeTo: ix.statusChangeTo,
    createdAt: ix.createdAt,
  }));

  const notifications: DemoNotification[] = [
    { id: "n1", userId: "u1", type: "submission", title: "Contract submitted for review", content: "James Wilson submitted TCP-00043 “API Integration for Payment Gateway” for your review.", contractId: "tc2", read: false, createdAt: daysAgo(1) },
    { id: "n2", userId: "u1", type: "progress", title: "Progress update", content: "Sarah Chen updated progress on “Redesign Customer Dashboard UI” to 55%.", contractId: "tc1", read: false, createdAt: hoursAgo(3) },
    { id: "n3", userId: "u1", type: "deadline", title: "Deadline approaching", content: "TCP-00043 is due in 1 day.", contractId: "tc2", read: false, createdAt: hoursAgo(6) },
    { id: "n4", userId: "u1", type: "comment", title: "New comment", content: "Sarah Chen commented on “Redesign Customer Dashboard UI”.", contractId: "tc1", read: true, createdAt: daysAgo(13) },
    { id: "n5", userId: "u1", type: "approval", title: "Contract approved", content: "“Security Audit — Authentication Module” was approved and archived to the ledger.", contractId: "tc4", read: true, createdAt: daysAgo(8) },
  ];

  return {
    version: 1,
    users: USERS,
    orgs: ORGS,
    memberships: MEMBERSHIPS,
    categories: CATEGORIES,
    contracts,
    versions,
    interactions,
    notifications,
    audit: [],
    seq,
    sessionUserId: null,
  };
}

let cache: DemoDbShape | null = null;

export function getDb(): DemoDbShape {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw) as DemoDbShape;
      return cache;
    }
  } catch {
    /* corrupted storage — reseed */
  }
  cache = seedDb();
  persist();
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or unavailable — demo continues in memory */
  }
}

export function mutate(fn: (db: DemoDbShape) => void) {
  const db = getDb();
  fn(db);
  persist();
}

export function resetDemo() {
  cache = seedDb();
  persist();
}

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function nextContractNumber(db: DemoDbShape): string {
  db.seq += 1;
  return `TCP-${year}-${String(db.seq).padStart(5, "0")}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

/* ---------- helpers shared with the API adapter ---------- */

export function userById(db: DemoDbShape, id?: string): DemoUser | undefined {
  return db.users.find((u) => u.id === id);
}

export function publicUser(db: DemoDbShape, id?: string) {
  const u = userById(db, id);
  if (!u) return undefined;
  return { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, avatarUrl: u.avatarUrl };
}

export function serializeContract(db: DemoDbShape, c: DemoContract) {
  return {
    id: c.id,
    contractNumber: c.contractNumber,
    title: c.title,
    description: c.currentDescription,
    currentDescription: c.currentDescription,
    status: c.currentStatus,
    currentStatus: c.currentStatus,
    priority: c.currentPriority,
    currentPriority: c.currentPriority,
    deadline: c.currentDeadline,
    currentDeadline: c.currentDeadline,
    progress: c.progress,
    category: db.categories.find((cat) => cat.id === c.categoryId),
    initiator: publicUser(db, c.initiatorId),
    executor: publicUser(db, c.responsibleExecutorId),
    responsibleExecutor: publicUser(db, c.responsibleExecutorId),
    tags: c.tags,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    sentAt: c.sentAt,
    acceptedAt: c.acceptedAt,
    submittedAt: c.submittedAt,
    approvedAt: c.approvedAt,
    completedAt: c.completedAt,
    archivedAt: c.archivedAt,
  };
}

export function computeAnalytics(db: DemoDbShape, orgId: string) {
  const contracts = db.contracts.filter((c) => c.orgId === orgId);
  const byStatus: Record<string, number> = {};
  for (const c of contracts) {
    byStatus[c.currentStatus] = (byStatus[c.currentStatus] || 0) + 1;
  }
  const terminal = ["approved", "archived", "rejected"];
  const active = contracts.filter((c) => !terminal.includes(c.currentStatus));
  const approved = contracts.filter((c) => c.currentStatus === "approved");
  const nowMs = Date.now();
  const overdue = contracts.filter(
    (c) => c.currentDeadline && new Date(c.currentDeadline).getTime() < nowMs && !terminal.includes(c.currentStatus)
  );
  const monthAgo = new Date(nowMs - 30 * 86400000);
  const completedThisMonth = contracts.filter(
    (c) => c.completedAt && new Date(c.completedAt) > monthAgo
  );
  const thisWeek = contracts.filter(
    (c) => new Date(c.createdAt).getTime() > nowMs - 7 * 86400000
  );

  return {
    stats: {
      totalContracts: contracts.length,
      activeContracts: active.length,
      pendingReview: byStatus["submitted"] || 0,
      overdue: overdue.length,
      completionRate: contracts.length
        ? Math.round((approved.length / contracts.length) * 100)
        : 0,
      completed: approved.length,
      completedThisMonth: completedThisMonth.length,
      pending: byStatus["submitted"] || 0,
      thisWeekCreated: thisWeek.length,
    },
    contractsByStatus: byStatus,
    recentContracts: [...contracts]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8)
      .map((c) => serializeContract(db, c)),
  };
}

/** The state machine — validates and returns the new status. */
const TRANSITIONS: Record<string, Partial<Record<DemoStatus, DemoStatus>>> = {
  send: { draft: "sent" },
  accept: { sent: "accepted" },
  reject: { sent: "rejected", submitted: "rejected" },
  submit: { accepted: "submitted", in_progress: "submitted", rejected: "submitted" },
  approve: { submitted: "approved" },
  archive: { draft: "archived", sent: "archived", accepted: "archived", in_progress: "archived", submitted: "archived", approved: "archived", rejected: "archived" },
};

export function transitionContract(
  db: DemoDbShape,
  contract: DemoContract,
  action: keyof typeof TRANSITIONS,
  actorId: string,
  note?: string
): { status: DemoStatus; from: DemoStatus } {
  const from = contract.currentStatus;
  const next = TRANSITIONS[action]?.[from];
  if (!next) {
    throw new Error(`Invalid transition: cannot ${action} a contract in “${from}” state`);
  }
  contract.currentStatus = next;
  contract.updatedAt = isoNow();
  if (next === "accepted") {
    contract.acceptedAt = isoNow();
    contract.currentStatus = "in_progress";
  }
  if (next === "submitted") contract.submittedAt = isoNow();
  if (next === "approved") {
    contract.approvedAt = isoNow();
    contract.completedAt = isoNow();
    contract.progress = 100;
  }
  if (next === "archived") contract.archivedAt = isoNow();

  const messages: Record<string, { type: string; title: string; content: string }> = {
    send: { type: "system_note", title: "Contract sent", content: `Contract sent to the executor${contract.responsibleExecutorId ? "." : " (unassigned)."}` },
    accept: { type: "system_note", title: "Contract accepted", content: "The executor accepted the contract. Work is now in progress." },
    reject: { type: "rejection", title: "Contract returned", content: note || "The contract was returned without acceptance." },
    submit: { type: "submission", title: "Work submitted", content: note || "Work submitted for review." },
    approve: { type: "approval", title: "Contract approved", content: note || "Contract approved and sealed into the ledger." },
    archive: { type: "system_note", title: "Contract archived", content: note || "Contract archived." },
  };

  db.interactions.unshift({
    id: uid("ix"),
    contractId: contract.id,
    authorId: actorId,
    interactionType: (messages[action].type || "system_note") as DemoInteraction["interactionType"],
    content: messages[action].content,
    statusChangeFrom: from,
    statusChangeTo: contract.currentStatus,
    createdAt: isoNow(),
  });

  db.audit.push({
    id: uid("au"),
    orgId: contract.orgId,
    userId: actorId,
    action: `contract_${action}`,
    entityType: "contract",
    entityId: contract.id,
    createdAt: isoNow(),
  });

  const counterpartId =
    actorId === contract.initiatorId ? contract.responsibleExecutorId : contract.initiatorId;
  if (counterpartId && counterpartId !== actorId) {
    const actor = publicUser(db, actorId);
    db.notifications.unshift({
      id: uid("n"),
      userId: counterpartId,
      type: action,
      title: messages[action].title,
      content: `${actor?.firstName ?? "Someone"} ${messages[action].content.toLowerCase()}`,
      contractId: contract.id,
      read: false,
      createdAt: isoNow(),
    });
  }

  return { status: contract.currentStatus, from };
}
