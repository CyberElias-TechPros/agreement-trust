package com.taskcontract.android.ui.screens

import android.content.Intent
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import com.taskcontract.android.MainActivity
import com.taskcontract.android.Screen
import com.taskcontract.android.core.Async
import com.taskcontract.android.core.Bus
import com.taskcontract.android.domain.*
import com.taskcontract.android.ui.*

/** Team: members with role management, invitations, categories. */
class TeamScreen(a: MainActivity) : Screen(a) {
    private lateinit var root: LinearLayout

    init {
        val sv = scroll { root = this; pad(16, 12, 16, 28) }
        addView(sv, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        build()
        listen(Bus.DATA_CHANGED) { build() }
    }

    private fun build() {
        root.removeAllViews()
        val org = repo.currentOrg()
        val myRole = repo.role()
        root.add(row {
            add(col {
                add(text("Team", 22f, p.fg, 700, font = "display"))
                add(text("${org?.first?.name ?: ""} · you are ${myRole.label}", 12f, p.brass, 600).apply { pad(t = 2) })
            }.weight(1f))
            if (Rules.can(myRole, "create", "member")) add(button("Invite", p, "primary", icon = "+") { inviteSheet() })
        }.apply { pad(b = 12) })

        val area = col {}
        root.add(area)
        Async.run({ repo.members() to repo.categories() }, { r ->
            r.onFailure { area.add(text(it.message ?: "Unavailable", 13f, p.muted, 400)) }
            r.onSuccess { (members, cats) ->
                area.add(sectionHeader("Members", p, "${members.size}"))
                for ((m, u) in members) area.add(memberCard(m, u, myRole))
                area.add(sectionHeader("Categories", p, if (Rules.can(myRole, "create", "category")) "Add" else null) { categorySheet() })
                if (cats.isEmpty()) area.add(text("No categories yet.", 13f, p.faint, 400))
                for (c in cats) {
                    area.add(row {
                        add(View(context).apply {
                            background = Shapes.oval(Palette.c(c.color))
                            layoutParams = LinearLayout.LayoutParams(Ui.dp(12), Ui.dp(12)).apply { rightMargin = Ui.dp(10) }
                        })
                        add(col {
                            add(text(c.name, 13.5f, p.fg, 600))
                            c.description?.let { d -> add(text(d, 11.5f, p.muted, 400)) }
                        }.weight(1f))
                        if (Rules.can(myRole, "delete", "category")) add(text("✕", 13f, p.faint, 600).apply {
                            padAll(8)
                            setOnClickListener {
                                Dialogs.confirm(context, p, "Delete category?", "Contracts keep their history; the label is removed.", "Delete", true) {
                                    Async.run({ repo.engine.deleteCategory(repo.orgId(), myRole, c.id) }, { rr ->
                                        rr.onFailure { Dialogs.error(context, it) }
                                        rr.onSuccess { Bus.emit(Bus.DATA_CHANGED) }
                                    })
                                }
                            }
                        })
                    }.apply {
                        background = Shapes.round(p.card, 12f, p.border)
                        padAll(12)
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(6) }
                    })
                }
            }
        })
    }

