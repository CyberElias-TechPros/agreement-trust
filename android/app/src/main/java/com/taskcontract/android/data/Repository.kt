package com.taskcontract.android.data

import android.content.Context
import com.taskcontract.android.core.*
import com.taskcontract.android.domain.*
import com.taskcontract.android.remote.ApiException
import com.taskcontract.android.remote.OfflineException
import com.taskcontract.android.remote.RemoteApi

/**
 * Single data facade for the UI.
 *
 * DEVICE mode — fully on-device workspace (LocalEngine). Works 100% offline,
 * seeded demo available, private by design.
 *
 * SERVER mode — the backend is the source of truth. Reads refresh a local
 * mirror (so the app is instant and offline-readable). Writes go to the API;
 * when offline they are applied to the mirror AND queued in a persistent
 * outbox, then replayed on reconnect. After replay the mirror is refreshed
 * from the server (server wins on conflict).
 */
class Repository(val context: Context) {
    val db = Db(context)
    val engine = LocalEngine(db)
    val session = SessionManager(context)
    val api = RemoteApi(session)

    val isServer: Boolean get() = session.mode == SessionManager.Mode.SERVER
    val userId: String get() = session.userId ?: throw DomainException("Not signed in", 401)

    fun user(): User? = engine.getUser(userId)

    fun orgs(): List<Pair<Organization, Role>> = engine.organizationsFor(userId)

    fun currentOrg(): Pair<Organization, Role>? {
        val orgs = orgs()
        return orgs.firstOrNull { it.first.id == session.orgId } ?: orgs.firstOrNull()?.also { session.orgId = it.first.id }
    }

    fun role(): Role = currentOrg()?.second ?: Role.OBSERVER
    fun orgId(): String = currentOrg()?.first?.id ?: throw DomainException("No organization selected")

    // =================== Auth ===================

    data class AuthResult(val user: User, val requires2fa: Boolean = false, val challengeToken: String? = null)

    fun enterDemo(): User {
        Seed.seedIfEmpty(db)
        val u = engine.login(Seed.DEMO_EMAIL, Seed.DEMO_PASSWORD)
        session.mode = SessionManager.Mode.DEVICE
        session.userId = u.id
        session.orgId = "org1"
        session.onboardingDone = true
        Bus.emit(Bus.SESSION_CHANGED)
        return u
    }

    fun loginDevice(email: String, password: String, otp: String?): User {
        val u = engine.login(email, password, otp)
        session.mode = SessionManager.Mode.DEVICE
        session.userId = u.id
        session.orgId = engine.organizationsFor(u.id).firstOrNull()?.first?.id
        Bus.emit(Bus.SESSION_CHANGED)
        return u
    }

    fun registerDevice(email: String, password: String, firstName: String, lastName: String, orgName: String?): User {
        val (u, org) = engine.register(email, password, firstName, lastName, orgName)
        session.mode = SessionManager.Mode.DEVICE
        session.userId = u.id
        session.orgId = org.id
        session.onboardingDone = true
        Bus.emit(Bus.SESSION_CHANGED)
        return u
    }

    fun loginServer(email: String, password: String, otp: String?): AuthResult {
        val data = api.login(email, password, otp)
        if (Json.bool(data["requires2fa"])) return AuthResult(User("", email, "", ""), true, Json.str(data["challengeToken"]))
        captureServerSession(data)
        return AuthResult(user()!!)
    }

    fun verify2faServer(challengeToken: String, code: String): User {
        captureServerSession(api.verify2fa(challengeToken, code))
        return user()!!
    }

    fun registerServer(email: String, password: String, firstName: String, lastName: String, orgName: String?): User {
        val data = api.register(email, password, firstName, lastName, orgName)
        session.accessToken = Json.str(data["accessToken"])
        session.refreshToken = Json.str(data["refreshToken"])
        session.mode = SessionManager.Mode.SERVER
        val u = Json.obj(data["user"])
        upsertUser(u)
        val org = Json.obj(data["organization"])
        upsertOrg(org, Json.str(org["role"]) ?: "owner", u.req("id"))
        session.userId = u.req("id")
        session.orgId = org.req("id")
        session.onboardingDone = true
        Bus.emit(Bus.SESSION_CHANGED)
        return user()!!
    }

