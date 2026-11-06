package com.taskcontract.android.ui.screens

import android.os.Build
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import com.taskcontract.android.MainActivity
import com.taskcontract.android.Screen
import com.taskcontract.android.core.Async
import com.taskcontract.android.core.Bus
import com.taskcontract.android.core.Crypto
import com.taskcontract.android.data.SessionManager
import com.taskcontract.android.domain.Rules
import com.taskcontract.android.platform.Notifier
import com.taskcontract.android.ui.*

/** Settings: profile, organizations, appearance, notifications, security, data, about. */
class SettingsScreen(a: MainActivity) : Screen(a) {
    private lateinit var root: LinearLayout

    init {
        val sv = scroll { root = this; pad(16, 12, 16, 28) }
        addView(sv, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        build()
    }

    private fun build() {
        root.removeAllViews()
        root.add(text("Settings", 22f, p.fg, 700, font = "display").apply { pad(b = 14) })
        val user = repo.user() ?: return

        // Profile card
        root.add(clickableCard(p, 16f, { activity.nav.push(ProfileScreen(activity)) }) {
            add(row {
                add(avatar(user, p, 48))
                add(col {
                    add(text(user.name, 16f, p.fg, 700))
                    add(text(user.email, 12.5f, p.muted, 400).apply { pad(t = 2) })
                    add(text(if (repo.isServer) "Team server account" else "On-device account", 11f, p.brass, 600).apply { pad(t = 4) })
                }.apply { pad(l = 12) }.weight(1f))
                add(text("›", 20f, p.faint, 500))
            })
        })

        // Organizations
        root.add(sectionHeader("Organizations", p, "New") { newOrgSheet() })
        for ((org, role) in repo.orgs()) {
            val current = org.id == repo.session.orgId
            root.add(clickableCard(p, 14f, {
                if (!current) {
                    repo.session.switchOrg(org.id)
                    Bus.emit(Bus.SESSION_CHANGED)
                }
            }) {
                add(row {
                    add(text("◈", 16f, if (current) p.brass else p.faint, 600).apply { pad(r = 10) })
                    add(col {
                        add(text(org.name, 14f, p.fg, 700))
                        add(text("${role.label} · ${org.planType} plan", 11.5f, p.muted, 500).apply { pad(t = 2) })
                    }.weight(1f))
                    if (current) add(text("ACTIVE", 9.5f, p.success, 700).apply { background = Shapes.round(p.successSoft, 100f); pad(8, 3, 8, 3) })
                })
            }.apply { padAll(13); layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(6) } })
        }

        // Appearance
        root.add(sectionHeader("Appearance", p))
        root.add(card(p, 16f) {
            add(row {
                for ((id, label) in listOf("system" to "System", "light" to "Light", "dark" to "Dark")) {
                    add(chip(label, p, repo.session.theme == id) {
                        repo.session.theme = id
                        Bus.emit(Bus.THEME_CHANGED)
                    })
                    add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(8), 1) })
                }
            })
            add(text("Paper light or ink dark — the seal stays brass.", 11.5f, p.faint, 400).apply { pad(t = 8) })
        })

        // Notifications
        root.add(sectionHeader("Notifications", p))
        root.add(card(p, 16f) {
            if (Build.VERSION.SDK_INT >= 33 && !Notifier.hasPermission(context)) {
                add(text("System notifications are off for this app.", 12.5f, p.warning, 600).apply { pad(b = 8) })
                add(button("Enable system notifications", p, "soft") {
                    activity.requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 11)
                }.apply { pad(b = 10) })
            }
            val prefs = repo.notificationPrefs()
            val items = listOf(
                "contract_assigned" to ("New contract assigned" to "When a contract is assigned to you"),
                "status_changed" to ("Status changes" to "Sends, acceptances, approvals, returns"),
                "deadline_reminder" to ("Deadline reminders" to "24 hours before due, and overdue alerts"),
                "comments" to ("Comments & mentions" to "Notes and interactions on your contracts")
            )
            for ((key, texts) in items) {
                add(toggleRow(texts.first, texts.second, prefs[key] ?: true) { on ->
                    repo.setNotificationPref(key, on)
                })
            }
        })

        // Security
        root.add(sectionHeader("Security", p))
        root.add(card(p, 16f) {
            add(toggleRow("Biometric app lock", "Require fingerprint/face or device PIN on open", repo.session.biometricLock) { on ->
                repo.session.biometricLock = on
            })
            add(clickableRow("Two-factor authentication", if (user.twoFactorEnabled) "Enabled ✓" else "Add an authenticator app") { twoFactorSheet() })
            add(clickableRow("Change password", "Update your sign-in password") { changePasswordSheet() })
        })

        // Workspace / server
        root.add(sectionHeader("Workspace", p))
        root.add(card(p, 16f) {
            add(row {
                add(col {
                    add(text("Mode", 13.5f, p.fg, 600))
                    add(text(if (repo.isServer) "Team server — ${repo.session.baseUrl}" else "On this device — private & offline", 11.5f, p.muted, 400, maxLines = 2).apply { pad(t = 2) })
                }.weight(1f))
            })
            if (repo.isServer) {
                add(clickableRow("Sync now", repo.session.lastSyncAt.let { if (it == 0L) "Never synced" else "Last sync ${com.taskcontract.android.domain.Time.relative(com.taskcontract.android.domain.Time.toIso(it))}" }) {
                    repo.syncIfNeeded(); Dialogs.toast(context, "Syncing…")
                })
                val pending = repo.outboxCount()
                if (pending > 0) add(text("$pending offline change${if (pending == 1) "" else "s"} pending", 12f, p.warning, 600).apply { pad(t = 6) })
            }
            add(clickableRow("Export all data", "Share a JSON snapshot of this workspace") { exportAll() })
        })

        // About
        root.add(sectionHeader("About", p))
        root.add(card(p, 16f) {
            add(row {
                add(SealView(context, p, "TCP").apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(44), Ui.dp(44)) })
                add(col {
                    add(text("TaskContract", 15f, p.fg, 700, font = "display"))
                    add(text("Agreement Trust Protocol · v1.0.0", 11.5f, p.muted, 500).apply { pad(t = 2) })
                    add(text("Native Android · works offline", 11f, p.faint, 400).apply { pad(t = 2) })
                }.apply { pad(l = 12) }.weight(1f))
            })
        })

        root.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(18)) })
        root.add(button("Sign out", p, "outline") {
            Dialogs.confirm(context, p, "Sign out?", if (repo.isServer && repo.outboxCount() > 0) "You have unsynced changes — they'll sync next time you sign in on this device." else "Your data stays safe on this device.", "Sign out", true) {
                repo.signOut()
            }
        })
    }

    private fun toggleRow(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit): LinearLayout = row {
        add(col {
            add(text(title, 13.5f, p.fg, 600))
            add(text(subtitle, 11.5f, p.muted, 400).apply { pad(t = 2) })
        }.weight(1f))
        add(Switch(context).apply {
            isChecked = checked
            buttonTintList = android.content.res.ColorStateList.valueOf(if (checked) p.primary else p.faint)
            setOnCheckedChangeListener { btn, on ->
                btn.buttonTintList = android.content.res.ColorStateList.valueOf(if (on) p.primary else p.faint)
                onChange(on)
            }
        })
    }.apply { pad(t = 8, b = 8) }

    private fun clickableRow(title: String, subtitle: String, onClick: () -> Unit): LinearLayout = row {
        add(col {
            add(text(title, 13.5f, p.fg, 600))
            add(text(subtitle, 11.5f, p.muted, 400).apply { pad(t = 2) })
        }.weight(1f))
        add(text("›", 18f, p.faint, 500))
    }.apply {
        pad(t = 10, b = 10)
        setOnClickListener { onClick() }
    }

    private fun newOrgSheet() {
        Dialogs.sheet(context, p, "New organization") {
            var name = ""
            add(context.fieldLabel("Name", p, true))
            add(context.input(p, "e.g. Acme Studio", onChange = { name = it }))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(14)) })
            add(context.button("Create organization", p, "primary") {
                if (name.trim().length < 2) { Dialogs.toast(context, "Enter a name"); return@button }
                Async.run({ repo.createOrganization(name.trim()) }, { r ->
                    r.onFailure { Dialogs.error(context, it) }
                    r.onSuccess { org ->
                        repo.session.switchOrg(org.id)
                        Dialogs.dismissAll()
                        Dialogs.toast(context, "${org.name} created")
                        Bus.emit(Bus.SESSION_CHANGED)
                    }
                })
            })
        }
    }

    private fun changePasswordSheet() {
        Dialogs.sheet(context, p, "Change password") {
            var current = ""; var next = ""; var confirm = ""
            add(context.fieldLabel("Current password", p, true))
            add(context.input(p, "Current", password = true, onChange = { current = it }))
            add(context.fieldLabel("New password", p, true))
            add(context.input(p, "8+ characters", password = true, onChange = { next = it }))
            add(context.fieldLabel("Confirm new password", p, true))
            add(context.input(p, "Repeat", password = true, onChange = { confirm = it }))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(14)) })
            add(context.button("Update password", p, "primary") {
                if (!Rules.isPassword(next)) { Dialogs.toast(context, "New password must be 8–128 characters"); return@button }
                if (next != confirm) { Dialogs.toast(context, "Passwords don't match"); return@button }
                Async.run({ repo.changePassword(current, next) }, { r ->
                    r.onFailure { Dialogs.error(context, it) }
                    r.onSuccess { Dialogs.dismissAll(); Dialogs.toast(context, "Password updated") }
                })
            })
        }
    }

    private fun twoFactorSheet() {
        val user = repo.user() ?: return
        if (user.twoFactorEnabled) {
            Dialogs.sheet(context, p, "Two-factor authentication") {
                add(context.text("2FA is enabled on this account. To disable it, confirm your password.", 13.5f, p.muted, 400).apply { pad(b = 10) })
                var password = ""
                add(context.input(p, "Password", password = true, onChange = { password = it }))
                add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(14)) })
                add(context.button("Disable 2FA", p, "danger") {
                    Async.run({ repo.disable2fa(password) }, { r ->
                        r.onFailure { Dialogs.error(context, it) }
                        r.onSuccess { Dialogs.dismissAll(); Dialogs.toast(context, "2FA disabled"); build() }
                    })
                })
            }
            return
        }
        // Setup flow: get secret → show manual key → verify code → backup codes
        Async.run({ repo.setup2fa() }, { r ->
            r.onFailure { Dialogs.error(context, it) }
            r.onSuccess { setup ->
                Dialogs.sheet(context, p, "Set up two-factor") {
                    add(context.text("1. In your authenticator app (Google Authenticator, Aegis, 1Password…), add a key manually:", 13f, p.muted, 400).apply { pad(b = 8) })
                    add(context.text(setup.secret, 15f, p.fg, 700, font = "mono").apply {
                        background = Shapes.round(p.cardAlt, 10f); padAll(12)
                        setOnLongClickListener {
                            val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            cm.setPrimaryClip(android.content.ClipData.newPlainText("2FA secret", setup.secret))
                            Dialogs.toast(context, "Key copied")
                            true
                        }
                    })
                    add(context.text("Type: time-based · Account: ${user.email}", 11.5f, p.faint, 400).apply { pad(t = 6) })
                    add(context.text("2. Enter the 6-digit code to confirm:", 13f, p.muted, 400).apply { pad(t = 14, b = 8) })
                    var code = ""
                    add(context.input(p, "123456", keyboard = InputType.TYPE_CLASS_NUMBER, onChange = { code = it }))
                    add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(14)) })
                    add(context.button("Verify & enable", p, "primary") {
                        Async.run({ repo.enable2fa(code.trim()) }, { rr ->
                            rr.onFailure { Dialogs.error(context, it) }
                            rr.onSuccess { codes ->
                                Dialogs.dismissAll()
                                Dialogs.sheet(context, p, "Save your backup codes") {
                                    add(context.text("Each code works once if you lose your authenticator. Store them somewhere safe.", 13f, p.muted, 400).apply { pad(b = 10) })
                                    add(context.text(codes.joinToString("\n"), 14f, p.fg, 600, font = "mono").apply {
                                        background = Shapes.round(p.cardAlt, 10f); padAll(14)
                                    })
                                    add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(12)) })
                                    add(context.button("Copy codes", p, "soft") {
                                        val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                        cm.setPrimaryClip(android.content.ClipData.newPlainText("Backup codes", codes.joinToString("\n")))
                                        Dialogs.toast(context, "Copied")
                                    })
                                    add(context.button("Done", p, "primary") { Dialogs.dismissAll(); build() }.apply { pad(t = 8) })
                                }
                            }
                        })
                    })
                }
            }
        })
    }

    private fun exportAll() {
        Async.run({
            val contracts = repo.contracts()
            val sb = StringBuilder("{\"exportedAt\":\"${com.taskcontract.android.domain.Time.nowIso()}\",\"organization\":\"${repo.currentOrg()?.first?.name}\",\"contracts\":[")
            sb.append(contracts.joinToString(",") { repo.exportJson(it.id) })
            sb.append("]}")
            sb.toString()
        }, { r ->
            r.onFailure { Dialogs.error(context, it) }
            r.onSuccess { json ->
                com.taskcontract.android.platform.ExportProvider.writeAndShare(context, "taskcontract-workspace.json", json, "application/json")
            }
        })
    }
}

