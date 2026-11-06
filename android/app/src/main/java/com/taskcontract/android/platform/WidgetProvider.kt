package com.taskcontract.android.platform

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.taskcontract.android.App
import com.taskcontract.android.MainActivity
import com.taskcontract.android.R
import com.taskcontract.android.core.Async
import com.taskcontract.android.domain.Status

/** Home-screen widget: active contracts, pending reviews, next deadline. */
class WidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) update(context, manager, id)
    }

    private fun update(context: Context, manager: AppWidgetManager, id: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_layout)
        val repo = App.repoOrNull()
        val intent = Intent(context, MainActivity::class.java).apply { data = Uri.parse("taskcontract://home") }
        views.setOnClickPendingIntent(R.id.widget_root,
            PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        if (repo == null || !repo.session.signedIn) {
            views.setTextViewText(R.id.widget_line1, "Sign in to see your contracts")
            views.setTextViewText(R.id.widget_line2, "TaskContract")
        } else {
            Async.run({
                try {
                    val contracts = repo.contracts()
                    val active = contracts.count { !it.isTerminal }
                    val review = contracts.count { it.status == Status.SUBMITTED }
                    val now = System.currentTimeMillis()
                    val overdue = contracts.count { it.isOverdue(now) }
                    val next = contracts.filter { !it.isTerminal && it.deadline != null }
                        .minByOrNull { com.taskcontract.android.domain.Time.parseIso(it.deadline) ?: Long.MAX_VALUE }
                    Triple(active, review, overdue) to next
                } catch (e: Exception) { (Triple(0, 0, 0) to null) }
            }) { result ->
                result.onSuccess { (stats, next) ->
                    val (active, review, overdue) = stats
                    views.setTextViewText(R.id.widget_line1, "$active active · $review to review")
                    views.setTextViewText(R.id.widget_line2,
                        if (overdue > 0) "⚠ $overdue overdue" else next?.let { "Next: ${it.title.take(26)} · ${com.taskcontract.android.domain.Time.deadlineLabel(it.deadline).first}" } ?: "All caught up")
                    manager.updateAppWidget(id, views)
                }
            }
        }
        manager.updateAppWidget(id, views)
    }

    companion object {
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, WidgetProvider::class.java))
            if (ids.isEmpty()) return
            val intent = Intent(context, WidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }
}
