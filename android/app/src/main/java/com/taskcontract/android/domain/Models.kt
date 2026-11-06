package com.taskcontract.android.domain

/** Status lifecycle: draft → sent → accepted → in_progress → submitted → approved/rejected → archived */
enum class Status(val wire: String, val label: String) {
    DRAFT("draft", "Draft"),
    SENT("sent", "Sent"),
    ACCEPTED("accepted", "Accepted"),
    IN_PROGRESS("in_progress", "In progress"),
    SUBMITTED("submitted", "Submitted"),
    APPROVED("approved", "Approved"),
    REJECTED("rejected", "Returned"),
    ARCHIVED("archived", "Archived");

    companion object {
        fun from(wire: String?): Status = entries.firstOrNull { it.wire == wire } ?: DRAFT
        val terminal = setOf(APPROVED, REJECTED, ARCHIVED)
    }
}

enum class Priority(val wire: String, val label: String) {
    LOW("low", "Low"), MEDIUM("medium", "Medium"), HIGH("high", "High"), CRITICAL("critical", "Critical");
    companion object { fun from(wire: String?): Priority = entries.firstOrNull { it.wire == wire } ?: MEDIUM }
}

enum class Role(val wire: String, val label: String, val level: Int) {
    OWNER("owner", "Owner", 5),
    ADMIN("admin", "Admin", 4),
    MANAGER("manager", "Manager", 3),
    EXECUTOR("executor", "Executor", 2),
    OBSERVER("observer", "Observer", 1),
    AUDITOR("auditor", "Auditor", 1);
    companion object { fun from(wire: String?): Role = entries.firstOrNull { it.wire == wire } ?: EXECUTOR }
}

enum class IxType(val wire: String, val label: String) {
    PROGRESS("progress_update", "Progress"),
    CLARIFICATION_REQUEST("clarification_request", "Clarification"),
    CLARIFICATION_RESPONSE("clarification_response", "Response"),
    SCOPE_PROPOSAL("scope_proposal", "Scope"),
    SCOPE_ACK("scope_acknowledgment", "Scope acknowledged"),
    SCOPE_REJECT("scope_rejection", "Scope declined"),
    ISSUE("issue_report", "Issue"),
    ISSUE_RESOLUTION("issue_resolution", "Resolved"),
    SUBMISSION("submission", "Submission"),
    APPROVAL("approval", "Approved"),
    REJECTION("rejection", "Returned"),
    COMMENT("comment", "Comment"),
    SYSTEM("system_note", "System");
    companion object { fun from(wire: String?): IxType = entries.firstOrNull { it.wire == wire } ?: COMMENT }
}

enum class Action(val wire: String) {
    SEND("send"), ACCEPT("accept"), REJECT("reject"), START("start"),
    SUBMIT("submit"), APPROVE("approve"), ARCHIVE("archive"), REOPEN("reopen");
    companion object { fun from(wire: String): Action? = entries.firstOrNull { it.wire == wire } }
}

data class User(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val title: String? = null,
    val avatarUrl: String? = null,
    val passwordHash: String? = null,
    val twoFactorEnabled: Boolean = false,
    val twoFactorSecret: String? = null,
    val backupCodes: List<String> = emptyList(),
    val createdAt: String = "",
    val lastLoginAt: String? = null,
) {
    val name: String get() = "$firstName $lastName".trim()
    val initials: String get() = (firstName.take(1) + lastName.take(1)).uppercase().ifEmpty { "?" }
}

data class Organization(
    val id: String,
    val name: String,
    val slug: String,
    val planType: String = "free",
    val createdAt: String = "",
)

data class Membership(
    val id: String,
    val orgId: String,
    val userId: String,
    val role: Role,
    val status: String = "active",
    val joinedAt: String = "",
    val invitedBy: String? = null,
)

data class Category(val id: String, val orgId: String, val name: String, val color: String, val description: String? = null)

data class Participant(
    val id: String,
    val contractId: String,
    val userId: String,
    val role: String, // initiator | executor | observer
    val isLead: Boolean = false,
    val status: String = "pending",
    val acceptedAt: String? = null,
)

