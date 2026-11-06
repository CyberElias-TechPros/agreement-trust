package com.taskcontract.android.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import com.taskcontract.android.domain.Priority
import com.taskcontract.android.domain.Status
import com.taskcontract.android.domain.User

/** Screen metrics + programmatic view DSL. Everything is native Views — no WebView. */
object Ui {
    var density = 3f
    fun dp(v: Float): Int = (v * density).toInt()
    fun dp(v: Int): Int = (v * density).toInt()
    fun dp(v: Double): Int = (v * density).toInt()
}

fun Context.col(init: LinearLayout.() -> Unit): LinearLayout = LinearLayout(this).apply {
    orientation = LinearLayout.VERTICAL
    init()
}

fun Context.row(init: LinearLayout.() -> Unit): LinearLayout = LinearLayout(this).apply {
    orientation = LinearLayout.HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    init()
}

fun Context.frame(init: FrameLayout.() -> Unit): FrameLayout = FrameLayout(this).apply { init() }

fun Context.scroll(init: LinearLayout.() -> Unit): ScrollView = ScrollView(this).apply {
    isFillViewport = true
    overScrollMode = View.OVER_SCROLL_NEVER
    val content = col(init)
    addView(content, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
}

fun Context.hscroll(init: LinearLayout.() -> Unit): HorizontalScrollView = HorizontalScrollView(this).apply {
    isHorizontalScrollBarEnabled = false
    overScrollMode = View.OVER_SCROLL_NEVER
    addView(row(init), ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT)
}

fun ViewGroup.add(v: View, w: Int = ViewGroup.LayoutParams.MATCH_PARENT, h: Int = ViewGroup.LayoutParams.WRAP_CONTENT, weight: Float = 0f, init: (View.() -> Unit)? = null): View {
    // Respect LayoutParams the caller already set (badges, spacers, avatars, FAB)
    // when no explicit sizing was requested; otherwise apply the given sizing.
    val explicit = w != ViewGroup.LayoutParams.MATCH_PARENT || h != ViewGroup.LayoutParams.WRAP_CONTENT || weight != 0f
    if (v.layoutParams == null || explicit) {
        // In horizontal rows the natural default is WRAP_CONTENT width —
        // MATCH_PARENT would let the first child swallow the row.
        val width = if (!explicit && this is LinearLayout && orientation == LinearLayout.HORIZONTAL) ViewGroup.LayoutParams.WRAP_CONTENT else w
        v.layoutParams = if (this is LinearLayout) LinearLayout.LayoutParams(width, h, weight) else FrameLayout.LayoutParams(w, h)
    }
    init?.invoke(v)
    addView(v)
    return v
}

fun View.pad(l: Int = 0, t: Int = 0, r: Int = 0, b: Int = 0): View { setPadding(Ui.dp(l), Ui.dp(t), Ui.dp(r), Ui.dp(b)); return this }
fun View.padAll(v: Int): View = pad(v, v, v, v)
fun View.margins(l: Int = 0, t: Int = 0, r: Int = 0, b: Int = 0): View {
    val lp = layoutParams
    if (lp is ViewGroup.MarginLayoutParams) lp.setMargins(Ui.dp(l), Ui.dp(t), Ui.dp(r), Ui.dp(b))
    return this
}
fun View.weight(w: Float): View {
    val lp = layoutParams
    if (lp is LinearLayout.LayoutParams) { lp.weight = w; lp.width = 0 }
    else layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, w)
    return this
}

fun Context.text(
    text: String, size: Float = 14f, color: Int = 0, weight: Int = 400, font: String = "body",
    align: Int = Gravity.START, maxLines: Int = Int.MAX_VALUE, init: (TextView.() -> Unit)? = null
): TextView = TextView(this).apply {
    this.text = text
    setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
    if (color != 0) setTextColor(color)
    typeface = when (font) { "display" -> Fonts.display(weight); "mono" -> Fonts.mono(weight); else -> Fonts.body(weight) }
    gravity = align
    if (maxLines != Int.MAX_VALUE) { this.maxLines = maxLines; ellipsize = android.text.TextUtils.TruncateAt.END }
    includeFontPadding = false
    init?.invoke(this)
}

