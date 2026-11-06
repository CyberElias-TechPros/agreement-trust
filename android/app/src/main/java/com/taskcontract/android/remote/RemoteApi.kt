package com.taskcontract.android.remote

import com.taskcontract.android.core.Json
import com.taskcontract.android.core.jobj
import com.taskcontract.android.core.o
import com.taskcontract.android.core.s
import com.taskcontract.android.domain.DomainException
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

class ApiException(message: String, val status: Int) : Exception(message)
class OfflineException : Exception("You're offline — the change was saved on this device and will sync when you reconnect.")

/**
 * REST client for the TaskContract backend (same /api/v1 contract as the web
 * client). Handles bearer auth + single-flight token refresh. Pure JVM code.
 */
class RemoteApi(private val tokens: TokenStore) {

    interface TokenStore {
        var baseUrl: String
        var accessToken: String?
        var refreshToken: String?
    }

    private val refreshLock = ReentrantLock()

    var lastOnline: Boolean = true
        private set

    fun ping(): Boolean = try {
        val conn = open("GET", "/health", auth = false)
        conn.connectTimeout = 5000; conn.readTimeout = 5000
        val ok = conn.responseCode in 200..299
        conn.disconnect()
        lastOnline = ok
        ok
    } catch (e: Exception) { lastOnline = false; false }

    // ---- auth ----
    fun login(email: String, password: String, otp: String?): Map<String, Any?> =
        Json.obj(post("/auth/login", jobj("email" to email, "password" to password, "otp" to otp), auth = false))

    fun register(email: String, password: String, firstName: String, lastName: String, orgName: String?): Map<String, Any?> =
        Json.obj(post("/auth/register", jobj("email" to email, "password" to password, "firstName" to firstName, "lastName" to lastName, "organizationName" to orgName), auth = false))

    fun verify2fa(challengeToken: String, code: String): Map<String, Any?> =
        Json.obj(post("/auth/2fa/verify", jobj("challengeToken" to challengeToken, "code" to code), auth = false))
    fun forgotPassword(email: String): Map<String, Any?> =
        Json.obj(post("/auth/forgot-password", jobj("email" to email), auth = false))
    fun resetPassword(token: String, password: String): Map<String, Any?> =
        Json.obj(post("/auth/reset-password", jobj("token" to token, "password" to password), auth = false))
    fun setup2fa(): Map<String, Any?> = Json.obj(post("/auth/2fa/setup", jobj()))
    fun enable2fa(code: String): Map<String, Any?> = Json.obj(post("/auth/2fa/enable", jobj("code" to code)))
    fun disable2fa(password: String): Map<String, Any?> = Json.obj(post("/auth/2fa/disable", jobj("password" to password)))
    fun inviteInfo(token: String): Map<String, Any?> = Json.obj(get("/auth/invites/$token"))
    fun acceptInvite(token: String, firstName: String?, lastName: String?, password: String?): Map<String, Any?> =
        Json.obj(post("/auth/invites/$token/accept", jobj("firstName" to firstName, "lastName" to lastName, "password" to password), auth = false))

    fun refresh(): Boolean = refreshLock.withLock {
        val rt = tokens.refreshToken ?: return false
        return try {
            val data = Json.obj(post("/auth/refresh", jobj("refreshToken" to rt), auth = false))
            val at = data.s("accessToken"); val rt2 = data.s("refreshToken")
            if (at != null) { tokens.accessToken = at; if (rt2 != null) tokens.refreshToken = rt2; true } else false
        } catch (e: Exception) { false }
    }

    fun me(): Map<String, Any?> = Json.obj(get("/auth/me"))
    fun logout() { try { post("/auth/logout", jobj("refreshToken" to tokens.refreshToken)) } catch (_: Exception) {} }