data class Version(
    val id: String,
    val contractId: String,
    val versionNumber: Int,
    val title: String,
    val description: String,
    val deadline: String?,
    val priority: Priority,
    val changeReason: String?,
    val changedBy: String,
    val changedAt: String,
    val acknowledgedAt: String? = null,
    val acknowledgedBy: String? = null,
)

data class Interaction(
    val id: String,
    val contractId: String,
    val authorId: String,
    val type: IxType,
    val content: String,
    val progress: Int? = null,
    val statusFrom: Status? = null,
    val statusTo: Status? = null,
    val createdAt: String = "",
)

data class Attachment(
    val id: String,
    val orgId: String,
    val contractId: String,
    val filename: String,
    val contentType: String,
    val size: Long,
    val localPath: String? = null,
    val remoteUrl: String? = null,
    val uploadedBy: String,
    val createdAt: String,
)

data class Contract(
    val id: String,
    val orgId: String,
    val contractNumber: String,
    val title: String,
    val description: String,
    val deadline: String? = null,
    val priority: Priority = Priority.MEDIUM,
    val status: Status = Status.DRAFT,
    val progress: Int = 0,
    val initiatorId: String = "",
    val executorId: String? = null,
    val categoryId: String? = null,
    val tags: List<String> = emptyList(),
    val currentVersion: Int = 1,
    val createdAt: String = "",
    val updatedAt: String = "",
    val sentAt: String? = null,
    val acceptedAt: String? = null,
    val submittedAt: String? = null,
    val approvedAt: String? = null,
    val completedAt: String? = null,
    val archivedAt: String? = null,
) {
    val isTerminal: Boolean get() = status in Status.terminal
    fun isOverdue(nowMs: Long): Boolean {
        val d = deadline ?: return false
        return !isTerminal && (Time.parseIso(d) ?: Long.MAX_VALUE) < nowMs
    }
}

data class Notification(
    val id: String,
    val userId: String,
    val orgId: String?,
    val type: String,
    val title: String,
    val content: String,
    val contractId: String? = null,
    val read: Boolean = false,
    val createdAt: String = "",
)

data class AuditLog(
    val id: String,
    val orgId: String?,
    val contractId: String?,
    val userId: String?,
    val action: String,
    val entityType: String,
    val entityId: String,
    val previousState: Map<String, Any?>? = null,
    val newState: Map<String, Any?>? = null,
    val createdAt: String,
    val checksum: String,
)

data class Invite(
    val id: String,
    val orgId: String,
    val email: String,
    val role: Role,
    val token: String,
    val invitedBy: String,
    val createdAt: String,
    val expiresAt: String,
    val acceptedAt: String? = null,
)

data class Session(
    val id: String,
    val userId: String,
    val refreshTokenHash: String,
    val createdAt: String,
    val expiresAt: String,
    val lastSeenAt: String,
    val revokedAt: String? = null,
    val device: String? = null,
)

/** Full contract aggregate for the detail screen. */
data class ContractFull(
    val contract: Contract,
    val participants: List<Participant>,
    val versions: List<Version>,
    val interactions: List<Interaction>,
    val attachments: List<Attachment> = emptyList(),
)

/** Time helpers — ISO-8601 UTC, dependency-free so tests are deterministic. */
object Time {
    fun nowIso(): String = toIso(System.currentTimeMillis())

    fun toIso(ms: Long): String {
        val cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"))
        cal.timeInMillis = ms
        return String.format(
            "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
            cal.get(java.util.Calendar.YEAR), cal.get(java.util.Calendar.MONTH) + 1, cal.get(java.util.Calendar.DAY_OF_MONTH),
            cal.get(java.util.Calendar.HOUR_OF_DAY), cal.get(java.util.Calendar.MINUTE), cal.get(java.util.Calendar.SECOND),
            cal.get(java.util.Calendar.MILLISECOND)
        )
    }

