package com.taskcontract.android.domain

/**
 * The contract state machine and RBAC — a faithful port of the backend
 * (worker/src/rbac.js + domain.js). Single source of truth for what is allowed.
 */
object Rules {

    /** action → (from-state → to-state). Mirrors TRANSITIONS on the server. */
    private val TRANSITIONS: Map<Action, Map<Status, Status>> = mapOf(
        Action.SEND to mapOf(Status.DRAFT to Status.SENT),
        Action.ACCEPT to mapOf(Status.SENT to Status.ACCEPTED),
        Action.REJECT to mapOf(Status.SENT to Status.REJECTED, Status.SUBMITTED to Status.IN_PROGRESS),
        Action.START to mapOf(Status.ACCEPTED to Status.IN_PROGRESS),
        Action.SUBMIT to mapOf(Status.ACCEPTED to Status.SUBMITTED, Status.IN_PROGRESS to Status.SUBMITTED, Status.REJECTED to Status.SUBMITTED),
        Action.APPROVE to mapOf(Status.SUBMITTED to Status.APPROVED),
        Action.ARCHIVE to Status.entries.filter { it != Status.ARCHIVED }.associateWith { Status.ARCHIVED },
        Action.REOPEN to mapOf(Status.APPROVED to Status.SENT, Status.REJECTED to Status.SENT),
    )

    /** Accept auto-starts work — the product's happy path (server does the same). */
    fun nextState(action: Action, from: Status): Status? {
        val raw = TRANSITIONS[action]?.get(from) ?: return null
        return if (action == Action.ACCEPT) Status.IN_PROGRESS else raw
    }

    fun canTransition(action: Action, from: Status): Boolean = nextState(action, from) != null

    // ---- RBAC permission matrix (mirrors server PERMISSIONS) ----
    private val MANAGER_PLUS_CONTRACT = setOf("create", "read", "update", "send", "accept", "submit", "approve", "reject", "archive", "start", "export")
    private val PERMISSIONS: Map<Role, Map<String, Set<String>>> = mapOf(
        Role.OWNER to mapOf(
            "contract" to (MANAGER_PLUS_CONTRACT + "delete"),
            "member" to setOf("create", "read", "update", "delete"),
            "organization" to setOf("read", "update", "delete", "manage_billing"),
            "audit" to setOf("read", "export"),
            "category" to setOf("create", "read", "update", "delete"),
        ),
        Role.ADMIN to mapOf(
            "contract" to (MANAGER_PLUS_CONTRACT + "delete"),
            "member" to setOf("create", "read", "update", "delete"),
            "organization" to setOf("read", "update"),
            "audit" to setOf("read", "export"),
            "category" to setOf("create", "read", "update", "delete"),
        ),
        Role.MANAGER to mapOf(
            "contract" to MANAGER_PLUS_CONTRACT,
            "member" to setOf("read"),
            "organization" to setOf("read"),
            "audit" to setOf("read"),
            "category" to setOf("create", "read", "update"),
        ),
        Role.EXECUTOR to mapOf(
            "contract" to setOf("read", "accept", "submit", "start"),
            "member" to setOf("read"),
            "organization" to setOf("read"),
            "audit" to emptySet(),
            "category" to setOf("read"),
        ),
        Role.OBSERVER to mapOf(
            "contract" to setOf("read"),
            "member" to setOf("read"),
            "organization" to setOf("read"),
            "audit" to emptySet(),
            "category" to setOf("read"),
        ),
        Role.AUDITOR to mapOf(
            "contract" to setOf("read", "export"),
            "member" to setOf("read"),
            "organization" to setOf("read"),
            "audit" to setOf("read", "export"),
            "category" to setOf("read"),
        ),
    )

    fun can(role: Role, action: String, resource: String): Boolean =
        PERMISSIONS[role]?.get(resource)?.contains(action) == true

    fun isManagerPlus(role: Role): Boolean = role.level >= Role.MANAGER.level

    /**
     * Whether [actorId] with org [role] may perform [action] on [contract].
     * Mirrors assertCanTransition on the server, including the special reject rules.
     */
    fun canPerform(action: Action, role: Role, contract: Contract, actorId: String): Boolean {
        if (!canTransition(action, contract.status)) return false
        val isInitiator = contract.initiatorId == actorId
        val isExecutor = contract.executorId == actorId
        return when (action) {
            Action.REJECT -> when (contract.status) {
                Status.SENT -> isExecutor || isInitiator
                Status.SUBMITTED -> can(role, "approve", "contract") || isInitiator
                else -> false
            }
            Action.ACCEPT, Action.SUBMIT, Action.START -> isExecutor || can(role, action.wire, "contract")
            Action.SEND, Action.APPROVE, Action.ARCHIVE, Action.REOPEN ->
                can(role, if (action == Action.REOPEN) "approve" else action.wire, "contract")
        }
    }

    /** UI-facing action descriptors for the detail screen, in display order. */
    data class ActionSpec(val action: Action, val label: String, val destructive: Boolean = false, val needsNote: Boolean = false, val primary: Boolean = false)

    fun availableActions(role: Role, contract: Contract, actorId: String): List<ActionSpec> {
        val out = ArrayList<ActionSpec>()
        fun add(a: Action, label: String, destructive: Boolean = false, needsNote: Boolean = false, primary: Boolean = false) {
            if (canPerform(a, role, contract, actorId)) out.add(ActionSpec(a, label, destructive, needsNote, primary))
        }
        when (contract.status) {
            Status.DRAFT -> add(Action.SEND, "Send contract", primary = true)
            Status.SENT -> {
                add(Action.ACCEPT, "Accept contract", primary = true)
                add(Action.REJECT, "Decline", destructive = true, needsNote = true)
            }
            Status.ACCEPTED -> add(Action.START, "Start work", primary = true)
            Status.IN_PROGRESS -> add(Action.SUBMIT, "Submit for review", primary = true)
            Status.REJECTED -> add(Action.SUBMIT, "Resubmit work", primary = true)
            Status.SUBMITTED -> {
                add(Action.APPROVE, "Approve & seal", primary = true)
                add(Action.REJECT, "Request changes", destructive = true, needsNote = true)
            }
            Status.APPROVED -> add(Action.REOPEN, "Reopen contract")
            else -> {}
        }
        if (contract.status != Status.ARCHIVED) add(Action.ARCHIVE, "Archive", needsNote = false)
        return out
    }

    // ---- Validation (mirrors authware.js + routes) ----
    fun isEmail(v: String?): Boolean =
        v != null && v.trim().length < 255 && Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(v.trim())

    fun isPassword(v: String?): Boolean = v != null && v.length in 8..128
    fun isName(v: String?): Boolean = v != null && v.trim().length in 1..80

    fun slugify(name: String): String =
        name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').take(60).ifEmpty { "org" }

    fun parseTags(v: String?): List<String> =
        (v ?: "").split(",").map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(12)

    /** Editing a non-draft agreement requires a stated change reason. */
    fun editNeedsReason(status: Status): Boolean = status != Status.DRAFT

    fun canEdit(role: Role, contract: Contract): Boolean =
        can(role, "update", "contract") && contract.status != Status.ARCHIVED && contract.status != Status.APPROVED

    fun canPostInteractions(role: Role): Boolean = role != Role.OBSERVER
}

/** Typed domain error with a user-safe message. */
class DomainException(message: String, val code: Int = 400) : Exception(message)