fun Context.label(text: String, p: Palette): TextView =
    text(text.uppercase(), 11f, p.muted, 700, init = { letterSpacing = 0.08f }).apply { pad(b = 6) }

/** Branded buttons */
fun Context.button(
    label: String, p: Palette, style: String = "primary", icon: String? = null,
    enabled: Boolean = true, onClick: () -> Unit
): TextView {
    val (bg, fg) = when (style) {
        "primary" -> p.primary to p.onPrimary
        "brass" -> p.brass to p.ink
        "danger" -> p.danger to Color.WHITE
        "soft" -> p.primarySoft to p.primary
        "ghost" -> Color.TRANSPARENT to p.fg
        "outline" -> Color.TRANSPARENT to p.fg
        else -> p.primarySoft to p.primary
    }
    return text((if (icon != null) "$icon  " else "") + label, 14.5f, fg, 600, align = Gravity.CENTER).apply {
        val radius = 14f
        background = Shapes.ripple(
            Shapes.round(bg, radius, if (style == "outline") p.border else null),
            Shapes.round(Color.WHITE, radius),
            Palette.withAlpha(if (style == "primary" || style == "danger") Color.WHITE else p.primary, 0.18f)
        )
        padAll(14)
        minHeight = Ui.dp(48)
        gravity = Gravity.CENTER
        isEnabled = enabled
        alpha = if (enabled) 1f else 0.5f
        isClickable = true
        isFocusable = true
        setOnClickListener {
            it.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
            onClick()
        }
    }
}

fun Context.iconButton(glyph: String, p: Palette, size: Float = 20f, contentDescription: String? = null, onClick: () -> Unit): TextView =
    text(glyph, size, p.fg, 500, align = Gravity.CENTER).apply {
        background = Shapes.ripple(Shapes.oval(Color.TRANSPARENT), Shapes.oval(Color.WHITE), Palette.withAlpha(p.fg, 0.1f))
        minimumWidth = Ui.dp(44); minimumHeight = Ui.dp(44)
        gravity = Gravity.CENTER
        this.contentDescription = contentDescription
        setOnClickListener { onClick() }
    }

/** Cards */
fun Context.card(p: Palette, radius: Float = 18f, border: Boolean = true, init: LinearLayout.() -> Unit): LinearLayout =
    col(init).apply {
        background = Shapes.round(p.card, radius, if (border) p.border else null)
        padAll(16)
    }

fun Context.clickableCard(p: Palette, radius: Float = 18f, onClick: () -> Unit, init: LinearLayout.() -> Unit): LinearLayout =
    card(p, radius, true, init).apply {
        val bg = background
        background = Shapes.ripple(bg, Shapes.round(Color.WHITE, radius), Palette.withAlpha(p.primary, 0.12f))
        isClickable = true
        setOnClickListener { onClick() }
    }

/** Status & priority badges */
fun Context.statusBadge(status: Status, p: Palette): TextView {
    val color = p.status(status)
    return text(status.label.uppercase(), 10.5f, color, 700).apply {
        letterSpacing = 0.06f
        background = Shapes.round(p.statusSoft(status), 100f)
        pad(10, 5, 10, 5)
    }
}

fun Context.priorityBadge(priority: Priority, p: Palette): TextView {
    val color = p.priority(priority)
    val glyph = when (priority) { Priority.LOW -> "↓"; Priority.MEDIUM -> "→"; Priority.HIGH -> "↑"; Priority.CRITICAL -> "⚠" }
    return text("$glyph ${priority.label}", 11f, color, 600).apply {
        background = Shapes.round(Palette.blend(color, p.card, if (p.dark) 0.2f else 0.1f), 100f)
        pad(9, 4, 9, 4)
    }
}

