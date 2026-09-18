import { nid, nowIso, sha256Hex } from "./crypto.js";
import { can, TRANSITIONS } from "./rbac.js";
import { hydrateContract, many, mapUser, one, parseJson, run } from "./db.js";

export async function writeAudit(env, { userId, orgId, contractId, action, entityType, entityId, previousState, newState, ip, userAgent }) {
  const id = nid("au");
  const created = nowIso();
  const checksum = await sha256Hex(`${action}|${entityId}|${created}|${JSON.stringify(previousState || {})}`);
  await run(
    env.DB,
    `INSERT INTO audit_logs (id, organization_id, contract_id, user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, user_agent, created_at, checksum)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    orgId || null,
    contractId || null,
    userId || null,
    action,
    entityType,
    entityId,
    previousState ? JSON.stringify(previousState) : null,
    newState ? JSON.stringify(newState) : null,
    ip || null,
    userAgent || null,
    created,
    checksum
  );
  return id;
}

export async function notify(env, { userId, orgId, type, title, content, contractId }) {
  if (!userId) return;
  await run(
    env.DB,
    `INSERT INTO notifications (id, user_id, organization_id, type, title, content, contract_id, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    nid("n"),
    userId,
    orgId || null,
    type,
    title,
    content || "",
    contractId || null,
    nowIso()
  );
}

export async function addInteraction(env, { contractId, authorId, type, content, from, to, progress, structured }) {
  const id = nid("ix");
  await run(
    env.DB,
    `INSERT INTO contract_interactions
      (id, contract_id, author_id, interaction_type, content, progress_percentage, structured_data, status_change_from, status_change_to, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    contractId,
    authorId,
    type,
    content,
    progress ?? null,
    structured ? JSON.stringify(structured) : null,
    from || null,
    to || null,
    nowIso()
  );
  return id;
}

export async function nextContractNumber(db, orgId) {
  const year = new Date().getFullYear();
  const seq = await one(db, "SELECT next_number FROM org_sequences WHERE organization_id = ?", orgId);
  let n = 1;
  if (!seq) {
    await run(db, "INSERT INTO org_sequences (organization_id, next_number) VALUES (?, 2)", orgId);
    n = 1;
  } else {
    n = seq.next_number;
    await run(db, "UPDATE org_sequences SET next_number = next_number + 1 WHERE organization_id = ?", orgId);
  }
  return `TCP-${year}-${String(n).padStart(5, "0")}`;
}

export async function serializeParticipants(db, contractId) {
  const rows = await many(
    db,
    `SELECT p.*, u.email, u.first_name, u.last_name, u.avatar_url, u.title
       FROM contract_participants p
       JOIN users u ON u.id = p.user_id
      WHERE p.contract_id = ?`,
    contractId
  );
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    isLead: Boolean(r.is_lead),
    status: r.status,
    acceptedAt: r.accepted_at,
    user: mapUser(r),
  }));
}

export async function serializeVersions(db, contractId) {
  const rows = await many(
    db,
    `SELECT v.*, u.email, u.first_name, u.last_name, u.avatar_url, u.title, u.id as uid
       FROM contract_versions v
       LEFT JOIN users u ON u.id = v.changed_by
      WHERE v.contract_id = ?
      ORDER BY v.version_number DESC`,
    contractId
  );
  return rows.map((r) => ({
    id: r.id,
    versionNumber: r.version_number,
    title: r.title,
    description: r.description,
    deadline: r.deadline,
    priority: r.priority,
    changeReason: r.change_reason,
    changedBy: r.uid
      ? { id: r.uid, email: r.email, firstName: r.first_name, lastName: r.last_name, avatarUrl: r.avatar_url, title: r.title }
      : undefined,
    changedAt: r.changed_at,
    acknowledgedAt: r.acknowledged_at,
    acknowledgedBy: r.acknowledged_by,
  }));
}

export async function serializeInteractions(db, contractId, type) {
  const rows = type
    ? await many(
        db,
        `SELECT i.*, u.email, u.first_name, u.last_name, u.avatar_url, u.title, u.id as uid
           FROM contract_interactions i
           LEFT JOIN users u ON u.id = i.author_id
          WHERE i.contract_id = ? AND i.interaction_type = ?
          ORDER BY i.created_at DESC`,
        contractId,
        type
      )
    : await many(
        db,
        `SELECT i.*, u.email, u.first_name, u.last_name, u.avatar_url, u.title, u.id as uid
           FROM contract_interactions i
           LEFT JOIN users u ON u.id = i.author_id
          WHERE i.contract_id = ?
          ORDER BY i.created_at DESC`,
        contractId
      );
  return rows.map((r) => ({
    id: r.id,
    contractId: r.contract_id,
    author: r.uid
      ? { id: r.uid, email: r.email, firstName: r.first_name, lastName: r.last_name, avatarUrl: r.avatar_url, title: r.title }
      : undefined,
    interactionType: r.interaction_type,
    content: r.content,
    progressPercentage: r.progress_percentage ?? undefined,
    structuredData: parseJson(r.structured_data, undefined),
    statusChangeFrom: r.status_change_from || undefined,
    statusChangeTo: r.status_change_to || undefined,
    createdAt: r.created_at,
  }));
}

export async function loadFullContract(db, orgId, contractId) {
  const row = await one(db, "SELECT * FROM contracts WHERE id = ? AND organization_id = ? AND is_deleted = 0", contractId, orgId);
  if (!row) return null;
  const [contract, participants, versions, interactions] = await Promise.all([
    hydrateContract(db, row),
    serializeParticipants(db, contractId),
    serializeVersions(db, contractId),
    serializeInteractions(db, contractId),
  ]);
  return { contract, participants, versions, interactions, row };
}

const MESSAGES = {
  send: { type: "system_note", title: "Contract sent", content: "Contract sent to the executor for acceptance." },
  accept: { type: "system_note", title: "Contract accepted", content: "The executor accepted the contract. Work is now in progress." },
  reject: { type: "rejection", title: "Contract returned", content: "The contract was returned." },
  start: { type: "system_note", title: "Work started", content: "The executor started work." },
  submit: { type: "submission", title: "Work submitted", content: "Work submitted for review." },
  approve: { type: "approval", title: "Contract approved", content: "Contract approved and sealed into the ledger." },
  archive: { type: "system_note", title: "Contract archived", content: "Contract archived." },
  reopen: { type: "system_note", title: "Contract reopened", content: "Contract reopened as a new cycle." },
};

export async function transition(env, { contract, action, actorId, note, ip, userAgent }) {
  const from = contract.current_status;
  let next = TRANSITIONS[action]?.[from];
  if (!next) {
    const e = new Error(`Invalid transition: cannot ${action} a contract in “${from}” state`);
    e.status = 400;
    e.expose = true;
    throw e;
  }
  // Accept auto-starts work — the product's happy path.
  if (action === "accept") next = "in_progress";

  const now = nowIso();
  const fields = ["current_status = ?", "updated_at = ?"];
  const values = [next, now];
  if (next === "sent") {
    fields.push("sent_at = ?");
    values.push(now);
  }
  if (action === "accept") {
    fields.push("accepted_at = ?");
    values.push(now);
  }
  if (next === "submitted") {
    fields.push("submitted_at = ?");
    values.push(now);
  }
  if (next === "approved") {
    fields.push("approved_at = ?", "completed_at = ?", "progress = 100");
    values.push(now, now);
  }
  if (next === "archived") {
    fields.push("archived_at = ?");
    values.push(now);
  }
  values.push(contract.id);
  await run(env.DB, `UPDATE contracts SET ${fields.join(", ")} WHERE id = ?`, ...values);

  const msg = MESSAGES[action];
  const content = note?.trim() ? note.trim() : msg.content;
  await addInteraction(env, {
    contractId: contract.id,
    authorId: actorId,
    type: msg.type,
    content,
    from,
    to: next,
    progress: next === "approved" ? 100 : undefined,
  });

  await writeAudit(env, {
    userId: actorId,
    orgId: contract.organization_id,
    contractId: contract.id,
    action: `contract_${action}`,
    entityType: "contract",
    entityId: contract.id,
    previousState: { status: from },
    newState: { status: next },
    ip,
    userAgent,
  });

  const counterpart = actorId === contract.initiator_id ? contract.responsible_executor_id : contract.initiator_id;
  if (counterpart && counterpart !== actorId) {
    await notify(env, {
      userId: counterpart,
      orgId: contract.organization_id,
      type: action,
      title: msg.title,
      content,
      contractId: contract.id,
    });
  }

  if (action === "accept") {
    await run(
      env.DB,
      "UPDATE contract_participants SET status = 'active', accepted_at = ? WHERE contract_id = ? AND user_id = ?",
      now,
      contract.id,
      actorId
    );
  }

  const fresh = await one(env.DB, "SELECT * FROM contracts WHERE id = ?", contract.id);
  return hydrateContract(env.DB, fresh);
}

export function assertCanTransition(role, action, contract, actorId) {
  const managerActions = ["send", "approve", "archive", "reopen"];
  const executorActions = ["accept", "submit", "start"];
  if (action === "reject") {
    if (contract.current_status === "sent" && contract.responsible_executor_id !== actorId && contract.initiator_id !== actorId) {
      const e = new Error("Only the assigned executor can decline");
      e.status = 403;
      e.expose = true;
      throw e;
    }
    if (contract.current_status === "submitted" && !can(role, "approve", "contract") && contract.initiator_id !== actorId) {
      const e = new Error("Only the initiator can request changes");
      e.status = 403;
      e.expose = true;
      throw e;
    }
    return;
  }
  if (executorActions.includes(action)) {
    if (contract.responsible_executor_id !== actorId && !can(role, action, "contract")) {
      const e = new Error("Only the assigned executor can perform this action");
      e.status = 403;
      e.expose = true;
      throw e;
    }
    return;
  }
  if (managerActions.includes(action) && !can(role, action === "reopen" ? "approve" : action, "contract")) {
    const e = new Error("Insufficient permissions");
    e.status = 403;
    e.expose = true;
    throw e;
  }
}

export async function computeAnalytics(db, orgId) {
  const contracts = await many(db, "SELECT * FROM contracts WHERE organization_id = ? AND is_deleted = 0", orgId);
  const byStatus = {};
  for (const c of contracts) byStatus[c.current_status] = (byStatus[c.current_status] || 0) + 1;
  const terminal = ["approved", "archived", "rejected"];
  const active = contracts.filter((c) => !terminal.includes(c.current_status));
  const approved = contracts.filter((c) => c.current_status === "approved");
  const nowMs = Date.now();
  const overdue = contracts.filter(
    (c) => c.current_deadline && new Date(c.current_deadline).getTime() < nowMs && !terminal.includes(c.current_status)
  );
  const monthAgo = new Date(nowMs - 30 * 86400000);
  const completedThisMonth = contracts.filter((c) => c.completed_at && new Date(c.completed_at) > monthAgo);
  const thisWeek = contracts.filter((c) => new Date(c.created_at).getTime() > nowMs - 7 * 86400000);

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setHours(0, 0, 0, 0);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 7 * 8);
  const weeklyActivity = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(eightWeeksAgo);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeklyActivity.push({
      week: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      created: contracts.filter((c) => {
        const t = new Date(c.created_at);
        return t >= start && t < end;
      }).length,
      completed: contracts.filter((c) => {
        const t = c.completed_at ? new Date(c.completed_at) : null;
        return t && t >= start && t < end;
      }).length,
    });
  }

  const sealedPerMonth = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() - i + 1, 1);
    sealedPerMonth.push({
      month: start.toLocaleDateString("en-US", { month: "short" }),
      sealed: contracts.filter((c) => {
        const t = c.approved_at ? new Date(c.approved_at) : null;
        return t && t >= start && t < end;
      }).length,
    });
  }

  const users = await many(db, "SELECT id, first_name, last_name FROM users");
  const byName = Object.fromEntries(users.map((u) => [u.id, `${u.first_name} ${u.last_name}`.trim()]));
  const byExecutor = new Map();
  for (const c of contracts) {
    const executorId = c.responsible_executor_id;
    if (!executorId) continue;
    if (!byExecutor.has(executorId)) {
      byExecutor.set(executorId, { name: byName[executorId] || "Unknown", completed: 0, totalDays: 0, onTime: 0, withDeadline: 0 });
    }
    const row = byExecutor.get(executorId);
    if (c.approved_at) {
      row.completed += 1;
      if (c.accepted_at) {
        row.totalDays += Math.max(0, Math.round((new Date(c.approved_at).getTime() - new Date(c.accepted_at).getTime()) / 86400000));
      }
      if (c.current_deadline) {
        row.withDeadline += 1;
        if (new Date(c.approved_at) <= new Date(c.current_deadline)) row.onTime += 1;
      }
    }
  }
  const teamPerformance = [...byExecutor.values()].map((row) => ({
    name: row.name,
    completed: row.completed,
    avgDays: row.completed ? Math.round((row.totalDays / row.completed) * 10) / 10 : 0,
    onTime: row.withDeadline ? Math.round((row.onTime / row.withDeadline) * 100) : 0,
  }));

  const recentRows = [...contracts].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 8);
  const recentContracts = [];
  for (const r of recentRows) recentContracts.push(await hydrateContract(db, r));

  return {
    stats: {
      totalContracts: contracts.length,
      activeContracts: active.length,
      pendingReview: byStatus.submitted || 0,
      overdue: overdue.length,
      completionRate: contracts.length ? Math.round((approved.length / contracts.length) * 100) : 0,
      completed: approved.length,
      completedThisMonth: completedThisMonth.length,
      pending: byStatus.submitted || 0,
      thisWeekCreated: thisWeek.length,
    },
    contractsByStatus: byStatus,
    recentContracts,
    weeklyActivity,
    sealedPerMonth,
    teamPerformance,
  };
}

export async function deadlineSweep(env) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const nowIsoStr = now.toISOString();
  const due = await many(
    env.DB,
    `SELECT * FROM contracts
      WHERE is_deleted = 0
        AND current_status NOT IN ('approved','rejected','archived')
        AND current_deadline IS NOT NULL
        AND current_deadline <= ?
        AND current_deadline >= ?`,
    in24h,
    nowIsoStr
  );
  let n = 0;
  for (const c of due) {
    const targets = [c.responsible_executor_id, c.initiator_id].filter(Boolean);
    for (const uid of new Set(targets)) {
      await notify(env, {
        userId: uid,
        orgId: c.organization_id,
        type: "deadline",
        title: "Deadline approaching",
        content: `${c.contract_number} “${c.title}” is due within 24 hours.`,
        contractId: c.id,
      });
      n += 1;
    }
  }
  const overdue = await many(
    env.DB,
    `SELECT * FROM contracts
      WHERE is_deleted = 0
        AND current_status NOT IN ('approved','rejected','archived')
        AND current_deadline IS NOT NULL
        AND current_deadline < ?`,
    nowIsoStr
  );
  for (const c of overdue) {
    const targets = [c.responsible_executor_id, c.initiator_id].filter(Boolean);
    for (const uid of new Set(targets)) {
      await notify(env, {
        userId: uid,
        orgId: c.organization_id,
        type: "deadline",
        title: "Contract overdue",
        content: `${c.contract_number} “${c.title}” is past its deadline.`,
        contractId: c.id,
      });
      n += 1;
    }
  }
  return n;
}
