package com.taskcontract.android

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.taskcontract.android.core.Bus
import com.taskcontract.android.data.SessionManager
import com.taskcontract.android.domain.Action
import com.taskcontract.android.domain.Status
import com.taskcontract.android.ui.*
import com.taskcontract.android.ui.screens.*

/**
 * Single-activity architecture. A custom Navigator manages a back stack of
 * native Screen views — no fragments, no WebView.
 */
class MainActivity : android.app.Activity() {
    lateinit var nav: Navigator
    private lateinit var root: FrameLayout
    private lateinit var content: FrameLayout
    private lateinit var bottomNav: LinearLayout
    private var bottomTabs: List<Triple<String, String, () -> Screen>> = emptyList()
    var currentTab = "home"
    private var locked = false
    /** Survives recreation & navigation; cleared on sign-out. Holds wizard drafts. */
    val draftCache: HashMap<String, Any> get() = (application as App).draftCache

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as App
        Ui.density = resources.displayMetrics.density
        Fonts.load(this)

        root = frame {}
        content = frame {}
        bottomNav = row {}

        val column = col {
            add(content, ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
            add(bottomNav, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        root.addView(column, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        setContentView(root)

        nav = Navigator(this, content)
        nav.onChanged = { updateBottomNav() }

        applySystemBars()
        buildBottomNav()
        routeInitial(intent)

        Bus.on(Bus.THEME_CHANGED) { recreate() }
        Bus.on(Bus.SESSION_CHANGED) {
            runOnUiThread {
                // Re-route only when the account or active org changed —
                // profile edits also emit SESSION_CHANGED but shouldn't reset navigation.
                val key = "${app.repo.session.userId}|${app.repo.session.orgId}"
                if (key != lastSessionKey) { lastSessionKey = key; routeInitial(null) }
            }
        }
        Bus.on(Bus.NOTIFICATIONS_CHANGED) { runOnUiThread { updateBottomNav() } }

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 10)
        }
    }

    private fun applySystemBars() {
        val p = palette()
        window.statusBarColor = p.bg
        window.navigationBarColor = p.bg
        var flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        if (!p.dark) flags = flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        if (Build.VERSION.SDK_INT >= 27 && !p.dark) flags = flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        window.decorView.systemUiVisibility = flags
        root.setPadding(0, statusBarHeight(), 0, 0)
    }

    private fun statusBarHeight(): Int {
        val id = resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (id > 0) resources.getDimensionPixelSize(id) else Ui.dp(24)
    }

    fun palette(): Palette = Palette.forContext(this, (application as App).repo.session.theme)

    /** Deep link received while signed out — replayed after sign-in (invite flow). */
    private var pendingUri: android.net.Uri? = null
    private var lastSessionKey: String? = null

    private fun routeInitial(intent: Intent?) {
        val app = application as App
        lastSessionKey = "${app.repo.session.userId}|${app.repo.session.orgId}"
        if (intent?.data != null) pendingUri = intent.data
        nav.clear()
        if (!app.repo.session.signedIn) {
            draftCache.clear()
            bottomNav.visibility = View.GONE
            nav.push(WelcomeScreen(this), animate = false)
            return
        }
        bottomNav.visibility = View.VISIBLE
        maybeBiometricLock {
            val data = pendingUri ?: intent?.data
            pendingUri = null
            when {
                data?.host == "contract" -> {
                    nav.push(DashboardScreen(this), animate = false)
                    data.lastPathSegment?.let { nav.push(ContractDetailScreen(this, it)) }
                }
                data?.host == "new" -> {
                    nav.push(DashboardScreen(this), animate = false)
                    nav.push(CreateContractScreen(this))
                }
                data?.host == "notifications" -> {
                    nav.push(NotificationsScreen(this), animate = false)
                }
                data?.host == "invite" -> {
                    nav.push(TeamScreen(this), animate = false)
                    data.getQueryParameter("token")?.let { nav.push(AcceptInviteScreen(this, it)) }
                }
                else -> {
                    currentTab = "home"
                    nav.push(DashboardScreen(this), animate = false)
                }
            }
            updateBottomNav()
        }
    }

    private fun maybeBiometricLock(onUnlock: () -> Unit) {
        val app = application as App
        if (!app.repo.session.biometricLock) { onUnlock(); return }
        if (locked) return // auth prompt already up; its callback will route
        locked = true
        val p = palette()
        val overlay = col {
            gravity = Gravity.CENTER
            setBackgroundColor(p.bg)
            add(text("◈", 44f, p.brass, 600, align = Gravity.CENTER).apply { pad(b = 12) })
            add(text("TaskContract", 26f, p.fg, 700, font = "display", align = Gravity.CENTER).apply { pad(b = 8) })
            add(text("Locked — authenticate to continue", 14f, p.muted, 500, align = Gravity.CENTER).apply { pad(b = 28) })
            add(button("Unlock", p, "primary") { promptBiometric(onUnlock) })
        }
        root.addView(overlay, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        promptBiometric(onUnlock) { root.removeView(overlay) }
    }

    private fun promptBiometric(onUnlock: () -> Unit, onDone: (() -> Unit)? = null) {
        val app = application as App
        fun finish() {
            locked = false
            onUnlock()
            onDone?.invoke()
        }
        if (Build.VERSION.SDK_INT >= 29) {
            val bm = getSystemService(android.hardware.biometrics.BiometricManager::class.java)
            val can = if (Build.VERSION.SDK_INT >= 30) {
                bm?.canAuthenticate(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_WEAK or android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            } else {
                bm?.canAuthenticate()
            }
            // API 29's canAuthenticate() only probes biometrics; a secure keyguard
            // alone is enough for the device-credential path.
            val available = can == android.hardware.biometrics.BiometricManager.BIOMETRIC_SUCCESS ||
                (Build.VERSION.SDK_INT == 29 && getSystemService(android.app.KeyguardManager::class.java)?.isDeviceSecure == true)
            if (available) {
                // NB: no negative button — the framework throws if one is set
                // while device credential is allowed.
                val builder = android.hardware.biometrics.BiometricPrompt.Builder(this)
                    .setTitle("Unlock TaskContract")
                    .setSubtitle("Verify it's you to open your contracts")
                if (Build.VERSION.SDK_INT >= 30) {
                    builder.setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_WEAK or android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                } else {
                    builder.setDeviceCredentialAllowed(true)
                }
                builder.build().authenticate(android.os.CancellationSignal(), mainExecutor, object : android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: android.hardware.biometrics.BiometricPrompt.AuthenticationResult?) { finish() }
                    override fun onAuthenticationError(code: Int, msg: CharSequence?) {
                        // 10 = USER_CANCELED, 13 = NEGATIVE_BUTTON — stay locked; overlay offers retry.
                    }
                })
                return
            }
        }
        // No secure lock screen / biometrics enrolled — can't enforce, don't trap the user out.
        finish()
    }

    private fun buildBottomNav() {
        bottomTabs = listOf(
            Triple("home", "⌂", { DashboardScreen(this) }),
            Triple("contracts", "▤", { ContractsScreen(this) }),
            Triple("reports", "◔", { ReportsScreen(this) }),
            Triple("team", "◉", { TeamScreen(this) }),
            Triple("settings", "⚙", { SettingsScreen(this) })
        )
        renderBottomNav()
    }

    private fun renderBottomNav() {
        val p = palette()
        bottomNav.removeAllViews()
        bottomNav.setBackgroundColor(p.card)
        val border = View(this).apply { setBackgroundColor(p.border) }
        // top border via a wrapper is overkill; draw simple divider above using foreground
        for ((id, glyph, factory) in bottomTabs) {
            val selected = currentTab == id
            val tab = col {
                gravity = Gravity.CENTER
                add(text(glyph, 19f, if (selected) p.primary else p.muted, 600, align = Gravity.CENTER))
                add(text(id.replaceFirstChar { it.uppercase() }, 10.5f, if (selected) p.primary else p.muted, if (selected) 700 else 500, align = Gravity.CENTER).apply { pad(t = 3) })
            }
            tab.pad(0, 10, 0, 12)
            tab.background = Shapes.ripple(null, null, Palette.withAlpha(p.primary, 0.1f))
            tab.setOnClickListener {
                if (currentTab == id && nav.depth() == 1) return@setOnClickListener
                currentTab = id
                nav.clear()
                nav.push(factory(), animate = true)
                updateBottomNav()
            }
            bottomNav.addView(tab, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }
    }

    private fun updateBottomNav() {
        renderBottomNav()
        val app = application as App
        bottomNav.visibility = if (app.repo.session.signedIn) View.VISIBLE else View.GONE
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        routeInitial(intent)
    }

    override fun onBackPressed() {
        if (!nav.pop()) super.onBackPressed()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        (nav.current() as? com.taskcontract.android.ui.screens.ContractDetailScreen)?.onPickAttachment(requestCode, resultCode, data)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        recreate()
    }
}

/** A screen is a native View with lifecycle hooks. */
abstract class Screen(val activity: MainActivity) : FrameLayout(activity) {
    val repo get() = (activity.application as App).repo
    val p get() = activity.palette()
    private val busHandles = mutableListOf<() -> Unit>()

    init {
        setBackgroundColor(p.bg)
        isClickable = true // block touch pass-through
    }

    fun listen(event: String, handler: () -> Unit) {
        val off = Bus.on(event) { activity.runOnUiThread { if (isAttachedToWindow) handler() } }
        busHandles.add(off)
    }

    open fun onResume() {}

    fun destroy() {
        busHandles.forEach { it() }
        busHandles.clear()
        onDestroyed()
    }

    open fun onDestroyed() {}

    /** Standard screen scaffold: top bar + scrolling body. */
    fun scaffold(title: String?, subtitle: String? = null, back: Boolean = false, actions: LinearLayout.() -> Unit = {}, body: LinearLayout.() -> Unit): LinearLayout {
        val column = col {
            if (title != null) {
                add(row {
                    pad(8, 10, 12, 10)
                    if (back) add(iconButton("←", p, 22f, "Back") { activity.nav.pop() })
                    else add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(8), 1) })
                    add(col {
                        add(text(title, 20f, p.fg, 700, font = "display"))
                        if (subtitle != null) add(text(subtitle, 12f, p.muted, 500).apply { pad(t = 2) })
                    }.weight(1f).apply { pad(l = if (back) 4 else 10) })
                    actions()
                })
                add(View(context).apply { setBackgroundColor(p.border) }, ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(1))
            }
            val scroll = scroll(body)
            scroll.isFillViewport = true
            add(scroll, ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        addView(column, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        (column.getChildAt(column.childCount - 1) as android.widget.ScrollView).let { sv ->
            (sv.getChildAt(0) as LinearLayout).pad(16, 4, 16, 28)
        }
        return column
    }
}

/** Back-stack navigator over native views with slide transitions. */
class Navigator(private val activity: MainActivity, private val container: FrameLayout) {
    private val stack = mutableListOf<Screen>()
    var onChanged: (() -> Unit)? = null

    fun depth() = stack.size

    fun current(): Screen? = stack.lastOrNull()

    fun push(screen: Screen, animate: Boolean = true) {
        stack.lastOrNull()?.let { it.visibility = View.GONE }
        stack.add(screen)
        container.addView(screen, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        if (animate) {
            screen.translationX = container.width * 0.25f
            screen.alpha = 0f
            screen.animate().translationX(0f).alpha(1f).setDuration(240).setInterpolator(android.view.animation.DecelerateInterpolator()).start()
        }
        screen.onResume()
        onChanged?.invoke()
    }

    fun pop(): Boolean {
        if (stack.size <= 1) return false
        val top = stack.removeAt(stack.size - 1)
        container.removeView(top)
        top.destroy()
        stack.lastOrNull()?.let {
            it.visibility = View.VISIBLE
            it.onResume()
        }
        onChanged?.invoke()
        return true
    }

    fun replace(screen: Screen) {
        while (stack.isNotEmpty()) {
            val top = stack.removeAt(stack.size - 1)
            container.removeView(top)
            top.destroy()
        }
        push(screen, animate = false)
    }

    fun clear() {
        while (stack.isNotEmpty()) {
            val top = stack.removeAt(stack.size - 1)
            container.removeView(top)
            top.destroy()
        }
        onChanged?.invoke()
    }
}
