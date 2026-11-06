package com.taskcontract.android.ui.screens

import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import com.taskcontract.android.MainActivity
import com.taskcontract.android.Screen
import com.taskcontract.android.core.Async
import com.taskcontract.android.core.Bus
import com.taskcontract.android.core.Json
import com.taskcontract.android.core.s
import com.taskcontract.android.data.Seed
import com.taskcontract.android.data.SessionManager
import com.taskcontract.android.domain.DomainException
import com.taskcontract.android.domain.Rules
import com.taskcontract.android.ui.*

/** Entry screen: brand hero, sign in / create account, demo workspace, server connect. */
class WelcomeScreen(a: MainActivity) : Screen(a) {
    private var mode = "login" // login | register
    private var serverMode = false
    private val body: LinearLayout

    init {
        val sv = scroll { render(this) }
        addView(sv, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        body = sv.getChildAt(0) as LinearLayout
    }

    private fun render(root: LinearLayout) {
        root.removeAllViews()
        root.pad(24, 28, 24, 32)
        // Brand
        root.add(row {
            add(SealView(context, p, "TCP").apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(52), Ui.dp(52)) })
            add(col {
                add(text("TaskContract", 24f, p.fg, 700, font = "display"))
                add(text("AGREEMENT TRUST PROTOCOL", 10f, p.brass, 700).apply { letterSpacing = 0.14f })
            }.apply { pad(l = 12) })
        }.apply { pad(b = 26) })

        root.add(text(if (mode == "login") "Welcome back." else "Create your workspace.", 30f, p.fg, 600, font = "display").apply { pad(b = 6) })
        root.add(text(
            if (mode == "login") "Every promise, sealed. Sign in to your contracts."
            else "Turn work agreements into accountable, trackable contracts.",
            14.5f, p.muted, 400).apply { pad(b = 20) })

