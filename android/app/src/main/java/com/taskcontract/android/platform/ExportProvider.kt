package com.taskcontract.android.platform

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/**
 * Shares contract exports (JSON/CSV) and attachments with other apps via
 * content:// URIs with temporary read grants — no storage permission needed.
 */
class ExportProvider : ContentProvider() {
    override fun onCreate(): Boolean = true

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        val file = File(context!!.filesDir, "exports/${uri.lastPathSegment}")
        if (!file.exists()) throw FileNotFoundException(uri.toString())
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    }

    override fun query(uri: Uri, projection: Array<String>?, selection: String?, selectionArgs: Array<String>?, sortOrder: String?): Cursor {
        val file = File(context!!.filesDir, "exports/${uri.lastPathSegment}")
        val cols = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        val cursor = MatrixCursor(cols, 1)
        val row = cols.map { when (it) {
            OpenableColumns.DISPLAY_NAME -> file.name
            OpenableColumns.SIZE -> file.length()
            else -> null
        } }.toTypedArray()
        cursor.addRow(row)
        return cursor
    }

    override fun getType(uri: Uri): String {
        val name = uri.lastPathSegment ?: return "application/octet-stream"
        val ext = name.substringAfterLast('.', "").lowercase()
        return android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: when (ext) {
            "json" -> "application/json"
            "csv" -> "text/csv"
            else -> "application/octet-stream"
        }
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?): Int = 0

    companion object {
        fun writeAndShare(context: Context, filename: String, content: String, mime: String) {
            val dir = File(context.filesDir, "exports").apply { mkdirs() }
            val file = File(dir, filename)
            file.writeText(content)
            val uri = Uri.parse("content://com.taskcontract.android.exports/$filename")
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, filename)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Export contract").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
        }
    }
}
