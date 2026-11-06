package com.taskcontract.android

import android.app.Application
import com.taskcontract.android.core.Bus
import com.taskcontract.android.data.Repository
import com.taskcontract.android.data.Seed
import com.taskcontract.android.platform.Scheduling
import com.taskcontract.android.platform.WidgetProvider
import com.taskcontract.android.ui.Fonts
import com.taskcontract.android.ui.Ui

class App : Application() {
    lateinit var repo: Repository
        private set
    val draftCache = HashMap<String, Any>()

    override fun onCreate() {
        super.onCreate()
        instance = this
        Ui.density = resources.displayMetrics.density
        Fonts.load(this)
        repo = Repository(this)
        Seed.seedIfEmpty(repo.db)
        Scheduling.start(this)
        Bus.on(Bus.DATA_CHANGED) { WidgetProvider.refreshAll(this) }
        Bus.on(Bus.NOTIFICATIONS_CHANGED) {
            // DB reads off the main thread; Notifier checks permission internally.
            com.taskcontract.android.core.Async.run({
                com.taskcontract.android.platform.Notifier.surfaceNew(this, repo)
            }, {})
        }
        repo.syncIfNeeded()
        Scheduling.runSweep(this)
    }

    companion object {
        private var instance: App? = null
        fun repoOrNull(): Repository? = instance?.repo
    }
}