fun Context.chip(label: String, p: Palette, selected: Boolean, onClick: () -> Unit): TextView =
    text(label, 12.5f, if (selected) p.onPrimary else p.muted, 600).apply {
        background = Shapes.round(if (selected) p.primary else p.card, 100f, if (selected) null else p.border)
        pad(14, 8, 14, 8)
        setOnClickListener { onClick() }
    }

/** Avatar with deterministic color from user id */
fun Context.avatar(user: User?, p: Palette, sizeDp: Int = 38): TextView {
    val colors = listOf("#4C58D6", "#875CEB", "#0F956A", "#AF721D", "#D6577E", "#2A9DB8")
    val id = user?.id ?: "?"
    val color = Palette.c(colors[Math.abs(id.hashCode()) % colors.size])
    return text(user?.initials ?: "?", (sizeDp * 0.36).toFloat(), Color.WHITE, 700, align = Gravity.CENTER).apply {
        background = Shapes.oval(Palette.blend(color, if (p.dark) p.ink2 else Color.WHITE, 0.85f))
        layoutParams = LinearLayout.LayoutParams(Ui.dp(sizeDp), Ui.dp(sizeDp))
        gravity = Gravity.CENTER
    }
}

/** Inputs */
fun Context.input(
    p: Palette, hint: String, value: String = "", singleLine: Boolean = true,
    password: Boolean = false, keyboard: Int = InputType.TYPE_CLASS_TEXT, minLines: Int = 1,
    onChange: ((String) -> Unit)? = null
): EditText = EditText(this).apply {
    setText(value)
    this.hint = hint
    setHintTextColor(p.faint)
    setTextColor(p.fg)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 14.5f)
    typeface = Fonts.body(400)
    background = Shapes.round(p.card, 14f, p.border)
    pad(14, 13, 14, 13)
    inputType = keyboard or (if (password) InputType.TYPE_TEXT_VARIATION_PASSWORD else 0) or
        (if (!singleLine) InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES else 0)
    if (singleLine) { maxLines = 1; imeOptions = EditorInfo.IME_ACTION_NEXT } else {
        this.minLines = minLines
        gravity = Gravity.TOP or Gravity.START
    }
    if (onChange != null) addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        override fun afterTextChanged(s: Editable?) { onChange(s?.toString() ?: "") }
    })
}

fun Context.fieldLabel(text: String, p: Palette, required: Boolean = false): TextView =
    text(if (required) "$text *" else text, 12.5f, p.muted, 600).apply { pad(b = 6, t = 14) }

/** Simple dropdown selector built on a native dialog */
fun Context.selector(p: Palette, value: String, placeholder: String, onClick: () -> Unit): LinearLayout =
    row {
        add(text(value.ifEmpty { placeholder }, 14.5f, if (value.isEmpty()) p.faint else p.fg, 500).weight(1f))
        add(text("▾", 13f, p.muted, 500))
    }.apply {
        background = Shapes.round(p.card, 14f, p.border)
        pad(14, 13, 14, 13)
        setOnClickListener { onClick() }
    }

/** Progress bar with rounded track */
fun Context.progressBar(progress: Int, p: Palette, color: Int = 0, heightDp: Int = 6): View {
    val barColor = if (color != 0) color else p.primary
    return object : View(this) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        var value = progress.coerceIn(0, 100)
        override fun onDraw(canvas: Canvas) {
            val r = height / 2f
            paint.color = Palette.blend(p.fg, p.card, 0.12f)
            canvas.drawRoundRect(0f, 0f, width.toFloat(), height.toFloat(), r, r, paint)
            paint.color = barColor
            val w = width * value / 100f
            if (w > 0) canvas.drawRoundRect(0f, 0f, w, height.toFloat(), r, r, paint)
        }
        fun animateTo(target: Int) {
            val anim = ValueAnimator.ofInt(value, target.coerceIn(0, 100))
            anim.duration = 600
            anim.interpolator = DecelerateInterpolator()
            anim.addUpdateListener { value = it.animatedValue as Int; invalidate() }
            anim.start()
        }
    }.apply { layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(heightDp)) }
}

