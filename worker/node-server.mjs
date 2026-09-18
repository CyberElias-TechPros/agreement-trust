/**
 * Local Cloudflare Worker runtime.
 * Speaks the same fetch() contract as production (D1 + KV + R2 bindings),
 * using node:sqlite, an in-memory KV, and an in-memory R2 bucket.
 */
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { SqliteD1, MemoryKV, MemoryR2 } from "./src/adapters.js";
import { loadSchema } from "./src/schema.js";
import { handleRequest, handleScheduled } from "./src/app.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "data");
mkdirSync(dataDir, { recursive: true });

const sqlite = new DatabaseSync(join(dataDir, "taskcontract.db"));
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");

const env = {
  DB: new SqliteD1(sqlite),
  KV: new MemoryKV(),
  R2: new MemoryR2(),
  JWT_SECRET: process.env.JWT_SECRET || "taskcontract-dev-secret-change-me-please-32b",
  APP_URL: process.env.APP_URL || process.env.CORS_ORIGINS || "http://localhost:8080",
  CORS_ORIGINS: process.env.CORS_ORIGINS || "*",
  ENVIRONMENT: process.env.NODE_ENV || "development",
  SCHEMA_SQL: loadSchema(),
};

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const url = `http://${host}${req.url}`;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }
    const method = req.method || "GET";
    const init = { method, headers };
    if (buf.length && method !== "GET" && method !== "HEAD") init.body = buf;
    const request = new Request(url, init);
    const response = await handleRequest(request, env);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const out = Buffer.from(await response.arrayBuffer());
    res.end(out);
  } catch (e) {
    console.error("[http]", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Internal error" }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[worker] TaskContract API on http://${HOST}:${PORT}`);
  console.log(`[worker] Health: http://127.0.0.1:${PORT}/health`);
  console.log(`[worker] Seed login: alex.morgan@northwind.studio / demo1234`);
});

// Hourly deadline sweep (Cloudflare Cron equivalent)
setInterval(() => {
  handleScheduled(env).catch((e) => console.error("[cron]", e));
}, 60 * 60 * 1000);

process.on("SIGTERM", () => {
  server.close();
  sqlite.close();
  process.exit(0);
});
