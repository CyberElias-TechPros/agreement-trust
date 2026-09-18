import { nid, nowIso } from "./crypto.js";
import { hydrateContract, many, one, requireMembership, run } from "./db.js";
import { err, json } from "./http.js";
import { authenticate, isEmail } from "./authware.js";

export function registerMore(router) {
  router.get("/health", async () => json({ status: "ok", service: "taskcontract-api", timestamp: nowIso() }));
  router.get("/api/v1/health", async (c) => {
    let db = "ok";
    try {
      await one(c.env.DB, "SELECT 1 AS ok");
    } catch {
      db = "error";
    }
    return json({ status: "ok", database: db, timestamp: nowIso(), region: c.req.headers.get("CF-Ray") || "local" });
  });

  router.post("/api/v1/public/contact", async (c) => {
    const body = await c.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    if (!name || !isEmail(email) || message.length < 8) return err("Please include your name, a valid email, and a message", 400);
    await run(
      c.env.DB,
      `INSERT INTO contact_messages (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)`,
      nid("msg"),
      name,
      email.toLowerCase(),
      message.slice(0, 5000),
      nowIso()
    );
    return json({ ok: true, message: "Received. We'll be in touch." }, 201);
  });

  router.get("/api/v1/notifications", authenticate, async (c) => {
    const unreadOnly = c.url.searchParams.get("unreadOnly") === "true";
    const limit = Math.min(100, Math.max(1, parseInt(c.url.searchParams.get("limit") || "20", 10)));
    const offset = Math.max(0, parseInt(c.url.searchParams.get("offset") || "0", 10));
    let list = await many(
      c.env.DB,
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
      c.userId
    );
    const unreadCount = list.filter((n) => !n.read).length;
    if (unreadOnly) list = list.filter((n) => !n.read);
    const total = list.length;
    const slice = list.slice(offset, offset + limit);
    const notifications = [];
    for (const n of slice) {
      let contract;
      if (n.contract_id) {
        const cRow = await one(c.env.DB, "SELECT title, contract_number FROM contracts WHERE id = ?", n.contract_id);
        if (cRow) contract = { title: cRow.title, contractNumber: cRow.contract_number };
      }
      notifications.push({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        contractId: n.contract_id,
        contract,
        read: Boolean(n.read),
        createdAt: n.created_at,
      });
    }
    return json({ notifications, unreadCount, pagination: { total, offset, limit } });
  });

  router.post("/api/v1/notifications/:notificationId/read", authenticate, async (c) => {
    const n = await one(c.env.DB, "SELECT * FROM notifications WHERE id = ? AND user_id = ?", c.params.notificationId, c.userId);
    if (!n) return err("Notification not found", 404);
    await run(c.env.DB, "UPDATE notifications SET read = 1 WHERE id = ?", n.id);
    return json({
      notification: {
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        contractId: n.contract_id,
        read: true,
        createdAt: n.created_at,
      },
    });
  });

  router.post("/api/v1/notifications/read-all", authenticate, async (c) => {
    await run(c.env.DB, "UPDATE notifications SET read = 1 WHERE user_id = ?", c.userId);
    return json({ message: "All notifications marked as read" });
  });

  router.get("/api/v1/search", authenticate, async (c) => {
    const q = String(c.url.searchParams.get("q") || "").trim().toLowerCase();
    const orgId = c.url.searchParams.get("organizationId");
    if (!orgId) return err("organizationId is required", 400);
    await requireMembership(c.env.DB, c.userId, orgId);
    if (!q) return json({ contracts: [], users: [], total: 0 });
    const contracts = await many(c.env.DB, "SELECT * FROM contracts WHERE organization_id = ? AND is_deleted = 0", orgId);
    const matched = [];
    for (const r of contracts) {
      if (
        r.title.toLowerCase().includes(q) ||
        r.current_description.toLowerCase().includes(q) ||
        r.contract_number.toLowerCase().includes(q) ||
        (r.tags || "").toLowerCase().includes(q)
      ) {
        matched.push(await hydrateContract(c.env.DB, r));
      }
    }
    const users = await many(
      c.env.DB,
      `SELECT u.*, m.role as member_role FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ? AND m.status = 'active'`,
      orgId
    );
    const userHits = users
      .filter(
        (u) =>
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        role: u.member_role,
      }));
    return json({ contracts: matched.slice(0, 20), users: userHits.slice(0, 10), total: matched.length + userHits.length });
  });

  router.get("/api/v1/attachments/:attachmentId", authenticate, async (c) => {
    const att = await one(c.env.DB, "SELECT * FROM attachments WHERE id = ?", c.params.attachmentId);
    if (!att) return err("Attachment not found", 404);
    await requireMembership(c.env.DB, c.userId, att.organization_id);
    if (!c.env.R2) return err("Storage unavailable", 500);
    const obj = await c.env.R2.get(att.r2_key);
    if (!obj) return err("File missing", 404);
    const buf = await obj.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": att.content_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${att.filename}"`,
      },
    });
  });

  router.get("/api/v1/meta", async () =>
    json({
      name: "TaskContract",
      version: "1.0.0",
      platform: "cloudflare-workers",
      bindings: ["D1", "KV", "R2"],
    })
  );
}
