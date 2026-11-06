package com.taskcontract.android.core

/**
 * Minimal, dependency-free JSON parser/serializer.
 * Pure Kotlin so the exact same code runs on Android and in JVM unit tests.
 * Values map to: Map<String, Any?>, List<Any?>, String, Long, Double, Boolean, null.
 */
object Json {

    fun parse(text: String): Any? {
        val p = Parser(text)
        val v = p.parseValue()
        p.skipWs()
        if (!p.atEnd()) throw IllegalArgumentException("Trailing JSON content at ${p.pos}")
        return v
    }

    @Suppress("UNCHECKED_CAST")
    fun obj(v: Any?): Map<String, Any?> = v as? Map<String, Any?> ?: emptyMap()

    @Suppress("UNCHECKED_CAST")
    fun arr(v: Any?): List<Any?> = v as? List<Any?> ?: emptyList()

    fun str(v: Any?): String? = when (v) {
        null -> null
        is String -> v
        is Long -> v.toString()
        is Double -> if (v == Math.floor(v) && !v.isInfinite()) v.toLong().toString() else v.toString()
        is Boolean -> v.toString()
        else -> v.toString()
    }

    fun long(v: Any?): Long? = when (v) {
        is Long -> v
        is Int -> v.toLong()
        is Double -> v.toLong()
        is String -> v.toLongOrNull()
        else -> null
    }

    fun int(v: Any?): Int? = long(v)?.toInt()

    fun double(v: Any?): Double? = when (v) {
        is Double -> v
        is Long -> v.toDouble()
        is String -> v.toDoubleOrNull()
        else -> null
    }

    fun bool(v: Any?): Boolean = when (v) {
        is Boolean -> v
        is Long -> v != 0L
        is String -> v == "true" || v == "1"
        else -> false
    }

    fun write(v: Any?): String = StringBuilder().also { writeValue(it, v) }.toString()

    private fun writeValue(sb: StringBuilder, v: Any?) {
        when (v) {
            null -> sb.append("null")
            is String -> writeString(sb, v)
            is Boolean -> sb.append(if (v) "true" else "false")
            is Int, is Long -> sb.append(v.toString())
            is Float -> writeValue(sb, v.toDouble())
            is Double -> {
                if (v.isNaN() || v.isInfinite()) sb.append("null")
                else if (v == Math.floor(v) && Math.abs(v) < 9.007199254740992E15) sb.append(v.toLong().toString())
                else sb.append(v.toString())
            }
            is Map<*, *> -> {
                sb.append('{')
                var first = true
                for ((k, value) in v) {
                    if (!first) sb.append(',')
                    first = false
                    writeString(sb, k.toString())
                    sb.append(':')
                    writeValue(sb, value)
                }
                sb.append('}')
            }
            is List<*> -> {
                sb.append('[')
                v.forEachIndexed { i, item ->
                    if (i > 0) sb.append(',')
                    writeValue(sb, item)
                }
                sb.append(']')
            }
            is Array<*> -> writeValue(sb, v.toList())
            else -> writeString(sb, v.toString())
        }
    }