    private fun captureServerSession(data: Map<String, Any?>) {
        session.accessToken = Json.str(data["accessToken"])
        session.refreshToken = Json.str(data["refreshToken"])
        session.mode = SessionManager.Mode.SERVER
        val u = Json.obj(data["user"])
        upsertUser(u)
        val orgs = Json.arr(data["organizations"]).map { Json.obj(it) }
        for (o in orgs) upsertOrg(o, Json.str(o["role"]) ?: "executor", u.req("id"))
        session.userId = u.req("id")
        if (session.orgId == null || orgs.none { it.s("id") == session.orgId }) session.orgId = orgs.firstOrNull()?.s("id")
        session.onboardingDone = true
        Bus.emit(Bus.SESSION_CHANGED)
        Async.run({ refreshAll() }, {})
    }

    fun signOut() {
        if (isServer) Async.run({ api.logout() }, {})
        session.signOut()
    }

    // =================== Server mirror ===================

    private fun upsertUser(u: Map<String, Any?>) {
        val id = u.s("id") ?: return
        val now = Time.nowIso()
        val existing = db.one("SELECT id FROM users WHERE id = ?", id)
        val values = cv(
            "email" to (u.s("email") ?: ""), "first_name" to (u.s("firstName") ?: ""),
            "last_name" to (u.s("lastName") ?: ""), "title" to u.s("title"),
            "avatar_url" to u.s("avatarUrl"), "updated_at" to now
        )
        if (existing == null) {
            values.put("id", id); values.put("created_at", now)
            db.writableDatabase.insert("users", null, values)
        } else db.writableDatabase.update("users", values, "id = ?", arrayOf(id))
    }

    private fun upsertOrg(o: Map<String, Any?>, role: String, userId: String) {
        val id = o.s("id") ?: return
        val now = Time.nowIso()
        if (db.one("SELECT id FROM organizations WHERE id = ?", id) == null) {
            db.writableDatabase.insert("organizations", null, cv("id" to id, "name" to (o.s("name") ?: ""), "slug" to (o.s("slug") ?: id), "plan_type" to (o.s("planType") ?: "free"), "created_at" to now, "updated_at" to now))
        } else {
            db.writableDatabase.update("organizations", cv("name" to (o.s("name") ?: ""), "plan_type" to (o.s("planType") ?: "free"), "updated_at" to now), "id = ?", arrayOf(id))
        }
        if (db.one("SELECT id FROM memberships WHERE organization_id = ? AND user_id = ?", id, userId) == null) {
            db.writableDatabase.insert("memberships", null, cv("id" to Crypto.nid("m"), "organization_id" to id, "user_id" to userId, "role" to role, "status" to "active", "joined_at" to now))
        } else {
            db.writableDatabase.update("memberships", cv("role" to role, "status" to "active"), "organization_id = ? AND user_id = ?", arrayOf(id, userId))
        }
    }

    private fun upsertContract(c: Map<String, Any?>, orgId: String) {
        val id = c.s("id") ?: return
        c.o("initiator").let { if (it.isNotEmpty()) upsertUser(it) }
        (c["executor"] ?: c["responsibleExecutor"])?.let { upsertUser(Json.obj(it)) }
        val cat = Json.obj(c["category"])
        if (cat.isNotEmpty() && cat.s("id") != null) {
            if (db.one("SELECT id FROM categories WHERE id = ?", cat.s("id")) == null) {
                db.writableDatabase.insert("categories", null, cv("id" to cat.s("id"), "organization_id" to orgId, "name" to (cat.s("name") ?: ""), "color" to (cat.s("color") ?: "#4C58D6"), "created_at" to Time.nowIso()))
            }
        }
        val values = cv(
            "organization_id" to orgId, "contract_number" to (c.s("contractNumber") ?: ""),
            "title" to (c.s("title") ?: ""), "current_description" to (c.s("description") ?: c.s("currentDescription") ?: ""),
            "current_deadline" to (c.s("deadline") ?: c.s("currentDeadline")),
            "current_priority" to (c.s("priority") ?: c.s("currentPriority") ?: "medium"),
            "current_status" to (c.s("status") ?: c.s("currentStatus") ?: "draft"),
            "progress" to (Json.int(c["progress"]) ?: 0),
            "initiator_id" to (Json.obj(c["initiator"]).s("id") ?: ""),
            "responsible_executor_id" to (Json.obj(c["executor"] ?: c["responsibleExecutor"]).s("id")),
            "category_id" to (cat.s("id")),
            "tags" to Json.write(c.strList("tags")),
            "current_version" to (Json.int(c["currentVersion"]) ?: 1),
            "is_deleted" to 0,
            "created_at" to (c.s("createdAt") ?: Time.nowIso()), "updated_at" to (c.s("updatedAt") ?: Time.nowIso()),
            "sent_at" to c.s("sentAt"), "accepted_at" to c.s("acceptedAt"), "submitted_at" to c.s("submittedAt"),
            "approved_at" to c.s("approvedAt"), "completed_at" to c.s("completedAt"), "archived_at" to c.s("archivedAt")
        )
        if (db.one("SELECT id FROM contracts WHERE id = ?", id) == null) {
            values.put("id", id)
            db.writableDatabase.insert("contracts", null, values)
        } else db.writableDatabase.update("contracts", values, "id = ?", arrayOf(id))
    }

