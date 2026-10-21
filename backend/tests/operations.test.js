import { expect, it } from 'vitest';
import request from 'supertest';
import { setup, account, origin } from './helpers.js';
import { createApp } from '../src/app.js';
it('shares atomic auth limits across API instances and returns a retry delay', async () => {
  const ctx = await setup({ authRateLimit: 2 });
  const replica = createApp({ pool: ctx.pool, config: ctx.config, logger: { error() {} } });
  try {
    const attempts = await Promise.all([ctx.app, replica, ctx.app, replica].map((app) => request(app).post('/api/v1/auth/login').set('Origin', origin).send({})));
    expect(attempts.map((r) => r.status).sort()).toEqual([400, 400, 429, 429]);
    expect(Number(attempts.find((r) => r.status === 429).headers['retry-after'])).toBeGreaterThan(0);
    const { rows } = await ctx.pool.query('SELECT bucket_key,hits FROM request_limits');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ hits: 4 });
    expect(rows[0].bucket_key).toMatch(/^auth:[a-f0-9]{64}$/);
  } finally { replica.locals.sessionStore.close(); await ctx.close(); }
});
it('limits viewing/report submissions per account without blocking another account', async () => {
  const ctx = await setup({ viewingRateLimit: 1, reportRateLimit: 1 });
  try {
    const one = await account(ctx), two = await account(ctx);
    for (const path of ['viewings', 'reports']) {
      expect((await one.agent.post(`/api/v1/${path}`).set('Origin', origin).send({})).status).toBe(400);
      expect((await one.agent.post(`/api/v1/${path}`).set('Origin', origin).send({})).status).toBe(429);
      expect((await two.agent.post(`/api/v1/${path}`).set('Origin', origin).send({})).status).toBe(400);
    }
  } finally { await ctx.close(); }
});
it('checks migration readiness and emits correlation logs without request bodies or query strings', async () => {
  const ctx = await setup();
  const events = [];
  const app = createApp({ pool: ctx.pool, config: ctx.config, logger: { info: (entry) => events.push(entry), error() {} } });
  try {
    const ready = await request(app).get('/api/v1/ready?secret=private-value');
    expect(ready.status).toBe(200);
    expect(ready.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(events[0]).toMatchObject({ requestId: ready.headers['x-request-id'], method: 'GET', status: 200 });
    expect(JSON.stringify(events)).not.toContain('private-value');
    await ctx.pool.query("DELETE FROM schema_migrations WHERE name='0007_notifications_limits.sql'");
    expect((await request(app).get('/api/v1/ready')).status).toBe(503);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
  } finally { app.locals.sessionStore.close(); await ctx.close(); }
});
