package com.taskcontract.android.ui.screens

import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import com.taskcontract.android.MainActivity
import com.taskcontract.android.Screen
import com.taskcontract.android.core.Async
import com.taskcontract.android.core.Bus
import com.taskcontract.android.domain.Notification
import com.taskcontract.android.domain.Time
import com.taskcontract.android.ui.*

/** Notification inbox with unread filter and mark-all-read. */
class NotificationsScreen(a: MainActivity) : Screen(a) {
    private var unreadOnly = false
    private lateinit var listArea: LinearLayout
    private lateinit var filterRow: LinearLayout

    init {
        scaffold("Notifications", back = true, actions = {
            add(iconButton("✓", p, 18f, "Mark all read") {
                Async.run({ repo.markAllRead() }, { r -> r.onFailure { Dialogs.error(context, it) }; r.onSuccess { Dialogs.toast(context, "All caught up") } })
            })
        }) {
            filterRow = row {}
            add(filterRow.apply { pad(b = 10) })
            listArea = col {}
            add(listArea)
            renderFilters()
        }
        reload()
        listen(Bus.NOTIFICATIONS_CHANGED) { reload() }
    }

    private fun renderFilters() {
        filterRow.removeAllViews()
        filterRow.add(chip("All", p, !unreadOnly) { unreadOnly = false; renderFilters(); reload() })
        filterRow.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(8), 1) })
        val unread = repo.unreadCount()
        filterRow.add(chip("Unread${if (unread > 0) " ($unread)" else ""}", p, unreadOnly) { unreadOnly = true; renderFilters(); reload() })
    }

    private fun reload() {
        Async.run({ repo.notifications(unreadOnly) }, { r ->
            r.onFailure { Dialogs.error(context, it) }
            r.onSuccess { notes ->
                renderFilters()
                listArea.removeAllViews()
                if (notes.isEmpty()) {
                    listArea.add(emptyState("♢", if (unreadOnly) "All caught up" else "No notifications", if (unreadOnly) "Nothing unread — nice." else "Contract activity will appear here.", p))
                    return@onSuccess
                }
                for (n in notes) listArea.add(notificationCard(n))
            }
        })
    }

    private fun notificationCard(n: Notification): LinearLayout {
        val glyph = when (n.type) {
            "contract_assigned", "invite" -> "⚑"
            "deadline" -> "⏱"
            "approved", "approval" -> "◈"
            "rejected", "rejection" -> "↩"
            "progress_update" -> "◔"
            else -> "●"
        }
        val color = when (n.type) {
            "deadline" -> p.warning
            "approved", "approval" -> p.success
            "rejected", "rejection" -> p.danger
            else -> p.primary
        }
        return clickableCard(p, 14f, {
            repo.markRead(n.id)
            if (n.contractId != null) activity.nav.push(ContractDetailScreen(activity, n.contractId))
            else reload()
        }) {
            if (!n.read) setBackgroundColor(p.primarySoft)
            add(row {
                add(text(glyph, 16f, color, 600).apply {
                    background = Shapes.oval(Palette.blend(color, p.card, 0.14f))
                    minimumWidth = Ui.dp(34); minimumHeight = Ui.dp(34); gravity = android.view.Gravity.CENTER
                })
                add(col {
                    add(row {
                        add(text(n.title, 14f, p.fg, if (n.read) 600 else 700).weight(1f))
                        if (!n.read) add(text("●", 8f, p.brass, 700).apply { pad(l = 6) })
                    })
                    add(text(n.content, 12.5f, p.muted, 400, maxLines = 3).apply { pad(t = 3) })
                    add(text(Time.relative(n.createdAt), 10.5f, p.faint, 500).apply { pad(t = 5) })
                }.apply { pad(l = 11) }.weight(1f))
            })
        }.apply {
            padAll(13)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(8) }
        }
    }
}
