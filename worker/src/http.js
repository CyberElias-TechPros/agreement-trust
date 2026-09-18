export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function err(message, status = 400, extra = {}) {
  return json({ error: message, ...extra }, status);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allow = env.CORS_ORIGINS || "*";
  const list = allow === "*" ? ["*"] : String(allow).split(",").map((s) => s.trim()).filter(Boolean);
  const allowed = allow === "*" || !origin || list.includes(origin) || list.includes("*");
  const acao = allow === "*" || !origin ? "*" : allowed ? origin : list[0] || "*";
  return {
    "Access-Control-Allow-Origin": acao,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Requested-With",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request, env);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if ((env.ENVIRONMENT || "development") === "production") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, { status: response.status, headers });
}

export function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() ||
    "127.0.0.1"
  );
}

export async function readJson(request) {
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) {
    const text = await request.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function createRouter() {
  const routes = [];

  const add = (method, path, ...handlers) => {
    const keys = [];
    const re = new RegExp(
      "^" +
        path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => {
          keys.push(k);
          return "([^/]+)";
        }) +
        "$"
    );
    routes.push({ method, re, keys, handlers });
  };

  return {
    get: (p, ...h) => add("GET", p, ...h),
    post: (p, ...h) => add("POST", p, ...h),
    patch: (p, ...h) => add("PATCH", p, ...h),
    put: (p, ...h) => add("PUT", p, ...h),
    delete: (p, ...h) => add("DELETE", p, ...h),
    async handle(request, env, ctx = {}) {
      if (request.method === "OPTIONS") {
        return withCors(new Response(null, { status: 204 }), request, env);
      }
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      for (const route of routes) {
        if (route.method !== request.method) continue;
        const m = path.match(route.re);
        if (!m) continue;
        const params = {};
        route.keys.forEach((k, i) => {
          params[k] = decodeURIComponent(m[i + 1]);
        });
        const c = {
          req: request,
          env,
          ctx,
          url,
          params,
          ip: clientIp(request),
          userAgent: request.headers.get("User-Agent") || "",
          json: () => readJson(request),
        };
        try {
          let res;
          for (const handler of route.handlers) {
            res = await handler(c);
            if (res) break;
          }
          if (!res) res = err("No response", 500);
          return withCors(res, request, env);
        } catch (e) {
          const status = e.status || 500;
          const message = e.expose ? e.message : status >= 500 ? "Internal error" : e.message;
          if (status >= 500) console.error("[api]", e);
          return withCors(err(message || "Request failed", status), request, env);
        }
      }
      return withCors(err("Not found", 404), request, env);
    },
  };
}

export function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  e.expose = status < 500;
  return e;
}

export async function rateLimit(env, key, limit, windowSec) {
  if (!env.KV) return true;
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const k = `rl:${key}:${bucket}`;
  const n = Number((await env.KV.get(k)) || "0");
  if (n >= limit) return false;
  await env.KV.put(k, String(n + 1), { expirationTtl: windowSec * 2 });
  return true;
}