    private fun upsertFullDetail(data: Map<String, Any?>, orgId: String, contractId: String) {
        db.tx { d ->
            d.delete("contract_versions", "contract_id = ?", arrayOf(contractId))
            d.delete("contract_interactions", "contract_id = ?", arrayOf(contractId))
            d.delete("contract_participants", "contract_id = ?", arrayOf(contractId))
            for (v in Json.arr(data["versions"]).map { Json.obj(it) }) {
                v.o("changedBy").let { if (it.isNotEmpty()) upsertUser(it) }
                d.insert("contract_versions", null, cv(
                    "id" to (v.s("id") ?: Crypto.nid("v")), "contract_id" to contractId,
                    "version_number" to (Json.int(v["versionNumber"]) ?: 1), "title" to v.s("title"),
                    "description" to (v.s("description") ?: ""), "deadline" to v.s("deadline"),
                    "priority" to (v.s("priority") ?: "medium"), "change_reason" to v.s("changeReason"),
                    "changed_by" to (Json.obj(v["changedBy"]).s("id") ?: ""), "changed_at" to (v.s("changedAt") ?: Time.nowIso()),
                    "acknowledged_at" to v.s("acknowledgedAt"), "acknowledged_by" to v.s("acknowledgedBy")
                ))
            }
            for (i in Json.arr(data["interactions"]).map { Json.obj(it) }) {
                i.o("author").let { if (it.isNotEmpty()) upsertUser(it) }
                d.insert("contract_interactions", null, cv(
                    "id" to (i.s("id") ?: Crypto.nid("ix")), "contract_id" to contractId,
                    "author_id" to (Json.obj(i["author"]).s("id") ?: ""), "interaction_type" to (i.s("interactionType") ?: "comment"),
                    "content" to (i.s("content") ?: ""), "progress_percentage" to Json.int(i["progressPercentage"]),
                    "status_change_from" to i.s("statusChangeFrom"), "status_change_to" to i.s("statusChangeTo"),
                    "created_at" to (i.s("createdAt") ?: Time.nowIso())
                ))
            }
            for (p in Json.arr(data["participants"]).map { Json.obj(it) }) {
                p.o("user").let { if (it.isNotEmpty()) upsertUser(it) }
                d.insert("contract_participants", null, cv(
                    "id" to (p.s("id") ?: Crypto.nid("p")), "contract_id" to contractId,
                    "user_id" to (Json.obj(p["user"]).s("id") ?: ""), "role" to (p.s("role") ?: "observer"),
                    "is_lead" to Json.bool(p["isLead"]), "status" to (p.s("status") ?: "pending"), "accepted_at" to p.s("acceptedAt")
                ))
            }
        }
    }