/** Section header with optional action */
fun Context.sectionHeader(title: String, p: Palette, actionLabel: String? = null, onAction: (() -> Unit)? = null): LinearLayout =
    row {
        add(text(title, 16f, p.fg, 700, font = "display").weight(1f))
        if (actionLabel != null && onAction != null) {
            add(text(actionLabel, 12.5f, p.primary, 600).apply {
                pad(8, 6, 8, 6)
                setOnClickListener { onAction() }
            })
        }
    }.apply { pad(t = 22, b = 10) }

/** Empty state */
fun Context.emptyState(glyph: String, title: String, subtitle: String, p: Palette, actionLabel: String? = null, onAction: (() -> Unit)? = null): LinearLayout =
    col {
        gravity = Gravity.CENTER_HORIZONTAL
        add(text(glyph, 40f, p.faint, 400, align = Gravity.CENTER).apply { pad(b = 12) })
        add(text(title, 17f, p.fg, 600, font = "display", align = Gravity.CENTER).apply { pad(b = 6) })
        add(text(subtitle, 13.5f, p.muted, 400, align = Gravity.CENTER).apply { pad(b = if (actionLabel != null) 16 else 0) })
        if (actionLabel != null && onAction != null) add(button(actionLabel, p, "soft", onClick = onAction))
    }.apply { padAll(28) }

/** Loading spinner */
fun Context.loading(p: Palette): LinearLayout = col {
    gravity = Gravity.CENTER
    add(ProgressBar(context).apply { isIndeterminate = true; indeterminateTintList = android.content.res.ColorStateList.valueOf(p.primary) })
    add(text("Loading…", 13f, p.muted, 500).apply { pad(t = 12) })
}.apply { padAll(40); gravity = Gravity.CENTER }

/** Animations */
fun View.fadeSlideIn(delayMs: Long = 0, durationMs: Long = 320) {
    alpha = 0f
    translationY = Ui.dp(14).toFloat()
    animate().alpha(1f).translationY(0f).setStartDelay(delayMs).setDuration(durationMs)
        .setInterpolator(DecelerateInterpolator(1.5f)).start()
}

fun View.stampIn(delayMs: Long = 0) {
    alpha = 0f; scaleX = 1.6f; scaleY = 1.6f; rotation = -14f
    animate().alpha(1f).scaleX(1f).scaleY(1f).rotation(-8f).setStartDelay(delayMs)
        .setDuration(420).setInterpolator(OvershootInterpolator(2.2f)).start()
}

/** Count-up text animation for stats */
fun TextView.countUp(target: Int, suffix: String = "", durationMs: Long = 700) {
    val anim = ValueAnimator.ofInt(0, target)
    anim.duration = durationMs
    anim.interpolator = DecelerateInterpolator()
    anim.addUpdateListener { text = "${it.animatedValue}$suffix" }
    anim.start()
}

/** The brass seal — drawn natively with Canvas. Used for approved contracts & branding. */
class SealView(context: Context, private val p: Palette, private val labelText: String = "SEALED") : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = p.brass
        typeface = Fonts.body(700)
        textAlign = Paint.Align.CENTER
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f; val cy = height / 2f
        val r = Math.min(cx, cy) - Ui.dp(4)
        paint.style = Paint.Style.STROKE
        paint.color = p.brass
        paint.strokeWidth = Ui.dp(2.5).toFloat()
        canvas.drawCircle(cx, cy, r, paint)
        paint.strokeWidth = Ui.dp(1).toFloat()
        canvas.drawCircle(cx, cy, r * 0.82f, paint)
        // scalloped edge
        val scallops = 24
        paint.style = Paint.Style.FILL
        for (i in 0 until scallops) {
            val a = Math.PI * 2 * i / scallops
            val sx = cx + Math.cos(a).toFloat() * r
            val sy = cy + Math.sin(a).toFloat() * r
            canvas.drawCircle(sx, sy, Ui.dp(2.2).toFloat(), paint)
        }
        // check mark
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = Ui.dp(3.5).toFloat()
        paint.strokeCap = Paint.Cap.ROUND
        paint.strokeJoin = Paint.Join.ROUND
        val path = Path()
        path.moveTo(cx - r * 0.32f, cy - r * 0.02f)
        path.lineTo(cx - r * 0.08f, cy + r * 0.24f)
        path.lineTo(cx + r * 0.36f, cy - r * 0.26f)
        canvas.drawPath(path, paint)
        // label
        textPaint.textSize = r * 0.2f
        textPaint.letterSpacing = 0.18f
        canvas.drawText(labelText, cx, cy + r * 0.62f, textPaint)
    }
}

