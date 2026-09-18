/**
 * End-to-end Worker API tests against an in-memory D1/KV/R2 stack.
 * Run: node worker/test.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { SqliteD1, MemoryKV, MemoryR2 } from "./src/adapters.js";
import { loadSchema } from "./src/schema.js";
import { handleRequest } from "./src/app.js";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");

const env = {
  DB: new SqliteD1(sqlite),
  KV: new MemoryKV(),
  R2: new MemoryR2(),
  JWT_SECRET: "test-secret-taskcontract-32bytes-min",
  APP_URL: "http://localhost:8080",
  CORS_ORIGINS: "*",
  ENVIRONMENT: "test",
  SCHEMA_SQL: loadSchema(),
};

let fails = 0;
function assert(cond, msg) {
  if (!cond) {
    fails += 1;
    console.error("  FAIL", msg);
  } else {
    console.log("  ok  ", msg);
  }
}

async function call(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await handleRequest(new Request(`http://local${path}`, init), env);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

async function main() {
  console.log("\nTaskContract Worker API\n");

  {
    const r = await call("GET", "/health");
    assert(r.status === 200 && r.json.status === "ok", "GET /health");
  }

  {
    const r = await call("POST", "/api/v1/auth/login", {
      body: { email: "alex.morgan@northwind.studio", password: "demo1234" },
    });
    assert(r.status === 200 && r.json.accessToken, "seed login");
    var alex = r.json;
  }

  {
    const r = await call("GET", "/api/v1/auth/me", { token: alex.accessToken });
    assert(r.status === 200 && r.json.user.email === "alex.morgan@northwind.studio", "GET /auth/me");
    assert(r.json.organizations.length >= 1, "me returns orgs");
  }

  const orgId = alex.organizations.find((o) => o.slug === "northwind")?.id || alex.organizations[0].id;

  {
    const r = await call("GET", `/api/v1/organizations/${orgId}/contracts`, { token: alex.accessToken });
    assert(r.status === 200 && r.json.contracts.length >= 5, "list contracts");
  }

  {
    const r = await call("GET", `/api/v1/organizations/${orgId}/analytics`, { token: alex.accessToken });
    assert(r.status === 200 && typeof r.json.stats.totalContracts === "number", "analytics");
  }

  {
    const r = await call("POST", `/api/v1/organizations/${orgId}/contracts`, {
      token: alex.accessToken,
      body: {
        title: "Seal the Q3 board pack",
        description: "Compile slides, numbers, and the risk register. Definition of done: PDF in the vault.",
        priority: "high",
        executorId: "u3",
        observerIds: ["u6"],
        send: true,
        tags: ["board", "q3"],
      },
    });
    assert(r.status === 201 && r.json.contract.status === "sent", "create + send");
    var created = r.json.contract;
  }

  {
    const r = await call("POST", "/api/v1/auth/login", {
      body: { email: "james.wilson@northwind.studio", password: "demo1234" },
    });
    assert(r.status === 200, "executor login");
    var james = r.json;
  }

  {
    const r = await call("POST", `/api/v1/organizations/${orgId}/contracts/${created.id}/accept`, {
      token: james.accessToken,
    });
    assert(r.status === 200 && r.json.contract.status === "in_progress", "accept → in_progress");
  }

  {
    const r = await call("POST", `/api/v1/organizations/${orgId}/contracts/${created.id}/interactions`, {
      token: james.accessToken,
      body: { interactionType: "progress_update", content: "Deck outline complete.", progressPercentage: 40 },
    });
    assert(r.status === 201, "progress interaction");
  }

  {
    const r = await call("POST", `/api/v1/organizations/${orgId}/contracts/${created.id}/submit`, {
      token: james.accessToken,
      body: { summary: "Board pack PDF attached conceptually." },
    });
    assert(r.status === 200 && r.json.contract.status === "submitted", "submit");
  }

  {
    const r = await call("POST", `/api/v1/organizations/${orgId}/contracts/${created.id}/approve`, {
      token: alex.accessToken,
    });
    assert(r.status === 200 && r.json.contract.status === "approved", "approve / seal");
  }

  {
    const r = await call("GET", `/api/v1/organizations/${orgId}/contracts/${created.id}`, { token: alex.accessToken });
    assert(r.status === 200 && r.json.versions.length >= 1 && r.json.interactions.length >= 3, "detail + history");
  }

  {
    const r = await call("POST", "/api/v1/auth/register", {
      body: {
        email: "new.owner@example.com",
        password: "password99",
        firstName: "New",
        lastName: "Owner",
        organizationName: "Example Co",
      },
    });
    assert(r.status === 201 && r.json.organization.role === "owner", "register");
    var newbie = r.json;
  }

  {
    const r = await call("POST", `/api/v1/organizations/${newbie.organization.id}/members`, {
      token: newbie.accessToken,
      body: { email: "invitee@example.com", role: "executor" },
    });
    assert(r.status === 201 && r.json.inviteUrl, "invite member");
    var inviteToken = r.json.token;
  }

  {
    const r = await call("POST", `/api/v1/auth/invites/${inviteToken}/accept`, {
      body: { firstName: "Ivy", lastName: "Invitee", password: "password99" },
    });
    assert(r.status === 200 && r.json.accessToken, "accept invite");
  }

  {
    const r = await call("POST", "/api/v1/auth/forgot-password", { body: { email: "new.owner@example.com" } });
    assert(r.status === 200 && r.json.resetToken, "forgot password");
    const reset = await call("POST", "/api/v1/auth/reset-password", {
      body: { token: r.json.resetToken, password: "password00" },
    });
    assert(reset.status === 200 && reset.json.accessToken, "reset password");
  }

  {
    const r = await call("POST", "/api/v1/public/contact", {
      body: { name: "Pat", email: "pat@example.com", message: "How do I seal a contract?" },
    });
    assert(r.status === 201, "contact form");
  }

  {
    const r = await call("GET", `/api/v1/search?organizationId=${orgId}&q=dashboard`, { token: alex.accessToken });
    assert(r.status === 200 && r.json.total >= 1, "search");
  }

  {
    const r = await call("POST", `/api/v1/organizations/${orgId}/contracts/tc2/approve`, { token: alex.accessToken });
    assert(r.status === 200 && r.json.contract.status === "approved", "approve seeded submitted contract");
  }

  {
    const r = await call("GET", `/api/v1/organizations/${orgId}/contracts/tc1/export`, { token: alex.accessToken });
    assert(r.status === 200 && r.json.contract, "export ledger");
  }

  {
    const r = await call("POST", "/api/v1/auth/2fa/setup", { token: alex.accessToken });
    assert(r.status === 200 && r.json.secret, "2fa setup");
  }

  if (fails) {
    console.error(`\n${fails} failed`);
    process.exit(1);
  }
  console.log("\nAll Worker API checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
