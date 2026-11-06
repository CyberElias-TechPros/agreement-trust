package com.taskcontract.android.data

import com.taskcontract.android.core.Crypto
import com.taskcontract.android.core.Json
import com.taskcontract.android.core.jobj
import com.taskcontract.android.domain.*
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * The on-device domain engine. Implements the same business rules as the
 * backend (worker/src/domain.js + routes): state machine, append-only versions,
 * typed interactions, audit checksums, notifications, RBAC and analytics.
 * All writes are transactional; the UI observes via Bus.DATA_CHANGED.
 */
class LocalEngine(private val db: Db) {
    private val lock = ReentrantLock()

    // =================== Users & auth ===================

    fun register(email: String, password: String, firstName: String, lastName: String, orgName: String?): Pair<User, Organization> = lock.withLock {
        val e = email.lowercase().trim()
        if (!Rules.isEmail(e)) throw DomainException("Valid email is required")
        if (!Rules.isPassword(password)) throw DomainException("Password must be 8–128 characters")
        if (!Rules.isName(firstName) || !Rules.isName(lastName)) throw DomainException("First and last name are required")
        db.tx { d ->
            if (d.one("SELECT id FROM users WHERE email = ?", e) != null) throw DomainException("Email already registered", 409)
            val now = Time.nowIso()
            val uid = Crypto.nid("u")
            d.insert("users", null, cv(
                "id" to uid, "email" to e, "password_hash" to Crypto.hashPassword(password),
                "first_name" to firstName.trim(), "last_name" to lastName.trim(),
                "created_at" to now, "updated_at" to now
            ))
            d.insert("notification_prefs", null, cv("user_id" to uid))
            val name = (orgName ?: "${firstName.trim()}'s Organization").trim().ifEmpty { "My Organization" }
            val org = createOrgInternal(d, uid, name, now)
            audit(d, uid, org.id, null, "user_registered", "user", uid, null, jobj("email" to e))
            Pair(getUser(d, uid)!!, org)
        }
    }

    fun login(email: String, password: String, otp: String? = null): User = lock.withLock {
        val e = email.lowercase().trim()
        db.tx { d ->
            val row = d.one("SELECT * FROM users WHERE email = ?", e) ?: throw DomainException("Invalid credentials", 401)
            if (!Crypto.verifyPassword(password, row.str("password_hash"))) throw DomainException("Invalid credentials", 401)
            if (row.bool("two_factor_enabled")) {
                val codes = Json.arr(Json.parse(row.str("backup_codes") ?: "[]")).mapNotNull { Json.str(it) }
                val ok = Crypto.verifyTotp(row.str("two_factor_secret"), otp ?: "") || (otp != null && codes.contains(otp.uppercase()))
                if (!ok) throw DomainException("Two-factor code required", 401)
                if (otp != null && codes.contains(otp.uppercase())) {
                    d.update("users", cv("backup_codes" to Json.write(codes.filter { it != otp.uppercase() })), "id = ?", arrayOf(row.str("id")))
                }
            }
            val now = Time.nowIso()
            d.update("users", cv("last_login_at" to now, "updated_at" to now), "id = ?", arrayOf(row.str("id")))
            audit(d, row.str("id"), null, null, "user_login", "user", row.strOr("id"), null, null)
            getUser(d, row.strOr("id"))!!
        }
    }

    fun changePassword(userId: String, current: String, next: String) = lock.withLock {
        if (!Rules.isPassword(next)) throw DomainException("Password must be 8–128 characters")
        db.tx { d ->
            val row = d.one("SELECT * FROM users WHERE id = ?", userId) ?: throw DomainException("User not found", 404)
            if (!Crypto.verifyPassword(current, row.str("password_hash"))) throw DomainException("Current password is incorrect", 401)
            d.update("users", cv("password_hash" to Crypto.hashPassword(next), "updated_at" to Time.nowIso()), "id = ?", arrayOf(userId))
            audit(d, userId, null, null, "password_changed", "user", userId, null, null)
        }
    }

    fun updateProfile(userId: String, firstName: String?, lastName: String?, title: String?) = lock.withLock {
        db.tx { d ->
            val row = d.one("SELECT * FROM users WHERE id = ?", userId) ?: throw DomainException("User not found", 404)
            val fn = firstName?.trim() ?: row.strOr("first_name")
            val ln = lastName?.trim() ?: row.strOr("last_name")
            if (!Rules.isName(fn) || !Rules.isName(ln)) throw DomainException("Names must be 1–80 characters")
            d.update("users", cv("first_name" to fn, "last_name" to ln, "title" to (title ?: row.str("title")), "updated_at" to Time.nowIso()), "id = ?", arrayOf(userId))
        }
    }

    fun setup2fa(userId: String): String = lock.withLock {
        val secret = Crypto.generateTotpSecret()
        db.writableDatabase.update("users", cv("two_factor_secret" to secret, "two_factor_enabled" to 0), "id = ?", arrayOf(userId))
        secret
    }

    fun enable2fa(userId: String, code: String): List<String> = lock.withLock {
        db.tx { d ->
            val row = d.one("SELECT * FROM users WHERE id = ?", userId) ?: throw DomainException("User not found", 404)
            if (!Crypto.verifyTotp(row.str("two_factor_secret"), code)) throw DomainException("Code doesn't match — try again")
            val backup = Crypto.generateBackupCodes()
            d.update("users", cv("two_factor_enabled" to 1, "backup_codes" to Json.write(backup)), "id = ?", arrayOf(userId))
            audit(d, userId, null, null, "2fa_enabled", "user", userId, null, null)
            backup
        }
    }

    fun disable2fa(userId: String, password: String) = lock.withLock {
        db.tx { d ->
            val row = d.one("SELECT * FROM users WHERE id = ?", userId) ?: throw DomainException("User not found", 404)
            if (!Crypto.verifyPassword(password, row.str("password_hash"))) throw DomainException("Password is incorrect", 401)
            d.update("users", cv("two_factor_enabled" to 0, "two_factor_secret" to null, "backup_codes" to null), "id = ?", arrayOf(userId))
            audit(d, userId, null, null, "2fa_disabled", "user", userId, null, null)
        }
    }

    // =================== Organizations & members ===================

