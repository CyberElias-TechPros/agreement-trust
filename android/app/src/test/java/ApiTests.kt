package com.taskcontract.android.tests

import com.taskcontract.android.core.Crypto
import com.taskcontract.android.core.Json
import com.taskcontract.android.core.jobj
import com.taskcontract.android.core.o
import com.taskcontract.android.core.s
import com.taskcontract.android.remote.ApiException
import com.taskcontract.android.remote.RemoteApi

/**
 * RemoteApi E2E against a live TaskContract worker (node worker/node-server.mjs).
 * Exercises the exact client the Android app ships: auth, refresh, contracts
 * lifecycle, versions, interactions, RBAC failures, notifications, audit,
 * export, search, categories, members, 2FA and password reset.
 */
private var passed = 0
private var failed = 0
private fun check(name: String, cond: Boolean) {
    if (cond) passed++ else { failed++; println("FAIL: $name") }
}
private fun expectApi(name: String, status: Int, block: () -> Unit) {
    try { block(); failed++; println("FAIL (no throw): $name") }
    catch (e: ApiException) { if (e.status == status) passed++ else { failed++; println("FAIL: $name — got ${e.status}: ${e.message}") } }
    catch (e: Exception) { failed++; println("FAIL: $name — ${e.javaClass.simpleName}: ${e.message}") }
}

private class MemTokens(override var baseUrl: String) : RemoteApi.TokenStore {
    override var accessToken: String? = null
    override var refreshToken: String? = null
}

