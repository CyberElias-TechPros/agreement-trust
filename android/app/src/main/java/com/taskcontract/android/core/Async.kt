package com.taskcontract.android.core

import android.os.Handler
import android.os.Looper
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/** Lightweight threading: a shared IO pool + main-thread postback. No external deps. */
object Async {
    private val threads = AtomicInteger(0)
    val io: ExecutorService = Executors.newFixedThreadPool(4) { r ->
        Thread(r, "tc-io-" + threads.incrementAndGet()).apply { isDaemon = true }
    }
    private val main = Handler(Looper.getMainLooper())

    fun <T> run(work: () -> T, done: (Result<T>) -> Unit) {
        io.execute {
            val result = try { Result.success(work()) } catch (e: Throwable) { Result.failure(e) }
            main.post { done(result) }
        }
    }

    fun onMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
    }

    fun delay(ms: Long, block: () -> Unit) { main.postDelayed(block, ms) }
}

/** Tiny publish/subscribe bus for cross-screen refresh (contracts changed, session changed…). */
object Bus {
    private val listeners = LinkedHashMap<String, MutableList<(Any?) -> Unit>>()

    fun on(event: String, l: (Any?) -> Unit): () -> Unit {
        synchronized(listeners) { listeners.getOrPut(event) { ArrayList() }.add(l) }
        return { synchronized(listeners) { listeners[event]?.remove(l) } }
    }

    fun emit(event: String, payload: Any? = null) {
        val snapshot = synchronized(listeners) { listeners[event]?.toList() ?: emptyList() }
        Async.onMain { snapshot.forEach { it(payload) } }
    }

    const val DATA_CHANGED = "data_changed"
    const val SESSION_CHANGED = "session_changed"
    const val NOTIFICATIONS_CHANGED = "notifications_changed"
    const val THEME_CHANGED = "theme_changed"
    const val SYNC_STATE = "sync_state"
}
