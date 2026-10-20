import { test, expect } from 'vitest';
import { mkdtemp, cp, appendFile, rm, writeFile } from 'node:fs/promises';
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