    /** Pull everything for the current org from the server into the mirror. */
    fun refreshAll() {
        if (!isServer) return
        val oid = session.orgId ?: return
        try {
            val me = api.me()
            val u = Json.obj(me["user"]); upsertUser(u)
            for (o in Json.arr(me["organizations"]).map { Json.obj(it) }) upsertOrg(o, Json.str(o["role"]) ?: "executor", u.req("id"))

            var page = 1
            val seen = HashSet<String>()
            while (page <= 20) {
                val data = api.contracts(oid, page = page, limit = 100)
                val list = Json.arr(data["contracts"]).map { Json.obj(it) }
                db.tx { for (c in list) { upsertContract(c, oid); c.s("id")?.let { seen.add(it) } } }
                val pagination = Json.obj(data["pagination"])
                val pages = Json.int(pagination["pages"]) ?: 1
                if (page >= pages || list.isEmpty()) break
                page++
            }
            // Remove local rows deleted on the server
            val placeholders = seen.joinToString(",") { "'$it'" }
            if (seen.isNotEmpty()) db.writableDatabase.delete("contracts", "organization_id = ? AND id NOT IN ($placeholders)", arrayOf(oid))

            for (m in api.members(oid)) {
                val mu = Json.obj(m["user"] ?: m["userDetails"]); upsertUser(mu)
                val mid = m.s("id") ?: continue
                if (db.one("SELECT id FROM memberships WHERE id = ?", mid) == null) {
                    db.writableDatabase.insert("memberships", null, cv("id" to mid, "organization_id" to oid, "user_id" to mu.req("id"), "role" to (m.s("role") ?: "executor"), "status" to (m.s("status") ?: "active"), "joined_at" to (m.s("joinedAt") ?: Time.nowIso())))
                } else {
                    db.writableDatabase.update("memberships", cv("role" to (m.s("role") ?: "executor"), "status" to (m.s("status") ?: "active")), "id = ?", arrayOf(mid))
                }
            }
            for (c in api.categories(oid)) {
                val cid = c.s("id") ?: continue
                if (db.one("SELECT id FROM categories WHERE id = ?", cid) == null) {
                    db.writableDatabase.insert("categories", null, cv("id" to cid, "organization_id" to oid, "name" to (c.s("name") ?: ""), "color" to (c.s("color") ?: "#4C58D6"), "description" to c.s("description"), "created_at" to Time.nowIso()))
                } else {
                    db.writableDatabase.update("categories", cv("name" to (c.s("name") ?: ""), "color" to (c.s("color") ?: "#4C58D6"), "description" to c.s("description")), "id = ?", arrayOf(cid))
                }
            }
            val nd = api.notifications(limit = 100)
            for (n in Json.arr(nd["notifications"]).map { Json.obj(it) }) {
                val nid = n.s("id") ?: continue
                val values = cv("user_id" to userId, "organization_id" to oid, "type" to (n.s("type") ?: ""), "title" to (n.s("title") ?: ""), "content" to (n.s("content") ?: ""), "contract_id" to n.s("contractId"), "read" to Json.bool(n["read"]), "created_at" to (n.s("createdAt") ?: Time.nowIso()))
                if (db.one("SELECT id FROM notifications WHERE id = ?", nid) == null) {
                    values.put("id", nid); db.writableDatabase.insert("notifications", null, values)
                } else db.writableDatabase.update("notifications", values, "id = ?", arrayOf(nid))
            }
            syncPreferences()
            session.lastSyncAt = System.currentTimeMillis()
            Bus.emit(Bus.DATA_CHANGED)
            Bus.emit(Bus.NOTIFICATIONS_CHANGED)
            Bus.emit(Bus.SYNC_STATE, "ok")
        } catch (e: OfflineException) {
            Bus.emit(Bus.SYNC_STATE, "offline")
        } catch (e: ApiException) {
            Bus.emit(Bus.SYNC_STATE, "error: ${e.message}")
        } catch (e: Exception) {
            Bus.emit(Bus.SYNC_STATE, "error")
        }
    }

    fun refreshContractDetail(contractId: String) {
        if (!isServer) return
        try {
            val data = api.contract(orgId(), contractId)
            upsertContract(Json.obj(data["contract"]), orgId())
            upsertFullDetail(data, orgId(), contractId)
            Bus.emit(Bus.DATA_CHANGED)
        } catch (_: Exception) { /* mirror stays as-is */ }
    }

    // =================== Outbox (offline writes in server mode) ===================

    private fun enqueue(kind: String, payload: Map<String, Any?>) {
        db.writableDatabase.insert("outbox", null, cv("id" to Crypto.nid("ob"), "kind" to kind, "payload" to Json.write(payload), "created_at" to Time.nowIso(), "attempts" to 0))
        Bus.emit(Bus.SYNC_STATE, "pending")
    }

    fun outboxCount(): Int = db.one("SELECT COUNT(*) AS c FROM outbox")?.int("c") ?: 0

    fun replayOutbox() {
        if (!isServer) return
        val items = db.q("SELECT * FROM outbox ORDER BY created_at ASC")
        if (items.isEmpty()) return
        var failed = 0
        for (item in items) {
            val kind = item.strOr("kind")
            val p = Json.obj(Json.parse(item.strOr("payload")))
            try {
                val oid = p.s("orgId") ?: session.orgId ?: continue
                val cid = p.s("contractId")
                when (kind) {
                    "transition" -> api.transition(oid, cid!!, p.req("action"), p.s("note"))
                    "interaction" -> api.postInteraction(oid, cid!!, p.req("type"), p.req("content"), Json.int(p["progress"]))
                    "create" -> api.createContract(oid, Json.obj(p["body"]))
                    "edit" -> api.updateContract(oid, cid!!, Json.obj(p["body"]))
                    "acknowledge" -> api.acknowledge(oid, cid!!)
                    "markRead" -> api.markRead(p.req("id"))
                    "markAllRead" -> api.markAllRead()
                    "invite" -> api.inviteMember(oid, p.req("email"), p.req("role"))
                    "category" -> api.createCategory(oid, p.req("name"), p.req("color"), p.s("description"))
                    "profile" -> api.updateProfile(Json.obj(p["body"]))
                    else -> {}
                }
                db.writableDatabase.delete("outbox", "id = ?", arrayOf(item.strOr("id")))
            } catch (e: OfflineException) {
                failed++
            } catch (e: ApiException) {
                // Server rejected (conflict / permission / stale state): drop it; server state wins after refresh.
                db.writableDatabase.update("outbox", cv("attempts" to item.int("attempts") + 1, "last_error" to e.message), "id = ?", arrayOf(item.strOr("id")))
                if (item.int("attempts") >= 2) db.writableDatabase.delete("outbox", "id = ?", arrayOf(item.strOr("id")))
                failed++
            }
        }
        if (failed == 0) {
            refreshAll()
        }
        Bus.emit(Bus.SYNC_STATE, if (outboxCount() > 0) "pending" else "ok")
        Bus.emit(Bus.DATA_CHANGED)
    }