    // ---- org & contracts ----
    fun organizations(): List<Map<String, Any?>> = Json.arr(Json.obj(get("/organizations"))["organizations"]).map { Json.obj(it) }
    fun analytics(orgId: String): Map<String, Any?> = Json.obj(get("/organizations/$orgId/analytics"))
    fun members(orgId: String): List<Map<String, Any?>> = Json.arr(Json.obj(get("/organizations/$orgId/members"))["members"]).map { Json.obj(it) }
    fun categories(orgId: String): List<Map<String, Any?>> = Json.arr(Json.obj(get("/organizations/$orgId/categories"))["categories"]).map { Json.obj(it) }
    fun orgUsers(orgId: String): List<Map<String, Any?>> = Json.arr(Json.obj(get("/organizations/$orgId/users"))["users"]).map { Json.obj(it) }

    fun contracts(orgId: String, status: String? = null, priority: String? = null, search: String? = null, page: Int = 1, limit: Int = 100): Map<String, Any?> {
        val params = buildList {
            add("page=$page"); add("limit=$limit")
            if (status != null) add("status=$status")
            if (priority != null) add("priority=$priority")
            if (!search.isNullOrBlank()) add("search=${com.taskcontract.android.core.Crypto.urlEncode(search)}")
        }.joinToString("&")
        return Json.obj(get("/organizations/$orgId/contracts?$params"))
    }

    fun contract(orgId: String, contractId: String): Map<String, Any?> = Json.obj(get("/organizations/$orgId/contracts/$contractId"))
    fun createContract(orgId: String, body: Map<String, Any?>): Map<String, Any?> = Json.obj(post("/organizations/$orgId/contracts", body))
    fun updateContract(orgId: String, contractId: String, body: Map<String, Any?>): Map<String, Any?> = Json.obj(patch("/organizations/$orgId/contracts/$contractId", body))
    fun deleteContract(orgId: String, contractId: String): Map<String, Any?> = Json.obj(delete("/organizations/$orgId/contracts/$contractId"))
    fun transition(orgId: String, contractId: String, action: String, note: String?): Map<String, Any?> =
        Json.obj(post("/organizations/$orgId/contracts/$contractId/$action", jobj("note" to note)))
    fun acknowledge(orgId: String, contractId: String): Map<String, Any?> = Json.obj(post("/organizations/$orgId/contracts/$contractId/acknowledge", jobj()))
    fun interactions(orgId: String, contractId: String): List<Map<String, Any?>> = Json.arr(Json.obj(get("/organizations/$orgId/contracts/$contractId/interactions"))["interactions"]).map { Json.obj(it) }
    fun postInteraction(orgId: String, contractId: String, type: String, content: String, progress: Int?): Map<String, Any?> =
        Json.obj(post("/organizations/$orgId/contracts/$contractId/interactions", jobj("interactionType" to type, "content" to content, "progressPercentage" to progress)))
    fun audit(orgId: String, contractId: String): List<Map<String, Any?>> = Json.arr(Json.obj(get("/organizations/$orgId/contracts/$contractId/audit"))["auditLogs"]).map { Json.obj(it) }
    fun history(orgId: String, contractId: String): List<Map<String, Any?>> = Json.arr(Json.obj(get("/organizations/$orgId/contracts/$contractId/history"))["versions"]).map { Json.obj(it) }
    fun exportContract(orgId: String, contractId: String): Map<String, Any?> = Json.obj(get("/organizations/$orgId/contracts/$contractId/export"))

    fun notifications(unreadOnly: Boolean = false, limit: Int = 100): Map<String, Any?> =
        Json.obj(get("/notifications?unreadOnly=$unreadOnly&limit=$limit"))
    fun markRead(id: String): Map<String, Any?> = Json.obj(post("/notifications/$id/read", jobj()))
    fun markAllRead(): Map<String, Any?> = Json.obj(post("/notifications/read-all", jobj()))