    private fun createOrgInternal(d: android.database.sqlite.SQLiteDatabase, userId: String, name: String, now: String): Organization {
        val oid = Crypto.nid("org")
        var slug = Rules.slugify(name)
        if (d.one("SELECT id FROM organizations WHERE slug = ?", slug) != null) slug = "$slug-${System.currentTimeMillis().toString(36)}"
        d.insert("organizations", null, cv("id" to oid, "name" to name, "slug" to slug, "plan_type" to "free", "created_at" to now, "updated_at" to now))
        d.insert("memberships", null, cv("id" to Crypto.nid("m"), "organization_id" to oid, "user_id" to userId, "role" to "owner", "status" to "active", "joined_at" to now))
        d.insert("org_sequences", null, cv("organization_id" to oid, "next_number" to 1))
        // Starter categories so the first contract is one tap away
        val starters = listOf("Design" to "#875CEB", "Engineering" to "#4C58D6", "Marketing" to "#D5A034", "Operations" to "#0F956A")
        for ((n, c) in starters) {
            d.insert("categories", null, cv("id" to Crypto.nid("c"), "organization_id" to oid, "name" to n, "color" to c, "created_at" to now))
        }
        return Organization(oid, name, slug, "free", now)
    }

    fun createOrganization(userId: String, name: String): Organization = lock.withLock {
        if (name.trim().isEmpty()) throw DomainException("Organization name is required")
        db.tx { d ->
            val org = createOrgInternal(d, userId, name.trim(), Time.nowIso())
            audit(d, userId, org.id, null, "organization_created", "organization", org.id, null, null)
            org
        }
    }

    fun organizationsFor(userId: String): List<Pair<Organization, Role>> {
        val rows = db.q(
            "SELECT o.*, m.role FROM organizations o JOIN memberships m ON m.organization_id = o.id WHERE m.user_id = ? AND m.status = 'active' ORDER BY o.created_at", userId
        )
        return rows.map { Organization(it.strOr("id"), it.strOr("name"), it.strOr("slug"), it.strOr("plan_type", "free"), it.strOr("created_at")) to Role.from(it.str("role")) }
    }

    fun members(orgId: String): List<Pair<Membership, User>> {
        val rows = db.q(
            "SELECT m.*, u.email, u.first_name, u.last_name, u.title FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.organization_id = ? ORDER BY m.joined_at", orgId
        )
        return rows.map {
            Membership(it.strOr("id"), orgId, it.strOr("user_id"), Role.from(it.str("role")), it.strOr("status", "active"), it.strOr("joined_at"), it.str("invited_by")) to
                User(it.strOr("user_id"), it.strOr("email"), it.strOr("first_name"), it.strOr("last_name"), it.str("title"))
        }
    }

    fun inviteMember(orgId: String, actorId: String, actorRole: Role, email: String, role: Role): Invite = lock.withLock {
        if (!Rules.can(actorRole, "create", "member")) throw DomainException("Insufficient permissions", 403)
        if (role == Role.OWNER) throw DomainException("Cannot invite an owner")
        val e = email.lowercase().trim()
        if (!Rules.isEmail(e)) throw DomainException("A valid email is required")
        db.tx { d ->
            val now = Time.nowIso()
            val existingUser = d.one("SELECT * FROM users WHERE email = ?", e)
            if (existingUser != null) {
                val m = d.one("SELECT * FROM memberships WHERE organization_id = ? AND user_id = ?", orgId, existingUser.str("id"))
                if (m != null && m.str("status") == "active") throw DomainException("This person is already a member")
                if (m != null) {
                    d.update("memberships", cv("status" to "pending", "role" to role.wire), "id = ?", arrayOf(m.str("id")))
                } else {
                    d.insert("memberships", null, cv("id" to Crypto.nid("m"), "organization_id" to orgId, "user_id" to existingUser.str("id"), "role" to role.wire, "status" to "pending", "invited_by" to actorId, "joined_at" to now))
                }
                notifyInternal(d, existingUser.strOr("id"), orgId, "invite", "You've been invited", "You were invited to join as ${role.label}.", null)
            }
            val inv = Invite(Crypto.nid("inv"), orgId, e, role, Crypto.tokenHex(18), actorId, now, Time.toIso(System.currentTimeMillis() + 14L * 86400_000))
            d.insert("invites", null, cv("id" to inv.id, "organization_id" to orgId, "email" to e, "role" to role.wire, "token" to inv.token, "invited_by" to actorId, "created_at" to now, "expires_at" to inv.expiresAt))
            audit(d, actorId, orgId, null, "member_invited", "membership", inv.id, null, jobj("email" to e, "role" to role.wire))
            inv
        }
    }

    fun acceptInvite(token: String, userId: String): Organization = lock.withLock {
        db.tx { d ->
            val inv = d.one("SELECT * FROM invites WHERE token = ?", token) ?: throw DomainException("Invite not found", 404)
            if (inv.str("accepted_at") != null) throw DomainException("Invite already used")
            if ((Time.parseIso(inv.str("expires_at")) ?: 0) < System.currentTimeMillis()) throw DomainException("Invite has expired")
            val now = Time.nowIso()
            val orgId = inv.strOr("organization_id")
            val existing = d.one("SELECT * FROM memberships WHERE organization_id = ? AND user_id = ?", orgId, userId)
            if (existing != null) {
                d.update("memberships", cv("status" to "active", "role" to inv.strOr("role", "executor")), "id = ?", arrayOf(existing.str("id")))
            } else {
                d.insert("memberships", null, cv("id" to Crypto.nid("m"), "organization_id" to orgId, "user_id" to userId, "role" to inv.strOr("role", "executor"), "status" to "active", "joined_at" to now))
            }
            d.update("invites", cv("accepted_at" to now), "id = ?", arrayOf(inv.str("id")))
            audit(d, userId, orgId, null, "invite_accepted", "membership", inv.strOr("id"), null, null)
            val o = d.one("SELECT * FROM organizations WHERE id = ?", orgId)!!
            Organization(o.strOr("id"), o.strOr("name"), o.strOr("slug"), o.strOr("plan_type", "free"), o.strOr("created_at"))
        }
    }

