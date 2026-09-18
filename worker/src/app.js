import { createRouter, err, json, rateLimit, withCors } from "./http.js";
import { seedIfEmpty } from "./seed.js";
import { deadlineSweep } from "./domain.js";
import { registerAuth } from "./routes-auth.js";
import { registerOrgs } from "./routes-orgs.js";
import { registerContracts } from "./routes-contracts.js";
import { registerMore } from "./routes-more.js";
import { one } from "./db.js";

const router = createRouter();
registerMore(router);
registerAuth(router);
registerOrgs(router);
registerContracts(router);

async function boot(env) {
  if (env.SCHEMA_SQL) {
    try {
      await one(env.DB, "SELECT 1 AS ok FROM users LIMIT 1");
    } catch {
      await env.DB.exec(env.SCHEMA_SQL);
    }
  }
  await seedIfEmpty(env);
}

export async function handleRequest(request, env, ctx = {}) {
  if (!env._boot) env._boot = boot(env);
  try {
    await env._boot;
  } catch (e) {
    console.error("[boot]", e);
    return withCors(err("API failed to start", 500), request, env);
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") && request.method !== "OPTIONS") {
    const ok = await rateLimit(env, `api:${request.headers.get("CF-Connecting-IP") || "local"}`, 300, 60);
    if (!ok) return withCors(err("Too many requests", 429), request, env);
  }

  return router.handle(request, env, ctx);
}

export async function handleScheduled(env) {
  if (!env._boot) env._boot = boot(env);
  await env._boot;
  const n = await deadlineSweep(env);
  return json({ ok: true, notified: n });
}
