import { test, expect } from 'vitest';
import { mkdtemp, cp, appendFile, rm, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { setup } from './helpers.js';
import { migrate } from '../src/db/migrate.js';
test('empty DB migrates once, reruns safely, rejects changed files, rolls back failed migration', async () => {
  const ctx = await setup();
  const directory = await mkdtemp(path.join(os.tmpdir(), 'homefinder-migrations-'));
  try {
    expect(await migrate(ctx.pool)).toEqual([]);
    const { rows } = await ctx.pool.query('SELECT name FROM schema_migrations');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await cp(new URL('../../database/migrations', import.meta.url), directory, { recursive: true });
    await writeFile(path.join(directory, '9999_failure.sql'), 'CREATE TABLE should_rollback(id INT); SELECT nonexistent_column;');
    await expect(migrate(ctx.pool, directory)).rejects.toThrow();
    expect((await ctx.pool.query("SELECT to_regclass('should_rollback') AS name")).rows[0].name).toBeNull();
    await appendFile(path.join(directory, '0001_auth.sql'), '\n-- changed\n');
    await expect(migrate(ctx.pool, directory)).rejects.toThrow('Applied migration changed');
  } finally { await ctx.close(); await rm(directory, { recursive: true, force: true }); }
});

test('accepts only line-ending differences in legacy checksums without rewriting history', async () => {
  const ctx = await setup();
  const directory = await mkdtemp(path.join(os.tmpdir(), 'homefinder-line-endings-'));
  try {
    await cp(new URL('../../database/migrations', import.meta.url), directory, { recursive: true });
    const file = path.join(directory, '0001_auth.sql');
    const lf = (await readFile(file, 'utf8')).replaceAll('\r\n', '\n');
    const crlf = lf.replaceAll('\n', '\r\n');
    const legacy = createHash('sha256').update(crlf).digest('hex');
    await ctx.pool.query("UPDATE schema_migrations SET checksum=$1 WHERE name='0001_auth.sql'", [legacy]);
    await writeFile(file, lf);
    expect(await migrate(ctx.pool, directory)).toEqual([]);
    expect((await ctx.pool.query("SELECT checksum FROM schema_migrations WHERE name='0001_auth.sql'")).rows[0].checksum).toBe(legacy);
    await writeFile(file, crlf);
    expect(await migrate(ctx.pool, directory)).toEqual([]);
    await appendFile(file, '\r\nALTER TABLE users ADD COLUMN tampered text;');
    await expect(migrate(ctx.pool, directory)).rejects.toThrow('Applied migration changed');
    expect((await ctx.pool.query("SELECT count(*)::int AS total FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users' AND column_name='tampered'")).rows[0].total).toBe(0);
  } finally { await ctx.close(); await rm(directory, { recursive: true, force: true }); }
});
