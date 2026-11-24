import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';

export function database(t) {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  const migrations = new URL('../../drizzle/', import.meta.url);
  for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL(file, migrations), 'utf8'));
  t.after(() => sql.close());
  const db = { sql, prepare(query) {
    let args = [];
    const statement = sql.prepare(query);
    return {
      isWrite: /^(INSERT|UPDATE|DELETE)/.test(query),
      bind(...values) { args = values; return this; },
      async first() { return statement.get(...args) ?? null; },
      async all() { return { results: statement.all(...args) }; },
      async run() { return { meta: statement.run(...args) }; },
    };
  }, async batch(statements) {
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await (statement.isWrite ? statement.run() : statement.all()));
      sql.exec('COMMIT');
      return results;
    } catch (error) { sql.exec('ROLLBACK'); throw error; }
  }};
  return db;
}
