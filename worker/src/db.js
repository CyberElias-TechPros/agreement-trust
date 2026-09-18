export async function one(db, sql, ...params) {
  return db.prepare(sql).bind(...params).first();
}

export async function many(db, sql, ...params) {
  const r = await db.prepare(sql).bind(...params).all();
  return r.results || [];
}

export async function run(db, sql, ...params) {
  return db.prepare(sql).bind(...params).run();
}

export function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function mapUser(r, extra = {}) {
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    avatarUrl: r.avatar_url || null,
    title: r.title || null,
    twoFactorEnabled: Boolean(r.two_factor_enabled),
    emailVerified: r.email_verified == null ? true : Boolean(r.email_verified),
    ...extra,
  };
}

export function mapOrg(r, extra = {}) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    planType: r.plan_type || "free",
    branding: parseJson(r.branding, {}),
    settings: parseJson(r.settings, {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...extra,
  };
}

export function mapCategory(r) {
  if (!r) return null;
  return { id: r.id, name: r.name, color: r.color, description: r.description || undefined };
}

export function mapContract(r, extras = {}) {
  if (!r) return null;
  const status = r.current_status;
  const priority = r.current_priority;
  const deadline = r.current_deadline || undefined;
  const description = r.current_description;
  return {
    id: r.id,
    contractNumber: r.contract_number,
    title: r.title,
    description,
    currentDescription: description,
    status,
    currentStatus: status,
    priority,
    currentPriority: priority,
    deadline,
    currentDeadline: deadline,
    progress: r.progress || 0,
    tags: parseJson(r.tags, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    sentAt: r.sent_at || undefined,
    acceptedAt: r.accepted_at || undefined,
    submittedAt: r.submitted_at || undefined,
    approvedAt: r.approved_at || undefined,
    completedAt: r.completed_at || undefined,
    archivedAt: r.archived_at || undefined,
    currentVersion: r.current_version,
    ...extras,
  };
}

export async function hydrateContract(db, row) {
  if (!row) return null;
  const [initiator, executor, category] = await Promise.all([
    one(db, "SELECT id, email, first_name, last_name, avatar_url, title FROM users WHERE id = ?", row.initiator_id),
    row.responsible_executor_id
      ? one(db, "SELECT id, email, first_name, last_name, avatar_url, title FROM users WHERE id = ?", row.responsible_executor_id)
      : null,
    row.category_id ? one(db, "SELECT * FROM categories WHERE id = ?", row.category_id) : null,
  ]);
  return mapContract(row, {
    initiator: mapUser(initiator),
    executor: mapUser(executor),
    responsibleExecutor: mapUser(executor),
    category: mapCategory(category),
  });
}

export async function membership(db, userId, orgId) {
  return one(
    db,
    "SELECT * FROM memberships WHERE user_id = ? AND organization_id = ? AND status = 'active'",
    userId,
    orgId
  );
}

export async function requireMembership(db, userId, orgId) {
  const m = await membership(db, userId, orgId);
  if (!m) {
    const e = new Error("Access denied to this organization");
    e.status = 403;
    e.expose = true;
    throw e;
  }
  return m;
}

export async function orgsForUser(db, userId) {
  const rows = await many(
    db,
    `SELECT o.*, m.role as member_role
       FROM memberships m
       JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = ? AND m.status = 'active'
      ORDER BY m.joined_at DESC`,
    userId
  );
  return rows.map((r) => mapOrg(r, { role: r.member_role }));
}
