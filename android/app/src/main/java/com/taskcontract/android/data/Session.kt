package com.taskcontract.android.data

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.taskcontract.android.core.Bus
import com.taskcontract.android.domain.Organization
import com.taskcontract.android.domain.Role
import com.taskcontract.android.domain.User
import com.taskcontract.android.remote.RemoteApi
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec

/**
 * Session + preferences. Server tokens are encrypted at rest with an
 * Android Keystore AES-GCM key (hardware-backed when available).
 */
class SessionManager(context: Context) : RemoteApi.TokenStore {
    private val prefs: SharedPreferences = context.getSharedPreferences("taskcontract.session", Context.MODE_PRIVATE)

    enum class Mode { DEVICE, SERVER }

    var mode: Mode
        get() = if (prefs.getString("mode", "device") == "server") Mode.SERVER else Mode.DEVICE
        set(v) { prefs.edit().putString("mode", v.name.lowercase()).apply() }

    var userId: String?
        get() = prefs.getString("userId", null)
        set(v) { prefs.edit().putString("userId", v).apply() }

    var orgId: String?
        get() = prefs.getString("orgId", null)
        set(v) { prefs.edit().putString("orgId", v).apply() }

    var onboardingDone: Boolean
        get() = prefs.getBoolean("onboarding", false)
        set(v) { prefs.edit().putBoolean("onboarding", v).apply() }

    var biometricLock: Boolean
        get() = prefs.getBoolean("biometric_lock", false)
        set(v) { prefs.edit().putBoolean("biometric_lock", v).apply() }

    var theme: String // system | light | dark
        get() = prefs.getString("theme", "system") ?: "system"
        set(v) { prefs.edit().putString("theme", v).apply(); Bus.emit(Bus.THEME_CHANGED) }

    var lastSyncAt: Long
        get() = prefs.getLong("last_sync", 0)
        set(v) { prefs.edit().putLong("last_sync", v).apply() }

    override var baseUrl: String
        get() = prefs.getString("baseUrl", "https://taskcontract-api.cyberelias.workers.dev/api/v1") ?: ""
        set(v) { prefs.edit().putString("baseUrl", v).apply() }

    override var accessToken: String?
        get() = decrypt(prefs.getString("at", null))
        set(v) { prefs.edit().putString("at", encrypt(v)).apply() }

    override var refreshToken: String?
        get() = decrypt(prefs.getString("rt", null))
        set(v) { prefs.edit().putString("rt", encrypt(v)).apply() }

    val signedIn: Boolean get() = userId != null

    fun signOut() {
        val keepBase = baseUrl; val keepTheme = theme; val keepOnboarding = onboardingDone
        prefs.edit().clear().apply()
        baseUrl = keepBase; theme = keepTheme; onboardingDone = keepOnboarding
        Bus.emit(Bus.SESSION_CHANGED)
    }

    fun switchOrg(orgId: String) {
        this.orgId = orgId
        Bus.emit(Bus.SESSION_CHANGED)
    }

    // ---- Keystore-backed encryption for tokens ----
    private val keyAlias = "taskcontract_session_key"

    private fun key(): javax.crypto.SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getEntry(keyAlias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(KeyGenParameterSpec.Builder(keyAlias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build())
        return gen.generateKey()
    }

    private fun encrypt(plain: String?): String? {
        if (plain == null) return null
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val iv = cipher.iv
            val ct = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
            Base64.encodeToString(iv + ct, Base64.NO_WRAP)
        } catch (e: Exception) { null }
    }

    private fun decrypt(stored: String?): String? {
        if (stored == null) return null
        return try {
            val raw = Base64.decode(stored, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, raw.sliceArray(0 until 12)))
            String(cipher.doFinal(raw.sliceArray(12 until raw.size)), Charsets.UTF_8)
        } catch (e: Exception) { null }
    }
}