fun main(args: Array<String>) {
    val base = args.firstOrNull() ?: "http://127.0.0.1:8787/api/v1"
    val suffix = System.currentTimeMillis().toString().takeLast(8)
    val mgrTokens = MemTokens(base)
    val execTokens = MemTokens(base)
    val obsTokens = MemTokens(base)
    val mgr = RemoteApi(mgrTokens)
    val exec = RemoteApi(execTokens)
    val obs = RemoteApi(obsTokens)

    check("ping", mgr.ping())

    // ---- register manager + org ----
    val reg = mgr.register("mgr-$suffix@test.dev", "password123", "Mana", "Ger", "E2E Org $suffix")
    mgrTokens.accessToken = reg.s("accessToken"); mgrTokens.refreshToken = reg.s("refreshToken")
    val orgId = Json.obj(reg["organization"]).s("id")!!
    val mgrId = Json.obj(reg["user"]).s("id")!!
    check("register org id", orgId.isNotEmpty())
    check("register tokens", !mgrTokens.accessToken.isNullOrEmpty())

    // me + refresh rotation
    val me = mgr.me()
    check("me email", Json.obj(me["user"]).s("email") == "mgr-$suffix@test.dev")
    val oldRefresh = mgrTokens.refreshToken
    check("refresh ok", mgr.refresh())
    check("refresh rotated", mgrTokens.refreshToken != oldRefresh)

    // ---- invite executor + observer, accept via API ----
    val invE = mgr.inviteMember(orgId, "exec-$suffix@test.dev", "executor")
    val invO = mgr.inviteMember(orgId, "obs-$suffix@test.dev", "observer")
    val tokE = invE.s("token") ?: Json.obj(invE["invite"]).s("token") ?: ""
    val tokO = invO.s("token") ?: Json.obj(invO["invite"]).s("token") ?: ""
    check("invite tokens issued", tokE.isNotEmpty() && tokO.isNotEmpty())
    val accE = exec.acceptInvite(tokE, "Exe", "Cutor", "password123")
    execTokens.accessToken = accE.s("accessToken"); execTokens.refreshToken = accE.s("refreshToken")
    val execId = Json.obj(accE["user"]).s("id")!!
    val accO = obs.acceptInvite(tokO, "Obser", "Ver", "password123")
    obsTokens.accessToken = accO.s("accessToken"); obsTokens.refreshToken = accO.s("refreshToken")
    check("executor joined", execId.isNotEmpty())
    check("invite single-use", run { try { obs.acceptInvite(tokE, "X", "Y", "password123"); false } catch (e: ApiException) { e.status == 400 } })

    // ---- categories ----
    val cat = Json.obj(mgr.createCategory(orgId, "E2E Cat", "#0F956A", null)["category"])
    check("category created", cat.s("name") == "E2E Cat")
    check("categories list", mgr.categories(orgId).any { it.s("id") == cat.s("id") })

    // ---- contract lifecycle ----
    val created = Json.obj(mgr.createContract(orgId, jobj(
        "title" to "E2E Agreement", "description" to "Deliver the thing within the agreed scope and quality bar.",
        "executorId" to execId, "deadline" to "2030-01-15", "priority" to "high",
        "categoryId" to cat.s("id"), "tags" to listOf("e2e"), "send" to true
    ))["contract"])
    val cid = created.s("id")!!
    check("created & sent", created.s("status") == "sent")
    check("contract number", (created.s("contractNumber") ?: "").startsWith("TCP-"))

    // executor accepts → auto in_progress
    val accepted = Json.obj(exec.transition(orgId, cid, "accept", null)["contract"])
    check("accept auto-starts", accepted.s("status") == "in_progress")

    // progress interaction updates contract progress
    exec.postInteraction(orgId, cid, "progress_update", "Halfway there — core complete.", 50)
    val mid = Json.obj(exec.contract(orgId, cid)["contract"])
    check("progress recorded", Json.int(mid["progress"]) == 50)

    // observer cannot post
    expectApi("observer post 403", 403) { obs.postInteraction(orgId, cid, "comment", "hi", null) }
    // executor cannot create
    expectApi("executor create 403", 403) { exec.createContract(orgId, jobj("title" to "nope", "description" to "not allowed for executors")) }

    // edit mid-flight requires changeReason → v2
    expectApi("edit without reason 400", 400) { mgr.updateContract(orgId, cid, jobj("title" to "E2E Agreement v2")) }
    val edited = Json.obj(mgr.updateContract(orgId, cid, jobj("title" to "E2E Agreement v2", "changeReason" to "Scope clarified with client"))["contract"])
    check("version bumped", Json.int(edited["currentVersion"]) == 2)
    val ack = exec.acknowledge(orgId, cid)
    check("ack version 2", Json.int(ack["versionNumber"]) == 2)

    // submit → request changes → resubmit → approve
    exec.transition(orgId, cid, "submit", "Ready for review")
    val returned = Json.obj(mgr.transition(orgId, cid, "reject", "Tighten the acceptance section")["contract"])
    check("reject returns to in_progress", returned.s("status") == "in_progress")
    exec.transition(orgId, cid, "submit", "Updated as requested")
    val sealed = Json.obj(mgr.transition(orgId, cid, "approve", "Excellent work")["contract"])
    check("approved", sealed.s("status") == "approved")
    check("progress 100 on approve", Json.int(sealed["progress"]) == 100)
    expectApi("approved locked", 400) { mgr.updateContract(orgId, cid, jobj("title" to "nope", "changeReason" to "x")) }

    // detail aggregate
    val detail = mgr.contract(orgId, cid)
    check("detail versions", Json.arr(detail["versions"]).size == 2)
    check("detail interactions", Json.arr(detail["interactions"]).size >= 5)
    check("detail participants", Json.arr(detail["participants"]).size >= 2)

    // audit: checksummed entries; observer 403
    val audit = mgr.audit(orgId, cid)
    check("audit entries", audit.size >= 6)
    check("audit checksums", audit.all { (it.s("checksum") ?: "").length == 64 })
    expectApi("observer audit 403", 403) { obs.audit(orgId, cid) }

    // history + export + search
    check("history v2", mgr.history(orgId, cid).size == 2)
    val exp = mgr.exportContract(orgId, cid)
    check("export contract", Json.obj(exp["contract"]).s("id") == cid)
    val found = mgr.search(orgId, "E2E Agreement")
    check("search finds", Json.arr(Json.obj(found)["contracts"]).isNotEmpty())

    // notifications for executor (assigned + status changes)
    val notes = exec.notifications()
    check("executor notified", Json.arr(notes["notifications"]).isNotEmpty())
    mgr.markAllRead()

    // analytics
    val an = mgr.analytics(orgId)
    check("analytics total", (Json.int(Json.obj(an["stats"])["totalContracts"]) ?: Json.int(an["totalContracts"]) ?: 0) >= 1)

    // members list + role update
    val members = mgr.members(orgId)
    check("members 3", members.size == 3)
    val obsMember = members.first { Json.obj(it["user"]).s("email") == "obs-$suffix@test.dev" }
    mgr.updateMember(orgId, obsMember.s("id")!!, "auditor", null)
    check("role updated", mgr.members(orgId).first { it.s("id") == obsMember.s("id") }.s("role") == "auditor")
    // auditor now CAN read audit
    check("auditor audit ok", obs.audit(orgId, cid).isNotEmpty())

    // ---- 2FA round-trip ----
    val setup = mgr.setup2fa()
    val secret = setup.s("secret")!!
    val enabled = mgr.enable2fa(Crypto.totp(secret))
    check("2fa backup codes", Json.arr(enabled["backupCodes"]).size == 8)
    val challenge = mgr.login("mgr-$suffix@test.dev", "password123", null)
    check("login requires 2fa", Json.bool(challenge["requires2fa"]))
    val verified = mgr.verify2fa(challenge.s("challengeToken")!!, Crypto.totp(secret))
    mgrTokens.accessToken = verified.s("accessToken"); mgrTokens.refreshToken = verified.s("refreshToken")
    check("2fa login ok", mgr.me().o("user").s("id") == mgrId)
    mgr.disable2fa("password123")
    check("2fa disabled", !Json.bool(mgr.me().o("user")["twoFactorEnabled"]))

    // ---- password reset ----
    val forgot = mgr.forgotPassword("mgr-$suffix@test.dev")
    val resetToken = forgot.s("resetToken")
    check("reset token (dev)", !resetToken.isNullOrEmpty())
    if (resetToken != null) {
        val after = mgr.resetPassword(resetToken, "newpassword456")
        mgrTokens.accessToken = after.s("accessToken"); mgrTokens.refreshToken = after.s("refreshToken")
        check("login with new password", Json.bool(mgr.login("mgr-$suffix@test.dev", "newpassword456", null)["accessToken"] != null))
    }

    // ---- draft delete ----
    val draft = Json.obj(mgr.createContract(orgId, jobj("title" to "Draft to delete", "description" to "This draft will be deleted shortly."))["contract"])
    mgr.delete("/organizations/$orgId/contracts/${draft.s("id")}")
    check("draft deleted", mgr.contracts(orgId).let { Json.arr(it["contracts"]).none { c -> Json.obj(c).s("id") == draft.s("id") } })

    // wrong password → 401
    expectApi("bad login 401", 401) { mgr.login("mgr-$suffix@test.dev", "wrong-password", null) }

    println("\n$passed passed, $failed failed")
    if (failed > 0) kotlin.system.exitProcess(1)
}