    // =================== Unified operations ===================

    fun contracts(status: Status? = null, priority: Priority? = null, search: String? = null): List<Contract> =
        engine.visibleContracts(orgId(), userId, role(), status, priority, search)

    fun contract(contractId: String): ContractFull? = engine.fullContract(orgId(), contractId)

    fun createContract(input: LocalEngine.NewContract): Contract {
        if (!isServer) return engine.createContract(orgId(), userId, role(), input).also { Bus.emit(Bus.DATA_CHANGED) }
        val body = jobj(
            "title" to input.title, "description" to input.description, "executorId" to input.executorId,
            "observerIds" to input.observerIds, "deadline" to input.deadline, "priority" to input.priority.wire,
            "categoryId" to input.categoryId, "tags" to input.tags, "send" to input.sendNow
        )
        return try {
            val data = api.createContract(orgId(), body)
            val c = Json.obj(data["contract"])
            upsertContract(c, orgId())
            refreshContractDetail(c.req("id"))
            Bus.emit(Bus.DATA_CHANGED)
            engine.fullContract(orgId(), c.req("id"))!!.contract
        } catch (e: OfflineException) {
            val local = engine.createContract(orgId(), userId, role(), input)
            enqueue("create", jobj("orgId" to orgId(), "body" to body, "localId" to local.id))
            Bus.emit(Bus.DATA_CHANGED)
            local
        }
    }

    fun editContract(contractId: String, edit: LocalEngine.ContractEdit): Contract {
        if (!isServer) return engine.editContract(orgId(), contractId, userId, role(), edit).also { Bus.emit(Bus.DATA_CHANGED) }
        val body = jobj(
            "title" to edit.title, "description" to edit.description,
            "deadline" to if (edit.clearDeadline) null else edit.deadline,
            "priority" to edit.priority?.wire, "categoryId" to edit.categoryId,
            "tags" to edit.tags, "changeReason" to edit.changeReason
        )
        return try {
            val data = api.updateContract(orgId(), contractId, body)
            upsertContract(Json.obj(data["contract"]), orgId())
            refreshContractDetail(contractId)
            Bus.emit(Bus.DATA_CHANGED)
            engine.fullContract(orgId(), contractId)!!.contract
        } catch (e: OfflineException) {
            val local = engine.editContract(orgId(), contractId, userId, role(), edit)
            enqueue("edit", jobj("orgId" to orgId(), "contractId" to contractId, "body" to body))
            Bus.emit(Bus.DATA_CHANGED)
            local
        }
    }

    fun transition(contractId: String, action: Action, note: String?): Contract {
        if (!isServer) return engine.transition(orgId(), contractId, action, userId, role(), note).also {
            Bus.emit(Bus.DATA_CHANGED); Bus.emit(Bus.NOTIFICATIONS_CHANGED)
        }
        return try {
            val data = api.transition(orgId(), contractId, action.wire, note)
            upsertContract(Json.obj(data["contract"]), orgId())
            refreshContractDetail(contractId)
            Bus.emit(Bus.DATA_CHANGED); Bus.emit(Bus.NOTIFICATIONS_CHANGED)
            engine.fullContract(orgId(), contractId)!!.contract
        } catch (e: OfflineException) {
            val local = engine.transition(orgId(), contractId, action, userId, role(), note)
            enqueue("transition", jobj("orgId" to orgId(), "contractId" to contractId, "action" to action.wire, "note" to note))
            Bus.emit(Bus.DATA_CHANGED); Bus.emit(Bus.NOTIFICATIONS_CHANGED)
            local
        }
    }