    fun parseIso(iso: String?): Long? {
        if (iso.isNullOrBlank()) return null
        return try {
            val s = iso.trim()
            // Accept YYYY-MM-DD and full ISO with Z or offset
            val dateOnly = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(s)
            if (dateOnly != null) {
                val (y, m, d) = dateOnly.destructured
                return utcCal(y.toInt(), m.toInt(), d.toInt(), 0, 0, 0, 0)
            }
            val m = Regex("^(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2})(?::(\\d{2}))?(?:\\.(\\d{1,3}))?(Z|[+-]\\d{2}:?\\d{2})?$").find(s)
                ?: return null
            val g = m.groupValues
            var ms = utcCal(g[1].toInt(), g[2].toInt(), g[3].toInt(), g[4].toInt(), g[5].toInt(), g[6].toIntOrNull() ?: 0,
                (g[7].padEnd(3, '0').toIntOrNull() ?: 0))
            val off = g[8]
            if (off.isNotEmpty() && off != "Z") {
                val sign = if (off[0] == '-') -1 else 1
                val oh = off.substring(1, 3).toInt()
                val om = off.removePrefix("+").removePrefix("-").replace(":", "").let { if (it.length >= 4) it.substring(2, 4).toInt() else 0 }
                ms -= sign * (oh * 3600_000L + om * 60_000L)
            }
            ms
        } catch (e: Exception) { null }
    }

    private fun utcCal(y: Int, mo: Int, d: Int, h: Int, mi: Int, s: Int, ms: Int): Long {
        val cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"))
        cal.clear()
        cal.set(y, mo - 1, d, h, mi, s)
        cal.set(java.util.Calendar.MILLISECOND, ms)
        return cal.timeInMillis
    }

    fun formatDeadline(iso: String?): String {
        val ms = parseIso(iso) ?: return "No deadline"
        val cal = java.util.Calendar.getInstance()
        cal.timeInMillis = ms
        val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
        return "${months[cal.get(java.util.Calendar.MONTH)]} ${cal.get(java.util.Calendar.DAY_OF_MONTH)}, ${cal.get(java.util.Calendar.YEAR)}"
    }

    fun formatDateTime(iso: String?): String {
        val ms = parseIso(iso) ?: return ""
        val cal = java.util.Calendar.getInstance()
        cal.timeInMillis = ms
        val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
        val h24 = cal.get(java.util.Calendar.HOUR_OF_DAY)
        val h = if (h24 % 12 == 0) 12 else h24 % 12
        val ampm = if (h24 < 12) "AM" else "PM"
        return "${months[cal.get(java.util.Calendar.MONTH)]} ${cal.get(java.util.Calendar.DAY_OF_MONTH)}, ${cal.get(java.util.Calendar.YEAR)} · $h:${"%02d".format(cal.get(java.util.Calendar.MINUTE))} $ampm"
    }

    fun relative(iso: String?, nowMs: Long = System.currentTimeMillis()): String {
        val ms = parseIso(iso) ?: return ""
        val diff = nowMs - ms
        val abs = Math.abs(diff)
        val future = diff < 0
        val (value, unit) = when {
            abs < 60_000 -> return if (future) "in a moment" else "just now"
            abs < 3_600_000 -> (abs / 60_000) to "m"
            abs < 86_400_000 -> (abs / 3_600_000) to "h"
            abs < 7 * 86_400_000 -> (abs / 86_400_000) to "d"
            abs < 30 * 86_400_000 -> (abs / (7 * 86_400_000)) to "w"
            abs < 365 * 86_400_000 -> (abs / (30 * 86_400_000)) to "mo"
            else -> (abs / (365 * 86_400_000)) to "y"
        }
        return if (future) "in $value$unit" else "$value$unit ago"
    }

    /** Human countdown for deadlines: "Due in 3d", "Overdue 2d", "Due today". */
    fun deadlineLabel(iso: String?, nowMs: Long = System.currentTimeMillis()): Pair<String, Boolean> {
        val ms = parseIso(iso) ?: return "No deadline" to false
        val diff = ms - nowMs
        val days = diff / 86_400_000
        return when {
            diff < 0 -> "Overdue ${Math.max(1, Math.abs(days))}d" to true
            diff < 86_400_000 -> "Due today" to true
            days < 7 -> "Due in ${days + 1}d" to (days < 2)
            else -> "Due ${formatDeadline(iso)}" to false
        }
    }
}
