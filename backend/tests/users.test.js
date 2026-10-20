import { beforeAll, afterAll, test, expect } from 'vitest';
import request from 'supertest';
import { setup, account, origin, testPassword } from './helpers.js';
let ctx, admin, seeker, landlord;
beforeAll(async () => {
  ctx = await setup(); admin = await account(ctx); seeker = await account(ctx); landlord = await account(ctx, 'landlord');
  // Test-only provisioning, never a public API role change.
  await ctx.pool.query("UPDATE users SET role='admin' WHERE id=$1", [admin.user.id]);
});
afterAll(async () => { await ctx?.close(); });
const status = (id, accountStatus, actor = admin, extra = {}) => actor.agent.patch(`/api/v1/admin/users/${id}/status`).set('Origin', origin).send({ accountStatus, reason: 'Account status reviewed by administrator.', ...extra });
test('only admin can list users and mutate status; validates reason and no self-suspension', async () => {
  expect((await request(ctx.app).get('/api/v1/admin/users')).status).toBe(401);
  expect((await seeker.agent.get('/api/v1/admin/users')).status).toBe(403);
  expect((await status(landlord.user.id, 'suspended', seeker)).status).toBe(403);
  expect((await status(admin.user.id, 'suspended')).status).toBe(409);
  expect((await status(landlord.user.id, 'suspended', admin, { reason: 'short' })).status).toBe(400);
  expect((await status(landlord.user.id, 'suspended', admin, { role: 'admin' })).status).toBe(400);
  const users = await admin.agent.get('/api/v1/admin/users').query({ role: 'landlord', accountStatus: 'active', limit: 1 });
  expect(users.status).toBe(200);
  expect(users.body.pagination.total).toBe(1);
  expect(JSON.stringify(users.body)).not.toContain('password');
});
test('suspends existing sessions immediately and persists audit; reactivation requires login', async () => {
  const changed = await status(landlord.user.id, 'suspended');
  expect(changed.status).toBe(200);
  expect(changed.body.user.accountStatus).toBe('suspended');
  expect((await landlord.agent.get('/api/v1/my/properties')).status).toBe(403);
  expect((await landlord.agent.get('/api/v1/auth/me')).status).toBe(401);
  expect((await status(landlord.user.id, 'suspended')).status).toBe(409);
  expect((await status(landlord.user.id, 'active')).status).toBe(200);
  expect((await landlord.agent.get('/api/v1/auth/me')).status).toBe(401);
  const { rows } = await ctx.pool.query('SELECT * FROM account_status_history WHERE user_id=$1 ORDER BY changed_at', [landlord.user.id]);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ old_status: 'active', new_status: 'suspended', changed_by: admin.user.id });
  expect(rows[1]).toMatchObject({ old_status: 'suspended', new_status: 'active' });
});
test('audit failure rolls back status change', async () => {
  await ctx.pool.query("ALTER TABLE account_status_history ADD CONSTRAINT test_audit_failure CHECK (new_status <> 'suspended') NOT VALID");
  try { expect((await status(seeker.user.id, 'suspended')).status).toBe(500); }
  finally { await ctx.pool.query('ALTER TABLE account_status_history DROP CONSTRAINT test_audit_failure'); }
  expect((await ctx.pool.query('SELECT account_status FROM users WHERE id=$1', [seeker.user.id])).rows[0].account_status).toBe('active');
});
test('reactivation cannot revive unused sessions issued before suspension', async () => {
  const target = await account(ctx);
  expect((await status(target.user.id, 'suspended')).status).toBe(200);
  expect((await status(target.user.id, 'active')).status).toBe(200);
  expect((await target.agent.get('/api/v1/auth/me')).status).toBe(403);
  expect((await target.agent.get('/api/v1/auth/me')).status).toBe(401);
  expect((await target.agent.post('/api/v1/auth/login').set('Origin', origin).send({ email: target.email, password: testPassword })).status).toBe(200);
});
