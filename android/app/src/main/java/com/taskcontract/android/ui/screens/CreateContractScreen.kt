package com.taskcontract.android.ui.screens

import android.app.DatePickerDialog
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import com.taskcontract.android.MainActivity
import com.taskcontract.android.Screen
import com.taskcontract.android.core.Async
import com.taskcontract.android.data.LocalEngine
import com.taskcontract.android.domain.*
import com.taskcontract.android.ui.*
import java.util.Calendar

/** Draft state shared between wizard steps. */
class ContractDraft {
    var title = ""
    var description = ""
    var executorId: String? = null
    var observerIds = mutableListOf<String>()
    var deadline: String? = null
    var priority = Priority.MEDIUM
    var categoryId: String? = null
    var tags = mutableListOf<String>()
}

/**
 * Create wizard: 1 Basic info → 2 Assignment → 3 Parameters → 4 Review.
 * Mirrors CreateContract.tsx. Draft persists across steps and config changes
 * are handled by activity recreate (draft kept in App-level cache).
 */
class CreateContractScreen(a: MainActivity) : Screen(a) {
    private var step = 0
    private val draft = (activity.draftCache["new"] as? ContractDraft) ?: ContractDraft().also { activity.draftCache["new"] = it }
    private lateinit var content: LinearLayout
    private lateinit var stepBar: LinearLayout
    private lateinit var footer: LinearLayout