    private fun writeString(sb: StringBuilder, s: String) {
        sb.append('"')
        for (c in s) {
            when (c) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                '\b' -> sb.append("\\b")
                '\u000C' -> sb.append("\\f")
                else -> if (c < ' ') sb.append("\\u").append(String.format("%04x", c.code)) else sb.append(c)
            }
        }
        sb.append('"')
    }

    private class Parser(val text: String) {
        var pos = 0
        fun atEnd() = pos >= text.length
        fun peek(): Char = text[pos]
        fun skipWs() { while (pos < text.length && text[pos].isWhitespace()) pos++ }
        fun expect(c: Char) {
            skipWs()
            if (atEnd() || text[pos] != c) throw IllegalArgumentException("Expected '$c' at $pos")
            pos++
        }

        fun parseValue(): Any? {
            skipWs()
            if (atEnd()) throw IllegalArgumentException("Unexpected end of JSON")
            return when (peek()) {
                '{' -> parseObject()
                '[' -> parseArray()
                '"' -> parseString()
                't' -> literal("true", true)
                'f' -> literal("false", false)
                'n' -> literal("null", null)
                else -> parseNumber()
            }
        }

        private fun literal(lit: String, value: Any?): Any? {
            if (!text.startsWith(lit, pos)) throw IllegalArgumentException("Invalid literal at $pos")
            pos += lit.length
            return value
        }

        private fun parseObject(): Map<String, Any?> {
            expect('{')
            val map = LinkedHashMap<String, Any?>()
            skipWs()
            if (!atEnd() && peek() == '}') { pos++; return map }
            while (true) {
                skipWs()
                val key = parseString()
                expect(':')
                map[key] = parseValue()
                skipWs()
                if (atEnd()) throw IllegalArgumentException("Unterminated object")
                when (peek()) {
                    ',' -> pos++
                    '}' -> { pos++; return map }
                    else -> throw IllegalArgumentException("Expected ',' or '}' at $pos")
                }
            }
        }

        private fun parseArray(): List<Any?> {
            expect('[')
            val list = ArrayList<Any?>()
            skipWs()
            if (!atEnd() && peek() == ']') { pos++; return list }
            while (true) {
                list.add(parseValue())
                skipWs()
                if (atEnd()) throw IllegalArgumentException("Unterminated array")
                when (peek()) {
                    ',' -> pos++
                    ']' -> { pos++; return list }
                    else -> throw IllegalArgumentException("Expected ',' or ']' at $pos")
                }
            }
        }

        private fun parseString(): String {
            expect('"')
            val sb = StringBuilder()
            while (true) {
                if (atEnd()) throw IllegalArgumentException("Unterminated string")
                val c = text[pos++]
                when {
                    c == '"' -> return sb.toString()
                    c == '\\' -> {
                        if (atEnd()) throw IllegalArgumentException("Unterminated escape")
                        when (val e = text[pos++]) {
                            '"' -> sb.append('"')
                            '\\' -> sb.append('\\')
                            '/' -> sb.append('/')
                            'n' -> sb.append('\n')
                            'r' -> sb.append('\r')
                            't' -> sb.append('\t')
                            'b' -> sb.append('\b')
                            'f' -> sb.append('\u000C')
                            'u' -> {
                                if (pos + 4 > text.length) throw IllegalArgumentException("Invalid unicode escape")
                                sb.append(text.substring(pos, pos + 4).toInt(16).toChar())
                                pos += 4
                            }
                            else -> throw IllegalArgumentException("Invalid escape '\\$e'")
                        }
                    }
                    else -> sb.append(c)
                }
            }
        }

        private fun parseNumber(): Any {
            val start = pos
            if (!atEnd() && peek() == '-') pos++
            while (!atEnd() && peek().isDigit()) pos++
            var isDouble = false
            if (!atEnd() && peek() == '.') { isDouble = true; pos++; while (!atEnd() && peek().isDigit()) pos++ }
            if (!atEnd() && (peek() == 'e' || peek() == 'E')) {
                isDouble = true; pos++
                if (!atEnd() && (peek() == '+' || peek() == '-')) pos++
                while (!atEnd() && peek().isDigit()) pos++
            }
            val raw = text.substring(start, pos)
            if (raw.isEmpty() || raw == "-") throw IllegalArgumentException("Invalid number at $start")
            return if (isDouble) raw.toDouble() else raw.toLongOrNull() ?: raw.toDouble()
        }
    }
}

/** Convenience builders mirroring JS object literals. */
fun jobj(vararg pairs: Pair<String, Any?>): LinkedHashMap<String, Any?> = LinkedHashMap<String, Any?>().apply { for ((k, v) in pairs) put(k, v) }
fun jarr(vararg items: Any?): List<Any?> = items.toList()

fun Map<String, Any?>.s(key: String): String? = Json.str(this[key])
fun Map<String, Any?>.req(key: String): String = s(key) ?: ""
fun Map<String, Any?>.i(key: String): Int? = Json.int(this[key])
fun Map<String, Any?>.l(key: String): Long? = Json.long(this[key])
fun Map<String, Any?>.b(key: String): Boolean = Json.bool(this[key])
fun Map<String, Any?>.o(key: String): Map<String, Any?> = Json.obj(this[key])
fun Map<String, Any?>.a(key: String): List<Any?> = Json.arr(this[key])
fun Map<String, Any?>.strList(key: String): List<String> = a(key).mapNotNull { Json.str(it) }