    fun postInteraction(contractId: String, type: IxType, content: String, progress: Int?): Interaction {
        if (!isServer) return engine.postInteraction(orgId(), contractId, userId, role(), type, content, progress).also {
            Bus.emit(Bus.DATA_CHANGED); Bus.emit(Bus.NOTIFICATIONS_CHANGED)
        }
        return try {
            api.postInteraction(orgId(), contractId, type.wire, content, progress)
            refreshContractDetail(contractId)
            Bus.emit(Bus.DATA_CHANGED)
            engine.fullContract(orgId(), contractId)!!.interactions.first()
        } catch (e: OfflineException) {
            val local = engine.postInteraction(orgId(), contractId, userId, role(), type, content, progress)
            enqueue("interaction", jobj("orgId" to orgId(), "contractId" to contractId, "type" to type.wire, "content" to content, "progress" to progress))
            Bus.emit(Bus.DATA_CHANGED)
            local
        }
    }

    fun acknowledge(contractId: String): Int {
        if (!isServer) return engine.acknowledgeVersion(orgId(), contractId, userId).also { Bus.emit(Bus.DATA_CHANGED) }
        return try {
            val r = api.acknowledge(orgId(), contractId)
            refreshContractDetail(contractId)
            Json.int(r["versionNumber"]) ?: 0
        } catch (e: OfflineException) {
            val v = engine.acknowledgeVersion(orgId(), contractId, userId)
            enqueue("acknowledge", jobj("orgId" to orgId(), "contractId" to contractId))
            Bus.emit(Bus.DATA_CHANGED)
            v
        }
    }

    fun deleteDraft(contractId: String) {
        if (isServer) {
            api.deleteContract(orgId(), contractId)
            db.writableDatabase.update("contracts", cv("is_deleted" to 1), "id = ?", arrayOf(contractId))
        } else {
            engine.deleteContract(orgId(), contractId, userId, role())
        }
        Bus.emit(Bus.DATA_CHANGED)
    }