    fun updateMemberRole(orgId: String, actorRole: Role, memberId: String, role: Role, status: String? = null) = lock.withLock {
        if (!Rules.can(actorRole, "update", "member")) throw DomainException("Insufficient permissions", 403)
        if (role == Role.OWNER) throw DomainException("Cannot assign the owner role")
        db.tx { d ->
            val m = d.one("SELECT * FROM memberships WHERE id = ? AND organization_id = ?", memberId, orgId) ?: throw DomainException("Member not found", 404)
            if (m.str("role") == "owner") throw DomainException("The owner's role cannot be changed")
            val values = cv("role" to role.wire)
            if (status != null) values.put("status", status)
            d.update("memberships", values, "id = ?", arrayOf(memberId))
        }
    }

    fun removeMember(orgId: String, actorRole: Role, memberId: String) = lock.withLock {
        if (!Rules.can(actorRole, "delete", "member")) throw DomainException("Insufficient permissions", 403)
        db.tx { d ->
            val m = d.one("SELECT * FROM memberships WHERE id = ? AND organization_id = ?", memberId, orgId) ?: throw DomainException("Member not found", 404)
            if (m.str("role") == "owner") throw DomainException("The owner cannot be removed")
            d.delete("memberships", "id = ?", arrayOf(memberId))
        }
    }

    fun categories(orgId: String): List<Category> =
        db.q("SELECT * FROM categories WHERE organization_id = ? ORDER BY name", orgId)
            .map { Category(it.strOr("id"), orgId, it.strOr("name"), it.strOr("color", "#4C58D6"), it.str("description")) }

    fun createCategory(orgId: String, role: Role, name: String, color: String, description: String?): Category = lock.withLock {
        if (!Rules.can(role, "create", "category")) throw DomainException("Insufficient permissions", 403)
        if (name.trim().isEmpty()) throw DomainException("Category name is required")
        db.tx { d ->
            if (d.one("SELECT id FROM categories WHERE organization_id = ? AND name = ?", orgId, name.trim()) != null)
                throw DomainException("A category with this name already exists")
            val id = Crypto.nid("c")
            d.insert("categories", null, cv("id" to id, "organization_id" to orgId, "name" to name.trim(), "color" to color, "description" to description, "created_at" to Time.nowIso()))
            Category(id, orgId, name.trim(), color, description)
        }
    }

    fun deleteCategory(orgId: String, role: Role, categoryId: String) = lock.withLock {
        if (!Rules.can(role, "delete", "category")) throw DomainException("Insufficient permissions", 403)
        db.tx { d ->
            d.update("contracts", cv("category_id" to null), "category_id = ?", arrayOf(categoryId))
            d.delete("categories", "id = ? AND organization_id = ?", arrayOf(categoryId, orgId))
        }
    }

    // =================== Contracts ===================

    private fun nextContractNumber(d: android.database.sqlite.SQLiteDatabase, orgId: String): String {
        val year = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
        val row = d.one("SELECT next_number FROM org_sequences WHERE organization_id = ?", orgId)
        val n: Int
        if (row == null) {
            n = 1
            d.insert("org_sequences", null, cv("organization_id" to orgId, "next_number" to 2))
        } else {
            n = row.int("next_number")
            d.update("org_sequences", cv("next_number" to n + 1), "organization_id = ?", arrayOf(orgId))
        }
        return "TCP-$year-${n.toString().padStart(5, '0')}"
    }

    data class NewContract(
        val title: String, val description: String, val executorId: String?, val observerIds: List<String>,
        val deadline: String?, val priority: Priority, val categoryId: String?, val tags: List<String>, val sendNow: Boolean,
    )

    fun createContract(orgId: String, actorId: String, role: Role, input: NewContract): Contract = lock.withLock {
        if (!Rules.can(role, "create", "contract")) throw DomainException("Insufficient permissions", 403)
        if (input.title.trim().isEmpty() || input.description.trim().isEmpty()) throw DomainException("Title and description are required")
        if (input.sendNow && input.executorId == null) throw DomainException("Assign an executor before sending")
        db.tx { d ->
            val now = Time.nowIso()
            val id = Crypto.nid("tc")
            val number = nextContractNumber(d, orgId)
            d.insert("contracts", null, cv(
                "id" to id, "organization_id" to orgId, "contract_number" to number,
                "title" to input.title.trim(), "current_description" to input.description.trim(),
                "current_deadline" to input.deadline, "current_priority" to input.priority.wire,
                "current_status" to "draft", "progress" to 0, "initiator_id" to actorId,
                "responsible_executor_id" to input.executorId, "category_id" to input.categoryId,
                "tags" to Json.write(input.tags), "current_version" to 1, "is_deleted" to 0,
                "created_at" to now, "updated_at" to now
            ))
            d.insert("contract_versions", null, cv(
                "id" to Crypto.nid("v"), "contract_id" to id, "version_number" to 1,
                "title" to input.title.trim(), "description" to input.description.trim(),
                "deadline" to input.deadline, "priority" to input.priority.wire,
                "change_reason" to "Initial creation", "changed_by" to actorId, "changed_at" to now
            ))
            d.insert("contract_participants", null, cv("id" to Crypto.nid("p"), "contract_id" to id, "user_id" to actorId, "role" to "initiator", "is_lead" to 1, "status" to "active", "accepted_at" to now))
            if (input.executorId != null) {
                d.insert("contract_participants", null, cv("id" to Crypto.nid("p"), "contract_id" to id, "user_id" to input.executorId, "role" to "executor", "is_lead" to 1, "status" to "pending"))
            }
            for (obs in input.observerIds.filter { it != input.executorId }) {
                d.insert("contract_participants", null, cv("id" to Crypto.nid("p"), "contract_id" to id, "user_id" to obs, "role" to "observer", "is_lead" to 0, "status" to "active", "accepted_at" to now))
            }
            audit(d, actorId, orgId, id, "contract_created", "contract", id, null, jobj("title" to input.title.trim(), "status" to "draft"))
            if (input.sendNow) transitionInternal(d, orgId, id, Action.SEND, actorId, role, null)
            getContract(d, id)!!
        }
    }

    data class ContractEdit(
        val title: String?, val description: String?, val deadline: String?, val clearDeadline: Boolean,
        val priority: Priority?, val categoryId: String?, val tags: List<String>?, val changeReason: String?,
    )

