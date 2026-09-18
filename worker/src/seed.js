import { hashPassword, nowIso } from "./crypto.js";
import { one, run } from "./db.js";

const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
const daysAhead = (d) => new Date(Date.now() + d * 86400000).toISOString();
const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

export async function seedIfEmpty(env) {
  const row = await one(env.DB, "SELECT COUNT(*) AS c FROM users");
  if (row && Number(row.c) > 0) return { seeded: false };
  await seed(env);
  return { seeded: true };
}

export async function seed(env) {
  const password = await hashPassword("demo1234");
  const year = new Date().getFullYear();
  const db = env.DB;

  const users = [
    ["u1", "alex.morgan@northwind.studio", "Alex", "Morgan", "Delivery Manager"],
    ["u2", "sarah.chen@northwind.studio", "Sarah", "Chen", "Product Designer"],
    ["u3", "james.wilson@northwind.studio", "James", "Wilson", "Senior Engineer"],
    ["u4", "maria.garcia@northwind.studio", "Maria", "Garcia", "Marketing Lead"],
    ["u5", "david.kim@northwind.studio", "David", "Kim", "Engineering Director"],
    ["u6", "emma.jones@northwind.studio", "Emma", "Jones", "Security Engineer"],
  ];
  const t = nowIso();
  for (const [id, email, first, last, title] of users) {
    await run(
      db,
      `INSERT INTO users (id, email, password_hash, first_name, last_name, title, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      id,
      email,
      password,
      first,
      last,
      title,
      daysAgo(200),
      t
    );
    await run(
      db,
      `INSERT INTO notification_prefs (user_id, contract_assigned, status_changed, deadline_reminder, comments, email_digest)
       VALUES (?, 1, 1, 1, 1, 0)`,
      id
    );
  }

  await run(
    db,
    `INSERT INTO organizations (id, name, slug, plan_type, branding, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    "org1",
    "Northwind Studio",
    "northwind",
    "pro",
    JSON.stringify({ primaryColor: "#4F5BD5", accentColor: "#D9A441" }),
    JSON.stringify({ timezone: "UTC" }),
    daysAgo(220),
    t
  );
  await run(
    db,
    `INSERT INTO organizations (id, name, slug, plan_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    "org2",
    "Morgan Consulting",
    "morgan-consulting",
    "free",
    daysAgo(400),
    t
  );

  const memberships = [
    ["m1", "org1", "u1", "manager", 210],
    ["m2", "org1", "u2", "executor", 180],
    ["m3", "org1", "u3", "executor", 165],
    ["m4", "org1", "u4", "executor", 150],
    ["m5", "org1", "u5", "admin", 200],
    ["m6", "org1", "u6", "executor", 90],
    ["m7", "org2", "u1", "owner", 400],
  ];
  for (const [id, org, user, role, ago] of memberships) {
    await run(
      db,
      `INSERT INTO memberships (id, organization_id, user_id, role, status, joined_at) VALUES (?, ?, ?, ?, 'active', ?)`,
      id,
      org,
      user,
      role,
      daysAgo(ago)
    );
  }

  const cats = [
    ["c1", "org1", "Design", "#8B5CF6", "Product & brand design work"],
    ["c2", "org1", "Engineering", "#4F5BD5", "Software engineering tasks"],
    ["c3", "org1", "Marketing", "#D9A441", "Campaigns, content & growth"],
    ["c4", "org1", "Operations", "#0F9D6E", "Process & logistics"],
    ["c5", "org1", "Research", "#D6577E", "Discovery & user research"],
    ["c6", "org2", "Client Work", "#4F5BD5", "Client deliverables"],
  ];
  for (const [id, org, name, color, desc] of cats) {
    await run(
      db,
      `INSERT INTO categories (id, organization_id, name, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      org,
      name,
      color,
      desc,
      daysAgo(180)
    );
  }

  await run(db, `INSERT INTO org_sequences (organization_id, next_number) VALUES ('org1', 48)`);
  await run(db, `INSERT INTO org_sequences (organization_id, next_number) VALUES ('org2', 128)`);

  const contracts = [
    {
      id: "tc1",
      org: "org1",
      number: `TCP-${year}-00042`,
      title: "Redesign Customer Dashboard UI",
      description:
        "Complete redesign of the customer-facing dashboard: new data-visualization components, improved navigation structure and a responsive mobile layout. Must follow brand guidelines v3.2 and pass the accessibility review before hand-off.",
      status: "in_progress",
      priority: "high",
      initiator: "u1",
      executor: "u2",
      observers: ["u6"],
      category: "c1",
      tags: ["ui", "dashboard", "redesign"],
      deadline: daysAhead(6),
      created: daysAgo(14),
      updated: hoursAgo(3),
      sent: daysAgo(14),
      accepted: daysAgo(13),
      progress: 55,
    },
    {
      id: "tc2",
      org: "org1",
      number: `TCP-${year}-00043`,
      title: "API Integration for Payment Gateway",
      description:
        "Integrate Stripe as the primary payment provider: tokenised checkout, webhook handling with idempotency keys, and reconciliation reporting. Sandbox credentials are in the shared vault.",
      status: "submitted",
      priority: "critical",
      initiator: "u1",
      executor: "u3",
      observers: ["u5"],
      category: "c2",
      tags: ["payments", "api", "stripe"],
      deadline: daysAhead(1),
      created: daysAgo(21),
      updated: daysAgo(1),
      sent: daysAgo(21),
      accepted: daysAgo(20),
      submitted: daysAgo(1),
      progress: 100,
    },
    {
      id: "tc3",
      org: "org1",
      number: `TCP-${year}-00044`,
      title: "Content Strategy for Q2 Campaign",
      description:
        "Deliver a complete content strategy for the Q2 product launch: audience segmentation, channel plan, editorial calendar and 6 pillar pieces with briefs for external writers.",
      status: "sent",
      priority: "medium",
      initiator: "u5",
      executor: "u4",
      observers: [],
      category: "c3",
      tags: ["content", "strategy", "q2"],
      deadline: daysAhead(21),
      created: daysAgo(2),
      updated: daysAgo(2),
      sent: daysAgo(2),
      progress: 0,
    },
    {
      id: "tc4",
      org: "org1",
      number: `TCP-${year}-00045`,
      title: "Security Audit — Authentication Module",
      description:
        "Third-party style audit of the authentication module: session lifecycle, password policy, brute-force protection and token storage. Produce findings report with severity ratings and a remediation plan.",
      status: "approved",
      priority: "high",
      initiator: "u1",
      executor: "u6",
      observers: [],
      category: "c2",
      tags: ["security", "audit", "auth"],
      deadline: daysAgo(9),
      created: daysAgo(38),
      updated: daysAgo(8),
      sent: daysAgo(38),
      accepted: daysAgo(37),
      submitted: daysAgo(9),
      approved: daysAgo(8),
      progress: 100,
    },
    {
      id: "tc5",
      org: "org1",
      number: `TCP-${year}-00046`,
      title: "User Research — Onboarding Flow",
      description:
        "Run 8 moderated sessions on the new onboarding flow. Deliver synthesis, journey map and a prioritised list of fixes. Include recordings (consented) in the hand-off folder.",
      status: "draft",
      priority: "low",
      initiator: "u1",
      executor: null,
      observers: [],
      category: "c5",
      tags: ["research", "onboarding"],
      deadline: daysAhead(30),
      created: daysAgo(1),
      updated: daysAgo(1),
      progress: 0,
    },
    {
      id: "tc6",
      org: "org1",
      number: `TCP-${year}-00047`,
      title: "Database Migration to PostgreSQL 16",
      description:
        "Plan and execute the migration of the analytics warehouse to PostgreSQL 16. Includes zero-downtime cutover, rollback plan, and updated runbooks. Maintenance window: first Sunday 02:00 UTC.",
      status: "rejected",
      priority: "high",
      initiator: "u5",
      executor: "u3",
      observers: [],
      category: "c2",
      tags: ["database", "migration", "infra"],
      deadline: daysAgo(3),
      created: daysAgo(16),
      updated: daysAgo(2),
      sent: daysAgo(16),
      accepted: daysAgo(15),
      submitted: daysAgo(2),
      progress: 90,
    },
    {
      id: "tc7",
      org: "org2",
      number: `TCP-${year - 1}-00127`,
      title: "Mobile App Performance Optimization",
      description:
        "Optimise the mobile app to reach the agreed targets: cold start < 2s, TTI < 3.5s on mid-range Android, and a 30% bundle-size reduction.",
      status: "archived",
      priority: "medium",
      initiator: "u1",
      executor: "u3",
      observers: ["u5"],
      category: "c6",
      tags: ["mobile", "performance"],
      deadline: daysAgo(60),
      created: daysAgo(120),
      updated: daysAgo(58),
      sent: daysAgo(120),
      accepted: daysAgo(119),
      submitted: daysAgo(61),
      approved: daysAgo(59),
      progress: 100,
    },
  ];

  for (const c of contracts) {
    await run(
      db,
      `INSERT INTO contracts (
        id, organization_id, contract_number, title, current_description, current_deadline, current_priority,
        current_status, progress, initiator_id, responsible_executor_id, category_id, tags, current_version,
        is_deleted, created_at, updated_at, sent_at, accepted_at, submitted_at, approved_at, completed_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      c.id,
      c.org,
      c.number,
      c.title,
      c.description,
      c.deadline || null,
      c.priority,
      c.status,
      c.progress,
      c.initiator,
      c.executor,
      c.category,
      JSON.stringify(c.tags),
      c.created,
      c.updated,
      c.sent || null,
      c.accepted || null,
      c.submitted || null,
      c.approved || null,
      c.approved || null,
      c.status === "archived" ? c.updated : null
    );

    await run(
      db,
      `INSERT INTO contract_versions (id, contract_id, version_number, title, description, deadline, priority, change_reason, changed_by, changed_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, 'Initial creation', ?, ?)`,
      `v-${c.id}-1`,
      c.id,
      c.title,
      c.description,
      c.deadline || null,
      c.priority,
      c.initiator,
      c.created
    );

    await run(
      db,
      `INSERT INTO contract_participants (id, contract_id, user_id, role, is_lead, status, accepted_at)
       VALUES (?, ?, ?, 'initiator', 1, 'active', ?)`,
      `p-${c.id}-i`,
      c.id,
      c.initiator,
      c.created
    );
    if (c.executor) {
      await run(
        db,
        `INSERT INTO contract_participants (id, contract_id, user_id, role, is_lead, status, accepted_at)
         VALUES (?, ?, ?, 'executor', 1, ?, ?)`,
        `p-${c.id}-e`,
        c.id,
        c.executor,
        c.accepted ? "active" : c.sent ? "pending" : "pending",
        c.accepted || null
      );
    }
    for (const obs of c.observers || []) {
      await run(
        db,
        `INSERT INTO contract_participants (id, contract_id, user_id, role, is_lead, status, accepted_at)
         VALUES (?, ?, ?, 'observer', 0, 'active', ?)`,
        `p-${c.id}-o-${obs}`,
        c.id,
        obs,
        c.created
      );
    }
  }

  await run(
    db,
    `INSERT INTO contract_versions (id, contract_id, version_number, title, description, deadline, priority, change_reason, changed_by, changed_at)
     VALUES ('v-tc1-2', 'tc1', 2, 'Redesign Customer Dashboard UI', ?, ?, 'high', 'Added revenue overview screen after finance stakeholder review', 'u1', ?)`,
    "Complete redesign of the customer-facing dashboard: new data-visualization components, improved navigation structure and a responsive mobile layout. Must follow brand guidelines v3.2 and pass the accessibility review before hand-off. Scope expanded to include the revenue overview screen requested by finance.",
    daysAhead(6),
    daysAgo(9)
  );
  await run(db, `UPDATE contracts SET current_version = 2, current_description = ? WHERE id = 'tc1'`, 
    "Complete redesign of the customer-facing dashboard: new data-visualization components, improved navigation structure and a responsive mobile layout. Must follow brand guidelines v3.2 and pass the accessibility review before hand-off. Scope expanded to include the revenue overview screen requested by finance."
  );

  const interactions = [
    ["ix-1", "tc1", "u1", "system_note", "Contract created and sent to Sarah Chen.", null, "draft", "sent", daysAgo(14)],
    ["ix-2", "tc1", "u2", "comment", "Reviewed the scope. The mobile breakpoints in the brief are a bit ambiguous — assuming 375/768/1440, will confirm before the hi-fi pass.", null, null, null, daysAgo(13)],
    ["ix-3", "tc1", "u2", "progress_update", "Wireframes complete for desktop and mobile. Moving into high-fidelity designs now.", 55, null, null, hoursAgo(3)],
    ["ix-4", "tc1", "u1", "comment", "Great pace. Please prioritise the revenue overview — finance want to see it first.", null, null, null, hoursAgo(2)],
    ["ix-5", "tc2", "u1", "system_note", "Contract created and sent to James Wilson.", null, "draft", "sent", daysAgo(21)],
    ["ix-6", "tc2", "u3", "scope_proposal", "Proposing a small scope addition: idempotent retry handling for webhooks (≈ half a day). Strongly recommended for production safety.", null, null, null, daysAgo(15)],
    ["ix-7", "tc2", "u1", "comment", "Approved — fold it into this contract, no deadline change needed.", null, null, null, daysAgo(14)],
    ["ix-8", "tc2", "u3", "submission", "Integration complete: checkout, webhooks with idempotency and reconciliation report are all live in sandbox. Ready for review.", 100, "in_progress", "submitted", daysAgo(1)],
    ["ix-9", "tc3", "u5", "system_note", "Contract created and sent to Maria Garcia.", null, "draft", "sent", daysAgo(2)],
    ["ix-10", "tc4", "u6", "issue_report", "Found a session-fixation vector in the refresh flow — flagged as HIGH in the report. Mitigation available immediately.", null, null, null, daysAgo(12)],
    ["ix-11", "tc4", "u6", "submission", "Audit complete. 2 critical, 5 high, 9 medium findings with a phased remediation plan.", 100, "in_progress", "submitted", daysAgo(9)],
    ["ix-12", "tc4", "u1", "approval", "Excellent report. Remediation plan accepted — phase 1 work is being contracted separately.", null, "submitted", "approved", daysAgo(8)],
    ["ix-13", "tc6", "u3", "submission", "Migration plan complete with rehearsed rollback. Requesting sign-off.", 90, "in_progress", "submitted", daysAgo(2)],
    ["ix-14", "tc6", "u5", "rejection", "The rollback runbook misses the read-replica resync step. Please add it and resubmit.", null, "submitted", "rejected", daysAgo(2)],
    ["ix-15", "tc7", "u1", "approval", "All performance targets verified in production. Contract closed.", null, "submitted", "approved", daysAgo(59)],
  ];
  for (const [id, cid, author, type, content, prog, from, to, at] of interactions) {
    await run(
      db,
      `INSERT INTO contract_interactions (id, contract_id, author_id, interaction_type, content, progress_percentage, status_change_from, status_change_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      cid,
      author,
      type,
      content,
      prog,
      from,
      to,
      at
    );
  }

  const notes = [
    ["n1", "u1", "org1", "submission", "Contract submitted for review", "James Wilson submitted TCP-00043 “API Integration for Payment Gateway” for your review.", "tc2", 0, daysAgo(1)],
    ["n2", "u1", "org1", "progress", "Progress update", "Sarah Chen updated progress on “Redesign Customer Dashboard UI” to 55%.", "tc1", 0, hoursAgo(3)],
    ["n3", "u1", "org1", "deadline", "Deadline approaching", "TCP-00043 is due in 1 day.", "tc2", 0, hoursAgo(6)],
    ["n4", "u1", "org1", "comment", "New comment", "Sarah Chen commented on “Redesign Customer Dashboard UI”.", "tc1", 1, daysAgo(13)],
    ["n5", "u1", "org1", "approval", "Contract approved", "“Security Audit — Authentication Module” was approved and archived to the ledger.", "tc4", 1, daysAgo(8)],
    ["n6", "u2", "org1", "comment", "New comment", "Alex Morgan commented on “Redesign Customer Dashboard UI”.", "tc1", 0, hoursAgo(2)],
    ["n7", "u4", "org1", "contract_sent", "New contract assigned", "Please review and accept “Content Strategy for Q2 Campaign”.", "tc3", 0, daysAgo(2)],
  ];
  for (const [id, user, org, type, title, content, cid, read, at] of notes) {
    await run(
      db,
      `INSERT INTO notifications (id, user_id, organization_id, type, title, content, contract_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      user,
      org,
      type,
      title,
      content,
      cid,
      read,
      at
    );
  }

  console.log("[seed] Northwind Studio workspace ready — alex.morgan@northwind.studio / demo1234");
}
