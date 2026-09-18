/**
 * Node adapters that implement the Cloudflare D1 / KV / R2 binding surfaces
 * closely enough for the Worker app to run locally without wrangler.
 */

export class SqliteD1 {
  constructor(db) {
    this.db = db;
  }

  prepare(sql) {
    return new SqliteStatement(this.db, sql);
  }

  async exec(sql) {
    this.db.exec(sql);
    return { count: 0, duration: 0 };
  }

  async batch(statements) {
    this.db.exec("BEGIN");
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}

class SqliteStatement {
  constructor(db, sql, values = []) {
    this.db = db;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new SqliteStatement(this.db, this.sql, values);
  }

  _stmt() {
    return this.db.prepare(this.sql);
  }

  async first() {
    const row = this._stmt().get(...this.values);
    return row ?? null;
  }

  async all() {
    const results = this._stmt().all(...this.values);
    return { results, success: true };
  }

  async run() {
    const info = this._stmt().run(...this.values);
    return {
      success: true,
      meta: {
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid || 0),
      },
    };
  }
}

export class MemoryKV {
  constructor() {
    this.map = new Map();
  }

  _alive(entry) {
    if (!entry) return false;
    if (entry.exp && Date.now() > entry.exp) {
      return false;
    }
    return true;
  }

  async get(key, type) {
    const entry = this.map.get(key);
    if (!this._alive(entry)) {
      this.map.delete(key);
      return null;
    }
    if (type === "json") {
      try {
        return JSON.parse(entry.value);
      } catch {
        return null;
      }
    }
    return entry.value;
  }

  async put(key, value, opts = {}) {
    const exp = opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null;
    this.map.set(key, { value: typeof value === "string" ? value : JSON.stringify(value), exp });
  }

  async delete(key) {
    this.map.delete(key);
  }

  async list({ prefix = "", limit = 1000 } = {}) {
    const keys = [];
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) keys.push({ name: k });
      if (keys.length >= limit) break;
    }
    return { keys };
  }
}

export class MemoryR2 {
  constructor() {
    this.map = new Map();
  }

  async put(key, value, options = {}) {
    let body;
    if (value instanceof ArrayBuffer) body = value;
    else if (ArrayBuffer.isView(value)) body = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    else if (typeof value === "string") body = new TextEncoder().encode(value).buffer;
    else if (value && typeof value.arrayBuffer === "function") body = await value.arrayBuffer();
    else body = new Uint8Array(value || []).buffer;
    this.map.set(key, {
      body,
      httpMetadata: options.httpMetadata || {},
      customMetadata: options.customMetadata || {},
      uploaded: new Date(),
      size: body.byteLength,
    });
    return { key, size: body.byteLength };
  }

  async get(key) {
    const o = this.map.get(key);
    if (!o) return null;
    return {
      key,
      size: o.size,
      httpMetadata: o.httpMetadata,
      customMetadata: o.customMetadata,
      uploaded: o.uploaded,
      arrayBuffer: async () => o.body,
      text: async () => new TextDecoder().decode(o.body),
      body: o.body,
    };
  }

  async delete(key) {
    this.map.delete(key);
  }
}
