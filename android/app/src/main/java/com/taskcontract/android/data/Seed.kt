package com.taskcontract.android.data

import com.taskcontract.android.core.Crypto
import com.taskcontract.android.core.Json
import com.taskcontract.android.domain.Time

/**
 * Seeds the Northwind Studio demo workspace — the same dataset as the web
 * demo and the backend seed, so the experience is identical across surfaces.
 * Demo sign-in: alex.morgan@northwind.studio / demo1234
 */
object Seed {
    const val DEMO_EMAIL = "alex.morgan@northwind.studio"
    const val DEMO_PASSWORD = "demo1234"

    @Synchronized
    fun seedIfEmpty(db: Db) {
        if ((db.one("SELECT COUNT(*) AS c FROM users")?.int("c") ?: 0) > 0) return
        seed(db)
    }

    fun seed(db: Db) {
        val password = Crypto.hashPassword(DEMO_PASSWORD)
        val year = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
        fun daysAgo(d: Int) = Time.toIso(System.currentTimeMillis() - d * 86400_000L)
        fun daysAhead(d: Int) = Time.toIso(System.currentTimeMillis() + d * 86400_000L)
        fun hoursAgo(h: Int) = Time.toIso(System.currentTimeMillis() - h * 3600_000L)
        val t = Time.nowIso()

        db.tx { d ->
            val users = listOf(
                Triple("u1", "alex.morgan@northwind.studio", "Alex" to "Morgan") to "Delivery Manager",
                Triple("u2", "sarah.chen@northwind.studio", "Sarah" to "Chen") to "Product Designer",
                Triple("u3", "james.wilson@northwind.studio", "James" to "Wilson") to "Senior Engineer",
                Triple("u4", "maria.garcia@northwind.studio", "Maria" to "Garcia") to "Marketing Lead",
                Triple("u5", "david.kim@northwind.studio", "David" to "Kim") to "Engineering Director",
                Triple("u6", "emma.jones@northwind.studio", "Emma" to "Jones") to "Security Engineer",
            )
            for ((u, title) in users) {
                d.insert("users", null, cv(
                    "id" to u.first, "email" to u.second, "password_hash" to password,
                    "first_name" to u.third.first, "last_name" to u.third.second, "title" to title,
                    "created_at" to daysAgo(200), "updated_at" to t
                ))
                d.insert("notification_prefs", null, cv("user_id" to u.first))
            }

            d.insert("organizations", null, cv("id" to "org1", "name" to "Northwind Studio", "slug" to "northwind", "plan_type" to "pro", "created_at" to daysAgo(220), "updated_at" to t))
            d.insert("organizations", null, cv("id" to "org2", "name" to "Morgan Consulting", "slug" to "morgan-consulting", "plan_type" to "free", "created_at" to daysAgo(400), "updated_at" to t))

            val memberships = listOf(
                listOf("m1", "org1", "u1", "manager", "210"), listOf("m2", "org1", "u2", "executor", "180"),
                listOf("m3", "org1", "u3", "executor", "165"), listOf("m4", "org1", "u4", "executor", "150"),
                listOf("m5", "org1", "u5", "admin", "200"), listOf("m6", "org1", "u6", "executor", "90"),
                listOf("m7", "org2", "u1", "owner", "400")
            )
            for (m in memberships) {
                d.insert("memberships", null, cv("id" to m[0], "organization_id" to m[1], "user_id" to m[2], "role" to m[3], "status" to "active", "joined_at" to daysAgo(m[4].toInt())))
            }

            val cats = listOf(
                listOf("c1", "org1", "Design", "#875CEB", "Product & brand design work"),
                listOf("c2", "org1", "Engineering", "#4C58D6", "Software engineering tasks"),
                listOf("c3", "org1", "Marketing", "#D5A034", "Campaigns, content & growth"),
                listOf("c4", "org1", "Operations", "#0F956A", "Process & logistics"),
                listOf("c5", "org1", "Research", "#D6577E", "Discovery & user research"),
                listOf("c6", "org2", "Client Work", "#4C58D6", "Client deliverables")
            )
            for (c in cats) {
                d.insert("categories", null, cv("id" to c[0], "organization_id" to c[1], "name" to c[2], "color" to c[3], "description" to c[4], "created_at" to daysAgo(180)))
            }
            d.insert("org_sequences", null, cv("organization_id" to "org1", "next_number" to 48))
            d.insert("org_sequences", null, cv("organization_id" to "org2", "next_number" to 128))

            data class C(val id: String, val org: String, val number: String, val title: String, val desc: String,
                         val status: String, val priority: String, val initiator: String, val executor: String?,
                         val observers: List<String>, val category: String, val tags: List<String>,
                         val deadline: String?, val created: String, val updated: String,
                         val sent: String?, val accepted: String?, val submitted: String?, val approved: String?, val progress: Int)

            val contracts = listOf(
                C("tc1", "org1", "TCP-$year-00042", "Redesign Customer Dashboard UI",
                    "Complete redesign of the customer-facing dashboard: new data-visualization components, improved navigation structure and a responsive mobile layout. Must follow brand guidelines v3.2 and pass the accessibility review before hand-off.",
                    "in_progress", "high", "u1", "u2", listOf("u6"), "c1", listOf("ui", "dashboard", "redesign"),
                    daysAhead(6), daysAgo(14), hoursAgo(3), daysAgo(14), daysAgo(13), null, null, 55),
                C("tc2", "org1", "TCP-$year-00043", "API Integration for Payment Gateway",
                    "Integrate Stripe as the primary payment provider: tokenised checkout, webhook handling with idempotency keys, and reconciliation reporting. Sandbox credentials are in the shared vault.",
                    "submitted", "critical", "u1", "u3", listOf("u5"), "c2", listOf("payments", "api", "stripe"),
                    daysAhead(1), daysAgo(21), daysAgo(1), daysAgo(21), daysAgo(20), daysAgo(1), null, 100),
                C("tc3", "org1", "TCP-$year-00044", "Content Strategy for Q2 Campaign",
                    "Deliver a complete content strategy for the Q2 product launch: audience segmentation, channel plan, editorial calendar and 6 pillar pieces with briefs for external writers.",
                    "sent", "medium", "u5", "u4", emptyList(), "c3", listOf("content", "strategy", "q2"),
                    daysAhead(21), daysAgo(2), daysAgo(2), daysAgo(2), null, null, null, 0),
                C("tc4", "org1", "TCP-$year-00045", "Security Audit — Authentication Module",
                    "Third-party style audit of the authentication module: session lifecycle, password policy, brute-force protection and token storage. Produce findings report with severity ratings and a remediation plan.",
                    "approved", "high", "u1", "u6", emptyList(), "c2", listOf("security", "audit", "auth"),
                    daysAgo(9), daysAgo(38), daysAgo(8), daysAgo(38), daysAgo(37), daysAgo(9), daysAgo(8), 100),
                C("tc5", "org1", "TCP-$year-00046", "User Research — Onboarding Flow",
                    "Run 8 moderated sessions on the new onboarding flow. Deliver synthesis, journey map and a prioritised list of fixes. Include recordings (consented) in the hand-off folder.",
                    "draft", "low", "u1", null, emptyList(), "c5", listOf("research", "onboarding"),
                    daysAhead(30), daysAgo(1), daysAgo(1), null, null, null, null, 0),
                C("tc6", "org1", "TCP-$year-00047", "Database Migration to PostgreSQL 16",
                    "Plan and execute the migration of the analytics warehouse to PostgreSQL 16. Includes zero-downtime cutover, rollback plan, and updated runbooks. Maintenance window: first Sunday 02:00 UTC.",
                    "rejected", "high", "u5", "u3", emptyList(), "c2", listOf("database", "migration", "infra"),
                    daysAgo(3), daysAgo(16), daysAgo(2), daysAgo(16), daysAgo(15), daysAgo(2), null, 90),
                C("tc7", "org2", "TCP-${year - 1}-00127", "Mobile App Performance Optimization",
                    "Optimise the mobile app to reach the agreed targets: cold start < 2s, TTI < 3.5s on mid-range Android, and a 30% bundle-size reduction.",
                    "archived", "medium", "u1", "u3", listOf("u5"), "c6", listOf("mobile", "performance"),
                    daysAgo(60), daysAgo(120), daysAgo(58), daysAgo(120), daysAgo(119), daysAgo(61), daysAgo(59), 100)
            )
            for (c in contracts) {
                d.insert("contracts", null, cv(
                    "id" to c.id, "organization_id" to c.org, "contract_number" to c.number,
                    "title" to c.title, "current_description" to c.desc, "current_deadline" to c.deadline,
                    "current_priority" to c.priority, "current_status" to c.status, "progress" to c.progress,
                    "initiator_id" to c.initiator, "responsible_executor_id" to c.executor, "category_id" to c.category,
                    "tags" to Json.write(c.tags), "current_version" to 1, "is_deleted" to 0,
                    "created_at" to c.created, "updated_at" to c.updated, "sent_at" to c.sent,
                    "accepted_at" to c.accepted, "submitted_at" to c.submitted, "approved_at" to c.approved,
                    "completed_at" to c.approved, "archived_at" to if (c.status == "archived") c.updated else null
                ))
                d.insert("contract_versions", null, cv(
                    "id" to "v-${c.id}-1", "contract_id" to c.id, "version_number" to 1, "title" to c.title,
                    "description" to c.desc, "deadline" to c.deadline, "priority" to c.priority,
                    "change_reason" to "Initial creation", "changed_by" to c.initiator, "changed_at" to c.created
                ))
                d.insert("contract_participants", null, cv("id" to "p-${c.id}-i", "contract_id" to c.id, "user_id" to c.initiator, "role" to "initiator", "is_lead" to 1, "status" to "active", "accepted_at" to c.created))
                if (c.executor != null) {
                    d.insert("contract_participants", null, cv("id" to "p-${c.id}-e", "contract_id" to c.id, "user_id" to c.executor, "role" to "executor", "is_lead" to 1, "status" to if (c.accepted != null) "active" else "pending", "accepted_at" to c.accepted))
                }
                for (obs in c.observers) {
                    d.insert("contract_participants", null, cv("id" to "p-${c.id}-o-$obs", "contract_id" to c.id, "user_id" to obs, "role" to "observer", "is_lead" to 0, "status" to "active", "accepted_at" to c.created))
                }
            }

            val v2desc = "Complete redesign of the customer-facing dashboard: new data-visualization components, improved navigation structure and a responsive mobile layout. Must follow brand guidelines v3.2 and pass the accessibility review before hand-off. Scope expanded to include the revenue overview screen requested by finance."
            d.insert("contract_versions", null, cv(
                "id" to "v-tc1-2", "contract_id" to "tc1", "version_number" to 2, "title" to "Redesign Customer Dashboard UI",
                "description" to v2desc, "deadline" to daysAhead(6), "priority" to "high",
                "change_reason" to "Added revenue overview screen after finance stakeholder review", "changed_by" to "u1", "changed_at" to daysAgo(9)
            ))
            d.update("contracts", cv("current_version" to 2, "current_description" to v2desc), "id = ?", arrayOf("tc1"))

            data class Ix(val id: String, val cid: String, val author: String, val type: String, val content: String,
                          val prog: Int?, val from: String?, val to: String?, val at: String)
            val interactions = listOf(
                Ix("ix-1", "tc1", "u1", "system_note", "Contract created and sent to Sarah Chen.", null, "draft", "sent", daysAgo(14)),
                Ix("ix-2", "tc1", "u2", "comment", "Reviewed the scope. The mobile breakpoints in the brief are a bit ambiguous — assuming 375/768/1440, will confirm before the hi-fi pass.", null, null, null, daysAgo(13)),
                Ix("ix-3", "tc1", "u2", "progress_update", "Wireframes complete for desktop and mobile. Moving into high-fidelity designs now.", 55, null, null, hoursAgo(3)),
                Ix("ix-4", "tc1", "u1", "comment", "Great pace. Please prioritise the revenue overview — finance want to see it first.", null, null, null, hoursAgo(2)),
                Ix("ix-5", "tc2", "u1", "system_note", "Contract created and sent to James Wilson.", null, "draft", "sent", daysAgo(21)),
                Ix("ix-6", "tc2", "u3", "scope_proposal", "Proposing a small scope addition: idempotent retry handling for webhooks (≈ half a day). Strongly recommended for production safety.", null, null, null, daysAgo(15)),
                Ix("ix-7", "tc2", "u1", "comment", "Approved — fold it into this contract, no deadline change needed.", null, null, null, daysAgo(14)),
                Ix("ix-8", "tc2", "u3", "submission", "Integration complete: checkout, webhooks with idempotency and reconciliation report are all live in sandbox. Ready for review.", 100, "in_progress", "submitted", daysAgo(1)),
                Ix("ix-9", "tc3", "u5", "system_note", "Contract created and sent to Maria Garcia.", null, "draft", "sent", daysAgo(2)),
                Ix("ix-10", "tc4", "u6", "issue_report", "Found a session-fixation vector in the refresh flow — flagged as HIGH in the report. Mitigation available immediately.", null, null, null, daysAgo(12)),
                Ix("ix-11", "tc4", "u6", "submission", "Audit complete. 2 critical, 5 high, 9 medium findings with a phased remediation plan.", 100, "in_progress", "submitted", daysAgo(9)),
                Ix("ix-12", "tc4", "u1", "approval", "Excellent report. Remediation plan accepted — phase 1 work is being contracted separately.", null, "submitted", "approved", daysAgo(8)),
                Ix("ix-13", "tc6", "u3", "submission", "Migration plan complete with rehearsed rollback. Requesting sign-off.", 90, "in_progress", "submitted", daysAgo(2)),
                Ix("ix-14", "tc6", "u5", "rejection", "The rollback runbook misses the read-replica resync step. Please add it and resubmit.", null, "submitted", "rejected", daysAgo(2)),
                Ix("ix-15", "tc7", "u1", "approval", "All performance targets verified in production. Contract closed.", null, "submitted", "approved", daysAgo(59))
            )
            for (i in interactions) {
                d.insert("contract_interactions", null, cv(
                    "id" to i.id, "contract_id" to i.cid, "author_id" to i.author, "interaction_type" to i.type,
                    "content" to i.content, "progress_percentage" to i.prog,
                    "status_change_from" to i.from, "status_change_to" to i.to, "created_at" to i.at
                ))
            }

            data class N(val id: String, val user: String, val type: String, val title: String, val content: String, val cid: String, val read: Boolean, val at: String)
            val notes = listOf(
                N("n1", "u1", "submission", "Contract submitted for review", "James Wilson submitted TCP-00043 “API Integration for Payment Gateway” for your review.", "tc2", false, daysAgo(1)),
                N("n2", "u1", "progress", "Progress update", "Sarah Chen updated progress on “Redesign Customer Dashboard UI” to 55%.", "tc1", false, hoursAgo(3)),
                N("n3", "u1", "deadline", "Deadline approaching", "TCP-00043 is due in 1 day.", "tc2", false, hoursAgo(6)),
                N("n4", "u1", "comment", "New comment", "Sarah Chen commented on “Redesign Customer Dashboard UI”.", "tc1", true, daysAgo(13)),
                N("n5", "u1", "approval", "Contract approved", "“Security Audit — Authentication Module” was approved and archived to the ledger.", "tc4", true, daysAgo(8)),
                N("n6", "u2", "comment", "New comment", "Alex Morgan commented on “Redesign Customer Dashboard UI”.", "tc1", false, hoursAgo(2)),
                N("n7", "u4", "contract_sent", "New contract assigned", "Please review and accept “Content Strategy for Q2 Campaign”.", "tc3", false, daysAgo(2))
            )
            for (n in notes) {
                d.insert("notifications", null, cv(
                    "id" to n.id, "user_id" to n.user, "organization_id" to "org1", "type" to n.type,
                    "title" to n.title, "content" to n.content, "contract_id" to n.cid, "read" to n.read, "created_at" to n.at
                ))
            }

            // A couple of audit entries so the ledger tab is alive in the demo
            fun au(id: String, cid: String, uid: String, action: String, prev: String?, next: String?, at: String) {
                d.insert("audit_logs", null, cv(
                    "id" to id, "organization_id" to "org1", "contract_id" to cid, "user_id" to uid,
                    "action" to action, "entity_type" to "contract", "entity_id" to cid,
                    "previous_state" to prev, "new_state" to next, "created_at" to at,
                    "checksum" to Crypto.sha256Hex("$action|$cid|$at|${prev ?: "{}"}")
                ))
            }
            au("au-1", "tc1", "u1", "contract_created", null, "{\"title\":\"Redesign Customer Dashboard UI\",\"status\":\"draft\"}", daysAgo(14))
            au("au-2", "tc1", "u1", "contract_send", "{\"status\":\"draft\"}", "{\"status\":\"sent\"}", daysAgo(14))
            au("au-3", "tc1", "u2", "contract_accept", "{\"status\":\"sent\"}", "{\"status\":\"in_progress\"}", daysAgo(13))
            au("au-4", "tc2", "u3", "contract_submit", "{\"status\":\"in_progress\"}", "{\"status\":\"submitted\"}", daysAgo(1))
            au("au-5", "tc4", "u1", "contract_approve", "{\"status\":\"submitted\"}", "{\"status\":\"approved\"}", daysAgo(8))
        }
    }
}
