package com.taskcontract.android.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * On-device SQLite store. Schema mirrors the backend (worker/schema.sql) so the
 * local engine and the remote API speak the same domain. Local-first: every
 * feature works fully offline; server sync reconciles when connected.
 */
class Db(context: Context) : SQLiteOpenHelper(context, "taskcontract.db", null, 3) {

    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(true)
    }

    override fun onCreate(db: SQLiteDatabase) {
        // execSQL runs ONE statement — split the schema on statement boundaries.
        for (stmt in SCHEMA.split(";")) {
            val s = stmt.trim()
            if (s.isNotEmpty()) db.execSQL(s)
        }
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // v1 → v2: outbox + sync state; v2 → v3: attachments local path. Additive migrations only.
        if (oldVersion < 2) {
            db.execSQL("CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER DEFAULT 0, last_error TEXT)")
            db.execSQL("CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT)")
        }
        if (oldVersion < 3) {
            db.execSQL("CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, contract_id TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT, size INTEGER DEFAULT 0, local_path TEXT, remote_url TEXT, uploaded_by TEXT NOT NULL, created_at TEXT NOT NULL)")
        }
    }

    fun q(sql: String, vararg args: Any?): List<ContentValues> = writableDatabase.q(sql, *args)
    fun one(sql: String, vararg args: Any?): ContentValues? = writableDatabase.one(sql, *args)

    fun <T> tx(block: (SQLiteDatabase) -> T): T {
        val db = writableDatabase
        db.beginTransaction()
        return try {
            val r = block(db)
            db.setTransactionSuccessful()
            r
        } finally {
            db.endTransaction()
        }
    }

    companion object {
        const val SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, avatar_url TEXT, title TEXT,
  two_factor_enabled INTEGER DEFAULT 0, two_factor_secret TEXT, backup_codes TEXT,
  last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  plan_type TEXT DEFAULT 'free', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
  role TEXT NOT NULL, status TEXT DEFAULT 'active', invited_by TEXT, joined_at TEXT NOT NULL,
  UNIQUE (organization_id, user_id)
);
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL, invited_by TEXT NOT NULL, created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL, accepted_at TEXT
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL,
  color TEXT DEFAULT '#4C58D6', description TEXT, created_at TEXT NOT NULL,
  UNIQUE (organization_id, name)
);
CREATE TABLE IF NOT EXISTS org_sequences (organization_id TEXT PRIMARY KEY, next_number INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, contract_number TEXT NOT NULL,
  title TEXT NOT NULL, current_description TEXT NOT NULL, current_deadline TEXT,
  current_priority TEXT DEFAULT 'medium', current_status TEXT DEFAULT 'draft',
  progress INTEGER DEFAULT 0, initiator_id TEXT NOT NULL, responsible_executor_id TEXT,
  category_id TEXT, tags TEXT, current_version INTEGER DEFAULT 1, is_deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, sent_at TEXT, accepted_at TEXT,
  submitted_at TEXT, approved_at TEXT, completed_at TEXT, archived_at TEXT,
  UNIQUE (organization_id, contract_number)
);
CREATE TABLE IF NOT EXISTS contract_versions (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, version_number INTEGER NOT NULL,
  title TEXT, description TEXT NOT NULL, deadline TEXT, priority TEXT, change_reason TEXT,
  changed_by TEXT NOT NULL, changed_at TEXT NOT NULL, acknowledged_at TEXT, acknowledged_by TEXT,
  UNIQUE (contract_id, version_number)
);
CREATE TABLE IF NOT EXISTS contract_participants (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, user_id TEXT NOT NULL,
  role TEXT NOT NULL, is_lead INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', accepted_at TEXT
);
CREATE TABLE IF NOT EXISTS contract_interactions (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, author_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL, content TEXT NOT NULL, progress_percentage INTEGER,
  structured_data TEXT, status_change_from TEXT, status_change_to TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT, type TEXT NOT NULL,
  title TEXT NOT NULL, content TEXT, contract_id TEXT, read INTEGER DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, organization_id TEXT, contract_id TEXT, user_id TEXT,
  action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  previous_state TEXT, new_state TEXT, created_at TEXT NOT NULL, checksum TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id TEXT PRIMARY KEY, contract_assigned INTEGER DEFAULT 1, status_changed INTEGER DEFAULT 1,
  deadline_reminder INTEGER DEFAULT 1, comments INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0, last_error TEXT
);
CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, contract_id TEXT NOT NULL,
  filename TEXT NOT NULL, content_type TEXT, size INTEGER DEFAULT 0, local_path TEXT,
  remote_url TEXT, uploaded_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contracts_org ON contracts(organization_id, current_status);
CREATE INDEX IF NOT EXISTS idx_versions_contract ON contract_versions(contract_id, version_number);
CREATE INDEX IF NOT EXISTS idx_ix_contract ON contract_interactions(contract_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_contract ON audit_logs(contract_id, created_at);
CREATE INDEX IF NOT EXISTS idx_members_org ON memberships(organization_id);
"""
    }
}

// ---- small Cursor helpers ----
fun SQLiteDatabase.q(sql: String, vararg args: Any?): List<ContentValues> {
    val out = ArrayList<ContentValues>()
    rawQuery(sql, args.map { it?.toString() ?: null }.toTypedArray()).use { c ->
        while (c.moveToNext()) {
            val cv = ContentValues()
            for (i in 0 until c.columnCount) {
                when (c.getType(i)) {
                    Cursor.FIELD_TYPE_NULL -> {}
                    Cursor.FIELD_TYPE_INTEGER -> cv.put(c.getColumnName(i), c.getLong(i))
                    Cursor.FIELD_TYPE_FLOAT -> cv.put(c.getColumnName(i), c.getDouble(i))
                    else -> cv.put(c.getColumnName(i), c.getString(i))
                }
            }
            out.add(cv)
        }
    }
    return out
}

fun SQLiteDatabase.one(sql: String, vararg args: Any?): ContentValues? = q(sql, *args).firstOrNull()

fun ContentValues.str(key: String): String? = getAsString(key)
fun ContentValues.strOr(key: String, def: String = ""): String = getAsString(key) ?: def
fun ContentValues.int(key: String): Int = getAsInteger(key) ?: 0
fun ContentValues.long(key: String): Long = getAsLong(key) ?: 0L
fun ContentValues.bool(key: String): Boolean = int(key) != 0
fun cv(vararg pairs: Pair<String, Any?>): ContentValues {
    val c = ContentValues()
    for ((k, v) in pairs) {
        when (v) {
            null -> c.putNull(k)
            is String -> c.put(k, v)
            is Int -> c.put(k, v)
            is Long -> c.put(k, v)
            is Boolean -> c.put(k, if (v) 1 else 0)
            is Double -> c.put(k, v)
            else -> c.put(k, v.toString())
        }
    }
    return c
}