    fun editContract(orgId: String, contractId: String, actorId: String, role: Role, edit: ContractEdit): Contract = lock.withLock {
        if (!Rules.can(role, "update", "contract")) throw DomainException("Insufficient permissions", 403)
        db.tx { d ->
            val row = d.one("SELECT * FROM contracts WHERE id = ? AND organization_id = ? AND is_deleted = 0", contractId, orgId)
                ?: throw DomainException("Contract not found", 404)
            val status = Status.from(row.str("current_status"))
            if (status == Status.ARCHIVED || status == Status.APPROVED) throw DomainException("Cannot edit archived or approved contracts")
            val changingAgreement = (edit.description != null && edit.description.trim() != row.strOr("current_description")) ||
                (edit.title != null && edit.title.trim() != row.strOr("title"))
            if (changingAgreement && Rules.editNeedsReason(status) && edit.changeReason?.trim().isNullOrEmpty())
                throw DomainException("A change reason is required when modifying the agreement")
            val now = Time.nowIso()
            val title = edit.title?.trim()?.ifEmpty { row.strOr("title") } ?: row.strOr("title")
            val description = edit.description?.trim()?.ifEmpty { row.strOr("current_description") } ?: row.strOr("current_description")
            val deadline = if (edit.clearDeadline) null else edit.deadline ?: row.str("current_deadline")
            val priority = edit.priority ?: Priority.from(row.str("current_priority"))
            val tags = edit.tags ?: Json.arr(Json.parse(row.str("tags") ?: "[]")).mapNotNull { Json.str(it) }
            val categoryId = edit.categoryId ?: row.str("category_id")
            val version = row.int("current_version") + 1
            d.update("contracts", cv(
                "title" to title, "current_description" to description, "current_deadline" to deadline,
                "current_priority" to priority.wire, "category_id" to categoryId, "tags" to Json.write(tags),
                "current_version" to version, "updated_at" to now
            ), "id = ?", arrayOf(contractId))
            d.insert("contract_versions", null, cv(
                "id" to Crypto.nid("v"), "contract_id" to contractId, "version_number" to version,
                "title" to title, "description" to description, "deadline" to deadline, "priority" to priority.wire,
                "change_reason" to (edit.changeReason?.trim()?.ifEmpty { "Updated" } ?: "Updated"), "changed_by" to actorId, "changed_at" to now
            ))
            addInteractionInternal(d, contractId, actorId, IxType.SYSTEM, "Agreement updated to v$version: ${edit.changeReason?.trim()?.ifEmpty { "Updated" } ?: "Updated"}", null, null, null)
            val executorId = row.str("responsible_executor_id")
            if (executorId != null && executorId != actorId) {
                notifyInternal(d, executorId, orgId, "version_updated", "Contract “$title” updated", "A new version (v$version) has been created.", contractId)
            }
            audit(d, actorId, orgId, contractId, "contract_updated", "contract", contractId,
                jobj("version" to version - 1), jobj("version" to version, "reason" to edit.changeReason))
            getContract(d, contractId)!!
        }
    }

    fun transition(orgId: String, contractId: String, action: Action, actorId: String, role: Role, note: String?): Contract = lock.withLock {
        db.tx { d -> transitionInternal(d, orgId, contractId, action, actorId, role, note); getContract(d, contractId)!! }
    }

    private fun transitionInternal(d: android.database.sqlite.SQLiteDatabase, orgId: String, contractId: String, action: Action, actorId: String, role: Role, note: String?) {
        val row = d.one("SELECT * FROM contracts WHERE id = ? AND organization_id = ? AND is_deleted = 0", contractId, orgId)
            ?: throw DomainException("Contract not found", 404)
        val contract = mapContract(row)
        if (action == Action.SEND && contract.executorId == null) throw DomainException("No executor assigned")
        if (!Rules.canPerform(action, role, contract, actorId)) {
            if (!Rules.canTransition(action, contract.status)) throw DomainException("Cannot ${action.wire} a contract in “${contract.status.label}” state")
            throw DomainException("You don't have permission for this action", 403)
        }
        val from = contract.status
        val next = Rules.nextState(action, from)!!
        val now = Time.nowIso()
        val values = cv("current_status" to next.wire, "updated_at" to now)
        when {
            next == Status.SENT && action == Action.SEND -> values.put("sent_at", now)
            action == Action.REOPEN -> values.put("sent_at", now)
        }
        if (action == Action.ACCEPT) values.put("accepted_at", now)
        if (next == Status.SUBMITTED) values.put("submitted_at", now)
        if (next == Status.APPROVED) { values.put("approved_at", now); values.put("completed_at", now); values.put("progress", 100) }
        if (next == Status.ARCHIVED) values.put("archived_at", now)
        d.update("contracts", values, "id = ?", arrayOf(contractId))

        val (type, defaultTitle, defaultContent) = when (action) {
            Action.SEND -> Triple(IxType.SYSTEM, "Contract sent", "Contract sent to the executor for acceptance.")
            Action.ACCEPT -> Triple(IxType.SYSTEM, "Contract accepted", "The executor accepted the contract. Work is now in progress.")
            Action.REJECT -> Triple(IxType.REJECTION, "Contract returned", "The contract was returned.")
            Action.START -> Triple(IxType.SYSTEM, "Work started", "The executor started work.")
            Action.SUBMIT -> Triple(IxType.SUBMISSION, "Work submitted", "Work submitted for review.")
            Action.APPROVE -> Triple(IxType.APPROVAL, "Contract approved", "Contract approved and sealed into the ledger.")
            Action.ARCHIVE -> Triple(IxType.SYSTEM, "Contract archived", "Contract archived.")
            Action.REOPEN -> Triple(IxType.SYSTEM, "Contract reopened", "Contract reopened as a new cycle.")
        }
        val content = note?.trim()?.ifEmpty { defaultContent } ?: defaultContent
        addInteractionInternal(d, contractId, actorId, type, content, if (next == Status.APPROVED) 100 else null, from, next)
        audit(d, actorId, orgId, contractId, "contract_${action.wire}", "contract", contractId, jobj("status" to from.wire), jobj("status" to next.wire))
        val counterpart = if (actorId == contract.initiatorId) contract.executorId else contract.initiatorId
        if (counterpart != null && counterpart != actorId) {
            notifyInternal(d, counterpart, orgId, action.wire, defaultTitle, content, contractId)
        }
        if (action == Action.ACCEPT) {
            d.update("contract_participants", cv("status" to "active", "accepted_at" to now), "contract_id = ? AND user_id = ?", arrayOf(contractId, actorId))
        }
    }

