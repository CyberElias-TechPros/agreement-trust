package com.taskcontract.android.platform

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import com.taskcontract.android.MainActivity
import com.taskcontract.android.R

object Notifier {
    const val CHANNEL_ACTIVITY = "contract_activity"
    const val CHANNEL_DEADLINES = "deadlines"

    fun ensureChannels(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val activity = NotificationChannel(CHANNEL_ACTIVITY, "Contract activity", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Status changes, submissions, approvals and comments on your contracts"
        }
        val deadlines = NotificationChannel(CHANNEL_DEADLINES, "Deadlines", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Reminders 24 hours before a deadline and overdue alerts"
            enableVibration(true)
        }
        nm.createNotificationChannel(activity)
        nm.createNotificationChannel(deadlines)
    }

    fun hasPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun show(context: Context, id: String, title: String, body: String, contractId: String?, deadline: Boolean = false) {
        if (!hasPermission(context)) return
        val intent = Intent(context, MainActivity::class.java).apply {
            data = Uri.parse(if (contractId != null) "taskcontract://contract/$contractId" else "taskcontract://notifications")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = android.app.Notification.Builder(context, if (deadline) CHANNEL_DEADLINES else CHANNEL_ACTIVITY)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(android.app.Notification.BigTextStyle().bigText(body))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setColor(0xFFD5A034.toInt())
            .build()
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(id.hashCode(), n)
    }

    /** Push system notifications for fresh in-app notifications not yet surfaced. */
    fun surfaceNew(context: Context, repo: com.taskcontract.android.data.Repository) {
        if (!repo.session.signedIn || !hasPermission(context)) return
        val prefs = context.getSharedPreferences("notifier", Context.MODE_PRIVATE)
        val seen = prefs.getStringSet("seen", emptySet())!!.toMutableSet()
        val fresh = repo.notifications(unreadOnly = true).take(20)
        for (n in fresh) {
            if (seen.contains(n.id)) continue
            seen.add(n.id)
            show(context, n.id, n.title, n.content, n.contractId, deadline = n.type == "deadline")
        }
        // keep the set bounded
        prefs.edit().putStringSet("seen", seen.toList().takeLast(500).toSet()).apply()
    }
}
