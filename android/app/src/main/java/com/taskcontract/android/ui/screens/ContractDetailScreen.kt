package com.taskcontract.android.ui.screens

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import com.taskcontract.android.MainActivity
import com.taskcontract.android.Screen
import com.taskcontract.android.core.Async
import com.taskcontract.android.core.Bus
import com.taskcontract.android.domain.*
import com.taskcontract.android.platform.ExportProvider
import com.taskcontract.android.ui.*

/**
 * Contract detail: header + seal, lifecycle actions, tabbed body
 * (Overview / Activity / Versions / Participants / Audit), composer with
 * typed interactions and a progress slider. Mirrors ContractDetail.tsx.
 */
class ContractDetailScreen(a: MainActivity, val contractId: String) : Screen(a) {
    private var tab = "overview"
    private var full: ContractFull? = null
    private lateinit var headerArea: LinearLayout
    private lateinit var actionsArea: LinearLayout
    private lateinit var tabsRow: android.widget.HorizontalScrollView
    private lateinit var bodyArea: LinearLayout
    private var sealShown = false

    companion object { const val REQ_ATTACH = 61 }
    private var pendingAttachPick = false

    init {
        val root = col {
            add(row {
                pad(8, 10, 8, 10)
                add(iconButton("←", p, 22f, "Back") { activity.nav.pop() })
                add(text("Contract", 18f, p.fg, 700, font = "display").weight(1f).apply { pad(l = 4) })
                add(iconButton("⋯", p, 20f, "More") { moreMenu() })
            })
            add(View(context).apply { setBackgroundColor(p.border) }, ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(1))
            val sv = scroll {
                headerArea = col {}
                add(headerArea)
                actionsArea = col {}
                add(actionsArea)
                tabsRow = hscroll { }
                add(tabsRow.apply { pad(t = 8, b = 2) })
                bodyArea = col {}
                add(bodyArea)
                pad(16, 6, 16, 28)
            }
            add(sv, ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        addView(root, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        listen(Bus.DATA_CHANGED) { load() }
        load()
        if (repo.isServer) Async.run({ repo.refreshContractDetail(contractId) }, {})
    }

    fun onPickAttachment(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQ_ATTACH || resultCode != Activity.RESULT_OK) return
        val uri = data?.data ?: return
        Async.run({ repo.attachFile(contractId, uri) }, { r ->
            r.onFailure { Dialogs.error(context, it) }
            r.onSuccess { Dialogs.toast(context, "Attached ${it.filename}") }
        })
    }

    private fun load() {
        Async.run({ repo.contract(contractId) }, { r ->
            r.onFailure { e ->
                headerArea.removeAllViews()
                headerArea.add(emptyState("✕", "Unavailable", e.message ?: "Contract not found.", p))
            }
            r.onSuccess { f ->
                if (f == null) {
                    headerArea.removeAllViews()
                    headerArea.add(emptyState("✕", "Not found", "This contract doesn't exist or you don't have access.", p))
                } else {
                    full = f
                    renderHeader(f)
                    renderActions(f)
                    renderTabs(f)
                    renderBody(f)
                }
            }
        })
    }

    private fun renderHeader(f: ContractFull) {
        val c = f.contract
        headerArea.removeAllViews()
        headerArea.add(row {
            add(statusBadge(c.status, p))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(8), 1) })
            add(priorityBadge(c.priority, p))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) })
            add(text("v${c.currentVersion}", 11f, p.faint, 600, font = "mono"))
        }.apply { pad(t = 8) })

        headerArea.add(row {
            add(col {
                add(text(c.contractNumber, 11.5f, p.brass, 600, font = "mono").apply { pad(t = 10, b = 4) })
                add(text(c.title, 23f, p.fg, 700, font = "display"))
            }.weight(1f))
            if (c.status == Status.APPROVED) {
                val seal = SealView(context, p, "SEALED").apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(76), Ui.dp(76)) }
                add(seal.apply { pad(l = 8) })
                if (!sealShown) { seal.stampIn(250); sealShown = true }
            }
        })

        // meta grid
        val initiator = repo.engine.getUser(c.initiatorId)
        val executor = c.executorId?.let { repo.engine.getUser(it) }
        val cat = c.categoryId?.let { id -> repo.categories().firstOrNull { it.id == id } }
        headerArea.add(card(p, 16f) {
            add(metaRow("Initiator", initiator?.name ?: "—", initiator))
            add(metaRow("Executor", executor?.name ?: "Unassigned", executor))
            val (dl, urgent) = Time.deadlineLabel(c.deadline)
            add(row {
                add(text("DEADLINE", 10f, p.faint, 700).apply { letterSpacing = 0.06f; minWidth = Ui.dp(84) })
                add(text(if (c.deadline == null) "None" else "${Time.formatDeadline(c.deadline)} · $dl", 13f, if (urgent) p.danger else p.fg, 600))
            }.apply { pad(t = 8, b = 2) })
            if (cat != null) add(row {
                add(text("CATEGORY", 10f, p.faint, 700).apply { letterSpacing = 0.06f; minWidth = Ui.dp(84) })
                add(View(context).apply { background = Shapes.oval(Palette.c(cat.color)); layoutParams = LinearLayout.LayoutParams(Ui.dp(9), Ui.dp(9)).apply { rightMargin = Ui.dp(6) } })
                add(text(cat.name, 13f, p.fg, 500))
            }.apply { pad(t = 6) })
            if (c.tags.isNotEmpty()) add(row {
                add(text("TAGS", 10f, p.faint, 700).apply { letterSpacing = 0.06f; minWidth = Ui.dp(84) })
                add(text(c.tags.joinToString(" · "), 12.5f, p.muted, 500))
            }.apply { pad(t = 6) })
            if (!c.isTerminal && c.status != Status.DRAFT) {
                add(row {
                    add(progressBar(c.progress, p, p.status(c.status)).weight(1f))
                    add(text("${c.progress}%", 12f, p.fg, 700, font = "mono").apply { pad(l = 10) })
                }.apply { pad(t = 12) })
            }
        }.apply {
            padAll(14)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = Ui.dp(14) }
        })

        // Unacknowledged version banner for executor
        val latest = f.versions.maxByOrNull { it.versionNumber }
        if (latest != null && latest.versionNumber > 1 && latest.acknowledgedAt == null && c.executorId == repo.userId && !c.isTerminal) {
            headerArea.add(card(p, 14f, false) {
                setBackgroundColor(p.warningSoft)
                add(text("Version ${latest.versionNumber} needs your acknowledgment", 13.5f, p.warning, 700))
                latest.changeReason?.let { add(text("“$it”", 12.5f, p.muted, 400).apply { pad(t = 4) }) }
                add(button("Acknowledge changes", p, "soft") {
                    Async.run({ repo.acknowledge(contractId) }, { r ->
                        r.onFailure { Dialogs.error(context, it) }
                        r.onSuccess { Dialogs.toast(context, "Version $it acknowledged") }
                    })
                }.apply { pad(t = 10) })
            }.apply { layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = Ui.dp(10) } })
        }
    }

    private fun metaRow(label: String, value: String, user: User?): LinearLayout = row {
        add(text(label.uppercase(), 10f, p.faint, 700).apply { letterSpacing = 0.06f; minWidth = Ui.dp(84) })
        if (user != null) add(avatar(user, p, 20).apply { pad(r = 6) })
        add(text(value, 13f, p.fg, 600))
    }.apply { pad(t = 4, b = 4) }

    private fun renderActions(f: ContractFull) {
        actionsArea.removeAllViews()
        val c = f.contract
        val actions = Rules.availableActions(repo.role(), c, repo.userId)
        if (actions.isEmpty()) return
        val primary = actions.firstOrNull { it.primary }
        val rest = actions.filter { it !== primary }
        actionsArea.add(row {
            if (primary != null) add(button(primary.label, p, if (primary.action == Action.APPROVE) "brass" else "primary") { confirmAction(primary) }.weight(1f))
            for (spec in rest.take(2)) {
                add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(8), 1) })
                add(button(spec.label, p, if (spec.destructive) "outline" else "soft") { confirmAction(spec) })
            }
        }.apply { pad(t = 14) })
    }

    private fun confirmAction(spec: Rules.ActionSpec) {
        if (spec.needsNote) {
            Dialogs.notePrompt(context, p, spec.label, "Why? This note becomes part of the record.", true, spec.label, spec.destructive) { note -> runAction(spec.action, note) }
        } else if (spec.action == Action.APPROVE) {
            Dialogs.confirm(context, p, "Approve & seal?", "This marks the agreement fulfilled and stamps the seal. The executor is notified.", "Seal it", false) { runAction(spec.action, null) }
        } else if (spec.action == Action.ARCHIVE) {
            Dialogs.confirm(context, p, "Archive contract?", "Archived contracts are read-only. You can still export them.", "Archive") { runAction(spec.action, null) }
        } else {
            runAction(spec.action, null)
        }
    }

    private fun runAction(action: Action, note: String?) {
        Async.run({ repo.transition(contractId, action, note) }, { r ->
            r.onFailure { Dialogs.error(context, it) }
            r.onSuccess { c ->
                val msg = when (action) {
                    Action.APPROVE -> "Contract sealed ◈"
                    Action.SEND -> "Sent to the executor"
                    Action.ACCEPT -> "Contract accepted"
                    Action.START -> "Work started"
                    Action.SUBMIT -> "Submitted for review"
                    Action.REJECT -> "Returned with notes"
                    Action.ARCHIVE -> "Archived"
                    Action.REOPEN -> "Reopened"
                }
                Dialogs.toast(context, msg)
                if (action == Action.APPROVE) { sealShown = false; performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS) }
            }
        })
    }

    private fun renderTabs(f: ContractFull) {
        val row = tabsRow.getChildAt(0) as LinearLayout
        row.removeAllViews()
        val isObserver = repo.role() == Role.OBSERVER
        val tabs = mutableListOf("overview" to "Overview", "activity" to "Activity", "versions" to "Versions", "people" to "People")
        if (!isObserver) tabs.add("audit" to "Audit")
        for ((id, label) in tabs) {
            row.add(chip(label, p, tab == id) { tab = id; renderTabs(f); renderBody(f) })
            row.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(7), 1) })
        }
    }

    private fun renderBody(f: ContractFull) {
        bodyArea.removeAllViews()
        when (tab) {
            "overview" -> renderOverview(f)
            "activity" -> renderActivity(f)
            "versions" -> renderVersions(f)
            "people" -> renderPeople(f)
            "audit" -> renderAudit(f)
        }
        bodyArea.fadeSlideIn(durationMs = 220)
    }

    private fun renderOverview(f: ContractFull) {
        bodyArea.add(sectionHeader("Agreement", p))
        bodyArea.add(card(p, 16f) { add(text(f.contract.description, 14f, p.fg, 400)) })

        // Timeline
        bodyArea.add(sectionHeader("Timeline", p))
        bodyArea.add(card(p, 16f) {
            val events = listOf(
                "Created" to f.contract.createdAt, "Sent" to f.contract.sentAt, "Accepted" to f.contract.acceptedAt,
                "Submitted" to f.contract.submittedAt, "Sealed" to f.contract.approvedAt, "Archived" to f.contract.archivedAt
            ).filter { it.second != null }
            if (events.isEmpty()) add(text("No events yet.", 13f, p.faint, 400))
            for ((label, at) in events) add(row {
                add(text("●", 9f, p.brass, 700).apply { pad(r = 10) })
                add(text(label, 13f, p.fg, 600).weight(1f))
                add(text(Time.formatDateTime(at), 11.5f, p.muted, 500))
            }.apply { pad(t = 5, b = 5) })
        })

        // Attachments
        bodyArea.add(sectionHeader("Attachments", p, "Add file") {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
            }
            try { activity.startActivityForResult(intent, REQ_ATTACH) } catch (e: Exception) { Dialogs.toast(context, "No file picker available") }
        })
        if (f.attachments.isEmpty()) bodyArea.add(text("No files attached.", 13f, p.faint, 400).apply { pad(b = 8) })
        for (att in f.attachments) {
            bodyArea.add(clickableCard(p, 12f, { repo.openAttachment(att) }) {
                add(row {
                    add(text("⎘", 17f, p.primary, 600).apply { pad(r = 10) })
                    add(col {
                        add(text(att.filename, 13.5f, p.fg, 600, maxLines = 1))
                        add(text("${att.size / 1024} KB · ${Time.relative(att.createdAt)}", 11.5f, p.muted, 400).apply { pad(t = 2) })
                    }.weight(1f))
                })
            }.apply { padAll(12); layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(6) } })
        }
    }

    private fun renderActivity(f: ContractFull) {
        val c = f.contract
        // Composer
        if (Rules.canPostInteractions(repo.role()) && c.status != Status.ARCHIVED) {
            bodyArea.add(sectionHeader("Add to the record", p))
            bodyArea.add(card(p, 16f) {
                var type = IxType.COMMENT
                var content = ""
                var progress = c.progress
                val typeLabel = text("Type: Comment ▾", 12.5f, p.primary, 600).apply { pad(b = 8) }
                add(typeLabel)
                val types = listOf(IxType.COMMENT, IxType.PROGRESS, IxType.CLARIFICATION_REQUEST, IxType.CLARIFICATION_RESPONSE, IxType.SCOPE_PROPOSAL, IxType.ISSUE, IxType.ISSUE_RESOLUTION)
                typeLabel.setOnClickListener {
                    Dialogs.pick(context, p, "Interaction type", types, { it.label }, { it == type }) { picked ->
                        type = picked
                        typeLabel.text = "Type: ${picked.label} ▾"
                    }
                }
                add(input(p, "Write a note for the record…", singleLine = false, minLines = 3, onChange = { content = it }))
                // progress slider
                val pv = text("$progress%", 12.5f, p.fg, 700, font = "mono")
                add(row {
                    add(text("Progress", 12.5f, p.muted, 600).weight(1f))
                    add(pv)
                }.apply { pad(t = 12, b = 4) })
                add(SeekBar(context).apply {
                    max = 100
                    setProgress(progress)
                    progressTintList = android.content.res.ColorStateList.valueOf(p.primary)
                    thumbTintList = android.content.res.ColorStateList.valueOf(p.primary)
                    setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                        override fun onProgressChanged(sb: SeekBar?, value: Int, fromUser: Boolean) { progress = value; pv.text = "$value%" }
                        override fun onStartTrackingTouch(sb: SeekBar?) {}
                        override fun onStopTrackingTouch(sb: SeekBar?) {}
                    })
                })
                add(button("Post to record", p, "primary") {
                    if (content.isBlank()) { Dialogs.toast(context, "Write something first"); return@button }
                    val prog = if (progress != c.progress || type == IxType.PROGRESS) progress else null
                    Async.run({ repo.postInteraction(contractId, type, content.trim(), prog) }, { r ->
                        r.onFailure { Dialogs.error(context, it) }
                        r.onSuccess { Dialogs.toast(context, "Posted") }
                    })
                }.apply { pad(t = 12) })
            })
        }

        bodyArea.add(sectionHeader("Interaction history", p, "${f.interactions.size}"))
        if (f.interactions.isEmpty()) bodyArea.add(text("No interactions yet.", 13f, p.faint, 400))
        for (ix in f.interactions.sortedByDescending { Time.parseIso(it.createdAt) ?: 0 }) {
            val author = repo.engine.getUser(ix.authorId)
            bodyArea.add(card(p, 14f) {
                add(row {
                    add(avatar(author, p, 26))
                    add(col {
                        add(text(author?.name ?: "Unknown", 12.5f, p.fg, 700))
                        add(text(Time.relative(ix.createdAt), 10.5f, p.faint, 500))
                    }.apply { pad(l = 8) }.weight(1f))
                    add(interactionBadge(ix, p))
                })
                add(text(ix.content, 13.5f, p.fg, 400).apply { pad(t = 8) })
                if (ix.progress != null) add(row {
                    add(progressBar(ix.progress, p, p.primary, 5).weight(1f))
                    add(text("${ix.progress}%", 11f, p.muted, 600, font = "mono").apply { pad(l = 8) })
                }.apply { pad(t = 8) })
                if (ix.statusFrom != null && ix.statusTo != null) add(text("${ix.statusFrom.label} → ${ix.statusTo.label}", 11.5f, p.muted, 600).apply { pad(t = 6) })
            }.apply { padAll(12); layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(8) } })
        }
    }

    private fun interactionBadge(ix: Interaction, pal: Palette): TextView {
        val color = when (ix.type) {
            IxType.APPROVAL, IxType.ISSUE_RESOLUTION, IxType.SCOPE_ACK -> pal.success
            IxType.REJECTION, IxType.ISSUE, IxType.SCOPE_REJECT -> pal.danger
            IxType.PROGRESS, IxType.SUBMISSION -> pal.primary
            IxType.SYSTEM -> pal.faint
            else -> pal.brass
        }
        return text(ix.type.label, 10f, color, 700).apply {
            background = Shapes.round(Palette.blend(color, pal.card, if (pal.dark) 0.2f else 0.1f), 100f)
            pad(8, 3, 8, 3)
        }
    }

    private fun renderVersions(f: ContractFull) {
        bodyArea.add(sectionHeader("Version history", p))
        val versions = f.versions.sortedByDescending { it.versionNumber }
        for (v in versions) {
            val changer = repo.engine.getUser(v.changedBy)
            bodyArea.add(card(p, 14f) {
                add(row {
                    add(text("v${v.versionNumber}", 13f, p.brass, 700, font = "mono"))
                    if (v.versionNumber == f.contract.currentVersion) add(text("CURRENT", 9f, p.success, 700).apply {
                        background = Shapes.round(p.successSoft, 100f); pad(7, 2, 7, 2)
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { leftMargin = Ui.dp(8) }
                    })
                    add(View(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) })
                    add(text(Time.relative(v.changedAt), 11f, p.faint, 500))
                })
                add(text(v.title, 14.5f, p.fg, 700).apply { pad(t = 8) })
                add(text(v.description, 12.5f, p.muted, 400, maxLines = 4).apply { pad(t = 4) })
                add(row {
                    add(priorityBadge(v.priority, p))
                    add(text(Time.formatDeadline(v.deadline), 11.5f, p.muted, 500).apply { pad(l = 8) })
                }.apply { pad(t = 8) })
                v.changeReason?.let {
                    add(text("Reason: $it", 12f, p.fg, 500).apply {
                        background = Shapes.round(p.cardAlt, 10f); padAll(10)
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = Ui.dp(8) }
                    })
                }
                add(text("By ${changer?.name ?: "unknown"} · ${Time.formatDateTime(v.changedAt)}" + (if (v.acknowledgedAt != null) " · ✓ acknowledged" else ""), 11f, p.faint, 500).apply { pad(t = 8) })
            }.apply { padAll(13); layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(8) } })
        }
    }

    private fun renderPeople(f: ContractFull) {
        bodyArea.add(sectionHeader("Participants", p))
        for (pt in f.participants) {
            val u = repo.engine.getUser(pt.userId)
            bodyArea.add(card(p, 14f) {
                add(row {
                    add(avatar(u, p, 36))
                    add(col {
                        add(text(u?.name ?: pt.userId, 14f, p.fg, 700))
                        add(text("${pt.role.replaceFirstChar { it.uppercase() }}${if (pt.isLead) " · lead" else ""}", 11.5f, p.muted, 500).apply { pad(t = 2) })
                    }.apply { pad(l = 10) }.weight(1f))
                    val (label, color) = when (pt.status) { "active" -> "Active" to p.success; "pending" -> "Pending" to p.warning; else -> pt.status to p.muted }
                    add(text(label, 10.5f, color, 700).apply { background = Shapes.round(Palette.blend(color, p.card, 0.13f), 100f); pad(9, 4, 9, 4) })
                })
            }.apply { padAll(12); layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(7) } })
        }
    }

    private fun renderAudit(f: ContractFull) {
        bodyArea.add(sectionHeader("Audit trail", p))
        bodyArea.add(text("Tamper-evident log — every entry is checksummed (SHA-256).", 12f, p.faint, 400).apply { pad(b = 10) })
        val area = col {}
        bodyArea.add(area)
        area.add(loading(p))
        Async.run({ repo.audit(contractId) }, { r ->
            area.removeAllViews()
            r.onFailure { area.add(text(it.message ?: "Audit unavailable", 13f, p.muted, 400)) }
            r.onSuccess { logs ->
                if (logs.isEmpty()) area.add(text("No audit entries.", 13f, p.faint, 400))
                for (log in logs) {
                    val u = log.userId?.let { repo.engine.getUser(it) }
                    area.add(card(p, 12f) {
                        add(row {
                            add(text(log.action.replace('_', ' '), 12.5f, p.fg, 700).weight(1f))
                            add(text(Time.relative(log.createdAt), 10.5f, p.faint, 500))
                        })
                        add(text("${u?.name ?: "System"} · ${Time.formatDateTime(log.createdAt)}", 11f, p.muted, 500).apply { pad(t = 3) })
                        add(text("sha256:${log.checksum.take(18)}…", 9.5f, p.faint, 400, font = "mono").apply { pad(t = 4) })
                    }.apply { padAll(11); layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(6) } })
                }
            }
        })
    }

    private fun moreMenu() {
        val f = full ?: return
        val c = f.contract
        val options = mutableListOf<String>()
        if (Rules.canEdit(repo.role(), c)) options.add("Edit contract")
        options.add("Export JSON"); options.add("Export CSV")
        if (c.status == Status.DRAFT && Rules.can(repo.role(), "delete", "contract")) options.add("Delete draft")
        Dialogs.pick(context, p, "Contract actions", options, { it }) { choice ->
            when (choice) {
                "Edit contract" -> activity.nav.push(EditContractScreen(activity, contractId))
                "Export JSON" -> Async.run({ repo.exportJson(contractId) }, { r ->
                    r.onFailure { Dialogs.error(context, it) }
                    r.onSuccess { ExportProvider.writeAndShare(context, "${c.contractNumber}.json", it, "application/json") }
                })
                "Export CSV" -> Async.run({ repo.exportCsv(contractId) }, { r ->
                    r.onFailure { Dialogs.error(context, it) }
                    r.onSuccess { ExportProvider.writeAndShare(context, "${c.contractNumber}.csv", it, "text/csv") }
                })
                "Delete draft" -> Dialogs.confirm(context, p, "Delete draft?", "This hides the draft from all lists. This cannot be undone.", "Delete", true) {
                    Async.run({ repo.deleteDraft(contractId) }, { r ->
                        r.onFailure { Dialogs.error(context, it) }
                        r.onSuccess { Dialogs.toast(context, "Draft deleted"); activity.nav.pop() }
                    })
                }
            }
        }
    }
}