        // Mode toggle
        root.add(row {
            add(chip("On this device", p, !serverMode) { serverMode = false; render(root) })
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(8), 1) })
            add(chip("Team server", p, serverMode) { serverMode = true; render(root) })
        }.apply { pad(b = 6) })
        root.add(text(
            if (!serverMode) "Private workspace stored on this phone. Works fully offline."
            else "Connect to your organization's TaskContract server and sync across devices.",
            12f, p.faint, 400).apply { pad(b = 16) })

        var email = ""; var password = ""; var first = ""; var last = ""; var org = ""; var otp = ""

        if (mode == "register") {
            root.add(row {
                add(col {
                    add(fieldLabel("First name", p, true))
                    add(input(p, "Alex", onChange = { first = it }))
                }.weight(1f))
                add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(10), 1) })
                add(col {
                    add(fieldLabel("Last name", p, true))
                    add(input(p, "Morgan", onChange = { last = it }))
                }.weight(1f))
            })
            root.add(fieldLabel("Organization", p))
            root.add(input(p, "Northwind Studio (optional)", onChange = { org = it }))
        }
        root.add(fieldLabel("Email", p, true))
        root.add(input(p, "you@company.com", keyboard = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, onChange = { email = it }))
        root.add(fieldLabel("Password", p, true))
        root.add(input(p, if (mode == "register") "8+ characters" else "Your password", password = true, keyboard = InputType.TYPE_TEXT_VARIATION_PASSWORD, onChange = { password = it }))
        if (mode == "login") {
            root.add(fieldLabel("2FA code (if enabled)", p))
            root.add(input(p, "6-digit code or backup code", keyboard = InputType.TYPE_CLASS_NUMBER, onChange = { otp = it }))
        }

        root.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(18)) })
        val cta = button(if (mode == "login") "Sign in" else "Create account", p, "primary") {}
        cta.setOnClickListener {
            val e = email.trim(); val pw = password
            if (!Rules.isEmail(e)) { Dialogs.toast(context, "Enter a valid email"); return@setOnClickListener }
            if (!Rules.isPassword(pw)) { Dialogs.toast(context, "Password must be 8–128 characters"); return@setOnClickListener }
            if (mode == "register" && (!Rules.isName(first) || !Rules.isName(last))) { Dialogs.toast(context, "Enter your first and last name"); return@setOnClickListener }
            cta.isEnabled = false; cta.text = "Please wait…"
            Async.run({
                if (mode == "login") {
                    if (serverMode) RepositoryAuthResultServer(repo.loginServer(e, pw, otp.ifBlank { null }))
                    else RepositoryAuthResultDevice(repo.loginDevice(e, pw, otp.ifBlank { null }))
                } else {
                    if (serverMode) RepositoryAuthResultDevice(repo.registerServer(e, pw, first.trim(), last.trim(), org.trim().ifEmpty { null }))
                    else RepositoryAuthResultDevice(repo.registerDevice(e, pw, first.trim(), last.trim(), org.trim().ifEmpty { null }))
                }
            }) { result ->
                cta.isEnabled = true; cta.text = if (mode == "login") "Sign in" else "Create account"
                result.onFailure { Dialogs.error(context, it) }
                result.onSuccess { r ->
                    when (r) {
                        is RepositoryAuthResultServer -> if (r.result.requires2fa) {
                            activity.nav.push(TwoFactorChallengeScreen(activity, r.result.challengeToken ?: ""))
                        }
                        else -> {} // SESSION_CHANGED routes home
                    }
                }
            }
        }
        root.add(cta)

        root.add(row {
            gravity = Gravity.CENTER
            if (mode == "login") {
                add(text("Forgot password?", 13f, p.primary, 600).apply {
                    padAll(10)
                    setOnClickListener { activity.nav.push(ForgotPasswordScreen(activity, serverMode)) }
                })
            }
            add(text(if (mode == "login") "Create account" else "I already have an account", 13f, p.primary, 600).apply {
                padAll(10)
                setOnClickListener { mode = if (mode == "login") "register" else "login"; render(root) }
            })
        }.apply { pad(t = 8) })

        // Divider
        root.add(row {
            add(View(context).apply { setBackgroundColor(p.border) }.weight(1f).apply { layoutParams = LinearLayout.LayoutParams(0, Ui.dp(1), 1f) })
            add(text("  or explore instantly  ", 12f, p.faint, 500))
            add(View(context).apply { setBackgroundColor(p.border) }.weight(1f).apply { layoutParams = LinearLayout.LayoutParams(0, Ui.dp(1), 1f) })
        }.apply { pad(t = 14, b = 14) })

        root.add(button("Try the demo workspace", p, "brass", icon = "◈") {
            Async.run({ repo.enterDemo() }, { r -> r.onFailure { Dialogs.error(context, it) } })
        })
        root.add(text("Northwind Studio · 6 teammates · 7 contracts · sign-in ${Seed.DEMO_EMAIL} / ${Seed.DEMO_PASSWORD}", 11.5f, p.faint, 400, align = Gravity.CENTER).apply { pad(t = 10) })

        if (serverMode) {
            root.add(text("Server: ${repo.session.baseUrl}", 11f, p.faint, 400, font = "mono", align = Gravity.CENTER).apply {
                pad(t = 16)
                setOnClickListener { serverSettings() }
            })
            root.add(text("Change server", 12f, p.primary, 600, align = Gravity.CENTER).apply {
                pad(t = 4)
                setOnClickListener { serverSettings() }
            })
        }
    }

    private fun serverSettings() {
        Dialogs.sheet(context, p, "Team server") {
            add(context.text("Base URL of your TaskContract API (ending in /api/v1).", 13f, p.muted, 400).apply { pad(b = 12) })
            val field = context.input(p, "https://…/api/v1", value = repo.session.baseUrl, keyboard = InputType.TYPE_TEXT_VARIATION_URI)
            add(field)
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(14)) })
            add(context.button("Save", p, "primary") {
                val v = field.text.toString().trim().trimEnd('/')
                if (!v.startsWith("http")) { field.error = "Must start with http(s)://"; return@button }
                repo.session.baseUrl = v
                Dialogs.toast(context, "Server updated")
                Dialogs.dismissAll()
                render(body)
            })
        }
    }
}

// Small wrappers so Async.run has one result type across device/server paths.
sealed class AuthOutcome
class RepositoryAuthResultDevice(val user: com.taskcontract.android.domain.User) : AuthOutcome()
class RepositoryAuthResultServer(val result: com.taskcontract.android.data.Repository.AuthResult) : AuthOutcome()