    init {
        val root = col {
            add(row {
                pad(8, 10, 16, 10)
                add(iconButton("✕", p, 20f, "Cancel") {
                    if (draft.title.isNotBlank() || draft.description.isNotBlank()) {
                        Dialogs.confirm(context, p, "Discard draft?", "Your unsaved contract will be lost.", "Discard", true) {
                            activity.draftCache.remove("new"); activity.nav.pop()
                        }
                    } else { activity.draftCache.remove("new"); activity.nav.pop() }
                })
                add(text("New contract", 18f, p.fg, 700, font = "display").weight(1f).apply { pad(l = 4) })
            })
            stepBar = row {}
            add(stepBar.apply { pad(16, 2, 16, 10) })
            add(View(context).apply { setBackgroundColor(p.border) }, ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(1))
            val sv = scroll { content = this; pad(20, 10, 20, 20) }
            add(sv, ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
            footer = row {}
            add(footer.apply { pad(16, 10, 16, 14) })
        }
        addView(root, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        render()
    }

    private fun render() {
        // Step indicator
        stepBar.removeAllViews()
        val names = listOf("Basics", "People", "Terms", "Review")
        for (i in names.indices) {
            val done = i < step; val current = i == step
            stepBar.add(col {
                gravity = Gravity.CENTER
                add(text(if (done) "✓" else "${i + 1}", 12f, if (done || current) p.onPrimary else p.muted, 700, align = Gravity.CENTER).apply {
                    background = Shapes.oval(if (done) p.success else if (current) p.primary else p.cardAlt)
                    minimumWidth = Ui.dp(26); minimumHeight = Ui.dp(26); gravity = Gravity.CENTER
                })
                add(text(names[i], 10f, if (current) p.primary else p.muted, if (current) 700 else 500).apply { pad(t = 4) })
            }.weight(1f))
            if (i < names.size - 1) stepBar.add(View(context).apply {
                setBackgroundColor(if (i < step) p.success else p.border)
                layoutParams = LinearLayout.LayoutParams(Ui.dp(18), Ui.dp(2)).apply { bottomMargin = Ui.dp(16) }
            })
        }

        content.removeAllViews()
        when (step) {
            0 -> stepBasics()
            1 -> stepPeople()
            2 -> stepTerms()
            3 -> stepReview()
        }
        content.fadeSlideIn(durationMs = 200)

        footer.removeAllViews()
        if (step > 0) {
            footer.add(button("Back", p, "ghost") { step--; render() })
            footer.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(10), 1) })
        }
        if (step < 3) {
            footer.add(button("Continue", p, "primary") { if (validateStep()) { step++; render() } }.weight(1f))
        } else {
            footer.add(button("Save draft", p, "outline") { submit(false) }.weight(1f))
            footer.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(10), 1) })
            footer.add(button("Create & send", p, "primary") { submit(true) }.weight(1f))
        }
    }

    private fun validateStep(): Boolean {
        when (step) {
            0 -> {
                if (draft.title.trim().length < 3) { Dialogs.toast(context, "Title needs at least 3 characters"); return false }
                if (draft.description.trim().length < 10) { Dialogs.toast(context, "Describe the agreement (10+ characters)"); return false }
            }
            2 -> {
                if (draft.deadline != null && (Time.parseIso(draft.deadline) ?: 0) < System.currentTimeMillis() - 86400_000) {
                    Dialogs.toast(context, "Deadline is in the past"); return false
                }
            }
        }
        return true
    }

    private fun stepBasics() {
        content.add(text("What's the agreement?", 22f, p.fg, 600, font = "display").apply { pad(b = 4) })
        content.add(text("A clear title and scope make the contract enforceable.", 13.5f, p.muted, 400).apply { pad(b = 8) })
        content.add(fieldLabel("Title", p, true))
        content.add(input(p, "e.g. Website redesign — phase 2", value = draft.title, onChange = { draft.title = it }))
        content.add(fieldLabel("Description & deliverables", p, true))
        content.add(input(p, "Define the work, acceptance criteria and deliverables…", value = draft.description, singleLine = false, minLines = 6, onChange = { draft.description = it }))
        content.add(text("Tip: state what “done” looks like — it's what the reviewer seals against.", 12f, p.faint, 400).apply { pad(t = 8) })
    }

    private fun stepPeople() {
        content.add(text("Who's accountable?", 22f, p.fg, 600, font = "display").apply { pad(b = 4) })
        content.add(text("One executor owns delivery. Observers watch without acting.", 13.5f, p.muted, 400).apply { pad(b = 8) })
        val users = repo.users().filter { it.id != repo.userId }

        content.add(fieldLabel("Responsible executor", p))
        val execLabel = users.firstOrNull { it.id == draft.executorId }?.name ?: ""
        content.add(selector(p, execLabel, "Choose executor…") {
            Dialogs.pick(context, p, "Executor", users, { "${it.name} · ${it.title ?: it.email}" }, { it.id == draft.executorId }) { u ->
                draft.executorId = u.id
                render()
            }
        })

        content.add(fieldLabel("Observers", p))
        if (users.isEmpty()) content.add(text("No other members yet — invite teammates from the Team tab.", 13f, p.faint, 400))
        for (u in users.filter { it.id != draft.executorId }) {
            val selected = draft.observerIds.contains(u.id)
            content.add(row {
                add(avatar(u, p, 30))
                add(col {
                    add(text(u.name, 13.5f, p.fg, 600))
                    add(text(u.title ?: u.email, 11.5f, p.muted, 400))
                }.apply { pad(l = 10) }.weight(1f))
                add(text(if (selected) "✓" else "", 15f, p.primary, 700).apply {
                    background = Shapes.round(if (selected) p.primarySoft else p.card, 8f, p.border)
                    minimumWidth = Ui.dp(26); minimumHeight = Ui.dp(26); gravity = Gravity.CENTER
                })
            }.apply {
                padAll(10)
                setOnClickListener {
                    if (selected) draft.observerIds.remove(u.id) else draft.observerIds.add(u.id)
                    render()
                }
            })
        }
    }

    private fun stepTerms() {
        content.add(text("Set the terms.", 22f, p.fg, 600, font = "display").apply { pad(b = 8) })

        content.add(fieldLabel("Deadline", p))
        content.add(selector(p, draft.deadline?.let { Time.formatDeadline(it) } ?: "", "Pick a date…") {
            val cal = Calendar.getInstance()
            draft.deadline?.let { Time.parseIso(it)?.let { ms -> cal.timeInMillis = ms } }
            DatePickerDialog(context, { _, y, m, d ->
                draft.deadline = String.format("%04d-%02d-%02d", y, m + 1, d)
                render()
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).apply {
                datePicker.minDate = System.currentTimeMillis() - 86400_000
            }.show()
        })
        if (draft.deadline != null) content.add(text("Clear deadline ✕", 12f, p.primary, 600).apply {
            pad(t = 6)
            setOnClickListener { draft.deadline = null; render() }
        })

        content.add(fieldLabel("Priority", p))
        content.add(row {
            for (pr in Priority.entries) {
                add(chip(pr.label, p, draft.priority == pr) { draft.priority = pr; render() })
                add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(6), 1) })
            }
        })

        content.add(fieldLabel("Category", p))
        val cats = repo.categories()
        val catName = cats.firstOrNull { it.id == draft.categoryId }?.name ?: ""
        content.add(selector(p, catName, "No category") {
            Dialogs.pick(context, p, "Category", cats, { it.name }, { it.id == draft.categoryId }) { c ->
                draft.categoryId = c.id
                render()
            }
        })

        content.add(fieldLabel("Tags", p))
        content.add(input(p, "design, q3, client-work (comma separated)", value = draft.tags.joinToString(", "), onChange = { draft.tags = Rules.parseTags(it).toMutableList() }))
    }

    private fun stepReview() {
        content.add(text("Review & seal the deal.", 22f, p.fg, 600, font = "display").apply { pad(b = 4) })
        content.add(text("Sending notifies the executor and starts the acceptance flow. Saving as draft keeps it private.", 13.5f, p.muted, 400).apply { pad(b = 12) })
        content.add(card(p, 16f) {
            add(text(draft.title, 17f, p.fg, 700, font = "display"))
            add(text(draft.description, 13f, p.muted, 400, maxLines = 6).apply { pad(t = 6) })
            add(View(context).apply { setBackgroundColor(p.border) }, ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(1)).apply { pad(t = 12, b = 12) }
            val executor = draft.executorId?.let { repo.engine.getUser(it) }
            add(reviewRow("Executor", executor?.name ?: "Unassigned"))
            add(reviewRow("Observers", if (draft.observerIds.isEmpty()) "None" else draft.observerIds.mapNotNull { repo.engine.getUser(it)?.name }.joinToString(", ")))
            add(reviewRow("Deadline", draft.deadline?.let { Time.formatDeadline(it) } ?: "None"))
            add(reviewRow("Priority", draft.priority.label))
            repo.categories().firstOrNull { it.id == draft.categoryId }?.let { add(reviewRow("Category", it.name)) }
            if (draft.tags.isNotEmpty()) add(reviewRow("Tags", draft.tags.joinToString(", ")))
        })
        if (draft.executorId == null) {
            content.add(text("⚠ No executor assigned — you can save a draft, but sending requires an executor.", 12.5f, p.warning, 600).apply { pad(t = 10) })
        }
    }

    private fun reviewRow(label: String, value: String): LinearLayout = row {
        add(text(label, 12f, p.faint, 600).apply { minWidth = Ui.dp(90) })
        add(text(value, 13f, p.fg, 600).weight(1f))
    }.apply { pad(t = 4, b = 4) }

    private fun submit(sendNow: Boolean) {
        if (sendNow && draft.executorId == null) { Dialogs.toast(context, "Assign an executor before sending"); return }
        val input = LocalEngine.NewContract(
            draft.title.trim(), draft.description.trim(), draft.executorId, draft.observerIds.toList(),
            draft.deadline, draft.priority, draft.categoryId, draft.tags.toList(), sendNow
        )
        Async.run({ repo.createContract(input) }, { r ->
            r.onFailure { Dialogs.error(context, it) }
            r.onSuccess { c ->
                activity.draftCache.remove("new")
                Dialogs.toast(context, if (sendNow) "Contract sent — ${c.contractNumber}" else "Draft saved — ${c.contractNumber}")
                activity.nav.pop()
                activity.nav.push(ContractDetailScreen(activity, c.id))
            }
        })
    }
}

