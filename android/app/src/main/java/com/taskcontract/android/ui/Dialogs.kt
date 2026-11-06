package com.taskcontract.android.ui

import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.taskcontract.android.domain.DomainException

/** Native dialogs & bottom sheets styled with the brand. */
object Dialogs {

    private val active = ArrayList<Dialog>()

    fun sheet(context: Context, p: Palette, title: String, build: LinearLayout.() -> Unit) {
        val dialog = Dialog(context)
        active.add(dialog)
        dialog.setOnDismissListener { active.remove(dialog) }
        dialog.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE)
        val content = context.col {
            background = Shapes.round(p.card, 24f)
            padAll(20)
            // grab handle
            add(View(context).apply {
                background = Shapes.round(p.border, 100f)
                layoutParams = LinearLayout.LayoutParams(Ui.dp(36), Ui.dp(4)).apply { gravity = Gravity.CENTER_HORIZONTAL; bottomMargin = Ui.dp(14) }
            })
            add(context.text(title, 19f, p.fg, 700, font = "display").apply { pad(b = 14) })
            build()
        }
        val scroller = android.widget.ScrollView(context).apply {
            addView(content, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            overScrollMode = View.OVER_SCROLL_NEVER
        }
        dialog.setContentView(scroller)
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT)
            setGravity(Gravity.BOTTOM)
            attributes = attributes.apply { windowAnimations = android.R.style.Animation_InputMethod }
            setDimAmount(0.5f)
        }
        dialog.show()
    }

    fun confirm(context: Context, p: Palette, title: String, message: String, confirmLabel: String = "Confirm", destructive: Boolean = false, onConfirm: () -> Unit) {
        sheet(context, p, title) {
            add(context.text(message, 14f, p.muted, 400).apply { pad(b = 18) })
            add(context.row {
                add(context.button("Cancel", p, "ghost") { dismissTop(context) }.weight(1f))
                add(View(context).apply { layoutParams = LinearLayout.LayoutParams(Ui.dp(10), 1) })
                add(context.button(confirmLabel, p, if (destructive) "danger" else "primary") {
                    dismissTop(context)
                    onConfirm()
                }.weight(1f))
            })
        }
    }

    /** Action with an optional/required note — used for transitions & interactions. */
    fun notePrompt(
        context: Context, p: Palette, title: String, hint: String, required: Boolean,
        confirmLabel: String, destructive: Boolean = false, onConfirm: (String) -> Unit
    ) {
        sheet(context, p, title) {
            val field = context.input(p, hint, singleLine = false, minLines = 3)
            add(field.apply { pad(b = 4) })
            add(context.text(if (required) "A note is required." else "Optional — visible to participants.", 11.5f, p.faint, 500).apply { pad(t = 6, b = 16) })
            add(context.button(confirmLabel, p, if (destructive) "danger" else "primary") {
                val v = field.text.toString().trim()
                if (required && v.isEmpty()) {
                    field.error = "Required"
                    return@button
                }
                dismissTop(context)
                onConfirm(v)
            })
        }
    }

    /** Generic option picker sheet. */
    fun <T> pick(context: Context, p: Palette, title: String, options: List<T>, label: (T) -> String, selected: ((T) -> Boolean)? = null, onPick: (T) -> Unit) {
        sheet(context, p, title) {
            for (opt in options) {
                val isSel = selected?.invoke(opt) ?: false
                add(context.row {
                    add(context.text(label(opt), 15f, if (isSel) p.primary else p.fg, if (isSel) 700 else 500).weight(1f))
                    if (isSel) add(context.text("✓", 16f, p.primary, 700))
                }.apply {
                    padAll(14)
                    background = Shapes.ripple(Shapes.round(if (isSel) p.primarySoft else Color.TRANSPARENT, 12f), null, Palette.withAlpha(p.primary, 0.1f))
                    setOnClickListener {
                        dismissTop(context)
                        onPick(opt)
                    }
                    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(4) }
                })
            }
            add(View(context).apply { layoutParams = LinearLayout.LayoutParams(1, Ui.dp(8)) })
        }
    }

    private fun dismissTop(context: Context) {
        active.lastOrNull()?.dismiss()
    }

    fun dismissAll() {
        for (d in active.toList()) d.dismiss()
        active.clear()
    }

    fun toast(context: Context, message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    fun error(context: Context, e: Throwable) {
        val msg = when (e) {
            is DomainException -> e.message
            is com.taskcontract.android.remote.ApiException -> e.message
            is com.taskcontract.android.remote.OfflineException -> "You're offline — this action needs a connection"
            else -> e.message ?: "Something went wrong"
        }
        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
    }
}