/** 2FA challenge after server login. */
class TwoFactorChallengeScreen(a: MainActivity, private val challengeToken: String) : Screen(a) {
    init {
        scaffold("Two-factor check", back = true) {
            add(text("Enter the 6-digit code from your authenticator app, or one of your backup codes.", 14f, p.muted, 400).apply { pad(b = 16) })
            var code = ""
            add(input(p, "123456", keyboard = InputType.TYPE_CLASS_NUMBER, onChange = { code = it }))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(16)) })
            val btn = button("Verify", p, "primary") {}
            btn.setOnClickListener {
                if (code.isBlank()) { Dialogs.toast(context, "Enter your code"); return@setOnClickListener }
                btn.isEnabled = false
                Async.run({ repo.verify2faServer(challengeToken, code.trim()) }, { r ->
                    btn.isEnabled = true
                    r.onFailure { Dialogs.error(context, it) }
                })
            }
            add(btn)
        }
    }
}

/** Forgot / reset password. Server mode talks to the API; device mode explains recovery. */
class ForgotPasswordScreen(a: MainActivity, private val serverMode: Boolean) : Screen(a) {
    init {
        scaffold("Reset password", back = true) {
            if (!serverMode) {
                add(card(p) {
                    add(text("On-device accounts", 16f, p.fg, 700, font = "display").apply { pad(b = 8) })
                    add(text("Device workspaces are private to this phone — there is no email recovery. If you used the demo, sign in with ${Seed.DEMO_EMAIL} / ${Seed.DEMO_PASSWORD}. Otherwise create a new account; existing data stays in the local database.", 13.5f, p.muted, 400))
                })
                return@scaffold
            }
            add(text("We'll issue a reset token for your account. If your server has no mail provider configured, the token is shown directly so you can complete the reset.", 13.5f, p.muted, 400).apply { pad(b = 16) })
            var email = ""
            add(fieldLabel("Email", p, true))
            add(input(p, "you@company.com", keyboard = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, onChange = { email = it }))
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(14)) })
            val resultArea = col {}
            add(button("Send reset token", p, "primary") {
                Async.run({ repo.forgotPassword(email.trim()) }, { r ->
                    r.onFailure { Dialogs.error(context, it) }
                    r.onSuccess { data ->
                        resultArea.removeAllViews()
                        val token = data.s("resetToken")
                        resultArea.add(text(Json.str(data["message"]) ?: "If an account exists, a reset link is on its way.", 13.5f, p.success, 600).apply { pad(t = 14, b = 8) })
                        var resetToken = token ?: ""
                        var newPw = ""
                        resultArea.add(fieldLabel("Reset token", p, true))
                        resultArea.add(input(p, "Paste token", value = token ?: "", onChange = { resetToken = it }))
                        resultArea.add(fieldLabel("New password", p, true))
                        resultArea.add(input(p, "8+ characters", password = true, onChange = { newPw = it }))
                        resultArea.add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(14)) })
                        resultArea.add(button("Set new password", p, "primary") {
                            Async.run({ repo.resetPassword(resetToken.trim(), newPw) }, { r2 ->
                                r2.onFailure { Dialogs.error(context, it) }
                                r2.onSuccess { Dialogs.toast(context, "Password reset — welcome back") }
                            })
                        })
                    }
                })
            })
            add(resultArea)
        }
    }
}

/** Accept an organization invite (deep link taskcontract://invite?token=…). */
class AcceptInviteScreen(a: MainActivity, private val token: String) : Screen(a) {
    init {
        scaffold("Team invitation", back = true) {
            val area = col {}
            add(area)
            area.add(loading(p))
            Async.run({ repo.inviteInfo(token) }, { r ->
                area.removeAllViews()
                r.onFailure { e -> area.add(emptyState("✕", "Invite unavailable", e.message ?: "This invite is invalid or expired.", p)) }
                r.onSuccess { info ->
                    val org = Json.obj(info["organization"])
                    area.add(card(p) {
                        add(text("You're invited", 18f, p.fg, 700, font = "display").apply { pad(b = 6) })
                        add(text("${info.s("email")} → ${org.s("name")} as ${info.s("role")}", 14f, p.muted, 500).apply { pad(b = 14) })
                        add(button("Accept invitation", p, "primary") {
                            Async.run({ repo.acceptInvite(token) }, { r2 ->
                                r2.onFailure { Dialogs.error(context, it) }
                                r2.onSuccess { o ->
                                    Dialogs.toast(context, "Joined ${o.name}")
                                    Bus.emit(Bus.SESSION_CHANGED)
                                }
                            })
                        })
                    })
                }
            })
        }
    }
}
