import {
  generateBackupCodes,
  generateTotpSecret,
  hashPassword,
  nid,
  nowIso,
  otpauthUrl,
  signJwt,
  tokenHex,
  verifyJwt,
  verifyPassword,
  verifyTotp,
  sha256Hex,
} from "./crypto.js";
import { mapUser, many, one, orgsForUser, parseJson, run } from "./db.js";
import { writeAudit } from "./domain.js";
import { err, httpError, json, rateLimit } from "./http.js";
import { ACCESS_TTL, REFRESH_TTL, authenticate, isEmail, isName, isPassword, jwtSecret, slugify } from "./authware.js";

async function issueTokens(env, user, { ip, userAgent, sessionId } = {}) {
  const sid = sessionId || nid("sess");
  const accessToken = await signJwt({ sub: user.id, typ: "access", sid }, jwtSecret(env), ACCESS_TTL);
  const refreshToken = await signJwt({ sub: user.id, typ: "refresh", sid }, jwtSecret(env), REFRESH_TTL);
  const refreshHash = await sha256Hex(refreshToken);
  const now = nowIso();
  const expires = new Date(Date.now() + REFRESH_TTL * 1000).toISOString();
  const existing = await one(env.DB, "SELECT id FROM sessions WHERE id = ?", sid);
  if (existing) {
    await run(
      env.DB,
      "UPDATE sessions SET refresh_token_hash = ?, last_seen_at = ?, expires_at = ?, revoked_at = NULL WHERE id = ?",
      refreshHash,
      now,
      expires,
      sid
    );
  } else {
    await run(
      env.DB,
      `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip_address, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      sid,
      user.id,
      refreshHash,
      userAgent || null,
      ip || null,
      now,
      expires,
      now
    );
  }
  // Cap sessions per user
  const sessions = await many(env.DB, "SELECT id FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC", user.id);
  if (sessions.length > 8) {
    for (const s of sessions.slice(8)) {
      await run(env.DB, "UPDATE sessions SET revoked_at = ? WHERE id = ?", now, s.id);
    }
  }
  return { accessToken, refreshToken, sessionId: sid };
}

export function registerAuth(router) {
  router.post("/api/v1/auth/register", async (c) => {
    if (!(await rateLimit(c.env, `auth:${c.ip}`, 20, 600))) return err("Too many attempts", 429);
    const body = await c.json();
    const { email, password, firstName, lastName, organizationName } = body || {};
    if (!isEmail(email) || !isPassword(password) || !isName(firstName) || !isName(lastName)) {
      return err("Validation failed", 400, {
        details: [
          !isEmail(email) && "Valid email is required",
          !isPassword(password) && "Password must be 8–128 characters",
          !isName(firstName) && "First name is required",
          !isName(lastName) && "Last name is required",
        ].filter(Boolean),
      });
    }
    const existing = await one(c.env.DB, "SELECT id FROM users WHERE email = ?", email.toLowerCase().trim());
    if (existing) return err("Email already registered", 409);
    const id = nid("u");
    const now = nowIso();
    const hash = await hashPassword(password);
    await run(
      c.env.DB,
      `INSERT INTO users (id, email, password_hash, first_name, last_name, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      id,
      email.toLowerCase().trim(),
      hash,
      firstName.trim(),
      lastName.trim(),
      now,
      now
    );
    await run(
      c.env.DB,
      `INSERT INTO notification_prefs (user_id, contract_assigned, status_changed, deadline_reminder, comments, email_digest)
       VALUES (?, 1, 1, 1, 1, 0)`,
      id
    );
    const orgName = (organizationName || `${firstName.trim()}'s Organization`).trim();
    const orgId = nid("org");
    let slug = slugify(orgName);
    const slugTaken = await one(c.env.DB, "SELECT id FROM organizations WHERE slug = ?", slug);
    if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`;
    await run(
      c.env.DB,
      `INSERT INTO organizations (id, name, slug, plan_type, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)`,
      orgId,
      orgName,
      slug,
      now,
      now
    );
    await run(
      c.env.DB,
      `INSERT INTO memberships (id, organization_id, user_id, role, status, joined_at) VALUES (?, ?, ?, 'owner', 'active', ?)`,
      nid("m"),
      orgId,
      id,
      now
    );
    const user = await one(c.env.DB, "SELECT * FROM users WHERE id = ?", id);
    const tokens = await issueTokens(c.env, user, { ip: c.ip, userAgent: c.userAgent });
    await writeAudit(c.env, {
      userId: id,
      orgId,
      action: "user_registered",
      entityType: "user",
      entityId: id,
      newState: { email: user.email },
      ip: c.ip,
      userAgent: c.userAgent,
    });
    return json(
      {
        user: mapUser(user),
        organization: { id: orgId, name: orgName, slug, planType: "free", role: "owner" },
        ...tokens,
      },
      201
    );
  });

  router.post("/api/v1/auth/login", async (c) => {
    if (!(await rateLimit(c.env, `auth:${c.ip}`, 20, 600))) return err("Too many attempts", 429);
    const body = await c.json();
    const { email, password, otp } = body || {};
    if (!isEmail(email) || !password) return err("Invalid credentials", 401);
    const user = await one(c.env.DB, "SELECT * FROM users WHERE email = ? AND deleted_at IS NULL", email.toLowerCase().trim());
    if (!user || !(await verifyPassword(password, user.password_hash))) return err("Invalid credentials", 401);
    if (user.two_factor_enabled) {
      if (!otp) {
        const challengeToken = await signJwt({ sub: user.id, typ: "2fa" }, jwtSecret(c.env), 300);
        return json({ requires2fa: true, challengeToken });
      }
      const codes = parseJson(user.backup_codes, []);
      const otpOk = (await verifyTotp(user.two_factor_secret, otp)) || codes.includes(String(otp).toUpperCase());
      if (!otpOk) return err("Invalid authentication code", 401);
      if (codes.includes(String(otp).toUpperCase())) {
        const next = codes.filter((x) => x !== String(otp).toUpperCase());
        await run(c.env.DB, "UPDATE users SET backup_codes = ? WHERE id = ?", JSON.stringify(next), user.id);
      }
    }
    await run(c.env.DB, "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), user.id);
    const tokens = await issueTokens(c.env, user, { ip: c.ip, userAgent: c.userAgent });
    const organizations = await orgsForUser(c.env.DB, user.id);
    await writeAudit(c.env, {
      userId: user.id,
      orgId: organizations[0]?.id,
      action: "user_login",
      entityType: "user",
      entityId: user.id,
      ip: c.ip,
      userAgent: c.userAgent,
    });
    return json({ user: mapUser(user), organizations, ...tokens });
  });

  router.post("/api/v1/auth/2fa/verify", async (c) => {
    const body = await c.json();
    const { challengeToken, code } = body || {};
    const payload = await verifyJwt(challengeToken, jwtSecret(c.env));
    if (!payload || payload.typ !== "2fa") return err("Invalid or expired challenge", 401);
    const user = await one(c.env.DB, "SELECT * FROM users WHERE id = ?", payload.sub);
    if (!user) return err("User not found", 401);
    const codes = parseJson(user.backup_codes, []);
    const otpOk = (await verifyTotp(user.two_factor_secret, code)) || codes.includes(String(code).toUpperCase());
    if (!otpOk) return err("Invalid authentication code", 401);
    const tokens = await issueTokens(c.env, user, { ip: c.ip, userAgent: c.userAgent });
    const organizations = await orgsForUser(c.env.DB, user.id);
    return json({ user: mapUser(user), organizations, ...tokens });
  });

  router.post("/api/v1/auth/refresh", async (c) => {
    const body = await c.json();
    const { refreshToken } = body || {};
    if (!refreshToken) return err("Refresh token required", 400);
    const payload = await verifyJwt(refreshToken, jwtSecret(c.env));
    if (!payload || payload.typ !== "refresh") return err("Invalid refresh token", 401);
    const hash = await sha256Hex(refreshToken);
    const session = await one(
      c.env.DB,
      "SELECT * FROM sessions WHERE id = ? AND user_id = ? AND refresh_token_hash = ? AND revoked_at IS NULL",
      payload.sid,
      payload.sub,
      hash
    );
    if (!session || new Date(session.expires_at) < new Date()) return err("Invalid or expired refresh token", 401);
    const user = await one(c.env.DB, "SELECT * FROM users WHERE id = ?", payload.sub);
    if (!user) return err("User not found", 401);
    const tokens = await issueTokens(c.env, user, { ip: c.ip, userAgent: c.userAgent, sessionId: session.id });
    return json(tokens);
  });

  router.post("/api/v1/auth/logout", authenticate, async (c) => {
    const body = await c.json();
    const now = nowIso();
    if (body.refreshToken) {
      const hash = await sha256Hex(body.refreshToken);
      await run(c.env.DB, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND refresh_token_hash = ?", now, c.userId, hash);
    } else if (c.sessionId) {
      await run(c.env.DB, "UPDATE sessions SET revoked_at = ? WHERE id = ?", now, c.sessionId);
    }
    await writeAudit(c.env, { userId: c.userId, action: "user_logout", entityType: "user", entityId: c.userId });
    return json({ message: "Logged out successfully" });
  });

  router.get("/api/v1/auth/me", authenticate, async (c) => {
    const organizations = await orgsForUser(c.env.DB, c.userId);
    return json({ user: mapUser(c.user), organizations });
  });

  router.patch("/api/v1/auth/me", authenticate, async (c) => {
    const body = await c.json();
    const firstName = body.firstName != null ? String(body.firstName).trim() : c.user.first_name;
    const lastName = body.lastName != null ? String(body.lastName).trim() : c.user.last_name;
    const avatarUrl = body.avatarUrl !== undefined ? body.avatarUrl : c.user.avatar_url;
    const title = body.title !== undefined ? body.title : c.user.title;
    if (!isName(firstName) || !isName(lastName)) return err("Validation failed", 400);
    await run(
      c.env.DB,
      "UPDATE users SET first_name = ?, last_name = ?, avatar_url = ?, title = ?, updated_at = ? WHERE id = ?",
      firstName,
      lastName,
      avatarUrl,
      title,
      nowIso(),
      c.userId
    );
    const user = await one(c.env.DB, "SELECT * FROM users WHERE id = ?", c.userId);
    return json({ user: mapUser(user) });
  });

  router.post("/api/v1/auth/change-password", authenticate, async (c) => {
    const body = await c.json();
    const { currentPassword, newPassword } = body || {};
    if (!isPassword(currentPassword) || !isPassword(newPassword)) return err("Validation failed", 400);
    if (currentPassword === newPassword) return err("New password must be different from the current password", 400);
    if (!(await verifyPassword(currentPassword, c.user.password_hash))) return err("Current password is incorrect", 400);
    const hash = await hashPassword(newPassword);
    await run(c.env.DB, "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", hash, nowIso(), c.userId);
    await run(c.env.DB, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", nowIso(), c.userId);
    const tokens = await issueTokens(c.env, c.user, { ip: c.ip, userAgent: c.userAgent });
    await writeAudit(c.env, { userId: c.userId, action: "password_changed", entityType: "user", entityId: c.userId });
    return json({ message: "Password changed successfully", ...tokens });
  });

  router.post("/api/v1/auth/forgot-password", async (c) => {
    if (!(await rateLimit(c.env, `auth:${c.ip}`, 20, 600))) return err("Too many attempts", 429);
    const body = await c.json();
    const email = String(body.email || "").toLowerCase().trim();
    const user = isEmail(email) ? await one(c.env.DB, "SELECT * FROM users WHERE email = ?", email) : null;
    const payload = { sent: true, message: "If an account exists, a reset link is on its way." };
    if (user) {
      const token = tokenHex(24);
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await run(c.env.DB, "INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)", token, user.id, expires);
      const appUrl = (c.env.APP_URL || "").replace(/\/$/, "");
      payload.resetToken = token;
      payload.resetUrl = `${appUrl || ""}/reset-password?token=${token}`;
      payload.devHint = "No mail provider configured — use resetUrl to complete the happy path.";
    }
    return json(payload);
  });

  router.post("/api/v1/auth/reset-password", async (c) => {
    const body = await c.json();
    const { token, password } = body || {};
    if (!token || !isPassword(password)) return err("A valid token and new password are required", 400);
    const row = await one(c.env.DB, "SELECT * FROM password_resets WHERE token = ?", token);
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) return err("Invalid or expired reset token", 400);
    const hash = await hashPassword(password);
    await run(c.env.DB, "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", hash, nowIso(), row.user_id);
    await run(c.env.DB, "UPDATE password_resets SET used_at = ? WHERE token = ?", nowIso(), token);
    await run(c.env.DB, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", nowIso(), row.user_id);
    const user = await one(c.env.DB, "SELECT * FROM users WHERE id = ?", row.user_id);
    const tokens = await issueTokens(c.env, user, { ip: c.ip, userAgent: c.userAgent });
    const organizations = await orgsForUser(c.env.DB, user.id);
    return json({ message: "Password reset", user: mapUser(user), organizations, ...tokens });
  });

  router.get("/api/v1/auth/sessions", authenticate, async (c) => {
    const rows = await many(
      c.env.DB,
      "SELECT id, user_agent, ip_address, created_at, last_seen_at, expires_at, revoked_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
      c.userId
    );
    return json({
      sessions: rows.map((s) => ({
        id: s.id,
        userAgent: s.user_agent,
        ipAddress: s.ip_address,
        createdAt: s.created_at,
        lastSeenAt: s.last_seen_at,
        expiresAt: s.expires_at,
        current: s.id === c.sessionId,
        revoked: Boolean(s.revoked_at),
      })),
    });
  });

  router.delete("/api/v1/auth/sessions/:sessionId", authenticate, async (c) => {
    const s = await one(c.env.DB, "SELECT * FROM sessions WHERE id = ? AND user_id = ?", c.params.sessionId, c.userId);
    if (!s) return err("Session not found", 404);
    await run(c.env.DB, "UPDATE sessions SET revoked_at = ? WHERE id = ?", nowIso(), s.id);
    return json({ message: "Session revoked" });
  });

  router.post("/api/v1/auth/sessions/revoke-others", authenticate, async (c) => {
    await run(
      c.env.DB,
      "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL",
      nowIso(),
      c.userId,
      c.sessionId || ""
    );
    return json({ message: "Other sessions revoked" });
  });

  router.get("/api/v1/auth/preferences", authenticate, async (c) => {
    let prefs = await one(c.env.DB, "SELECT * FROM notification_prefs WHERE user_id = ?", c.userId);
    if (!prefs) {
      await run(
        c.env.DB,
        `INSERT INTO notification_prefs (user_id, contract_assigned, status_changed, deadline_reminder, comments, email_digest)
         VALUES (?, 1, 1, 1, 1, 0)`,
        c.userId
      );
      prefs = await one(c.env.DB, "SELECT * FROM notification_prefs WHERE user_id = ?", c.userId);
    }
    return json({
      preferences: {
        contract_assigned: Boolean(prefs.contract_assigned),
        status_changed: Boolean(prefs.status_changed),
        deadline_reminder: Boolean(prefs.deadline_reminder),
        comments: Boolean(prefs.comments),
        email_digest: Boolean(prefs.email_digest),
      },
    });
  });

  router.patch("/api/v1/auth/preferences", authenticate, async (c) => {
    const body = await c.json();
    const keys = ["contract_assigned", "status_changed", "deadline_reminder", "comments", "email_digest"];
    const existing = await one(c.env.DB, "SELECT * FROM notification_prefs WHERE user_id = ?", c.userId);
    if (!existing) {
      await run(
        c.env.DB,
        `INSERT INTO notification_prefs (user_id, contract_assigned, status_changed, deadline_reminder, comments, email_digest)
         VALUES (?, 1, 1, 1, 1, 0)`,
        c.userId
      );
    }
    const next = {};
    for (const k of keys) {
      if (typeof body[k] === "boolean") next[k] = body[k] ? 1 : 0;
    }
    if (Object.keys(next).length) {
      const sets = Object.keys(next).map((k) => `${k} = ?`).join(", ");
      await run(c.env.DB, `UPDATE notification_prefs SET ${sets} WHERE user_id = ?`, ...Object.values(next), c.userId);
    }
    const prefs = await one(c.env.DB, "SELECT * FROM notification_prefs WHERE user_id = ?", c.userId);
    return json({
      preferences: {
        contract_assigned: Boolean(prefs.contract_assigned),
        status_changed: Boolean(prefs.status_changed),
        deadline_reminder: Boolean(prefs.deadline_reminder),
        comments: Boolean(prefs.comments),
        email_digest: Boolean(prefs.email_digest),
      },
    });
  });

  router.post("/api/v1/auth/2fa/setup", authenticate, async (c) => {
    const secret = generateTotpSecret();
    if (!c.env.KV) return err("KV binding required for 2FA setup", 500);
    await c.env.KV.put(`2fa-setup:${c.userId}`, secret, { expirationTtl: 600 });
    return json({ secret, otpauthUrl: otpauthUrl(c.user.email, secret) });
  });

  router.post("/api/v1/auth/2fa/enable", authenticate, async (c) => {
    const body = await c.json();
    const secret = c.env.KV ? await c.env.KV.get(`2fa-setup:${c.userId}`) : null;
    if (!secret) return err("No 2FA setup in progress — call /2fa/setup first", 400);
    if (!(await verifyTotp(secret, body.code))) return err("Invalid authentication code", 400);
    const backupCodes = generateBackupCodes();
    await run(
      c.env.DB,
      "UPDATE users SET two_factor_enabled = 1, two_factor_secret = ?, backup_codes = ?, updated_at = ? WHERE id = ?",
      secret,
      JSON.stringify(backupCodes),
      nowIso(),
      c.userId
    );
    if (c.env.KV) await c.env.KV.delete(`2fa-setup:${c.userId}`);
    await writeAudit(c.env, { userId: c.userId, action: "2fa_enabled", entityType: "user", entityId: c.userId });
    return json({ message: "Two-factor authentication enabled", backupCodes });
  });

  router.post("/api/v1/auth/2fa/disable", authenticate, async (c) => {
    const body = await c.json();
    if (!(await verifyPassword(body.password || "", c.user.password_hash))) return err("Current password is incorrect", 400);
    await run(
      c.env.DB,
      "UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, backup_codes = NULL, updated_at = ? WHERE id = ?",
      nowIso(),
      c.userId
    );
    return json({ message: "Two-factor authentication disabled" });
  });

  router.get("/api/v1/auth/invites/:token", async (c) => {
    const inv = await one(c.env.DB, "SELECT * FROM invites WHERE token = ?", c.params.token);
    if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) return err("Invite is invalid or expired", 404);
    const org = await one(c.env.DB, "SELECT id, name, slug FROM organizations WHERE id = ?", inv.organization_id);
    return json({ email: inv.email, role: inv.role, organization: org });
  });

  router.post("/api/v1/auth/invites/:token/accept", async (c) => {
    const inv = await one(c.env.DB, "SELECT * FROM invites WHERE token = ?", c.params.token);
    if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) return err("Invite is invalid or expired", 400);
    const body = await c.json();
    let user = await one(c.env.DB, "SELECT * FROM users WHERE email = ?", inv.email);
    if (!user) {
      if (!isName(body.firstName) || !isName(body.lastName) || !isPassword(body.password)) {
        return err("First name, last name and a password are required to join", 400);
      }
      const id = nid("u");
      const now = nowIso();
      await run(
        c.env.DB,
        `INSERT INTO users (id, email, password_hash, first_name, last_name, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        id,
        inv.email,
        await hashPassword(body.password),
        body.firstName.trim(),
        body.lastName.trim(),
        now,
        now
      );
      user = await one(c.env.DB, "SELECT * FROM users WHERE id = ?", id);
    }
    const existing = await one(
      c.env.DB,
      "SELECT * FROM memberships WHERE organization_id = ? AND user_id = ?",
      inv.organization_id,
      user.id
    );
    if (existing) {
      await run(c.env.DB, "UPDATE memberships SET status = 'active', role = ? WHERE id = ?", inv.role, existing.id);
    } else {
      await run(
        c.env.DB,
        `INSERT INTO memberships (id, organization_id, user_id, role, status, invited_by, joined_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
        nid("m"),
        inv.organization_id,
        user.id,
        inv.role,
        inv.invited_by,
        nowIso()
      );
    }
    await run(c.env.DB, "UPDATE invites SET accepted_at = ? WHERE id = ?", nowIso(), inv.id);
    const tokens = await issueTokens(c.env, user, { ip: c.ip, userAgent: c.userAgent });
    const organizations = await orgsForUser(c.env.DB, user.id);
    return json({ user: mapUser(user), organizations, ...tokens });
  });
}
