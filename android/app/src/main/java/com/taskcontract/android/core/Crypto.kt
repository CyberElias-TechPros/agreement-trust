package com.taskcontract.android.core

import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/** Identifiers, encoding, hashing, PBKDF2, TOTP — pure Kotlin/JVM (shared with unit tests). */
object Crypto {
    private val random = SecureRandom()
    private const val HEX = "0123456789abcdef"
    private const val B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

    fun nid(prefix: String): String {
        val bytes = ByteArray(10)
        random.nextBytes(bytes)
        return prefix + "_" + hex(bytes)
    }

    fun tokenHex(bytes: Int = 24): String {
        val b = ByteArray(bytes)
        random.nextBytes(b)
        return hex(b)
    }

    fun hex(bytes: ByteArray): String {
        val sb = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val v = b.toInt() and 0xff
            sb.append(HEX[v ushr 4]).append(HEX[v and 0x0f])
        }
        return sb.toString()
    }

    fun sha256Hex(input: String): String = hex(MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8)))

    fun b64(bytes: ByteArray): String = java.util.Base64.getEncoder().encodeToString(bytes)
    fun unb64(s: String): ByteArray = java.util.Base64.getDecoder().decode(s)
    fun b64url(bytes: ByteArray): String = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    fun unb64url(s: String): ByteArray = java.util.Base64.getUrlDecoder().decode(s)

    // ---- Password hashing (PBKDF2-HMAC-SHA256, 80k iterations — same format as the backend) ----
    private const val ITERATIONS = 80_000

    fun hashPassword(password: String): String {
        val salt = ByteArray(16).also { random.nextBytes(it) }
        val dk = pbkdf2(password, salt, ITERATIONS)
        return "pbkdf2\$$ITERATIONS\$${b64(salt)}\$${b64(dk)}"
    }

    fun verifyPassword(password: String, stored: String?): Boolean {
        if (stored == null || !stored.startsWith("pbkdf2$")) return false
        val parts = stored.split("$")
        if (parts.size != 4) return false
        val iterations = parts[1].toIntOrNull() ?: return false
        return try {
            val salt = unb64(parts[2])
            val expected = unb64(parts[3])
            val actual = pbkdf2(password, salt, iterations)
            constantTimeEquals(actual, expected)
        } catch (e: Exception) { false }
    }

    private fun pbkdf2(password: String, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(password.toCharArray(), salt, iterations, 256)
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    }

    fun constantTimeEquals(a: ByteArray, b: ByteArray): Boolean {
        if (a.size != b.size) return false
        var diff = 0
        for (i in a.indices) diff = diff or (a[i].toInt() xor b[i].toInt())
        return diff == 0
    }

    // ---- TOTP (RFC 6238) for two-factor auth ----
    fun generateTotpSecret(): String {
        val bytes = ByteArray(20).also { random.nextBytes(it) }
        return base32Encode(bytes)
    }

    fun base32Encode(data: ByteArray): String {
        val sb = StringBuilder()
        var buffer = 0
        var bits = 0
        for (b in data) {
            buffer = (buffer shl 8) or (b.toInt() and 0xff)
            bits += 8
            while (bits >= 5) {
                bits -= 5
                sb.append(B32[(buffer ushr bits) and 31])
            }
        }
        if (bits > 0) sb.append(B32[(buffer shl (5 - bits)) and 31])
        return sb.toString()
    }

    fun base32Decode(s: String): ByteArray {
        val clean = s.trim().uppercase().replace("=", "").replace(" ", "")
        var buffer = 0
        var bits = 0
        val out = ArrayList<Byte>()
        for (c in clean) {
            val idx = B32.indexOf(c)
            if (idx < 0) continue
            buffer = (buffer shl 5) or idx
            bits += 5
            if (bits >= 8) {
                bits -= 8
                out.add(((buffer ushr bits) and 0xff).toByte())
            }
        }
        return out.toByteArray()
    }

    fun totp(secretBase32: String, timeSec: Long = System.currentTimeMillis() / 1000, step: Long = 30, digits: Int = 6): String {
        val key = base32Decode(secretBase32)
        var counter = timeSec / step
        val msg = ByteArray(8)
        for (i in 7 downTo 0) { msg[i] = (counter and 0xff).toByte(); counter = counter ushr 8 }
        val mac = Mac.getInstance("HmacSHA1")
        mac.init(SecretKeySpec(key, "HmacSHA1"))
        val hash = mac.doFinal(msg)
        val offset = hash[hash.size - 1].toInt() and 0x0f
        val binary = ((hash[offset].toInt() and 0x7f) shl 24) or
            ((hash[offset + 1].toInt() and 0xff) shl 16) or
            ((hash[offset + 2].toInt() and 0xff) shl 8) or
            (hash[offset + 3].toInt() and 0xff)
        val otp = binary % Math.pow(10.0, digits.toDouble()).toInt()
        return otp.toString().padStart(digits, '0')
    }

    /** Verify with ±1 step clock-skew tolerance. */
    fun verifyTotp(secretBase32: String?, code: String): Boolean {
        if (secretBase32.isNullOrBlank()) return false
        val now = System.currentTimeMillis() / 1000
        val cleaned = code.trim().replace(" ", "")
        return listOf(now - 30, now, now + 30).any { totp(secretBase32, it) == cleaned }
    }

    fun otpauthUrl(secret: String, email: String, issuer: String = "TaskContract"): String =
        "otpauth://totp/$issuer:${urlEncode(email)}?secret=$secret&issuer=$issuer&algorithm=SHA1&digits=6&period=30"

    fun urlEncode(s: String): String = java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    fun generateBackupCodes(count: Int = 8): List<String> =
        (1..count).map { tokenHex(4).uppercase() }
}
