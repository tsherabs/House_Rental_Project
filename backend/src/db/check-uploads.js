import { readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { createPool } from './pool.js';
if (!process.env.DATABASE_URL || !process.env.UPLOAD_DIR) throw new Error('DATABASE_URL and UPLOAD_DIR are required');
const pool = createPool(process.env.DATABASE_URL);
try {
  const directory = path.resolve(process.env.UPLOAD_DIR);
  const { rows } = await pool.query('SELECT id,storage_key FROM property_images');
  const keys = new Set(rows.map((r) => r.storage_key));
  const files = await readdir(directory).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
  const missingImageIds = [];
  for (const row of rows) {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(row.storage_key)) { missingImageIds.push(row.id); continue; }
    try { await access(path.join(directory, row.storage_key)); }
    catch (error) { if (error.code === 'ENOENT') missingImageIds.push(row.id); else throw error; }
  }
  console.log(JSON.stringify({ missingImageIds, orphanKeys: files.filter((f) => !keys.has(f)) }, null, 2));
  // Read-only report. Reconcile from backup or remove rows/files only after review.
} finally { await pool.end(); }
