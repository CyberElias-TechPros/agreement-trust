package com.taskcontract.android.ui

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import com.taskcontract.android.R

/**
 * "Ink & Seal" design system — native Android port of the web brand.
 * Workspace: archival parchment (light) / deep ink (dark). Brass seals, indigo actions.
 */
class Palette(val dark: Boolean) {
    val bg = c(if (dark) "#0E101B" else "#F9F7F1")
    val card = c(if (dark) "#161927" else "#FEFDFB")
    val cardAlt = c(if (dark) "#1B1F30" else "#F4F1E8")
    val fg = c(if (dark) "#F3F1ED" else "#191C2A")
    val muted = c(if (dark) "#9498A8" else "#676C7E")
    val faint = c(if (dark) "#5D6172" else "#9B9FAD")
    val border = c(if (dark) "#2D3143" else "#DFDACD")
    val primary = c(if (dark) "#7A82F5" else "#4C58D6")
    val onPrimary = c(if (dark) "#0E101B" else "#FFFFFF")
    val primarySoft = c(if (dark) "#232849" else "#E8EAFB")
    val brass = c("#D5A034")
    val brassStrong = c("#B8821E")
    val brassSoft = c(if (dark) "#332A17" else "#F6ECD4")
    val success = c(if (dark) "#22C38E" else "#0F956A")
    val successSoft = c(if (dark) "#12332A" else "#E1F3EC")
    val warning = c(if (dark) "#EFB239" else "#AF721D")
    val warningSoft = c(if (dark) "#362B12" else "#F7EDD8")
    val danger = c(if (dark) "#E05269" else "#CB2A42")
    val dangerSoft = c(if (dark) "#3A1B22" else "#F9E4E8")
    val ink = c("#0E101B")
    val ink2 = c("#161927")
    val ink3 = c("#232739")
    val scrim = Color.argb(if (dark) 190 else 120, 8, 9, 16)

    fun status(s: com.taskcontract.android.domain.Status): Int = when (s) {
        com.taskcontract.android.domain.Status.DRAFT -> muted
        com.taskcontract.android.domain.Status.SENT -> c(if (dark) "#8B94F8" else "#4955DF")
        com.taskcontract.android.domain.Status.ACCEPTED -> c(if (dark) "#A488F2" else "#875CEB")
        com.taskcontract.android.domain.Status.IN_PROGRESS -> warning
        com.taskcontract.android.domain.Status.SUBMITTED -> c(if (dark) "#C077E8" else "#A445D3")
        com.taskcontract.android.domain.Status.APPROVED -> success
        com.taskcontract.android.domain.Status.REJECTED -> danger
        com.taskcontract.android.domain.Status.ARCHIVED -> faint
    }

    fun statusSoft(s: com.taskcontract.android.domain.Status): Int = blend(status(s), card, if (dark) 0.22f else 0.12f)

    fun priority(p: com.taskcontract.android.domain.Priority): Int = when (p) {
        com.taskcontract.android.domain.Priority.LOW -> muted
        com.taskcontract.android.domain.Priority.MEDIUM -> primary
        com.taskcontract.android.domain.Priority.HIGH -> warning
        com.taskcontract.android.domain.Priority.CRITICAL -> danger
    }

    companion object {
        fun c(hex: String): Int = Color.parseColor(hex)

        fun blend(fg: Int, bg: Int, ratio: Float): Int {
            val r = (Color.red(fg) * ratio + Color.red(bg) * (1 - ratio)).toInt()
            val g = (Color.green(fg) * ratio + Color.green(bg) * (1 - ratio)).toInt()
            val b = (Color.blue(fg) * ratio + Color.blue(bg) * (1 - ratio)).toInt()
            return Color.rgb(r, g, b)
        }

        fun withAlpha(color: Int, alpha: Float): Int = Color.argb((255 * alpha).toInt(), Color.red(color), Color.green(color), Color.blue(color))

        fun forContext(context: Context, themePref: String): Palette {
            val night = when (themePref) {
                "dark" -> true
                "light" -> false
                else -> (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
            }
            return Palette(night)
        }
    }
}

object Fonts {
    private var display: Typeface? = null
    private var displaySemibold: Typeface? = null
    private var displayBold: Typeface? = null
    private var body: Typeface? = null
    private var bodyMedium: Typeface? = null
    private var bodySemibold: Typeface? = null
    private var bodyBold: Typeface? = null
    private var mono: Typeface? = null
    private var monoMedium: Typeface? = null

    fun load(context: Context) {
        if (display != null) return
        fun f(id: Int): Typeface = try {
            context.resources.getFont(id)
        } catch (e: Exception) { Typeface.DEFAULT }
        display = f(R.font.fraunces_500)
        displaySemibold = f(R.font.fraunces_600)
        displayBold = f(R.font.fraunces_700)
        body = f(R.font.jakarta_400)
        bodyMedium = f(R.font.jakarta_500)
        bodySemibold = f(R.font.jakarta_600)
        bodyBold = f(R.font.jakarta_700)
        mono = f(R.font.jbmono_400)
        monoMedium = f(R.font.jbmono_500)
    }

    fun display(weight: Int = 600): Typeface = when {
        weight >= 700 -> displayBold ?: Typeface.SERIF
        weight >= 600 -> displaySemibold ?: Typeface.SERIF
        else -> display ?: Typeface.SERIF
    }
    fun body(weight: Int = 400): Typeface = when {
        weight >= 700 -> bodyBold ?: Typeface.SANS_SERIF
        weight >= 600 -> bodySemibold ?: Typeface.SANS_SERIF
        weight >= 500 -> bodyMedium ?: Typeface.SANS_SERIF
        else -> body ?: Typeface.SANS_SERIF
    }
    fun mono(weight: Int = 400): Typeface = if (weight >= 500) monoMedium ?: Typeface.MONOSPACE else mono ?: Typeface.MONOSPACE
}

/** Shape helpers */
object Shapes {
    fun round(fill: Int, radiusDp: Float, strokeColor: Int? = null, strokeWidthDp: Float = 1f): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radiusDp * Ui.density
            setColor(fill)
            if (strokeColor != null) setStroke((strokeWidthDp * Ui.density).toInt(), strokeColor)
        }

    fun oval(fill: Int, strokeColor: Int? = null, strokeWidthDp: Float = 1f): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(fill)
            if (strokeColor != null) setStroke((strokeWidthDp * Ui.density).toInt(), strokeColor)
        }

    fun ripple(content: android.graphics.drawable.Drawable?, mask: android.graphics.drawable.Drawable?, color: Int): RippleDrawable =
        RippleDrawable(ColorStateList.valueOf(color), content, mask)
}
