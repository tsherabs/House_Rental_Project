import bcrypt from 'bcrypt';
import { z } from 'zod';
import { createPool } from './pool.js';
import { password } from '../routes/auth.routes.js';
const input = z.object({ ADMIN_NAME: z.string().trim().min(1).max(120), ADMIN_EMAIL: z.string().trim().toLowerCase().max(254).email(), ADMIN_PASSWORD: password, DATABASE_URL: z.string().url(), BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12) }).parse(process.env);
const pool = createPool(input.DATABASE_URL);
try {
  const hash = await bcrypt.hash(input.ADMIN_PASSWORD, input.BCRYPT_COST);
  await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin')", [input.ADMIN_NAME, input.ADMIN_EMAIL, hash]);
  console.log('Administrator provisioned. Remove ADMIN_PASSWORD from the environment.');
} catch (error) {
  console.error(error.code === '23505'
    ? 'Account already exists; provisioning does not promote existing accounts'
    : 'Administrator provisioning failed; check database configuration');
  process.exitCode = 1;
} finally { await pool.end(); }
