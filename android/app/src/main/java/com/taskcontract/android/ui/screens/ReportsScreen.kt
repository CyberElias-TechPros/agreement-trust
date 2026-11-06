package com.taskcontract.android.ui.screens

import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import com.taskcontract.android.MainActivity
import com.taskcontract.android.Screen
import com.taskcontract.android.core.Async
import com.taskcontract.android.core.Bus
import com.taskcontract.android.data.LocalEngine
import com.taskcontract.android.domain.Status
import com.taskcontract.android.ui.*

/** Reports & analytics: stat cards, native Canvas charts, team performance. */
class ReportsScreen(a: MainActivity) : Screen(a) {
    private lateinit var root: LinearLayout

    init {
        val sv = scroll { root = this; pad(16, 12, 16, 28) }
        addView(sv, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        build()
        listen(Bus.DATA_CHANGED) { build() }
    }

    private fun build() {
        root.removeAllViews()
        root.add(row {
            add(col {
                add(text("Reports", 22f, p.fg, 700, font = "display"))
                add(text(repo.currentOrg()?.first?.name ?: "", 12f, p.brass, 600).apply { pad(t = 2) })
            }.weight(1f))
            add(text("◔", 22f, p.brass, 600))
        }.apply { pad(b = 14) })

        val area = col {}
        root.add(area)
        area.add(loading(p))
        Async.run({ repo.analytics() }, { r ->
            area.removeAllViews()
            r.onFailure { area.add(emptyState("◔", "No data", "Create contracts to see analytics.", p)) }
            r.onSuccess { an -> render(area, an) }
        })
    }

    private fun render(area: LinearLayout, an: LocalEngine.Analytics) {
        // Stat grid
        area.add(row {
            add(statCard("Total", an.total, p.primary).weight(1f))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(9), 1) })
            add(statCard("Active", an.active, p.warning).weight(1f))
        })
        area.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(9)) })
        area.add(row {
            add(statCard("Sealed", an.completed, p.success).weight(1f))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(9), 1) })
            add(statCard("To review", an.pendingReview, p.status(Status.SUBMITTED)).weight(1f))
        })

        // Completion rate ring row
        area.add(card(p, 16f) {
            add(row {
                add(col {
                    add(label("Completion rate", p))
                    add(text("${an.completionRate}%", 30f, p.fg, 700, font = "display"))
                    add(text("${an.completed} of ${an.total} sealed", 12f, p.muted, 500).apply { pad(t = 2) })
                }.weight(1f))
                add(col {
                    add(text("${an.completedThisMonth}", 20f, p.brass, 700, font = "display", align = Gravity.END))
                    add(text("sealed this month", 10.5f, p.muted, 600, align = Gravity.END))
                    add(text("${an.thisWeekCreated} created this week", 10.5f, p.faint, 500, align = Gravity.END).apply { pad(t = 6) })
                })
            })
            add(progressBar(an.completionRate, p, p.success, 8).apply { pad(t = 12) })
        }.apply { topMargin(12) })

        // Weekly activity
        area.add(sectionHeader("Weekly activity", p, "8 weeks"))
        area.add(card(p, 16f) {
            add(row {
                add(legendDot(p.primary, "Created"))
                add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(14), 1) })
                add(legendDot(p.brass, "Sealed"))
            }.apply { pad(b = 10) })
            if (an.weekly.all { it.second == 0 && it.third == 0 }) {
                add(text("No activity in the last 8 weeks.", 13f, p.faint, 400))
            } else {
                add(BarChart(context, p, an.weekly), ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(150))
            }
        })

        // Status distribution
        area.add(sectionHeader("Status distribution", p))
        area.add(card(p, 16f) {
            val slices = Status.entries.mapNotNull { s -> an.byStatus[s]?.takeIf { it > 0 }?.let { s.label to it } }
            if (slices.isEmpty()) add(text("No contracts yet.", 13f, p.faint, 400))
            else {
                add(row {
                    add(DonutChart(context, p, slices) { label -> p.status(Status.entries.first { it.label == label }) }, Ui.dp(140), Ui.dp(140))
                    add(col {
                        for ((label, count) in slices) {
                            add(row {
                                add(View(context).apply {
                                    background = Shapes.oval(p.status(Status.entries.first { it.label == label }))
                                    layoutParams = LinearLayout.LayoutParams(Ui.dp(8), Ui.dp(8)).apply { rightMargin = Ui.dp(7) }
                                })
                                add(text(label, 12f, p.muted, 500).weight(1f))
                                add(text("$count", 12f, p.fg, 700, font = "mono"))
                            }.apply { pad(t = 3, b = 3) })
                        }
                    }.apply { pad(l = 16) }.weight(1f))
                })
            }
        })

        // Sealed per month
        area.add(sectionHeader("Sealed per month", p, "6 months"))
        area.add(card(p, 16f) {
            val maxV = Math.max(1, an.sealedPerMonth.maxOf { it.second })
            for ((month, count) in an.sealedPerMonth) {
                add(row {
                    add(text(month, 11f, p.muted, 600).apply { minWidth = Ui.dp(40) })
                    add(frame {
                        add(View(context).apply { setBackgroundColor(Palette.blend(p.fg, p.card, 0.08f)) }, ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(10))
                        if (count > 0) add(View(context).apply {
                            background = Shapes.round(p.brass, 100f)
                        }, (Ui.dp(200) * count / maxV).coerceAtLeast(Ui.dp(10)), Ui.dp(10))
                    }.weight(1f).apply { pad(l = 8, r = 8) })
                    add(text("$count", 12f, p.fg, 700, font = "mono").apply { minWidth = Ui.dp(24); gravity = Gravity.END })
                }.apply { pad(t = 5, b = 5) })
            }
        })

        // Team performance
        area.add(sectionHeader("Team performance", p))
        if (an.team.isEmpty()) area.add(card(p, 16f) { add(text("No completed contracts to rank yet.", 13f, p.faint, 400)) })
        for ((i, t) in an.team.withIndex()) {
            area.add(card(p, 14f) {
                add(row {
                    add(text("${i + 1}", 13f, if (i == 0) p.brass else p.faint, 700, font = "mono").apply { minWidth = Ui.dp(26) })
                    add(col {
                        add(text(t.name, 14f, p.fg, 700))
                        add(text("${t.completed} sealed · avg ${"%.1f".format(t.avgDays)}d · ${t.onTime}% on time", 11.5f, p.muted, 500).apply { pad(t = 2) })
                    }.weight(1f))
                    if (i == 0 && t.completed > 0) add(text("◈", 16f, p.brass, 700))
                })
            }.apply { padAll(12); bottomMargin(7) })
        }
        area.fadeSlideIn()
    }

    private fun statCard(label: String, value: Int, color: Int): LinearLayout = card(p, 16f) {
        add(text(label.uppercase(), 10.5f, p.muted, 700).apply { letterSpacing = 0.07f })
        val v = text("0", 26f, color, 700, font = "display").apply { pad(t = 6) }
        add(v)
        v.countUp(value)
    }.apply { padAll(14) }

    private fun legendDot(color: Int, label: String): LinearLayout = row {
        add(View(context).apply {
            background = Shapes.round(color, 3f)
            layoutParams = LinearLayout.LayoutParams(Ui.dp(10), Ui.dp(10)).apply { rightMargin = Ui.dp(6) }
        })
        add(text(label, 11.5f, p.muted, 600))
    }
}

private fun View.topMargin(dp: Int) {
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = Ui.dp(dp) }
}
private fun View.bottomMargin(dp: Int) {
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(dp) }
}