/** Donut chart for status distribution — native Canvas. */
class DonutChart(context: Context, private val p: Palette, private val slices: List<Pair<String, Int>>, private val colorFor: (String) -> Int) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var sweepProgress = 0f

    init {
        val anim = ValueAnimator.ofFloat(0f, 1f)
        anim.duration = 800
        anim.interpolator = DecelerateInterpolator()
        anim.addUpdateListener { sweepProgress = it.animatedValue as Float; invalidate() }
        anim.start()
    }

    override fun onDraw(canvas: Canvas) {
        val total = slices.sumOf { it.second }.toFloat()
        if (total <= 0) return
        val cx = width / 2f; val cy = height / 2f
        val r = Math.min(cx, cy) - Ui.dp(8)
        val stroke = Ui.dp(16).toFloat()
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = stroke
        paint.strokeCap = Paint.Cap.BUTT
        var start = -90f
        val rect = android.graphics.RectF(cx - r + stroke / 2, cy - r + stroke / 2, cx + r - stroke / 2, cy + r - stroke / 2)
        for ((label, value) in slices) {
            val sweep = value / total * 360f * sweepProgress
            paint.color = colorFor(label)
            canvas.drawArc(rect, start + 1.5f, Math.max(0f, sweep - 3f), false, paint)
            start += value / total * 360f
        }
        paint.style = Paint.Style.FILL
        paint.color = p.fg
        paint.textSize = Ui.dp(26).toFloat()
        paint.typeface = Fonts.display(700)
        paint.textAlign = Paint.Align.CENTER
        canvas.drawText(total.toInt().toString(), cx, cy + Ui.dp(2), paint)
        paint.textSize = Ui.dp(10).toFloat()
        paint.color = p.muted
        paint.typeface = Fonts.body(600)
        canvas.drawText("CONTRACTS", cx, cy + Ui.dp(18), paint)
    }
}

/** Bar chart (weekly activity) — native Canvas. */
class BarChart(context: Context, private val p: Palette, private val bars: List<Triple<String, Int, Int>>) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var progress = 0f

    init {
        val anim = ValueAnimator.ofFloat(0f, 1f)
        anim.duration = 800
        anim.interpolator = DecelerateInterpolator()
        anim.addUpdateListener { progress = it.animatedValue as Float; invalidate() }
        anim.start()
    }

    override fun onDraw(canvas: Canvas) {
        if (bars.isEmpty()) return
        val max = Math.max(1, bars.maxOf { Math.max(it.second, it.third) })
        val n = bars.size
        val gap = Ui.dp(10).toFloat()
        val groupW = (width - gap * (n - 1)) / n
        val barW = groupW * 0.3f
        val chartH = height - Ui.dp(24).toFloat()
        for (i in 0 until n) {
            val x = i * (groupW + gap)
            val (label, created, completed) = bars[i]
            val h1 = created.toFloat() / max * chartH * progress
            val h2 = completed.toFloat() / max * chartH * progress
            paint.color = Palette.withAlpha(p.primary, 0.85f)
            canvas.drawRoundRect(x, chartH - h1, x + barW, chartH, Ui.dp(3).toFloat(), Ui.dp(3).toFloat(), paint)
            paint.color = p.brass
            canvas.drawRoundRect(x + barW + Ui.dp(3).toFloat(), chartH - h2, x + barW * 2 + Ui.dp(3).toFloat(), chartH, Ui.dp(3).toFloat(), Ui.dp(3).toFloat(), paint)
            paint.color = p.muted
            paint.textSize = Ui.dp(9).toFloat()
            paint.typeface = Fonts.body(500)
            paint.textAlign = Paint.Align.CENTER
            if (i % 2 == 0 || n <= 5) canvas.drawText(label, x + groupW / 2, height.toFloat() - Ui.dp(6), paint)
        }
    }
}

