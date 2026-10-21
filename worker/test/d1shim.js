// محاكي بسيط لـ Cloudflare D1 فوق node:sqlite، للاختبار المحلي فقط.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function makeDB() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
    async run() { db.prepare(sql).run(...args); return { success: true }; },
    _exec() { db.prepare(sql).run(...args); },
  });
  return {
    prepare: (sql) => stmt(sql),
    async batch(list) {
      db.exec("BEGIN");
      try { list.forEach((s) => s._exec()); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
      return list.map(() => ({ success: true }));
    },
    raw: db,
  };
}
