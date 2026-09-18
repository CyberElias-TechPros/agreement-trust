import { nid, nowIso } from "./crypto.js";
import { can, VALID_INTERACTIONS, VALID_PRIORITIES } from "./rbac.js";
import { hydrateContract, many, one, requireMembership, run } from "./db.js";
import {
  addInteraction,
  assertCanTransition,
  loadFullContract,
  nextContractNumber,
  notify,
  serializeInteractions,
  serializeParticipants,
  serializeVersions,
  transition,
  writeAudit,
} from "./domain.js";
import { err, json } from "./http.js";
import { authenticate } from "./authware.js";

function parseTags(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function registerContracts(router) {
  router.get("/api/v1/organizations/:organizationId/contracts", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const status = c.url.searchParams.get("status");
    const priority = c.url.searchParams.get("priority");
    const search = c.url.searchParams.get("search");
    const page = Math.max(1, parseInt(c.url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.url.searchParams.get("limit") || "20", 10)));
    let rows = await many(
      c.env.DB,
      "SELECT * FROM contracts WHERE organization_id = ? AND is_deleted = 0 ORDER BY updated_at DESC",
      c.params.organizationId
    );
    if (m.role === "executor" || m.role === "observer") {
      const parts = await many(
        c.env.DB,
        "SELECT contract_id FROM contract_participants WHERE user_id = ?",
        c.userId
      );
      const allowed = new Set(parts.map((p) => p.contract_id));
      rows = rows.filter((r) => r.responsible_executor_id === c.userId || r.initiator_id === c.userId || allowed.has(r.id));
    }
    if (status) rows = rows.filter((r) => r.current_status === status);
    if (priority) rows = rows.filter((r) => r.current_priority === priority);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(s) ||
          r.current_description.toLowerCase().includes(s) ||
          r.contract_number.toLowerCase().includes(s) ||
          (r.tags || "").toLowerCase().includes(s)
      );
    }
    const total = rows.length;
    const paged = rows.slice((page - 1) * limit, page * limit);
    const contracts = [];
    for (const r of paged) contracts.push(await hydrateContract(c.env.DB, r));
    return json({ contracts, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  });

  router.post("/api/v1/organizations/:organizationId/contracts", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "create", "contract")) return err("Insufficient permissions", 403);
    const body = await c.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    if (!title || !description) return err("Title and description are required", 400);
    if (body.priority && !VALID_PRIORITIES.includes(body.priority)) return err("Invalid priority", 400);
    const id = nid("tc");
    const now = nowIso();
    const number = await nextContractNumber(c.env.DB, c.params.organizationId);
    const tags = parseTags(body.tags);
    const observers = Array.isArray(body.observerIds) ? body.observerIds.filter((x) => x && x !== body.executorId) : [];
    await run(
      c.env.DB,
      `INSERT INTO contracts (
        id, organization_id, contract_number, title, current_description, current_deadline, current_priority,
        current_status, progress, initiator_id, responsible_executor_id, category_id, tags, current_version,
        is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?, 1, 0, ?, ?)`,
      id,
      c.params.organizationId,
      number,
      title,
      description,
      body.deadline || null,
      body.priority || "medium",
      c.userId,
      body.executorId || null,
      body.categoryId || null,
      JSON.stringify(tags),
      now,
      now
    );
    await run(
      c.env.DB,
      `INSERT INTO contract_versions (id, contract_id, version_number, title, description, deadline, priority, change_reason, changed_by, changed_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, 'Initial creation', ?, ?)`,
      nid("v"),
      id,
      title,
      description,
      body.deadline || null,
      body.priority || "medium",
      c.userId,
      now
    );
    await run(
      c.env.DB,
      `INSERT INTO contract_participants (id, contract_id, user_id, role, is_lead, status, accepted_at)
       VALUES (?, ?, ?, 'initiator', 1, 'active', ?)`,
      nid("p"),
      id,
      c.userId,
      now
    );
    if (body.executorId) {
      await run(
        c.env.DB,
        `INSERT INTO contract_participants (id, contract_id, user_id, role, is_lead, status)
         VALUES (?, ?, ?, 'executor', 1, 'pending')`,
        nid("p"),
        id,
        body.executorId
      );
    }
    for (const obs of observers) {
      await run(
        c.env.DB,
        `INSERT INTO contract_participants (id, contract_id, user_id, role, is_lead, status, accepted_at)
         VALUES (?, ?, ?, 'observer', 0, 'active', ?)`,
        nid("p"),
        id,
        obs,
        now
      );
    }
    await writeAudit(c.env, {
      userId: c.userId,
      orgId: c.params.organizationId,
      contractId: id,
      action: "contract_created",
      entityType: "contract",
      entityId: id,
      newState: { title, status: "draft" },
      ip: c.ip,
    });
    let row = await one(c.env.DB, "SELECT * FROM contracts WHERE id = ?", id);
    if (body.send && body.executorId) {
      const contract = await transition(c.env, { contract: row, action: "send", actorId: c.userId, ip: c.ip, userAgent: c.userAgent });
      return json({ contract }, 201);
    }
    return json({ contract: await hydrateContract(c.env.DB, row) }, 201);
  });

  router.get("/api/v1/organizations/:organizationId/contracts/:contractId", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const full = await loadFullContract(c.env.DB, c.params.organizationId, c.params.contractId);
    if (!full) return err("Contract not found", 404);
    await writeAudit(c.env, {
      userId: c.userId,
      orgId: c.params.organizationId,
      contractId: c.params.contractId,
      action: "contract_viewed",
      entityType: "contract",
      entityId: c.params.contractId,
    });
    return json({ contract: full.contract, participants: full.participants, versions: full.versions, interactions: full.interactions });
  });

  router.patch("/api/v1/organizations/:organizationId/contracts/:contractId", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "update", "contract")) return err("Insufficient permissions", 403);
    const row = await one(
      c.env.DB,
      "SELECT * FROM contracts WHERE id = ? AND organization_id = ? AND is_deleted = 0",
      c.params.contractId,
      c.params.organizationId
    );
    if (!row) return err("Contract not found", 404);
    if (["archived", "approved"].includes(row.current_status)) return err("Cannot edit archived or approved contracts", 400);
    const body = await c.json();
    if ((body.description || body.title) && row.current_status !== "draft" && !String(body.changeReason || "").trim()) {
      return err("A change reason is required when modifying the agreement", 400);
    }
    const title = body.title != null ? String(body.title).trim() : row.title;
    const description = body.description != null ? String(body.description).trim() : row.current_description;
    const deadline = body.deadline !== undefined ? body.deadline : row.current_deadline;
    const priority = body.priority || row.current_priority;
    const tags = body.tags ? parseTags(body.tags) : JSON.parse(row.tags || "[]");
    const categoryId = body.categoryId !== undefined ? body.categoryId : row.category_id;
    const version = (row.current_version || 1) + 1;
    const now = nowIso();
    await run(
      c.env.DB,
      `UPDATE contracts SET title = ?, current_description = ?, current_deadline = ?, current_priority = ?, category_id = ?, tags = ?, current_version = ?, updated_at = ? WHERE id = ?`,
      title,
      description,
      deadline || null,
      priority,
      categoryId || null,
      JSON.stringify(tags),
      version,
      now,
      row.id
    );
    await run(
      c.env.DB,
      `INSERT INTO contract_versions (id, contract_id, version_number, title, description, deadline, priority, change_reason, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      nid("v"),
      row.id,
      version,
      title,
      description,
      deadline || null,
      priority,
      body.changeReason || "Updated",
      c.userId,
      now
    );
    await addInteraction(c.env, {
      contractId: row.id,
      authorId: c.userId,
      type: "system_note",
      content: `Agreement updated to v${version}${body.changeReason ? `: ${body.changeReason}` : "."}`,
    });
    if (row.responsible_executor_id && row.responsible_executor_id !== c.userId) {
      await notify(c.env, {
        userId: row.responsible_executor_id,
        orgId: row.organization_id,
        type: "version_updated",
        title: `Contract “${title}” updated`,
        content: `A new version (v${version}) has been created.`,
        contractId: row.id,
      });
    }
    const fresh = await one(c.env.DB, "SELECT * FROM contracts WHERE id = ?", row.id);
    return json({ contract: await hydrateContract(c.env.DB, fresh) });
  });

  const actionHandler = (action) => async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const row = await one(
      c.env.DB,
      "SELECT * FROM contracts WHERE id = ? AND organization_id = ? AND is_deleted = 0",
      c.params.contractId,
      c.params.organizationId
    );
    if (!row) return err("Contract not found", 404);
    if (action === "send" && !row.responsible_executor_id) return err("No executor assigned", 400);
    assertCanTransition(m.role, action, row, c.userId);
    const body = await c.json().catch(() => ({}));
    const note = body.reason || body.summary || body.note || body.content;
    const contract = await transition(c.env, { contract: row, action, actorId: c.userId, note, ip: c.ip, userAgent: c.userAgent });
    return json({ contract });
  };

  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/send", authenticate, actionHandler("send"));
  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/accept", authenticate, actionHandler("accept"));
  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/reject", authenticate, actionHandler("reject"));
  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/start", authenticate, actionHandler("start"));
  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/submit", authenticate, actionHandler("submit"));
  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/approve", authenticate, actionHandler("approve"));
  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/archive", authenticate, actionHandler("archive"));
  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/reopen", authenticate, actionHandler("reopen"));

  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/acknowledge", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const latest = await one(
      c.env.DB,
      "SELECT * FROM contract_versions WHERE contract_id = ? ORDER BY version_number DESC LIMIT 1",
      c.params.contractId
    );
    if (!latest) return err("Contract not found", 404);
    await run(
      c.env.DB,
      "UPDATE contract_versions SET acknowledged_at = ?, acknowledged_by = ? WHERE id = ?",
      nowIso(),
      c.userId,
      latest.id
    );
    return json({ message: "Version acknowledged", versionNumber: latest.version_number });
  });

  router.get("/api/v1/organizations/:organizationId/contracts/:contractId/history", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    return json({ versions: await serializeVersions(c.env.DB, c.params.contractId) });
  });

  router.get("/api/v1/organizations/:organizationId/contracts/:contractId/audit", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "read", "audit") && m.role === "observer") return err("Insufficient permissions", 403);
    const logs = await many(
      c.env.DB,
      `SELECT a.*, u.first_name, u.last_name, u.email, u.avatar_url, u.id as uid
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
        WHERE a.contract_id = ?
        ORDER BY a.created_at DESC`,
      c.params.contractId
    );
    return json({
      auditLogs: logs.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entity_type,
        entityId: a.entity_id,
        previousState: a.previous_state ? JSON.parse(a.previous_state) : undefined,
        newState: a.new_state ? JSON.parse(a.new_state) : undefined,
        createdAt: a.created_at,
        checksum: a.checksum,
        user: a.uid
          ? { id: a.uid, firstName: a.first_name, lastName: a.last_name, email: a.email, avatarUrl: a.avatar_url }
          : undefined,
      })),
    });
  });

  router.get("/api/v1/organizations/:organizationId/contracts/:contractId/export", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const full = await loadFullContract(c.env.DB, c.params.organizationId, c.params.contractId);
    if (!full) return err("Contract not found", 404);
    const format = c.url.searchParams.get("format") || "json";
    if (format === "csv") {
      const rows = [
        ["kind", "at", "actor", "detail"],
        ...full.versions.map((v) => ["version", v.changedAt, `${v.changedBy?.firstName || ""} ${v.changedBy?.lastName || ""}`, `v${v.versionNumber} ${v.changeReason || ""}`]),
        ...full.interactions.map((i) => ["interaction", i.createdAt, `${i.author?.firstName || ""} ${i.author?.lastName || ""}`, `${i.interactionType}: ${i.content}`]),
      ];
      const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      return new Response(csv, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${full.contract.contractNumber}.csv"` },
      });
    }
    return json({ exportedAt: nowIso(), ...full, checksum: full.contract.id });
  });

  router.get("/api/v1/organizations/:organizationId/contracts/:contractId/interactions", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const type = c.url.searchParams.get("type");
    const interactions = await serializeInteractions(c.env.DB, c.params.contractId, type || undefined);
    return json({ interactions, pagination: { total: interactions.length } });
  });

  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/interactions", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (m.role === "observer") return err("Observers cannot post interactions", 403);
    const row = await one(
      c.env.DB,
      "SELECT * FROM contracts WHERE id = ? AND organization_id = ?",
      c.params.contractId,
      c.params.organizationId
    );
    if (!row) return err("Contract not found", 404);
    const body = await c.json();
    const content = String(body.content || "").trim();
    if (!content) return err("Content is required", 400);
    const type = VALID_INTERACTIONS.includes(body.interactionType) ? body.interactionType : "comment";
    const progress =
      typeof body.progressPercentage === "number" ? Math.max(0, Math.min(100, body.progressPercentage)) : undefined;
    await addInteraction(c.env, {
      contractId: row.id,
      authorId: c.userId,
      type,
      content,
      progress,
      structured: body.structuredData,
    });
    if (type === "progress_update" && progress != null) {
      await run(c.env.DB, "UPDATE contracts SET progress = ?, updated_at = ? WHERE id = ?", progress, nowIso(), row.id);
    } else {
      await run(c.env.DB, "UPDATE contracts SET updated_at = ? WHERE id = ?", nowIso(), row.id);
    }
    const counterpart = c.userId === row.initiator_id ? row.responsible_executor_id : row.initiator_id;
    if (counterpart && counterpart !== c.userId) {
      await notify(c.env, {
        userId: counterpart,
        orgId: row.organization_id,
        type,
        title: type === "progress_update" ? "Progress update" : "New interaction",
        content: `${c.user.first_name} added a ${type.replace(/_/g, " ")} on “${row.title}”.`,
        contractId: row.id,
      });
    }
    const interactions = await serializeInteractions(c.env.DB, row.id);
    return json({ interaction: interactions[0] }, 201);
  });

  router.post("/api/v1/organizations/:organizationId/contracts/:contractId/attachments", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const body = await c.json();
    const filename = String(body.filename || "file").slice(0, 180);
    const contentType = String(body.contentType || "application/octet-stream");
    const data = String(body.data || "");
    if (!data) return err("File data is required", 400);
    const raw = Uint8Array.from(atob(data.includes(",") ? data.split(",")[1] : data), (ch) => ch.charCodeAt(0));
    if (raw.byteLength > 10 * 1024 * 1024) return err("File too large (10MB max)", 400);
    const id = nid("att");
    const key = `${c.params.organizationId}/${c.params.contractId}/${id}-${filename}`;
    if (c.env.R2) {
      await c.env.R2.put(key, raw, { httpMetadata: { contentType } });
    }
    await run(
      c.env.DB,
      `INSERT INTO attachments (id, organization_id, contract_id, filename, content_type, size, r2_key, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      c.params.organizationId,
      c.params.contractId,
      filename,
      contentType,
      raw.byteLength,
      key,
      c.userId,
      nowIso()
    );
    return json({ attachment: { id, filename, contentType, size: raw.byteLength, url: `/api/v1/attachments/${id}` } }, 201);
  });
}
