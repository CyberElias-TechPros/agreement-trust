package com.taskcontract.android.ui.screens

import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import com.taskcontract.android.MainActivity
import com.taskcontract.android.Screen
import com.taskcontract.android.core.Async
import com.taskcontract.android.core.Bus
import com.taskcontract.android.domain.*
import com.taskcontract.android.ui.*

/** Contract list with status filters, priority filter and sort. */
class ContractsScreen(a: MainActivity) : Screen(a) {
    private var statusFilter: Status? = null
    private var priorityFilter: Priority? = null
    private var query = ""
    private var sort = "updated" // updated | deadline | created
    private lateinit var listArea: LinearLayout
    private lateinit var chipsRow: android.widget.HorizontalScrollView

    init {
        val root = col {
            add(row {
                pad(16, 12, 16, 4)
                add(text("Contracts", 22f, p.fg, 700, font = "display").weight(1f))
                add(iconButton("⌕", p, 20f, "Search") { activity.nav.push(SearchScreen(activity)) })
                add(iconButton("≡", p, 20f, "Sort & filter") { sortSheet() })
            })
            chipsRow = hscroll { renderChips(this) }
            add(chipsRow.apply { pad(16, 6, 16, 6) })
            val sv = scroll { listArea = this; pad(16, 6, 16, 24) }
            add(sv, ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        addView(root, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        // FAB-style new contract button
        add(button("+", p, "primary") { activity.nav.push(CreateContractScreen(activity)) }.apply {
            textSize = 24f
            background = Shapes.ripple(Shapes.oval(p.primary), Shapes.oval(android.graphics.Color.WHITE), Palette.withAlpha(android.graphics.Color.WHITE, 0.2f))
            gravity = android.view.Gravity.CENTER
            layoutParams = android.widget.FrameLayout.LayoutParams(Ui.dp(56), Ui.dp(56), android.view.Gravity.BOTTOM or android.view.Gravity.END).apply {
                rightMargin = Ui.dp(18); bottomMargin = Ui.dp(18)
            }
            elevation = Ui.dp(6).toFloat()
            contentDescription = "New contract"
        })
        reload()
        listen(Bus.DATA_CHANGED) { reload() }
    }

    private fun renderChips(row: LinearLayout) {
        row.removeAllViews()
        fun gap() = row.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(7), 1) })
        row.add(chip("All", p, statusFilter == null) { statusFilter = null; renderChips(row); reload() }); gap()
        for (s in listOf(Status.DRAFT, Status.SENT, Status.ACCEPTED, Status.IN_PROGRESS, Status.SUBMITTED, Status.APPROVED, Status.REJECTED, Status.ARCHIVED)) {
            row.add(chip(s.label, p, statusFilter == s) { statusFilter = if (statusFilter == s) null else s; renderChips(row); reload() }); gap()
        }
        if (priorityFilter != null) {
            row.add(chip("${priorityFilter!!.label} ✕", p, true) { priorityFilter = null; renderChips(row); reload() })
        }
    }

    private fun sortSheet() {
        Dialogs.sheet(context, p, "Sort & filter") {
            add(context.label("Sort by", p))
            for ((id, label) in listOf("updated" to "Recently updated", "deadline" to "Deadline (soonest)", "created" to "Newest first")) {
                add(context.row {
                    add(context.text(label, 14.5f, if (sort == id) p.primary else p.fg, if (sort == id) 700 else 500).weight(1f))
                    if (sort == id) add(context.text("✓", 15f, p.primary, 700))
                }.apply {
                    padAll(12)
                    setOnClickListener { sort = id; Dialogs.dismissAll(); reload() }
                })
            }
            add(context.label("Priority", p).apply { pad(t = 12) })
            add(context.row {
                for (pr in Priority.entries) {
                    add(context.chip(pr.label, p, priorityFilter == pr) {
                        priorityFilter = if (priorityFilter == pr) null else pr
                        Dialogs.dismissAll(); renderChips(chipsRow.getChildAt(0) as LinearLayout); reload()
                    })
                    add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(6), 1) })
                }
            })
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(10)) })
        }
    }

    private fun reload() {
        Async.run({ repo.contracts(statusFilter, priorityFilter, query.ifBlank { null }) }, { r ->
            r.onFailure { Dialogs.error(context, it) }
            r.onSuccess { contracts ->
                val sorted = when (sort) {
                    "deadline" -> contracts.sortedBy { Time.parseIso(it.deadline) ?: Long.MAX_VALUE }
                    "created" -> contracts.sortedByDescending { Time.parseIso(it.createdAt) ?: 0 }
                    else -> contracts.sortedByDescending { Time.parseIso(it.updatedAt) ?: 0 }
                }
                listArea.removeAllViews()
                listArea.add(text("${sorted.size} contract${if (sorted.size == 1) "" else "s"}", 12f, p.faint, 600).apply { pad(b = 10, l = 2) })
                if (sorted.isEmpty()) {
                    listArea.add(emptyState("▤", "Nothing here", if (statusFilter != null) "No ${statusFilter!!.label.lowercase()} contracts match." else "Create your first contract to begin.", p, "New contract") {
                        activity.nav.push(CreateContractScreen(activity))
                    })
                }
                for (c in sorted) {
                    listArea.add(contractListRow(context, c, p, repo) { activity.nav.push(ContractDetailScreen(activity, c.id)) }.apply {
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(9) }
                    })
                }
            }
        })
    }
}

/** Global search across contracts and people. */
class SearchScreen(a: MainActivity) : Screen(a) {
    private lateinit var results: LinearLayout

    init {
        val root = col {
            add(row {
                pad(8, 10, 16, 8)
                add(iconButton("←", p, 22f, "Back") { activity.nav.pop() })
                val field = input(p, "Search contracts, numbers, people…") { q -> doSearch(q) }
                add(field.weight(1f).apply { pad(l = 0) })
                field.requestFocus()
            })
            add(View(context).apply { setBackgroundColor(p.border) }, ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(1))
            val sv = scroll { results = this; pad(16, 12, 16, 24) }
            add(sv, ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        addView(root, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        results.add(text("Type to search across your workspace.", 13.5f, p.faint, 400))
    }

    private var lastQuery = ""
    private fun doSearch(q: String) {
        lastQuery = q
        if (q.trim().length < 2) {
            results.removeAllViews()
            results.add(text("Type at least 2 characters.", 13.5f, p.faint, 400))
            return
        }
        Async.run({ repo.search(q.trim()) }, { r ->
            if (q != lastQuery) return@run
            r.onSuccess { (contracts, users) ->
                results.removeAllViews()
                if (contracts.isEmpty() && users.isEmpty()) {
                    results.add(emptyState("⌕", "No matches", "Nothing found for “$q”.", p))
                    return@onSuccess
                }
                if (contracts.isNotEmpty()) {
                    results.add(sectionHeader("Contracts", p, "${contracts.size}"))
                    for (c in contracts) results.add(contractListRow(context, c, p, repo) { activity.nav.push(ContractDetailScreen(activity, c.id)) }.apply {
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(8) }
                    })
                }
                if (users.isNotEmpty()) {
                    results.add(sectionHeader("People", p, "${users.size}"))
                    for (u in users) results.add(row {
                        add(avatar(u, p, 36))
                        add(col {
                            add(text(u.name, 14.5f, p.fg, 600))
                            add(text(u.email, 12f, p.muted, 400))
                        }.apply { pad(l = 10) }.weight(1f))
                    }.apply { padAll(10) })
                }
            }
        })
    }
}