    fun acknowledgeVersion(orgId: String, contractId: String, actorId: String): Int = lock.withLock {
        db.tx { d ->
            val latest = d.one("SELECT * FROM contract_versions WHERE contract_id = ? ORDER BY version_number DESC LIMIT 1", contractId)
                ?: throw DomainException("Contract not found", 404)
            val now = Time.nowIso()
            d.update("contract_versions", cv("acknowledged_at" to now, "acknowledged_by" to actorId), "id = ?", arrayOf(latest.str("id")))
            audit(d, actorId, orgId, contractId, "version_acknowledged", "contract_version", latest.strOr("id"), null, jobj("version" to latest.int("version_number")))
            latest.int("version_number")
        }
    }

    fun postInteraction(orgId: String, contractId: String, actorId: String, role: Role, type: IxType, content: String, progress: Int?): Interaction = lock.withLock {
        if (!Rules.canPostInteractions(role)) throw DomainException("Observers cannot post interactions", 403)
        if (content.trim().isEmpty()) throw DomainException("Content is required")
        db.tx { d ->
            val row = d.one("SELECT * FROM contracts WHERE id = ? AND organization_id = ? AND is_deleted = 0", contractId, orgId)
                ?: throw DomainException("Contract not found", 404)
            val now = Time.nowIso()
            val p = progress?.coerceIn(0, 100)
            val id = addInteractionInternal(d, contractId, actorId, type, content.trim(), p, null, null)
            if (type == IxType.PROGRESS && p != null) {
                d.update("contracts", cv("progress" to p, "updated_at" to now), "id = ?", arrayOf(contractId))
            } else {
                d.update("contracts", cv("updated_at" to now), "id = ?", arrayOf(contractId))
            }
            val initiator = row.strOr("initiator_id")
            val executor = row.str("responsible_executor_id")
            val counterpart = if (actorId == initiator) executor else initiator
            if (counterpart != null && counterpart != actorId) {
                val author = d.one("SELECT first_name FROM users WHERE id = ?", actorId)?.strOr("first_name", "Someone")
                notifyInternal(d, counterpart, orgId, type.wire,
                    if (type == IxType.PROGRESS) "Progress update" else "New interaction",
                    "$author added a ${type.wire.replace('_', ' ')} on “${row.strOr("title")}”.", contractId)
            }
            mapInteraction(d.one("SELECT * FROM contract_interactions WHERE id = ?", id)!!)
        }
    }

    fun addAttachment(orgId: String, contractId: String, actorId: String, filename: String, contentType: String, size: Long, localPath: String): Attachment = lock.withLock {
        if (size > 10 * 1024 * 1024) throw DomainException("File too large (10 MB max)")
        db.tx { d ->
            val now = Time.nowIso()
            val id = Crypto.nid("att")
            d.insert("attachments", null, cv(
                "id" to id, "organization_id" to orgId, "contract_id" to contractId, "filename" to filename,
                "content_type" to contentType, "size" to size, "local_path" to localPath,
                "uploaded_by" to actorId, "created_at" to now
            ))
            addInteractionInternal(d, contractId, actorId, IxType.COMMENT, "Attached file: $filename", null, null, null)
            Attachment(id, orgId, contractId, filename, contentType, size, localPath, null, actorId, now)
        }
    }

    fun deleteContract(orgId: String, contractId: String, actorId: String, role: Role) = lock.withLock {
        if (!Rules.can(role, "delete", "contract")) throw DomainException("Insufficient permissions", 403)
        db.tx { d ->
            val row = d.one("SELECT * FROM contracts WHERE id = ? AND organization_id = ?", contractId, orgId) ?: throw DomainException("Contract not found", 404)
            if (Status.from(row.str("current_status")) != Status.DRAFT) throw DomainException("Only drafts can be deleted — archive completed work instead")
            d.update("contracts", cv("is_deleted" to 1, "updated_at" to Time.nowIso()), "id = ?", arrayOf(contractId))
            audit(d, actorId, orgId, contractId, "contract_deleted", "contract", contractId, null, null)
        }
    }

    // =================== Queries ===================

    fun visibleContracts(orgId: String, userId: String, role: Role, status: Status? = null, priority: Priority? = null, search: String? = null): List<Contract> {
        var rows = db.q("SELECT * FROM contracts WHERE organization_id = ? AND is_deleted = 0 ORDER BY updated_at DESC", orgId)
        // Server restricts visibility for executor/observer only — auditors read everything.
        if (role == Role.EXECUTOR || role == Role.OBSERVER) {
            val parts = db.q("SELECT contract_id FROM contract_participants WHERE user_id = ?", userId).map { it.strOr("contract_id") }.toSet()
            rows = rows.filter { it.str("responsible_executor_id") == userId || it.str("initiator_id") == userId || parts.contains(it.str("id")) }
        }
        var list = rows.map { mapContract(it) }
        if (status != null) list = list.filter { it.status == status }
        if (priority != null) list = list.filter { it.priority == priority }
        val s = search?.lowercase()?.trim()
        if (!s.isNullOrEmpty()) {
            list = list.filter {
                it.title.lowercase().contains(s) || it.description.lowercase().contains(s) ||
                    it.contractNumber.lowercase().contains(s) || it.tags.any { t -> t.lowercase().contains(s) }
            }
        }
        return list
    }