    fun inviteMember(orgId: String, email: String, role: String): Map<String, Any?> =
        Json.obj(post("/organizations/$orgId/members", jobj("email" to email, "role" to role)))
    fun updateMember(orgId: String, memberId: String, role: String, status: String?): Map<String, Any?> =
        Json.obj(patch("/organizations/$orgId/members/$memberId", jobj("role" to role, "status" to status)))
    fun removeMember(orgId: String, memberId: String): Map<String, Any?> = Json.obj(delete("/organizations/$orgId/members/$memberId"))
    fun createCategory(orgId: String, name: String, color: String, description: String?): Map<String, Any?> =
        Json.obj(post("/organizations/$orgId/categories", jobj("name" to name, "color" to color, "description" to description)))
    fun deleteCategory(orgId: String, categoryId: String): Map<String, Any?> = Json.obj(delete("/organizations/$orgId/categories/$categoryId"))
    fun createOrganization(name: String): Map<String, Any?> = Json.obj(post("/organizations", jobj("name" to name)))
    fun updateProfile(body: Map<String, Any?>): Map<String, Any?> = Json.obj(patch("/auth/me", body))
    fun preferences(): Map<String, Any?> = Json.obj(Json.obj(get("/auth/preferences"))["preferences"])
    fun updatePreferences(prefs: Map<String, Any?>): Map<String, Any?> = Json.obj(Json.obj(patch("/auth/preferences", prefs))["preferences"])
    fun changePassword(current: String, next: String): Map<String, Any?> =
        Json.obj(post("/auth/change-password", jobj("currentPassword" to current, "newPassword" to next)))
    fun search(orgId: String, q: String): Map<String, Any?> = Json.obj(get("/search?organizationId=$orgId&q=${com.taskcontract.android.core.Crypto.urlEncode(q)}"))
    fun uploadAttachment(orgId: String, contractId: String, filename: String, contentType: String, base64: String): Map<String, Any?> =
        Json.obj(post("/organizations/$orgId/contracts/$contractId/attachments", jobj("filename" to filename, "contentType" to contentType, "data" to base64)))

    // ---- HTTP plumbing ----
    fun get(path: String): Any? = request("GET", path, null, true)
    fun post(path: String, body: Any?, auth: Boolean = true): Any? = request("POST", path, body, auth)
    fun patch(path: String, body: Any?): Any? = request("PATCH", path, body, true)
    fun delete(path: String): Any? = request("DELETE", path, null, true)

    private fun request(method: String, path: String, body: Any?, auth: Boolean, retried: Boolean = false): Any? {
        val conn = try { open(method, path, auth, body) } catch (e: IOException) { lastOnline = false; throw OfflineException() }
        try {
            val code = try { conn.responseCode } catch (e: IOException) { lastOnline = false; throw OfflineException() }
            lastOnline = true
            val stream = if (code >= 400) conn.errorStream else conn.inputStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code == 401 && auth && !retried && refresh()) {
                conn.disconnect()
                return request(method, path, body, auth, retried = true)
            }
            val parsed = try { Json.parse(text) } catch (e: Exception) { null }
            if (code >= 400) {
                val msg = Json.obj(parsed).s("error") ?: "Request failed ($code)"
                throw ApiException(msg, code)
            }
            return parsed
        } finally { conn.disconnect() }
    }

    private fun open(method: String, path: String, auth: Boolean, body: Any? = null): HttpURLConnection {
        val base = tokens.baseUrl.trimEnd('/')
        val url = URL(if (path.startsWith("http")) path else "$base$path")
        val conn = url.openConnection() as HttpURLConnection
        // HttpURLConnection rejects PATCH — tunnel it as POST + override header
        // (supported by the TaskContract worker router).
        if (method == "PATCH") {
            conn.requestMethod = "POST"
            conn.setRequestProperty("X-HTTP-Method-Override", "PATCH")
        } else {
            conn.requestMethod = method
        }
        conn.connectTimeout = 12_000
        conn.readTimeout = 25_000
        conn.setRequestProperty("Accept", "application/json")
        conn.setRequestProperty("X-Client", "taskcontract-android/1.0")
        if (auth) tokens.accessToken?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
        if (body != null) {
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.outputStream.use { it.write(Json.write(body).toByteArray(Charsets.UTF_8)) }
        }
        return conn
    }
}