/** Edit an existing contract; non-drafts require a change reason (new version). */
class EditContractScreen(a: MainActivity, private val contractId: String) : Screen(a) {
    init {
        scaffold("Edit contract", back = true) {
            val area = col {}
            add(area)
            area.add(loading(p))
            Async.run({ repo.contract(contractId) }, { r ->
                area.removeAllViews()
                r.onFailure { area.add(text(it.message ?: "Not found", 14f, p.muted, 400)) }
                r.onSuccess { f ->
                    if (f == null) { area.add(text("Contract not found.", 14f, p.muted, 400)); return@onSuccess }
                    val c = f.contract
                    var title = c.title; var description = c.description; var deadline = c.deadline
                    var priority = c.priority; var categoryId = c.categoryId; var tags = c.tags.joinToString(", ")
                    var reason = ""
                    val needsReason = Rules.editNeedsReason(c.status)

                    if (needsReason) area.add(card(p, 14f, false) {
                        setBackgroundColor(p.warningSoft)
                        add(text("This contract is ${c.status.label.lowercase()} — saving creates version ${c.currentVersion + 1} and notifies the executor, who must acknowledge the change.", 12.5f, p.warning, 600))
                    }.apply { layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(8) } })

                    area.add(fieldLabel("Title", p, true))
                    area.add(input(p, "Title", value = title, onChange = { title = it }))
                    area.add(fieldLabel("Description", p, true))
                    area.add(input(p, "Description", value = description, singleLine = false, minLines = 5, onChange = { description = it }))
                    area.add(fieldLabel("Deadline", p))
                    val dlSelector = selector(p, deadline?.let { Time.formatDeadline(it) } ?: "", "Pick a date…") {}
                    dlSelector.setOnClickListener {
                        val cal = Calendar.getInstance()
                        deadline?.let { Time.parseIso(it)?.let { ms -> cal.timeInMillis = ms } }
                        DatePickerDialog(context, { _, y, m, d ->
                            deadline = String.format("%04d-%02d-%02d", y, m + 1, d)
                            (dlSelector.getChildAt(0) as TextView).text = Time.formatDeadline(deadline)
                            (dlSelector.getChildAt(0) as TextView).setTextColor(p.fg)
                        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
                    }
                    area.add(dlSelector)
                    area.add(fieldLabel("Priority", p))
                    val prRow = row {}
                    fun renderPriorities() {
                        prRow.removeAllViews()
                        for (pr in Priority.entries) {
                            prRow.add(chip(pr.label, p, priority == pr) { priority = pr; renderPriorities() })
                            prRow.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(6), 1) })
                        }
                    }
                    renderPriorities()
                    area.add(prRow)
                    area.add(fieldLabel("Category", p))
                    val cats = repo.categories()
                    val catSelector = selector(p, cats.firstOrNull { it.id == categoryId }?.name ?: "", "No category") {}
                    catSelector.setOnClickListener {
                        Dialogs.pick(context, p, "Category", cats, { it.name }, { it.id == categoryId }) { picked ->
                            categoryId = picked.id
                            (catSelector.getChildAt(0) as TextView).text = picked.name
                            (catSelector.getChildAt(0) as TextView).setTextColor(p.fg)
                        }
                    }
                    area.add(catSelector)
                    area.add(fieldLabel("Tags", p))
                    area.add(input(p, "comma, separated", value = tags, onChange = { tags = it }))
                    if (needsReason) {
                        area.add(fieldLabel("Change reason", p, true))
                        area.add(input(p, "Why is this changing? The executor will see this.", singleLine = false, minLines = 2, onChange = { reason = it }))
                    }
                    area.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(18)) })
                    area.add(button(if (needsReason) "Save new version" else "Save changes", p, "primary") {
                        if (title.trim().length < 3 || description.trim().length < 10) { Dialogs.toast(context, "Title and description are required"); return@button }
                        if (needsReason && reason.trim().isEmpty()) { Dialogs.toast(context, "A change reason is required"); return@button }
                        val edit = LocalEngine.ContractEdit(title.trim(), description.trim(), deadline, deadline == null, priority, categoryId, Rules.parseTags(tags), reason.trim().ifEmpty { null })
                        Async.run({ repo.editContract(contractId, edit) }, { rr ->
                            rr.onFailure { Dialogs.error(context, it) }
                            rr.onSuccess { cc ->
                                Dialogs.toast(context, if (needsReason) "Version ${cc.currentVersion} published" else "Saved")
                                activity.nav.pop()
                            }
                        })
                    })
                }
            })
        }
    }
}