    fun fullContract(orgId: String, contractId: String): ContractFull? {
        val row = db.one("SELECT * FROM contracts WHERE id = ? AND organization_id = ? AND is_deleted = 0", contractId, orgId) ?: return null
        val participants = db.q("SELECT * FROM contract_participants WHERE contract_id = ?", contractId).map {
            Participant(it.strOr("id"), contractId, it.strOr("user_id"), it.strOr("role"), it.bool("is_lead"), it.strOr("status", "pending"), it.str("accepted_at"))
        }
        val versions = db.q("SELECT * FROM contract_versions WHERE contract_id = ? ORDER BY version_number DESC", contractId).map {
            Version(it.strOr("id"), contractId, it.int("version_number"), it.strOr("title"), it.strOr("description"), it.str("deadline"),
                Priority.from(it.str("priority")), it.str("change_reason"), it.strOr("changed_by"), it.strOr("changed_at"), it.str("acknowledged_at"), it.str("acknowledged_by"))
        }
        val interactions = db.q("SELECT * FROM contract_interactions WHERE contract_id = ? ORDER BY created_at DESC", contractId).map { mapInteraction(it) }
        val attachments = db.q("SELECT * FROM attachments WHERE contract_id = ? ORDER BY created_at DESC", contractId).map {
            Attachment(it.strOr("id"), orgId, contractId, it.strOr("filename"), it.strOr("content_type"), it.long("size"), it.str("local_path"), it.str("remote_url"), it.strOr("uploaded_by"), it.strOr("created_at"))
        }
        return ContractFull(mapContract(row), participants, versions, interactions, attachments)
    }

    fun auditFor(contractId: String): List<AuditLog> =
        db.q("SELECT * FROM audit_logs WHERE contract_id = ? ORDER BY created_at DESC", contractId).map {
            @Suppress("UNCHECKED_CAST")
            AuditLog(it.strOr("id"), it.str("organization_id"), it.str("contract_id"), it.str("user_id"), it.strOr("action"),
                it.strOr("entity_type"), it.strOr("entity_id"),
                it.str("previous_state")?.let { s -> Json.parse(s) as? Map<String, Any?> },
                it.str("new_state")?.let { s -> Json.parse(s) as? Map<String, Any?> },
                it.strOr("created_at"), it.strOr("checksum"))
        }

    fun notifications(userId: String, unreadOnly: Boolean = false, limit: Int = 100): List<Notification> {
        val sql = if (unreadOnly) "SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC LIMIT ?"
        else "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
        return db.q(sql, userId, limit).map {
            Notification(it.strOr("id"), userId, it.str("organization_id"), it.strOr("type"), it.strOr("title"), it.strOr("content"), it.str("contract_id"), it.bool("read"), it.strOr("created_at"))
        }
    }

    fun unreadCount(userId: String): Int = db.one("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0", userId)?.int("c") ?: 0

    fun markNotificationRead(userId: String, id: String) {
        db.writableDatabase.update("notifications", cv("read" to 1), "id = ? AND user_id = ?", arrayOf(id, userId))
    }

    fun markAllRead(userId: String) {
        db.writableDatabase.update("notifications", cv("read" to 1), "user_id = ?", arrayOf(userId))
    }

    fun notificationPrefs(userId: String): Map<String, Boolean> {
        val row = db.one("SELECT * FROM notification_prefs WHERE user_id = ?", userId)
            ?: return mapOf("contract_assigned" to true, "status_changed" to true, "deadline_reminder" to true, "comments" to true)
        return mapOf(
            "contract_assigned" to row.bool("contract_assigned"), "status_changed" to row.bool("status_changed"),
            "deadline_reminder" to row.bool("deadline_reminder"), "comments" to row.bool("comments")
        )
    }

    fun setNotificationPref(userId: String, key: String, value: Boolean) {
        val allowed = setOf("contract_assigned", "status_changed", "deadline_reminder", "comments")
        if (key !in allowed) return
        if (db.one("SELECT user_id FROM notification_prefs WHERE user_id = ?", userId) == null) {
            db.writableDatabase.insert("notification_prefs", null, cv("user_id" to userId))
        }
        db.writableDatabase.update("notification_prefs", cv(key to value), "user_id = ?", arrayOf(userId))
    }

    fun usersInOrg(orgId: String): List<User> =
        db.q("SELECT u.* FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.organization_id = ? AND m.status = 'active' ORDER BY u.first_name", orgId)
            .map { mapUser(it) }

    fun getUser(userId: String): User? = db.one("SELECT * FROM users WHERE id = ?", userId)?.let { mapUser(it) }

