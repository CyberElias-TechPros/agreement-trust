package com.taskcontract.android.ui.screens

import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import com.taskcontract.android.MainActivity
import com.taskcontract.android.Screen
import com.taskcontract.android.core.Async
import com.taskcontract.android.core.Bus
import com.taskcontract.android.domain.*
import com.taskcontract.android.ui.*

/** Home: greeting, key numbers, needs-attention queue, recent contracts & activity. */
class DashboardScreen(a: MainActivity) : Screen(a) {
    private lateinit var bodyRoot: LinearLayout

    init {
        build()
        listen(Bus.DATA_CHANGED) { build() }
        listen(Bus.SESSION_CHANGED) { build() }
        listen(Bus.NOTIFICATIONS_CHANGED) { build() }
    }

    private fun build() {
        removeAllViews()
        val sv = scroll { bodyRoot = this; render(this) }
        addView(sv, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        // refresh server mirror in background
        if (repo.isServer) Async.run({ repo.refreshAll() }, {})
    }

    private fun render(root: LinearLayout) {
        val user = repo.user() ?: return
        val org = repo.currentOrg()
        val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        val greeting = when { hour < 12 -> "Good morning"; hour < 17 -> "Good afternoon"; else -> "Good evening" }

        // Top bar
        root.add(row {
            add(col {
                add(text("$greeting,", 13f, p.muted, 500))
                add(text(user.firstName.ifEmpty { "there" } + ".", 26f, p.fg, 700, font = "display"))
            }.weight(1f))
            add(orgSwitcher(org))
            add(notificationBell())
        }.apply { pad(b = 4) })
        org?.let { root.add(text("${it.first.name} · ${it.second.label}", 12f, p.brass, 600).apply { pad(b = 14) }) }

        // Sync banner (server mode)
        if (repo.isServer) {
            val pending = repo.outboxCount()
            if (pending > 0) {
                root.add(row {
                    add(text("⟳", 15f, p.warning, 700))
                    add(text("$pending change${if (pending == 1) "" else "s"} waiting to sync", 12.5f, p.warning, 600).apply { pad(l = 8) }.weight(1f))
                    add(text("Sync now", 12.5f, p.primary, 700).apply { setOnClickListener { repo.syncIfNeeded(); Dialogs.toast(context, "Syncing…") } })
                }.apply {
                    background = Shapes.round(p.warningSoft, 12f)
                    padAll(12)
                    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(12) }
                })
            }
        }

        Async.run({ repo.analytics() }, { r ->
            r.onFailure { /* not signed into org yet */ }
            r.onSuccess { an -> renderStats(root, an) }
        })

        // Quick action
        root.add(row {
            add(button("New contract", p, "primary", icon = "+") { activity.nav.push(CreateContractScreen(activity)) }.weight(1f))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(10), 1) })
            add(button("Search", p, "outline", icon = "⌕") { activity.nav.push(SearchScreen(activity)) }.weight(1f))
        }.apply { pad(t = 16) })

        // Needs attention
        Async.run({
            val all = repo.contracts()
            val now = System.currentTimeMillis()
            val mine = repo.userId
            val attention = all.filter { c ->
                (c.status == Status.SUBMITTED && Rules.canPerform(Action.APPROVE, repo.role(), c, mine)) ||
                (c.status == Status.SENT && c.executorId == mine) ||
                (c.status == Status.ACCEPTED && c.executorId == mine) ||
                c.isOverdue(now)
            }.sortedBy { Time.parseIso(it.deadline) ?: Long.MAX_VALUE }
            attention
        }, { r ->
            r.onSuccess { attention ->
                if (attention.isNotEmpty()) {
                    root.add(sectionHeader("Needs your attention", p, "${attention.size}"))
                    val list = col {}
                    root.add(list)
                    for (c in attention.take(4)) list.add(attentionRow(c))
                    if (attention.size > 4) root.add(text("View all ${attention.size} →", 13f, p.primary, 600).apply {
                        pad(t = 6)
                        setOnClickListener { activity.nav.push(ContractsScreen(activity)) }
                    })
                }
            }
        })

        // Recent contracts
        root.add(sectionHeader("Recent contracts", p, "View all") { activity.nav.push(ContractsScreen(activity)) })
        val recentList = col {}
        root.add(recentList)
        Async.run({ repo.analytics().recent }, { r ->
            r.onSuccess { recent ->
                recentList.removeAllViews()
                if (recent.isEmpty()) recentList.add(emptyState("▤", "No contracts yet", "Create your first agreement to get started.", p, "New contract") { activity.nav.push(CreateContractScreen(activity)) })
                for (c in recent) recentList.add(contractRow(c))
            }
        })

        // Recent activity from notifications
        root.add(sectionHeader("Recent activity", p, "All") { activity.nav.push(NotificationsScreen(activity)) })
        val actList = col {}
        root.add(actList)
        Async.run({ repo.notifications().take(4) }, { r ->
            r.onSuccess { notes ->
                actList.removeAllViews()
                if (notes.isEmpty()) actList.add(text("No activity yet.", 13f, p.faint, 400).apply { pad(t = 4, b = 8) })
                for (n in notes) {
                    actList.add(row {
                        add(text(if (n.read) "·" else "●", 12f, if (n.read) p.faint else p.brass, 700).apply { pad(r = 10, t = 2) })
                        add(col {
                            add(text(n.title, 13.5f, p.fg, if (n.read) 500 else 700))
                            add(text(n.content, 12.5f, p.muted, 400, maxLines = 2).apply { pad(t = 2) })
                        }.weight(1f))
                        add(text(Time.relative(n.createdAt), 11f, p.faint, 500))
                    }.apply {
                        pad(2, 9, 2, 9)
                        setOnClickListener {
                            repo.markRead(n.id)
                            if (n.contractId != null) activity.nav.push(ContractDetailScreen(activity, n.contractId))
                            else activity.nav.push(NotificationsScreen(activity))
                        }
                    })
                }
            }
        })
        root.fadeSlideIn()
    }

    private fun renderStats(root: LinearLayout, an: com.taskcontract.android.data.LocalEngine.Analytics) {
        // Insert stats grid right after the header block (index varies with banner) — find quick action row
        val grid = col {
            add(row {
                add(statCard("Active", an.active, p.primary, "◔").weight(1f))
                add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(10), 1) })
                add(statCard("To review", an.pendingReview, p.status(Status.SUBMITTED), "⚑").weight(1f))
            })
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(10)) })
            add(row {
                add(statCard("Overdue", an.overdue, if (an.overdue > 0) p.danger else p.muted, "⚠").weight(1f))
                add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(10), 1) })
                add(statCard("Sealed", an.completed, p.success, "◈").weight(1f))
            })
        }
        // place before quick actions: find index of first row containing buttons — simpler: add at position after header texts
        val insertAt = Math.min(2 + (if (repo.isServer && repo.outboxCount() > 0) 1 else 0), root.childCount)
        root.addView(grid, insertAt)
    }

    private fun statCard(label: String, value: Int, color: Int, glyph: String): LinearLayout =
        card(p, 16f) {
            add(row {
                add(text(glyph, 15f, color, 600))
                add(text(label.uppercase(), 10.5f, p.muted, 700).apply { letterSpacing = 0.07f; pad(l = 7) })
            })
            val v = text("0", 27f, p.fg, 700, font = "display").apply { pad(t = 8) }
            add(v)
            v.countUp(value)
        }.apply { padAll(14) }

    private fun orgSwitcher(org: Pair<Organization, Role>?): View {
        val orgs = repo.orgs()
        return text("⇄", 18f, p.muted, 600, align = Gravity.CENTER).apply {
            contentDescription = "Switch organization"
            minimumWidth = Ui.dp(42); minimumHeight = Ui.dp(42); gravity = Gravity.CENTER
            background = Shapes.ripple(Shapes.oval(Color0()), null, Palette.withAlpha(p.fg, 0.08f))
            setOnClickListener {
                if (orgs.size <= 1) {
                    Dialogs.toast(context, "You're in ${org?.first?.name ?: "one organization"} — create another from Settings")
                    return@setOnClickListener
                }
                Dialogs.pick(context, p, "Switch organization", orgs, { "${it.first.name}  ·  ${it.second.label}" }, { it.first.id == repo.session.orgId }) { picked ->
                    repo.session.switchOrg(picked.first.id)
                    Bus.emit(Bus.SESSION_CHANGED)
                }
            }
        }
    }

    private fun Color0() = android.graphics.Color.TRANSPARENT

    private fun notificationBell(): View {
        val unread = repo.unreadCount()
        return frame {
            add(text("♢", 20f, p.fg, 500, align = Gravity.CENTER).apply {
                minimumWidth = Ui.dp(42); minimumHeight = Ui.dp(42); gravity = Gravity.CENTER
                contentDescription = "Notifications"
                setOnClickListener { activity.nav.push(NotificationsScreen(activity)) }
            })
            if (unread > 0) add(text(if (unread > 9) "9+" else "$unread", 9f, android.graphics.Color.WHITE, 700, align = Gravity.CENTER).apply {
                background = Shapes.oval(p.danger)
                minimumWidth = Ui.dp(16); minimumHeight = Ui.dp(16); gravity = Gravity.CENTER
                layoutParams = android.widget.FrameLayout.LayoutParams(Ui.dp(17), Ui.dp(17), Gravity.END or Gravity.TOP).apply { topMargin = Ui.dp(4); rightMargin = Ui.dp(2) }
            })
        }
    }

    private fun attentionRow(c: Contract): LinearLayout {
        val now = System.currentTimeMillis()
        val reason = when {
            c.isOverdue(now) -> "Overdue" to p.danger
            c.status == Status.SUBMITTED -> "Awaiting your review" to p.status(Status.SUBMITTED)
            c.status == Status.SENT -> "Awaiting your acceptance" to p.status(Status.SENT)
            else -> "Ready to start" to p.status(Status.ACCEPTED)
        }
        return clickableCard(p, 16f, { activity.nav.push(ContractDetailScreen(activity, c.id)) }) {
            add(row {
                add(text(reason.first.uppercase(), 10f, reason.second, 700).apply { letterSpacing = 0.07f }.weight(1f))
                add(text(Time.deadlineLabel(c.deadline, now).first, 11f, if (c.isOverdue(now)) p.danger else p.muted, 600))
            })
            add(text(c.title, 15.5f, p.fg, 600, maxLines = 1).apply { pad(t = 6) })
            add(text(c.contractNumber, 11f, p.faint, 500, font = "mono").apply { pad(t = 3) })
        }.apply {
            padAll(14)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(8) }
        }
    }

    private fun contractRow(c: Contract): LinearLayout = contractListRow(context, c, p, repo) {
        activity.nav.push(ContractDetailScreen(activity, c.id))
    }.apply {
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(8) }
    }
}

