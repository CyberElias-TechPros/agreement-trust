package com.taskcontract.android.tests

import com.taskcontract.android.core.Crypto
import com.taskcontract.android.core.Json
import com.taskcontract.android.core.jobj
import com.taskcontract.android.core.s
import com.taskcontract.android.domain.*

/**
 * Pure-JVM domain tests. Run: see android/tools/test.sh
 * Covers JSON round-trips, PBKDF2, RFC 6238 TOTP vectors, base32,
 * the lifecycle state machine, RBAC and time parsing.
 */
private var passed = 0
private var failed = 0

private fun check(name: String, cond: Boolean) {
    if (cond) { passed++ } else { failed++; println("FAIL: $name") }
}

private fun expectThrows(name: String, block: () -> Unit) {
    try { block(); failed++; println("FAIL (no throw): $name") } catch (e: Exception) { passed++ }
}

fun main() {
    // ---- JSON ----
    val doc = jobj(
        "s" to "héllo \"wörld\"\n\t\\/", "n" to 42L, "d" to 3.5, "b" to true, "nil" to null,
        "arr" to listOf(1L, "two", false, jobj("k" to "v")),
        "nested" to jobj("a" to listOf(jobj("x" to 1L)))
    )
    val text = Json.write(doc)
    val back = Json.obj(Json.parse(text))
    check("json string escape round-trip", back.s("s") == "héllo \"wörld\"\n\t\\/")
    check("json long", Json.long(back["n"]) == 42L)
    check("json double", back["d"] == 3.5)
    check("json bool", back["b"] == true)
    check("json null preserved", back.containsKey("nil") && back["nil"] == null)
    check("json array", Json.arr(back["arr"]).size == 4)
    check("json unicode escape parse", Json.obj(Json.parse("{\"u\":\"\\u00e9\\ud83d\\ude00\"}")).s("u") == "é😀")
    expectThrows("json trailing content") { Json.parse("{} x") }
    expectThrows("json malformed") { Json.parse("{\"a\":}") }
    check("json empty object", Json.obj(Json.parse("{}")).isEmpty())
    check("json number forms", Json.long(Json.obj(Json.parse("{\"a\":1e3}"))["a"]) == 1000L)

    // ---- Password hashing ----
    val hash = Crypto.hashPassword("correct horse battery staple")
    check("pbkdf2 format", hash.startsWith("pbkdf2$80000$"))
    check("pbkdf2 verify ok", Crypto.verifyPassword("correct horse battery staple", hash))
    check("pbkdf2 verify wrong", !Crypto.verifyPassword("wrong", hash))
    check("pbkdf2 verify null", !Crypto.verifyPassword("x", null))
    check("pbkdf2 salt unique", Crypto.hashPassword("same") != Crypto.hashPassword("same"))

    // ---- Base32 + TOTP (RFC 6238 SHA1 vectors, secret = "12345678901234567890") ----
    val secret = Crypto.base32Encode("12345678901234567890".toByteArray(Charsets.US_ASCII))
    check("base32 encode", secret == "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")
    check("base32 decode", String(Crypto.base32Decode(secret), Charsets.US_ASCII) == "12345678901234567890")
    check("totp t=59", Crypto.totp(secret, 59L, 30, 8) == "94287082")
    check("totp t=1111111109", Crypto.totp(secret, 1111111109L, 30, 8) == "07081804")
    check("totp t=1234567890", Crypto.totp(secret, 1234567890L, 30, 8) == "89005924")
    check("totp t=2000000000", Crypto.totp(secret, 2000000000L, 30, 8) == "69279037")
    val now = System.currentTimeMillis() / 1000
    check("totp verify current", Crypto.verifyTotp(secret, Crypto.totp(secret, now)))
    check("totp verify skew -30", Crypto.verifyTotp(secret, Crypto.totp(secret, now - 30)))
    check("totp verify reject old", !Crypto.verifyTotp(secret, Crypto.totp(secret, now - 300)))
    check("totp verify null secret", !Crypto.verifyTotp(null, "123456"))
    check("backup codes", Crypto.generateBackupCodes().let { it.size == 8 && it.all { c -> c.length == 8 } })

    // ---- Lifecycle transitions ----
    check("draft→sent", Rules.canTransition(Action.SEND, Status.DRAFT))
    check("sent→accepted", Rules.canTransition(Action.ACCEPT, Status.SENT))
    check("sent→rejected", Rules.canTransition(Action.REJECT, Status.SENT))
    check("accepted→in_progress", Rules.canTransition(Action.START, Status.ACCEPTED))
    check("in_progress→submitted", Rules.canTransition(Action.SUBMIT, Status.IN_PROGRESS))
    check("rejected→submitted", Rules.canTransition(Action.SUBMIT, Status.REJECTED))
    check("submitted→approved", Rules.canTransition(Action.APPROVE, Status.SUBMITTED))
    check("submitted→rejected", Rules.canTransition(Action.REJECT, Status.SUBMITTED))
    check("approved→in_progress reopen", Rules.canTransition(Action.REOPEN, Status.APPROVED))
    check("no approve from draft", !Rules.canTransition(Action.APPROVE, Status.DRAFT))
    check("no send from approved", !Rules.canTransition(Action.SEND, Status.APPROVED))
    check("no submit from sent", !Rules.canTransition(Action.SUBMIT, Status.SENT))
    check("archive from most states", Rules.canTransition(Action.ARCHIVE, Status.IN_PROGRESS))
    check("no archive from archived", !Rules.canTransition(Action.ARCHIVE, Status.ARCHIVED))

    // ---- RBAC + performer rules ----
    val mgr = Role.MANAGER; val exec = Role.EXECUTOR; val obs = Role.OBSERVER
    fun contract(status: Status, initiator: String = "u-mgr", executor: String? = "u-exec") =
        Contract("tc1", "org1", "TCP-2026-00001", "T", "D", status = status, initiatorId = initiator, executorId = executor)

    check("manager can create", Rules.can(mgr, "create", "contract"))
    check("executor cannot create", !Rules.can(exec, "create", "contract"))
    check("observer cannot create", !Rules.can(obs, "create", "contract"))
    check("manager sends own draft", Rules.canPerform(Action.SEND, mgr, contract(Status.DRAFT), "u-mgr"))
    check("executor accepts sent", Rules.canPerform(Action.ACCEPT, exec, contract(Status.SENT), "u-exec"))
    check("manager may accept (server matrix allows)", Rules.canPerform(Action.ACCEPT, mgr, contract(Status.SENT), "u-mgr"))
    // Server semantics: executor ROLE carries accept/submit/start permissions,
    // so any executor-role member may act (assignment check is an OR, not AND).
    check("executor role accepts (server matrix)", Rules.canPerform(Action.ACCEPT, exec, contract(Status.SENT), "u-other"))
    check("observer role cannot accept", !Rules.canPerform(Action.ACCEPT, obs, contract(Status.SENT), "u-other"))
    check("accept auto-starts work", Rules.nextState(Action.ACCEPT, Status.SENT) == Status.IN_PROGRESS)
    check("reject submitted returns to in_progress", Rules.nextState(Action.REJECT, Status.SUBMITTED) == Status.IN_PROGRESS)
    check("reopen returns to sent", Rules.nextState(Action.REOPEN, Status.APPROVED) == Status.SENT)
    check("executor submits", Rules.canPerform(Action.SUBMIT, exec, contract(Status.IN_PROGRESS), "u-exec"))
    check("manager approves", Rules.canPerform(Action.APPROVE, mgr, contract(Status.SUBMITTED), "u-mgr"))
    check("executor cannot approve", !Rules.canPerform(Action.APPROVE, exec, contract(Status.SUBMITTED), "u-exec"))
    check("executor declines sent", Rules.canPerform(Action.REJECT, exec, contract(Status.SENT), "u-exec"))
    check("initiator withdraws sent", Rules.canPerform(Action.REJECT, mgr, contract(Status.SENT), "u-mgr"))
    check("observer can do nothing", Rules.availableActions(obs, contract(Status.SENT), "u-obs").none { it.action != Action.ARCHIVE })
    check("observer cannot post", !Rules.canPostInteractions(obs))
    check("auditor can post (server blocks observers only)", Rules.canPostInteractions(Role.AUDITOR))
    check("executor can post", Rules.canPostInteractions(exec))
    check("edit needs reason non-draft", Rules.editNeedsReason(Status.IN_PROGRESS))
    check("edit no reason draft", !Rules.editNeedsReason(Status.DRAFT))
    check("approved locked", !Rules.canEdit(mgr, contract(Status.APPROVED)))
    check("archived locked", !Rules.canEdit(mgr, contract(Status.ARCHIVED)))
    check("draft editable", Rules.canEdit(mgr, contract(Status.DRAFT)))

    // ---- Validators ----
    check("email ok", Rules.isEmail("a.b+c@x.co"))
    check("email bad", !Rules.isEmail("nope@") && !Rules.isEmail("a b@c.d") && !Rules.isEmail(null))
    check("password bounds", Rules.isPassword("12345678") && !Rules.isPassword("1234567") && !Rules.isPassword("x".repeat(129)))
    check("tags parse", Rules.parseTags(" a, b ,, a ,c ") == listOf("a", "b", "c"))
    check("slugify", Rules.slugify("Northwind Stüdio!!") == "northwind-st-dio")

    // ---- Time ----
    val ms = Time.parseIso("2026-01-15T10:30:00.000Z")!!
    check("iso round-trip", Time.toIso(ms) == "2026-01-15T10:30:00.000Z")
    check("date only", Time.parseIso("2026-01-15") == ms - 10 * 3600_000 - 30 * 60_000)
    check("offset parse", Time.parseIso("2026-01-15T12:30:00+02:00") == ms)
    check("bad parse null", Time.parseIso("garbage") == null && Time.parseIso(null) == null)
    val (lbl, urgent) = Time.deadlineLabel(Time.toIso(System.currentTimeMillis() - 2 * 86400_000))
    check("overdue label", lbl.startsWith("Overdue") && urgent)
    val (lbl2, _) = Time.deadlineLabel(null)
    check("no deadline label", lbl2 == "No deadline")
    check("terminal set", Status.APPROVED in Status.terminal && Status.IN_PROGRESS !in Status.terminal)
    check("overdue flag", contract(Status.IN_PROGRESS).copy(deadline = Time.toIso(System.currentTimeMillis() - 1000)).isOverdue(System.currentTimeMillis()))
    check("terminal not overdue", !contract(Status.APPROVED).copy(deadline = Time.toIso(System.currentTimeMillis() - 1000)).isOverdue(System.currentTimeMillis()))

    println("\n$passed passed, $failed failed")
    if (failed > 0) kotlin.system.exitProcess(1)
}
