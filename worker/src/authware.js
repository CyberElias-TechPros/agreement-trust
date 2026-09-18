import { verifyJwt } from "./crypto.js";
import { one } from "./db.js";
import { httpError } from "./http.js";

export async function authenticate(c) {
  const header = c.req.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) throw httpError("No token provided", 401);
  const token = header.slice(7);
  const payload = await verifyJwt(token, jwtSecret(c.env));
  if (!payload || payload.typ === "refresh" || payload.typ === "2fa") {
    throw httpError("Invalid or expired token", 401);
  }
  const user = await one(c.env.DB, "SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", payload.sub);
  if (!user) throw httpError("User not found", 401);
  c.user = user;
  c.userId = user.id;
  c.sessionId = payload.sid || null;
}

export function jwtSecret(env) {
  return env.JWT_SECRET || "taskcontract-dev-secret-change-me-please-32b";
}

export const ACCESS_TTL = 15 * 60;
export const REFRESH_TTL = 7 * 24 * 60 * 60;

export function isEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length < 255;
}

export function isPassword(v) {
  return typeof v === "string" && v.length >= 8 && v.length <= 128;
}

export function isName(v) {
  return typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 80;
}

export function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "org"
  );
}