/** Shared contract row used by Dashboard / Contracts / Search. */
fun contractListRow(context: android.content.Context, c: Contract, p: Palette, repo: com.taskcontract.android.data.Repository, onClick: () -> Unit): LinearLayout {
    val executor = c.executorId?.let { repo.engine.getUser(it) }
    return context.clickableCard(p, 16f, onClick) {
        add(row {
            add(statusBadge(c.status, p))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) })
            add(priorityBadge(c.priority, p))
        })
        add(text(c.title, 15.5f, p.fg, 600, maxLines = 2).apply { pad(t = 9) })
        add(row {
            add(text(c.contractNumber, 10.5f, p.faint, 500, font = "mono").weight(1f))
            val (label, urgent) = Time.deadlineLabel(c.deadline)
            add(text(label, 11f, if (urgent) p.danger else p.muted, 600))
        }.apply { pad(t = 5) })
        if (!c.isTerminal && c.status != Status.DRAFT && c.status != Status.SENT) {
            add(row {
                add(progressBar(c.progress, p, p.status(c.status)).weight(1f))
                add(text("${c.progress}%", 11f, p.muted, 600, font = "mono").apply { pad(l = 8) })
            }.apply { pad(t = 10) })
        }
        executor?.let {
            add(row {
                add(avatar(it, p, 20))
                add(text(it.name, 11.5f, p.muted, 500).apply { pad(l = 6) })
            }.apply { pad(t = 9) })
        }
    }.apply { padAll(14) }
}