// ---- View-receiver delegates -------------------------------------------------
// Screens are Views (not Contexts); these let the same DSL run inside Screen
// classes without `context.` prefixes.
fun View.col(init: LinearLayout.() -> Unit): LinearLayout = context.col(init)
fun View.row(init: LinearLayout.() -> Unit): LinearLayout = context.row(init)
fun View.frame(init: FrameLayout.() -> Unit): FrameLayout = context.frame(init)
fun View.scroll(init: LinearLayout.() -> Unit): ScrollView = context.scroll(init)
fun View.hscroll(init: LinearLayout.() -> Unit): HorizontalScrollView = context.hscroll(init)
fun View.text(text: String, size: Float = 14f, color: Int = 0, weight: Int = 400, font: String = "body", align: Int = Gravity.START, maxLines: Int = Int.MAX_VALUE, init: (TextView.() -> Unit)? = null): TextView =
    context.text(text, size, color, weight, font, align, maxLines, init)
fun View.label(text: String, p: Palette): TextView = context.label(text, p)
fun View.button(label: String, p: Palette, style: String = "primary", icon: String? = null, enabled: Boolean = true, onClick: () -> Unit): TextView =
    context.button(label, p, style, icon, enabled, onClick)
fun View.iconButton(glyph: String, p: Palette, size: Float = 20f, contentDescription: String? = null, onClick: () -> Unit): TextView =
    context.iconButton(glyph, p, size, contentDescription, onClick)
fun View.card(p: Palette, radius: Float = 18f, border: Boolean = true, init: LinearLayout.() -> Unit): LinearLayout = context.card(p, radius, border, init)
fun View.clickableCard(p: Palette, radius: Float = 18f, onClick: () -> Unit, init: LinearLayout.() -> Unit): LinearLayout = context.clickableCard(p, radius, onClick, init)
fun View.statusBadge(status: Status, p: Palette): TextView = context.statusBadge(status, p)
fun View.priorityBadge(priority: Priority, p: Palette): TextView = context.priorityBadge(priority, p)
fun View.chip(label: String, p: Palette, selected: Boolean, onClick: () -> Unit): TextView = context.chip(label, p, selected, onClick)
fun View.avatar(user: User?, p: Palette, sizeDp: Int = 38): TextView = context.avatar(user, p, sizeDp)
fun View.input(p: Palette, hint: String, value: String = "", singleLine: Boolean = true, password: Boolean = false, keyboard: Int = InputType.TYPE_CLASS_TEXT, minLines: Int = 1, onChange: ((String) -> Unit)? = null): EditText =
    context.input(p, hint, value, singleLine, password, keyboard, minLines, onChange)
fun View.fieldLabel(text: String, p: Palette, required: Boolean = false): TextView = context.fieldLabel(text, p, required)
fun View.selector(p: Palette, value: String, placeholder: String, onClick: () -> Unit): LinearLayout = context.selector(p, value, placeholder, onClick)
fun View.progressBar(progress: Int, p: Palette, color: Int = 0, heightDp: Int = 6): View = context.progressBar(progress, p, color, heightDp)
fun View.sectionHeader(title: String, p: Palette, actionLabel: String? = null, onAction: (() -> Unit)? = null): LinearLayout = context.sectionHeader(title, p, actionLabel, onAction)
fun View.emptyState(glyph: String, title: String, subtitle: String, p: Palette, actionLabel: String? = null, onAction: (() -> Unit)? = null): LinearLayout = context.emptyState(glyph, title, subtitle, p, actionLabel, onAction)
fun View.loading(p: Palette): LinearLayout = context.loading(p)