/** Profile: personal info + password + account details. */
class ProfileScreen(a: MainActivity) : Screen(a) {
    init {
        scaffold("Profile", back = true) {
            val user = repo.user() ?: return@scaffold
            add(row {
                gravity = Gravity.CENTER_HORIZONTAL
                add(avatar(user, p, 72))
            }.apply { pad(t = 8, b = 8) })
            add(text(user.name, 20f, p.fg, 700, font = "display", align = Gravity.CENTER))
            add(text(user.email, 13f, p.muted, 400, align = Gravity.CENTER).apply { pad(t = 3, b = 16) })

            var first = user.firstName; var last = user.lastName; var title = user.title ?: ""
            add(fieldLabel("First name", p))
            add(input(p, "First name", value = first, onChange = { first = it }))
            add(fieldLabel("Last name", p))
            add(input(p, "Last name", value = last, onChange = { last = it }))
            add(fieldLabel("Title", p))
            add(input(p, "e.g. Product Designer", value = title, onChange = { title = it }))
            add(fieldLabel("Email", p))
            add(input(p, "", value = user.email, onChange = {}).apply { isEnabled = false; alpha = 0.6f })
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(16)) })
            add(button("Save profile", p, "primary") {
                if (!Rules.isName(first) || !Rules.isName(last)) { Dialogs.toast(context, "Names are required"); return@button }
                Async.run({ repo.updateProfile(first.trim(), last.trim(), title.trim().ifEmpty { null }) }, { r ->
                    r.onFailure { Dialogs.error(context, it) }
                    r.onSuccess { Dialogs.toast(context, "Profile saved"); activity.nav.pop() }
                })
            })
            add(text("Member since ${com.taskcontract.android.domain.Time.formatDeadline(user.createdAt)}", 11.5f, p.faint, 400, align = Gravity.CENTER).apply { pad(t = 14) })
        }
    }
}
