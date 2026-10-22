import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createPool } from './pool.js';

const defaultDirectory = fileURLToPath(new URL('../../../database/migrations/', import.meta.url));
const hash = (text) => createHash('sha256').update(text).digest('hex');
export async function migrate(pool, directory = defaultDirectory) {
  const client = await pool.connect();
  const applied = [];
  try {
    await client.query('SELECT pg_advisory_lock(412003)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(directory)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    if (new Set(files.map((f) => f.slice(0, 4))).size !== files.length) throw new Error('Duplicate migration version');
    const { rows } = await client.query('SELECT name, checksum FROM schema_migrations ORDER BY name');
    for (const row of rows) {
      if (!files.includes(row.name)) throw new Error(`Applied migration missing: ${row.name}`);
    }
    // Verify every existing checksum before applying anything new.
    const scripts = await Promise.all(files.map(async (name) => {
      const sql = await readFile(path.join(directory, name), 'utf8');
      const normalized = sql.replaceAll('\r\n', '\n');
      const checksum = hash(normalized);
      const existing = rows.find((r) => r.name === name);
      // Older databases hashed checkout bytes. Accept those LF/CRLF variants without
      // changing recorded checksums; every other content change still fails closed.
      const compatible = [checksum, hash(normalized.replaceAll('\n', '\r\n')), hash(sql)];
      if (existing && !compatible.includes(existing.checksum)) throw new Error(`Applied migration changed: ${name}`);
      if (!existing && rows.some((r) => r.name > name)) throw new Error(`Out-of-order migration: ${name}`);
      return { name, sql, checksum, existing };
    }));
    for (const { name, sql, checksum, existing } of scripts) {
      if (existing) continue;
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name, checksum) VALUES ($1,$2)', [name, checksum]);
        await client.query('COMMIT');
        applied.push(name);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock(412003)');
    client.release();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = createPool(process.env.DATABASE_URL);
  try { console.log({ applied: await migrate(pool) }); }
  finally { await pool.end(); }
}
