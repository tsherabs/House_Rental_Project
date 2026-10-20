import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
export const testPassword = 'secure-testing-password';
export const origin = 'http://localhost:4200';
export async function setup(overrides = {}) {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must explicitly name a dedicated database ending in _test');
  if (connectionString === process.env.DATABASE_URL) throw new Error('Test and development database URLs must differ');
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const control = createPool(connectionString);
  await control.query(`CREATE SCHEMA "${schema}"`); // only a generated identifier
  const pool = createPool(connectionString, { options: `-c search_path=${schema}` });
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'homefinder-images-'));
  const config = { production: false, port: 3000, sessionSecret: 'test-only-secret-at-least-32-characters', cookieName: 'homefinder.sid', sessionTtlMs: 3600000, sessionPruneSeconds: false, bcryptCost: 4, appOrigin: origin, trustProxy: false, authRateLimit: 1000, uploadDir, maxUploadBytes: 5 * 1024 * 1024, maxPropertyImages: 8, ...overrides };
  await migrate(pool);
  const app = createApp({ pool, config, logger: { error() {} } });
  return { pool, app, config, async close() {
    app.locals.sessionStore.close();
    await pool.end();
    await control.query(`DROP SCHEMA "${schema}" CASCADE`);
    await control.end();
    await rm(uploadDir, { recursive: true, force: true });
  } };
}
export async function account(ctx, role = 'seeker') {
  const email = `${randomUUID()}@example.test`;
  const agent = request.agent(ctx.app);
  const registration = await agent.post('/api/v1/auth/register').set('Origin', origin).send({ name: 'Test account', email, password: testPassword, role });
  if (registration.status !== 201) throw new Error(JSON.stringify(registration.body));
  const login = await agent.post('/api/v1/auth/login').set('Origin', origin).send({ email, password: testPassword });
  if (login.status !== 200) throw new Error(JSON.stringify(login.body));
  return { agent, user: login.body.user, email, cookie: login.headers['set-cookie'][0].split(';')[0] };
}