    /** Copy a SAF-picked file into app storage and attach it (uploads in server mode). */
    fun attachFile(contractId: String, uri: android.net.Uri): Attachment {
        val cr = context.contentResolver
        var filename = "attachment"
        var size = 0L
        cr.query(uri, null, null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                val ni = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                val si = c.getColumnIndex(android.provider.OpenableColumns.SIZE)
                if (ni >= 0) filename = c.getString(ni) ?: filename
                if (si >= 0 && !c.isNull(si)) size = c.getLong(si)
            }
        }
        val mime = cr.getType(uri) ?: "application/octet-stream"
        val dir = java.io.File(context.filesDir, "attachments/$contractId").apply { mkdirs() }
        val safe = filename.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val file = java.io.File(dir, "${Crypto.nid("f")}_$safe")
        cr.openInputStream(uri)?.use { input -> file.outputStream().use { input.copyTo(it) } }
            ?: throw DomainException("Could not read the selected file")
        if (file.length() > 10 * 1024 * 1024) { file.delete(); throw DomainException("File too large (10 MB max)") }
        val att = engine.addAttachment(orgId(), contractId, userId, filename, mime, file.length(), file.absolutePath)
        if (isServer) Async.run({
            try {
                val b64 = Crypto.b64(file.readBytes())
                api.uploadAttachment(orgId(), contractId, filename, mime, b64)
            } catch (_: Exception) { /* stays local; export/share still works */ }
        }, {})
        Bus.emit(Bus.DATA_CHANGED)
        return att
    }

    fun openAttachment(att: Attachment) {
        val path = att.localPath ?: return
        val file = java.io.File(path)
        if (!file.exists()) { DialogsToast("File no longer available"); return }
        // Copy into exports so the provider can share it
        val dir = java.io.File(context.filesDir, "exports").apply { mkdirs() }
        val target = java.io.File(dir, file.name)
        file.copyTo(target, overwrite = true)
        val uri = android.net.Uri.parse("content://com.taskcontract.android.exports/${target.name}")
        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
            setDataAndType(uri, att.contentType)
            addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try { context.startActivity(intent) } catch (e: Exception) { DialogsToast("No app can open ${att.filename}") }
    }

    private fun DialogsToast(msg: String) { android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show() }

    fun notifications(unreadOnly: Boolean = false): List<Notification> = engine.notifications(userId, unreadOnly)
    fun unreadCount(): Int = engine.unreadCount(userId)

    fun markRead(id: String) {
        engine.markNotificationRead(userId, id)
        if (isServer) Async.run({ try { api.markRead(id) } catch (e: OfflineException) { enqueue("markRead", jobj("id" to id)) } }, {})
        Bus.emit(Bus.NOTIFICATIONS_CHANGED)
    }

    fun markAllRead() {
        engine.markAllRead(userId)
        if (isServer) Async.run({ try { api.markAllRead() } catch (e: OfflineException) { enqueue("markAllRead", jobj()) } }, {})
        Bus.emit(Bus.NOTIFICATIONS_CHANGED)
    }

    fun notificationPrefs(): Map<String, Boolean> {
        return engine.notificationPrefs(userId)
    }

    fun setNotificationPref(key: String, value: Boolean) {
        engine.setNotificationPref(userId, key, value)
        if (isServer) Async.run({ try { api.updatePreferences(jobj(key to value)) } catch (_: Exception) {} }, {})
    }

    /** Pull server notification prefs into the local mirror (server mode). */
    fun syncPreferences() {
        if (!isServer) return
        try {
            val prefs = api.preferences()
            for (k in listOf("contract_assigned", "status_changed", "deadline_reminder", "comments")) {
                if (prefs.containsKey(k)) engine.setNotificationPref(userId, k, Json.bool(prefs[k]))
            }
        } catch (_: Exception) {}
    }

    fun analytics(): LocalEngine.Analytics = engine.analytics(orgId(), userId, role())

    fun members(): List<Pair<Membership, User>> = engine.members(orgId())
    fun categories(): List<Category> = engine.categories(orgId())
    fun users(): List<User> = engine.usersInOrg(orgId())

    fun invite(email: String, role: Role): Invite {
        if (!isServer) return engine.inviteMember(orgId(), userId, role(), email, role).also { Bus.emit(Bus.DATA_CHANGED) }
        return try {
            val r = api.inviteMember(orgId(), email, role.wire)
            val m = Json.obj(r["membership"])
            Invite(m.s("id") ?: Crypto.nid("inv"), orgId(), email, role, Json.str(r["token"]) ?: "", userId, Time.nowIso(), Time.toIso(System.currentTimeMillis() + 14L * 86400_000))
        } catch (e: OfflineException) {
            val inv = engine.inviteMember(orgId(), userId, role(), email, role)
            enqueue("invite", jobj("orgId" to orgId(), "email" to email, "role" to role.wire))
            inv
        }
    }

    fun updateMemberRole(memberId: String, role: Role) {
        engine.updateMemberRole(orgId(), role(), memberId, role)
        if (isServer) Async.run({ try { api.updateMember(orgId(), memberId, role.wire, null) } catch (_: Exception) {} }, {})
        Bus.emit(Bus.DATA_CHANGED)
    }

    fun removeMember(memberId: String) {
        engine.removeMember(orgId(), role(), memberId)
        if (isServer) Async.run({ try { api.removeMember(orgId(), memberId) } catch (_: Exception) {} }, {})
        Bus.emit(Bus.DATA_CHANGED)
    }

    fun createCategory(name: String, color: String, description: String?): Category {
        if (!isServer) return engine.createCategory(orgId(), role(), name, color, description).also { Bus.emit(Bus.DATA_CHANGED) }
        return try {
            val r = Json.obj(api.createCategory(orgId(), name, color, description)["category"])
            engine.createCategory(orgId(), role(), name, color, description)
        } catch (e: OfflineException) {
            val c = engine.createCategory(orgId(), role(), name, color, description)
            enqueue("category", jobj("orgId" to orgId(), "name" to name, "color" to color, "description" to description))
            c
        }
    }

    fun createOrganization(name: String): Organization {
        if (!isServer) return engine.createOrganization(userId, name).also { Bus.emit(Bus.SESSION_CHANGED) }
        val r = Json.obj(api.createOrganization(name)["organization"])
        upsertOrg(r, "owner", userId)
        Bus.emit(Bus.SESSION_CHANGED)
        return Organization(r.req("id"), r.req("name"), r.req("slug"), r.s("planType") ?: "free", Time.nowIso())
    }

    fun updateProfile(firstName: String?, lastName: String?, title: String?) {
        engine.updateProfile(userId, firstName, lastName, title)
        if (isServer) Async.run({
            val body = jobj("firstName" to firstName, "lastName" to lastName, "title" to title)
            try { api.updateProfile(body) } catch (e: OfflineException) { enqueue("profile", jobj("body" to body)) }
        }, {})
        Bus.emit(Bus.SESSION_CHANGED)
    }

    fun changePassword(current: String, next: String) {
        if (!isServer) return engine.changePassword(userId, current, next)
        val r = api.changePassword(current, next)
        Json.str(r["accessToken"])?.let { session.accessToken = it }
        Json.str(r["refreshToken"])?.let { session.refreshToken = it }
    }

    // ---- Password recovery (server) ----
    fun forgotPassword(email: String): Map<String, Any?> = api.forgotPassword(email)

    fun resetPassword(token: String, password: String): User {
        val data = api.resetPassword(token, password)
        captureServerSession(data)
        return user()!!
    }

    // ---- Two-factor management ----
    data class TwoFactorSetup(val secret: String, val otpauthUrl: String)

    fun setup2fa(): TwoFactorSetup {
        if (!isServer) {
            val secret = engine.setup2fa(userId)
            val email = user()?.email ?: ""
            return TwoFactorSetup(secret, Crypto.otpauthUrl(secret, email))
        }
        val r = api.setup2fa()
        return TwoFactorSetup(Json.str(r["secret"]) ?: "", Json.str(r["otpauthUrl"]) ?: "")
    }

    fun enable2fa(code: String): List<String> {
        if (!isServer) return engine.enable2fa(userId, code)
        val r = api.enable2fa(code)
        return r.strList("backupCodes")
    }

    fun disable2fa(password: String) {
        if (!isServer) return engine.disable2fa(userId, password)
        api.disable2fa(password)
    }

    // ---- Invites ----
    fun inviteInfo(token: String): Map<String, Any?> {
        if (!isServer) {
            val row = db.one("SELECT i.*, o.name AS org_name FROM invites i JOIN organizations o ON o.id = i.organization_id WHERE i.token = ?", token)
                ?: throw DomainException("Invite is invalid or expired", 404)
            if (row.str("accepted_at") != null || (Time.parseIso(row.str("expires_at")) ?: 0) < System.currentTimeMillis())
                throw DomainException("Invite is invalid or expired", 404)
            return jobj("email" to row.strOr("email"), "role" to row.strOr("role"), "organization" to jobj("id" to row.strOr("organization_id"), "name" to row.strOr("org_name")))
        }
        return api.inviteInfo(token)
    }

    fun acceptInvite(token: String): Organization {
        if (!isServer) {
            val org = engine.acceptInvite(token, userId)
            session.orgId = org.id
            Bus.emit(Bus.SESSION_CHANGED)
            return org
        }
        val u = user()
        val data = api.acceptInvite(token, u?.firstName, u?.lastName, null)
        // Response includes tokens when a fresh user was created; otherwise membership only.
        if (data["accessToken"] != null) {
            captureServerSession(data)
        } else {
            Async.run({ refreshAll() }, {})
        }
        val org = Json.obj(data["organization"])
        if (org.isNotEmpty()) {
            upsertOrg(org, Json.str(data["role"]) ?: "executor", userId)
            session.orgId = org.s("id")
        }
        Bus.emit(Bus.SESSION_CHANGED)
        return Organization(org.s("id") ?: "", org.s("name") ?: "Organization", org.s("slug") ?: "")
    }

    fun search(query: String): Pair<List<Contract>, List<User>> = engine.search(orgId(), userId, role(), query)

    fun audit(contractId: String): List<AuditLog> {
        if (isServer) {
            try {
                val logs = api.audit(orgId(), contractId)
                db.tx { d ->
                    for (a in logs) {
                        val id = a.s("id") ?: continue
                        if (d.one("SELECT id FROM audit_logs WHERE id = ?", id) == null) {
                            val au = Json.obj(a["user"]); if (au.isNotEmpty()) upsertUser(au)
                            d.insert("audit_logs", null, cv(
                                "id" to id, "organization_id" to orgId(), "contract_id" to contractId, "user_id" to au.s("id"),
                                "action" to (a.s("action") ?: ""), "entity_type" to (a.s("entityType") ?: "contract"), "entity_id" to (a.s("entityId") ?: contractId),
                                "previous_state" to a["previousState"]?.let { Json.write(it) }, "new_state" to a["newState"]?.let { Json.write(it) },
                                "created_at" to (a.s("createdAt") ?: Time.nowIso()), "checksum" to (a.s("checksum") ?: "")
                            ))
                        }
                    }
                }
            } catch (_: Exception) {}
        }
        return engine.auditFor(contractId)
    }

    fun exportJson(contractId: String): String = engine.exportContractJson(orgId(), contractId)
    fun exportCsv(contractId: String): String = engine.exportContractCsv(orgId(), contractId)

    /** Called on app start / connectivity regain. */
    fun syncIfNeeded() {
        if (!isServer) return
        Async.run({
            if (api.ping()) { replayOutbox(); refreshAll() } else Bus.emit(Bus.SYNC_STATE, "offline")
        }, {})
    }
}