    fun search(orgId: String, userId: String, role: Role, query: String): Pair<List<Contract>, List<User>> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return emptyList<Contract>() to emptyList()
        val contracts = visibleContracts(orgId, userId, role, search = q).take(20)
        val users = usersInOrg(orgId).filter { it.name.lowercase().contains(q) || it.email.lowercase().contains(q) }.take(10)
        return contracts to users
    }

    // =================== Analytics ===================

    data class Analytics(
        val total: Int, val active: Int, val pendingReview: Int, val overdue: Int, val completionRate: Int,
        val completed: Int, val completedThisMonth: Int, val thisWeekCreated: Int,
        val byStatus: Map<Status, Int>,
        val weekly: List<Triple<String, Int, Int>>,       // label, created, completed
        val sealedPerMonth: List<Pair<String, Int>>,
        val team: List<TeamPerf>,
        val recent: List<Contract>,
    )
    data class TeamPerf(val userId: String, val name: String, val completed: Int, val avgDays: Double, val onTime: Int)

    fun analytics(orgId: String, userId: String, role: Role): Analytics {
        val contracts = visibleContracts(orgId, userId, role)
        val now = System.currentTimeMillis()
        val byStatus = Status.entries.associateWith { s -> contracts.count { it.status == s } }.filterValues { it > 0 }
        val approved = contracts.filter { it.status == Status.APPROVED }
        val active = contracts.filter { !it.isTerminal }
        val overdue = contracts.filter { it.isOverdue(now) }
        val monthAgo = now - 30L * 86400_000
        val completedThisMonth = contracts.count { (Time.parseIso(it.completedAt) ?: 0) > monthAgo }
        val thisWeek = contracts.count { (Time.parseIso(it.createdAt) ?: 0) > now - 7L * 86400_000 }

        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0); cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0); cal.set(java.util.Calendar.MILLISECOND, 0)
        cal.add(java.util.Calendar.DAY_OF_MONTH, -7 * 8)
        val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
        val weekly = ArrayList<Triple<String, Int, Int>>()
        for (i in 0 until 8) {
            val start = cal.timeInMillis
            val end = start + 7L * 86400_000
            val c = java.util.Calendar.getInstance(); c.timeInMillis = start
            val label = "${months[c.get(java.util.Calendar.MONTH)]} ${c.get(java.util.Calendar.DAY_OF_MONTH)}"
            weekly.add(Triple(label,
                contracts.count { val t = Time.parseIso(it.createdAt) ?: 0; t in start until end },
                contracts.count { val t = Time.parseIso(it.completedAt) ?: -1; t in start until end }))
            cal.add(java.util.Calendar.DAY_OF_MONTH, 7)
        }
        val sealed = ArrayList<Pair<String, Int>>()
        for (i in 5 downTo 0) {
            val c = java.util.Calendar.getInstance()
            c.set(java.util.Calendar.DAY_OF_MONTH, 1); c.set(java.util.Calendar.HOUR_OF_DAY, 0)
            c.set(java.util.Calendar.MINUTE, 0); c.set(java.util.Calendar.SECOND, 0); c.set(java.util.Calendar.MILLISECOND, 0)
            c.add(java.util.Calendar.MONTH, -i)
            val start = c.timeInMillis
            c.add(java.util.Calendar.MONTH, 1)
            val end = c.timeInMillis
            val mc = java.util.Calendar.getInstance(); mc.timeInMillis = start
            sealed.add(months[mc.get(java.util.Calendar.MONTH)] to contracts.count { val t = Time.parseIso(it.approvedAt) ?: -1; t in start until end })
        }
        val users = usersInOrg(orgId).associateBy { it.id }
        val teamMap = LinkedHashMap<String, MutableList<Contract>>()
        for (c in contracts) { val e = c.executorId ?: continue; teamMap.getOrPut(e) { ArrayList() }.add(c) }
        val team = teamMap.map { (uid, list) ->
            val done = list.filter { it.approvedAt != null }
            var totalDays = 0L; var withDeadline = 0; var onTime = 0
            for (c in done) {
                val a = Time.parseIso(c.acceptedAt); val ap = Time.parseIso(c.approvedAt)
                if (a != null && ap != null) totalDays += Math.max(0, Math.round((ap - a) / 86400_000.0))
                val dl = Time.parseIso(c.deadline)
                if (dl != null && ap != null) { withDeadline++; if (ap <= dl) onTime++ }
            }
            TeamPerf(uid, users[uid]?.name ?: "Unknown", done.size,
                if (done.isNotEmpty()) Math.round(totalDays.toDouble() / done.size * 10) / 10.0 else 0.0,
                if (withDeadline > 0) Math.round(onTime * 100.0 / withDeadline).toInt() else 0)
        }.sortedByDescending { it.completed }

        return Analytics(
            contracts.size, active.size, byStatus[Status.SUBMITTED] ?: 0, overdue.size,
            if (contracts.isNotEmpty()) Math.round(approved.size * 100.0 / contracts.size).toInt() else 0,
            approved.size, completedThisMonth, thisWeek, byStatus, weekly, sealed, team,
            contracts.sortedByDescending { Time.parseIso(it.updatedAt) ?: 0 }.take(8)
        )
    }

    /** Deadline sweep — same rules as the server cron: due ≤24h and overdue, deduped per day. */
    fun deadlineSweep(): Int = lock.withLock {
        val now = System.currentTimeMillis()
        val today = Time.nowIso().substring(0, 10)
        var created = 0
        db.tx { d ->
            val rows = d.q("SELECT * FROM contracts WHERE is_deleted = 0 AND current_deadline IS NOT NULL AND current_status NOT IN ('approved','rejected','archived')")
            for (row in rows) {
                val dl = Time.parseIso(row.str("current_deadline")) ?: continue
                val overdue = dl < now
                val dueSoon = !overdue && dl <= now + 24L * 3600_000
                if (!overdue && !dueSoon) continue
                val targets = listOfNotNull(row.str("responsible_executor_id"), row.str("initiator_id")).distinct()
                for (uid in targets) {
                    val p = d.one("SELECT deadline_reminder FROM notification_prefs WHERE user_id = ?", uid)
                    if (p != null && !p.bool("deadline_reminder")) continue
                    val dupeKey = "deadline:${row.str("id")}:$uid:$today:${if (overdue) "over" else "soon"}"
                    if (d.one("SELECT id FROM sync_state WHERE key = ?", dupeKey) != null) continue
                    d.insert("sync_state", null, cv("key" to dupeKey, "value" to "1"))
                    notifyInternal(d, uid, row.str("organization_id"), "deadline",
                        if (overdue) "Contract overdue" else "Deadline approaching",
                        "${row.strOr("contract_number")} “${row.strOr("title")}” ${if (overdue) "is past its deadline." else "is due within 24 hours."}",
                        row.str("id"))
                    created++
                }
            }
        }
        return created
    }

    // =================== Export ===================

    fun exportContractJson(orgId: String, contractId: String): String {
        val full = fullContract(orgId, contractId) ?: throw DomainException("Contract not found", 404)
        val users = usersInOrg(orgId).associateBy { it.id }
        fun userJson(id: String?): Any? = id?.let { users[it]?.let { u -> jobj("id" to u.id, "name" to u.name, "email" to u.email) } }
        return Json.write(jobj(
            "exportedAt" to Time.nowIso(),
            "contract" to jobj(
                "id" to full.contract.id, "contractNumber" to full.contract.contractNumber, "title" to full.contract.title,
                "description" to full.contract.description, "status" to full.contract.status.wire, "priority" to full.contract.priority.wire,
                "deadline" to full.contract.deadline, "progress" to full.contract.progress, "tags" to full.contract.tags,
                "initiator" to userJson(full.contract.initiatorId), "executor" to userJson(full.contract.executorId),
                "createdAt" to full.contract.createdAt, "currentVersion" to full.contract.currentVersion
            ),
            "versions" to full.versions.map { v -> jobj(
                "versionNumber" to v.versionNumber, "title" to v.title, "description" to v.description,
                "deadline" to v.deadline, "priority" to v.priority.wire, "changeReason" to v.changeReason,
                "changedBy" to userJson(v.changedBy), "changedAt" to v.changedAt, "acknowledgedAt" to v.acknowledgedAt
            ) },
            "interactions" to full.interactions.map { i -> jobj(
                "type" to i.type.wire, "author" to userJson(i.authorId), "content" to i.content,
                "progress" to i.progress, "statusFrom" to i.statusFrom?.wire, "statusTo" to i.statusTo?.wire, "createdAt" to i.createdAt
            ) },
            "auditTrail" to auditFor(contractId).map { a -> jobj(
                "action" to a.action, "user" to userJson(a.userId), "createdAt" to a.createdAt, "checksum" to a.checksum
            ) }
        ))
    }

    fun exportContractCsv(orgId: String, contractId: String): String {
        val full = fullContract(orgId, contractId) ?: throw DomainException("Contract not found", 404)
        val users = usersInOrg(orgId).associateBy { it.id }
        fun esc(v: Any?): String = "\"" + (v?.toString() ?: "").replace("\"", "\"\"") + "\""
        val rows = ArrayList<List<String>>()
        rows.add(listOf("kind", "at", "actor", "detail"))
        for (v in full.versions) rows.add(listOf("version", v.changedAt, users[v.changedBy]?.name ?: "", "v${v.versionNumber} ${v.changeReason ?: ""}"))
        for (i in full.interactions) rows.add(listOf("interaction", i.createdAt, users[i.authorId]?.name ?: "", "${i.type.wire}: ${i.content}"))
        return rows.joinToString("\n") { r -> r.joinToString(",") { esc(it) } }
    }

    // =================== internals ===================

    private fun addInteractionInternal(d: android.database.sqlite.SQLiteDatabase, contractId: String, authorId: String, type: IxType, content: String, progress: Int?, from: Status?, to: Status?): String {
        val id = Crypto.nid("ix")
        d.insert("contract_interactions", null, cv(
            "id" to id, "contract_id" to contractId, "author_id" to authorId, "interaction_type" to type.wire,
            "content" to content, "progress_percentage" to progress,
            "status_change_from" to from?.wire, "status_change_to" to to?.wire, "created_at" to Time.nowIso()
        ))
        return id
    }

    private fun notifyInternal(d: android.database.sqlite.SQLiteDatabase, userId: String, orgId: String?, type: String, title: String, content: String, contractId: String?) {
        // Respect notification preferences (same categories as the web app)
        val prefKey = when (type) {
            "send", "invite" -> "contract_assigned"
            "comment", "progress_update", "clarification_request", "clarification_response", "scope_proposal", "issue_report", "issue_resolution" -> "comments"
            "deadline" -> "deadline_reminder"
            else -> "status_changed"
        }
        val prefs = d.one("SELECT * FROM notification_prefs WHERE user_id = ?", userId)
        if (prefs != null && !prefs.bool(prefKey)) return
        d.insert("notifications", null, cv(
            "id" to Crypto.nid("n"), "user_id" to userId, "organization_id" to orgId, "type" to type,
            "title" to title, "content" to content, "contract_id" to contractId, "read" to 0, "created_at" to Time.nowIso()
        ))
    }

    private fun audit(d: android.database.sqlite.SQLiteDatabase, userId: String?, orgId: String?, contractId: String?, action: String, entityType: String, entityId: String, prev: Map<String, Any?>?, next: Map<String, Any?>?) {
        val created = Time.nowIso()
        val checksum = Crypto.sha256Hex("$action|$entityId|$created|${Json.write(prev ?: emptyMap<String, Any?>())}")
        d.insert("audit_logs", null, cv(
            "id" to Crypto.nid("au"), "organization_id" to orgId, "contract_id" to contractId, "user_id" to userId,
            "action" to action, "entity_type" to entityType, "entity_id" to entityId,
            "previous_state" to prev?.let { Json.write(it) }, "new_state" to next?.let { Json.write(it) },
            "created_at" to created, "checksum" to checksum
        ))
    }

    private fun getContract(d: android.database.sqlite.SQLiteDatabase, id: String): Contract? =
        d.one("SELECT * FROM contracts WHERE id = ?", id)?.let { mapContract(it) }

    private fun getUser(d: android.database.sqlite.SQLiteDatabase, id: String): User? =
        d.one("SELECT * FROM users WHERE id = ?", id)?.let { mapUser(it) }

    private fun mapContract(r: android.content.ContentValues) = Contract(
        id = r.strOr("id"), orgId = r.strOr("organization_id"), contractNumber = r.strOr("contract_number"),
        title = r.strOr("title"), description = r.strOr("current_description"), deadline = r.str("current_deadline"),
        priority = Priority.from(r.str("current_priority")), status = Status.from(r.str("current_status")),
        progress = r.int("progress"), initiatorId = r.strOr("initiator_id"), executorId = r.str("responsible_executor_id"),
        categoryId = r.str("category_id"), tags = Json.arr(Json.parse(r.str("tags") ?: "[]")).mapNotNull { Json.str(it) },
        currentVersion = r.int("current_version").let { if (it == 0) 1 else it },
        createdAt = r.strOr("created_at"), updatedAt = r.strOr("updated_at"),
        sentAt = r.str("sent_at"), acceptedAt = r.str("accepted_at"), submittedAt = r.str("submitted_at"),
        approvedAt = r.str("approved_at"), completedAt = r.str("completed_at"), archivedAt = r.str("archived_at")
    )

    private fun mapUser(r: android.content.ContentValues) = User(
        id = r.strOr("id"), email = r.strOr("email"), firstName = r.strOr("first_name"), lastName = r.strOr("last_name"),
        title = r.str("title"), avatarUrl = r.str("avatar_url"),
        twoFactorEnabled = r.bool("two_factor_enabled"),
        createdAt = r.strOr("created_at"), lastLoginAt = r.str("last_login_at")
    )

    private fun mapInteraction(r: android.content.ContentValues) = Interaction(
        id = r.strOr("id"), contractId = r.strOr("contract_id"), authorId = r.strOr("author_id"),
        type = IxType.from(r.str("interaction_type")), content = r.strOr("content"),
        progress = if (r.get("progress_percentage") == null) null else r.int("progress_percentage"),
        statusFrom = r.str("status_change_from")?.let { Status.from(it) },
        statusTo = r.str("status_change_to")?.let { Status.from(it) },
        createdAt = r.strOr("created_at")
    )
}
