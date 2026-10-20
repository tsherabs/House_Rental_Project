import { beforeAll, afterAll, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setup, account, origin, testPassword } from './helpers.js';
import { authentication } from '../src/middleware/auth.js';
import { roles } from '../src/middleware/roles.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx?.close(); });
test('suspension invalidates existing sessions and blocks login until reactivation', async () => {
  const { agent, user, email, cookie } = await account(ctx);
  await ctx.pool.query("UPDATE users SET account_status='suspended' WHERE id=$1", [user.id]);
  expect((await agent.get('/api/v1/auth/me')).status).toBe(403);
  expect((await request(ctx.app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
  expect((await agent.post('/api/v1/auth/login').set('Origin', origin).send({ email, password: testPassword })).status).toBe(403);
  await ctx.pool.query("UPDATE users SET account_status='active' WHERE id=$1", [user.id]);
  expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
});
test('role changes are loaded from the DB and never trusted from session data', async () => {
  const { agent, user } = await account(ctx);
  await ctx.pool.query("UPDATE users SET role='landlord' WHERE id=$1", [user.id]);
  expect((await agent.get('/api/v1/auth/me')).body.user.role).toBe('landlord');
});
test('shared auth/roles middleware rejects guests, seekers and suspended users', async () => {
  // Exercise exported middleware using real database identities; no mock DB.
  const fixture = express();
  let userId;
  fixture.use((req, _res, next) => { req.session = { userId, destroy: (cb) => cb() }; next(); });
  fixture.get('/landlord', authentication(ctx.pool, ctx.config), roles('landlord'), (_req, res) => res.sendStatus(204));
  fixture.use(errorHandler);
  expect((await request(fixture).get('/landlord')).status).toBe(401);
  const seeker = await account(ctx);
  userId = seeker.user.id;
  expect((await request(fixture).get('/landlord')).status).toBe(403);
  const landlord = await account(ctx, 'landlord');
  userId = landlord.user.id;
  expect((await request(fixture).get('/landlord')).status).toBe(204);
  await ctx.pool.query("UPDATE users SET account_status='suspended' WHERE id=$1", [userId]);
  expect((await request(fixture).get('/landlord')).status).toBe(403);
});