    private fun memberCard(m: Membership, u: User, myRole: Role): LinearLayout = card(p, 14f) {
        add(row {
            add(avatar(u, p, 40))
            add(col {
                add(row {
                    add(text(u.name, 14.5f, p.fg, 700))
                    if (u.id == repo.userId) add(text(" (you)", 12f, p.faint, 500))
                })
                add(text(u.title ?: u.email, 11.5f, p.muted, 400).apply { pad(t = 2) })
            }.apply { pad(l = 11) }.weight(1f))
            val roleColor = when (m.role) { Role.OWNER -> p.brass; Role.ADMIN, Role.MANAGER -> p.primary; else -> p.muted }
            val roleChip = text(m.role.label + if (m.status == "pending") " · pending" else "", 10.5f, roleColor, 700).apply {
                background = Shapes.round(Palette.blend(roleColor, p.card, 0.13f), 100f)
                pad(10, 5, 10, 5)
            }
            add(roleChip)
            if (Rules.can(myRole, "update", "member") && m.role != Role.OWNER && u.id != repo.userId) {
                roleChip.setOnClickListener { memberActions(m, u) }
            }
        })
    }.apply {
        padAll(13)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(7) }
    }

    private fun memberActions(m: Membership, u: User) {
        val roles = listOf(Role.ADMIN, Role.MANAGER, Role.EXECUTOR, Role.OBSERVER, Role.AUDITOR)
        Dialogs.sheet(context, p, u.name) {
            add(context.label("Change role", p))
            for (r in roles) {
                add(context.row {
                    add(context.text(r.label, 14.5f, if (m.role == r) p.primary else p.fg, if (m.role == r) 700 else 500).weight(1f))
                    if (m.role == r) add(context.text("✓", 15f, p.primary, 700))
                }.apply {
                    padAll(12)
                    setOnClickListener {
                        Dialogs.dismissAll()
                        Async.run({ repo.updateMemberRole(m.id, r) }, { rr ->
                            rr.onFailure { Dialogs.error(context, it) }
                            rr.onSuccess { Dialogs.toast(context, "${u.firstName} is now ${r.label}") }
                        })
                    }
                })
            }
            if (Rules.can(repo.role(), "delete", "member")) {
                add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(8)) })
                add(context.button("Remove from team", p, "danger") {
                    Dialogs.dismissAll()
                    Dialogs.confirm(context, p, "Remove ${u.firstName}?", "They lose access to this organization's contracts.", "Remove", true) {
                        Async.run({ repo.removeMember(m.id) }, { rr ->
                            rr.onFailure { Dialogs.error(context, it) }
                            rr.onSuccess { Dialogs.toast(context, "Removed") }
                        })
                    }
                })
            }
        }
    }

    private fun inviteSheet() {
        Dialogs.sheet(context, p, "Invite a teammate") {
            var email = ""
            var role = Role.EXECUTOR
            add(context.fieldLabel("Email", p, true))
            add(context.input(p, "teammate@company.com", keyboard = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, onChange = { email = it }))
            add(context.fieldLabel("Role", p))
            val roleSel = context.selector(p, role.label, "Role") {}
            roleSel.setOnClickListener {
                val roles = listOf(Role.ADMIN, Role.MANAGER, Role.EXECUTOR, Role.OBSERVER, Role.AUDITOR)
                Dialogs.pick(context, p, "Role", roles, { it.label }, { it == role }) { r ->
                    role = r
                    (roleSel.getChildAt(0) as android.widget.TextView).text = r.label
                }
            }
            add(roleSel)
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(16)) })
            add(context.button("Send invitation", p, "primary") {
                if (!Rules.isEmail(email)) { Dialogs.toast(context, "Enter a valid email"); return@button }
                Async.run({ repo.invite(email.trim(), role) }, { r ->
                    r.onFailure { Dialogs.error(context, it) }
                    r.onSuccess { inv ->
                        Dialogs.dismissAll()
                        // Share the invite link — mirrors the server's devHint flow.
                        Dialogs.sheet(context, p, "Invitation created") {
                            add(context.text("Share this invite link with ${inv.email}:", 13.5f, p.muted, 400).apply { pad(b = 10) })
                            val link = "taskcontract://invite?token=${inv.token}"
                            add(context.text(link, 12f, p.fg, 500, font = "mono").apply {
                                background = Shapes.round(p.cardAlt, 10f); padAll(12)
                            })
                            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(12)) })
                            add(context.button("Share link", p, "primary") {
                                val send = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_TEXT, "Join our team on TaskContract: $link")
                                    putExtra(Intent.EXTRA_SUBJECT, "TaskContract invitation")
                                }
                                context.startActivity(Intent.createChooser(send, "Share invitation"))
                            })
                        }
                    }
                })
            })
        }
    }

    private fun categorySheet() {
        Dialogs.sheet(context, p, "New category") {
            var name = ""; var description = ""
            var color = "#4C58D6"
            add(context.fieldLabel("Name", p, true))
            add(context.input(p, "e.g. Design", onChange = { name = it }))
            add(context.fieldLabel("Description", p))
            add(context.input(p, "Optional", onChange = { description = it }))
            add(context.fieldLabel("Color", p))
            val colors = listOf("#4C58D6", "#875CEB", "#0F956A", "#AF721D", "#D6577E", "#2A9DB8", "#CB2A42", "#D5A034")
            val colorRow = context.row {}
            fun renderColors() {
                colorRow.removeAllViews()
                for (hex in colors) {
                    colorRow.add(View(context).apply {
                        background = Shapes.oval(Palette.c(hex), if (hex == color) p.fg else null, 2f)
                        layoutParams = LinearLayout.LayoutParams(Ui.dp(30), Ui.dp(30)).apply { rightMargin = Ui.dp(8) }
                        setOnClickListener { color = hex; renderColors() }
                    })
                }
            }
            renderColors()
            add(colorRow)
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(16)) })
            add(context.button("Create category", p, "primary") {
                if (name.isBlank()) { Dialogs.toast(context, "Name is required"); return@button }
                Async.run({ repo.createCategory(name.trim(), color, description.trim().ifEmpty { null }) }, { r ->
                    r.onFailure { Dialogs.error(context, it) }
                    r.onSuccess { Dialogs.dismissAll(); Dialogs.toast(context, "Category created") }
                })
            })
        }
    }
}
