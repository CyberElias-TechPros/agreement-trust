import { nid, nowIso, tokenHex } from "./crypto.js";
import { can, VALID_ROLES } from "./rbac.js";
import { mapOrg, mapUser, many, membership, one, orgsForUser, requireMembership, run } from "./db.js";
import { computeAnalytics, notify, writeAudit } from "./domain.js";
import { err, json } from "./http.js";
import { authenticate, isEmail, slugify } from "./authware.js";

export function registerOrgs(router) {
  router.get("/api/v1/organizations", authenticate, async (c) => {
    return json({ organizations: await orgsForUser(c.env.DB, c.userId) });
  });

  router.post("/api/v1/organizations", authenticate, async (c) => {
    const body = await c.json();
    const name = String(body.name || "").trim();
    if (!name) return err("Organization name is required", 400);
    let slug = slugify(body.slug || name);
    if (await one(c.env.DB, "SELECT id FROM organizations WHERE slug = ?", slug)) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    const id = nid("org");
    const now = nowIso();
    await run(
      c.env.DB,
      `INSERT INTO organizations (id, name, slug, plan_type, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)`,
      id,
      name,
      slug,
      now,
      now
    );
    await run(
      c.env.DB,
      `INSERT INTO memberships (id, organization_id, user_id, role, status, joined_at) VALUES (?, ?, ?, 'owner', 'active', ?)`,
      nid("m"),
      id,
      c.userId,
      now
    );
    await writeAudit(c.env, { userId: c.userId, orgId: id, action: "organization_created", entityType: "organization", entityId: id });
    return json({ organization: { id, name, slug, planType: "free", role: "owner" } }, 201);
  });

  router.get("/api/v1/organizations/:organizationId", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const org = await one(c.env.DB, "SELECT * FROM organizations WHERE id = ?", c.params.organizationId);
    if (!org) return err("Organization not found", 404);
    return json({ organization: mapOrg(org, { role: m.role }) });
  });

  router.patch("/api/v1/organizations/:organizationId", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "update", "organization")) return err("Insufficient permissions", 403);
    const body = await c.json();
    const org = await one(c.env.DB, "SELECT * FROM organizations WHERE id = ?", c.params.organizationId);
    const name = body.name != null ? String(body.name).trim() : org.name;
    const branding = body.branding ? { ...(org.branding ? JSON.parse(org.branding || "{}") : {}), ...body.branding } : org.branding;
    const settings = body.settings ? { ...(org.settings ? JSON.parse(org.settings || "{}") : {}), ...body.settings } : org.settings;
    await run(
      c.env.DB,
      "UPDATE organizations SET name = ?, branding = ?, settings = ?, updated_at = ? WHERE id = ?",
      name,
      typeof branding === "string" ? branding : JSON.stringify(branding || {}),
      typeof settings === "string" ? settings : JSON.stringify(settings || {}),
      nowIso(),
      org.id
    );
    const fresh = await one(c.env.DB, "SELECT * FROM organizations WHERE id = ?", org.id);
    return json({ organization: mapOrg(fresh, { role: m.role }) });
  });

  router.get("/api/v1/organizations/:organizationId/members", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const rows = await many(
      c.env.DB,
      `SELECT m.*, u.email, u.first_name, u.last_name, u.avatar_url, u.title, u.id as uid
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ?
        ORDER BY m.joined_at`,
      c.params.organizationId
    );
    return json({
      members: rows.map((r) => ({
        id: r.id,
        role: r.role,
        status: r.status,
        joinedAt: r.joined_at,
        user: mapUser({ id: r.uid, email: r.email, first_name: r.first_name, last_name: r.last_name, avatar_url: r.avatar_url, title: r.title }),
        userDetails: mapUser({ id: r.uid, email: r.email, first_name: r.first_name, last_name: r.last_name, avatar_url: r.avatar_url, title: r.title }),
      })),
    });
  });

  router.post("/api/v1/organizations/:organizationId/members", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "create", "member")) return err("Insufficient permissions", 403);
    const body = await c.json();
    const email = String(body.email || "").toLowerCase().trim();
    const role = VALID_ROLES.includes(body.role) ? body.role : "executor";
    if (role === "owner") return err("Cannot invite an owner", 400);
    if (!isEmail(email)) return err("A valid email is required", 400);
    const user = await one(c.env.DB, "SELECT * FROM users WHERE email = ?", email);
    if (user) {
      const existing = await one(
        c.env.DB,
        "SELECT * FROM memberships WHERE organization_id = ? AND user_id = ?",
        c.params.organizationId,
        user.id
      );
      if (existing && existing.status === "active") return err("This person is already a member", 400);
      if (existing) {
        await run(c.env.DB, "UPDATE memberships SET status = 'pending', role = ? WHERE id = ?", role, existing.id);
      } else {
        await run(
          c.env.DB,
          `INSERT INTO memberships (id, organization_id, user_id, role, status, invited_by, joined_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
          nid("m"),
          c.params.organizationId,
          user.id,
          role,
          c.userId,
          nowIso()
        );
      }
      await notify(c.env, {
        userId: user.id,
        orgId: c.params.organizationId,
        type: "invite",
        title: "You've been invited",
        content: `${c.user.first_name} invited you to join as ${role}.`,
      });
    }
    const token = tokenHex(18);
    const expires = new Date(Date.now() + 14 * 86400000).toISOString();
    await run(
      c.env.DB,
      `INSERT INTO invites (id, organization_id, email, role, token, invited_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      nid("inv"),
      c.params.organizationId,
      email,
      role,
      token,
      c.userId,
      nowIso(),
      expires
    );
    const appUrl = (c.env.APP_URL || "").replace(/\/$/, "");
    const membershipRow = user
      ? await one(c.env.DB, "SELECT * FROM memberships WHERE organization_id = ? AND user_id = ?", c.params.organizationId, user.id)
      : { id: token, role, status: "pending" };
    return json(
      {
        membership: {
          id: membershipRow.id,
          role,
          status: "pending",
          user: user ? mapUser(user) : { email, firstName: email.split("@")[0], lastName: "", id: email },
        },
        inviteUrl: `${appUrl}/invite/${token}`,
        token,
        devHint: "No mail provider configured — share inviteUrl with the teammate.",
      },
      201
    );
  });

  router.patch("/api/v1/organizations/:organizationId/members/:memberId", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "update", "member")) return err("Insufficient permissions", 403);
    const member = await one(c.env.DB, "SELECT * FROM memberships WHERE id = ? AND organization_id = ?", c.params.memberId, c.params.organizationId);
    if (!member) return err("Member not found", 404);
    const body = await c.json();
    if (member.role === "owner" && body.role && body.role !== "owner") return err("Cannot downgrade owner", 400);
    const role = body.role && VALID_ROLES.includes(body.role) ? body.role : member.role;
    const status = body.status || member.status;
    await run(c.env.DB, "UPDATE memberships SET role = ?, status = ? WHERE id = ?", role, status, member.id);
    const fresh = await one(c.env.DB, "SELECT * FROM memberships WHERE id = ?", member.id);
    return json({ membership: { id: fresh.id, role: fresh.role, status: fresh.status } });
  });

  router.delete("/api/v1/organizations/:organizationId/members/:memberId", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "delete", "member")) return err("Insufficient permissions", 403);
    const member = await one(c.env.DB, "SELECT * FROM memberships WHERE id = ? AND organization_id = ?", c.params.memberId, c.params.organizationId);
    if (!member) return err("Member not found", 404);
    if (member.role === "owner") return err("Cannot remove owner", 400);
    await run(c.env.DB, "UPDATE memberships SET status = 'removed' WHERE id = ?", member.id);
    return json({ message: "Member removed" });
  });

  router.get("/api/v1/organizations/:organizationId/analytics", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    return json(await computeAnalytics(c.env.DB, c.params.organizationId));
  });

  router.get("/api/v1/organizations/:organizationId/billing", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const org = await one(c.env.DB, "SELECT * FROM organizations WHERE id = ?", c.params.organizationId);
    const members = await one(c.env.DB, "SELECT COUNT(*) as c FROM memberships WHERE organization_id = ? AND status = 'active'", org.id);
    const contracts = await one(c.env.DB, "SELECT COUNT(*) as c FROM contracts WHERE organization_id = ? AND is_deleted = 0", org.id);
    return json({
      plan: org.plan_type,
      seats: Number(members.c),
      contracts: Number(contracts.c),
      limits: org.plan_type === "free" ? { seats: 5, contracts: 50 } : { seats: 1000, contracts: 100000 },
      canManage: can(m.role, "manage_billing", "organization"),
    });
  });

  router.post("/api/v1/organizations/:organizationId/billing/upgrade", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "manage_billing", "organization") && m.role !== "owner") return err("Only owners can change the plan", 403);
    const body = await c.json();
    const plan = ["free", "pro", "enterprise"].includes(body.planType) ? body.planType : "pro";
    await run(c.env.DB, "UPDATE organizations SET plan_type = ?, updated_at = ? WHERE id = ?", plan, nowIso(), c.params.organizationId);
    const org = await one(c.env.DB, "SELECT * FROM organizations WHERE id = ?", c.params.organizationId);
    await writeAudit(c.env, {
      userId: c.userId,
      orgId: org.id,
      action: "plan_changed",
      entityType: "organization",
      entityId: org.id,
      newState: { plan },
    });
    return json({ organization: mapOrg(org, { role: m.role }), message: `Plan updated to ${plan}.` });
  });

  router.get("/api/v1/organizations/:organizationId/users", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const rows = await many(
      c.env.DB,
      `SELECT u.*, m.role as member_role
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ? AND m.status = 'active'`,
      c.params.organizationId
    );
    return json({ users: rows.map((r) => mapUser(r, { role: r.member_role })) });
  });

  router.get("/api/v1/organizations/:organizationId/users/search", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const q = String(c.url.searchParams.get("q") || "").toLowerCase();
    const rows = await many(
      c.env.DB,
      `SELECT u.*, m.role as member_role
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ? AND m.status = 'active'`,
      c.params.organizationId
    );
    const users = rows
      .map((r) => mapUser(r, { role: r.member_role }))
      .filter(
        (u) =>
          !q ||
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    return json({ users });
  });

  router.get("/api/v1/organizations/:organizationId/categories", authenticate, async (c) => {
    await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    const rows = await many(c.env.DB, "SELECT * FROM categories WHERE organization_id = ? ORDER BY name", c.params.organizationId);
    return json({
      categories: rows.map((r) => ({ id: r.id, name: r.name, color: r.color, description: r.description })),
    });
  });

  router.post("/api/v1/organizations/:organizationId/categories", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "create", "category")) return err("Insufficient permissions", 403);
    const body = await c.json();
    const name = String(body.name || "").trim();
    if (!name) return err("Name is required", 400);
    const palette = ["#8B5CF6", "#4F5BD5", "#D9A441", "#0F9D6E", "#D6577E", "#3B82F6"];
    const id = nid("c");
    await run(
      c.env.DB,
      `INSERT INTO categories (id, organization_id, name, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      c.params.organizationId,
      name,
      body.color || palette[Math.floor(Math.random() * palette.length)],
      body.description || null,
      nowIso()
    );
    const cat = await one(c.env.DB, "SELECT * FROM categories WHERE id = ?", id);
    return json({ category: { id: cat.id, name: cat.name, color: cat.color, description: cat.description } }, 201);
  });

  router.patch("/api/v1/organizations/:organizationId/categories/:categoryId", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "update", "category")) return err("Insufficient permissions", 403);
    const cat = await one(
      c.env.DB,
      "SELECT * FROM categories WHERE id = ? AND organization_id = ?",
      c.params.categoryId,
      c.params.organizationId
    );
    if (!cat) return err("Category not found", 404);
    const body = await c.json();
    await run(
      c.env.DB,
      "UPDATE categories SET name = ?, color = ?, description = ? WHERE id = ?",
      body.name != null ? String(body.name).trim() : cat.name,
      body.color || cat.color,
      body.description !== undefined ? body.description : cat.description,
      cat.id
    );
    const fresh = await one(c.env.DB, "SELECT * FROM categories WHERE id = ?", cat.id);
    return json({ category: { id: fresh.id, name: fresh.name, color: fresh.color, description: fresh.description } });
  });

  router.delete("/api/v1/organizations/:organizationId/categories/:categoryId", authenticate, async (c) => {
    const m = await requireMembership(c.env.DB, c.userId, c.params.organizationId);
    if (!can(m.role, "delete", "category")) return err("Insufficient permissions", 403);
    await run(c.env.DB, "UPDATE contracts SET category_id = NULL WHERE category_id = ?", c.params.categoryId);
    await run(c.env.DB, "DELETE FROM categories WHERE id = ? AND organization_id = ?", c.params.categoryId, c.params.organizationId);
    return json({ message: "Category deleted" });
  });
}
