package com.taskcontract.android.platform

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import com.taskcontract.android.App
import com.taskcontract.android.core.Async
import com.taskcontract.android.core.Bus

/**
 * Deadline sweep scheduling: a periodic JobService (15 min flex while the app
 * process lives) plus an AlarmManager fallback that survives reboots.
 * Also watches connectivity to replay the offline outbox.
 */
object Scheduling {
    private const val JOB_ID = 42
    private const val ALARM_REQ = 43

    fun start(context: Context) {
        Notifier.ensureChannels(context)
        scheduleJob(context)
        scheduleAlarm(context)
        watchNetwork(context)
    }

    private fun scheduleJob(context: Context) {
        val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
        if (scheduler.getPendingJob(JOB_ID) != null) return
        val job = JobInfo.Builder(JOB_ID, ComponentName(context, DeadlineJobService::class.java))
            .setPeriodic(15 * 60 * 1000L, 5 * 60 * 1000L)
            .setPersisted(true)
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_NONE)
            .build()
        try { scheduler.schedule(job) } catch (_: Exception) {}
    }

    private fun scheduleAlarm(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = PendingIntent.getBroadcast(context, ALARM_REQ, Intent(context, DeadlineAlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        // Inexact repeating hourly — battery friendly, no SCHEDULE_EXACT_ALARM permission needed.
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 10 * 60 * 1000L, AlarmManager.INTERVAL_HOUR, pi)
    }

    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private fun watchNetwork(context: Context) {
        if (networkCallback != null) return
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                val repo = App.repoOrNull() ?: return
                if (repo.isServer) Async.run({ repo.syncIfNeeded() }, {})
            }
        }
        networkCallback = cb
        try {
            cm.registerNetworkCallback(NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build(), cb)
        } catch (_: Exception) {}
    }

    fun runSweep(context: Context) {
        val repo = App.repoOrNull() ?: return
        Async.run({
            if (!repo.session.signedIn) return@run
            if (repo.isServer) {
                // The server runs its own deadline cron; pull its notifications instead.
                repo.syncIfNeeded()
                Notifier.surfaceNew(context, repo)
            } else {
                val created = repo.engine.deadlineSweep()
                if (created > 0) {
                    Notifier.surfaceNew(context, repo)
                    Bus.emit(Bus.NOTIFICATIONS_CHANGED)
                    WidgetProvider.refreshAll(context)
                }
            }
        }, {})
    }
}

class DeadlineAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        Scheduling.runSweep(context)
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        Scheduling.start(context)
        Scheduling.runSweep(context)
    }
}

class DeadlineJobService : JobService() {
    override fun onStartJob(params: JobParameters?): Boolean {
        Scheduling.runSweep(this)
        return false
    }
    override fun onStopJob(params: JobParameters?): Boolean = false
}
