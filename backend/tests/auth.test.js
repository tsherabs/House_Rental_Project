import { beforeAll, afterAll, test, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { setup, account, origin, testPassword } from './helpers.js';
let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx?.close(); });
const register = (body) => request(ctx.app).post('/api/v1/auth/register').set('Origin', origin).send(body);
const payload = { name: 'Pema', email: 'pema@example.test', password: testPassword, role: 'seeker' };

test.each(['seeker', 'landlord'])('registers %s with hashed password, normalized email and no automatic login', async (role) => {
  const agent = request.agent(ctx.app);
  const response = await agent.post('/api/v1/auth/register').set('Origin', origin).send({ ...payload, email: `  ${role.toUpperCase()}@EXAMPLE.TEST `, role });
  expect(response.status).toBe(201);
  expect(response.body.user).toMatchObject({ role, email: `${role}@example.test`, accountStatus: 'active' });
  expect(Object.keys(response.body.user).sort()).toEqual(['id', 'name', 'email', 'role', 'accountStatus', 'createdAt'].sort());
  const { rows: [row] } = await ctx.pool.query('SELECT * FROM users WHERE id=$1', [response.body.user.id]);
  expect(await bcrypt.compare(testPassword, row.password_hash)).toBe(true);
  expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  expect((await register({ ...payload, email: `${role}@EXAMPLE.TEST`, role })).status).toBe(409);
});
test.each([{ role: 'admin' }, { accountStatus: 'suspended' }, { id: 'injected' }, { password: 'short' }, { password: 'ཀ'.repeat(25) }, { email: 'not-email' }, { name: ' ' }])('rejects invalid or privileged signup fields %j', async (change) => {
  expect((await register({ ...payload, ...change })).status).toBe(400);
});
test('accepts exactly 72 UTF-8 bytes and rejects longer bcrypt inputs', async () => {
  expect((await register({ ...payload, email: 'bytes@example.test', password: 'ཀ'.repeat(24) })).status).toBe(201);
});
test('login failures are generic; login rotates session, logout invalidates it', async () => {
  const { agent, email, cookie } = await account(ctx);
  const wrong = await agent.post('/api/v1/auth/login').set('Origin', origin).send({ email, password: 'wrong password' });
  const absent = await agent.post('/api/v1/auth/login').set('Origin', origin).send({ email: 'missing@example.test', password: 'wrong password' });
  expect(wrong.status).toBe(401);
  expect(absent.body).toEqual(wrong.body);
  const login = await agent.post('/api/v1/auth/login').set('Origin', origin).send({ email, password: testPassword });
  const newCookie = login.headers['set-cookie'][0];
  expect(newCookie).toContain('HttpOnly');
  expect(newCookie).toContain('SameSite=Lax');
  expect(newCookie.split(';')[0]).not.toBe(cookie);
  expect((await request(ctx.app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
  expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
  expect((await agent.post('/api/v1/auth/logout').set('Origin', origin).send({})).status).toBe(204);
  expect((await request(ctx.app).get('/api/v1/auth/me').set('Cookie', newCookie.split(';')[0])).status).toBe(401);
});
test('rejects missing/foreign Origin and accepts same-origin Referer fallback', async () => {
  expect((await request(ctx.app).post('/api/v1/auth/login').send({})).status).toBe(403);
  expect((await request(ctx.app).post('/api/v1/auth/login').set('Origin', 'https://evil.test').set('Referer', `${origin}/login`).send({})).status).toBe(403);
  expect((await request(ctx.app).post('/api/v1/auth/login').set('Referer', `${origin}/login`).send({})).status).toBe(400);
});
test('malformed JSON and oversized bodies return safe errors', async () => {
  const bad = await request(ctx.app).post('/api/v1/auth/login').set('Origin', origin).set('Content-Type', 'application/json').send('{broken');
  expect(bad.status).toBe(400);
  expect(JSON.stringify(bad.body)).not.toContain('SyntaxError');
  expect((await register({ ...payload, name: 'a'.repeat(70000) })).status).toBe(413);
});
test('authentication attempts are rate limited', async () => {
  const limited = await setup({ authRateLimit: 2 });
  try {
    for (let i = 0; i < 2; i++) await request(limited.app).post('/api/v1/auth/login').set('Origin', origin).send({});
    const response = await request(limited.app).post('/api/v1/auth/login').set('Origin', origin).send({});
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  } finally { await limited.close(); }
});
test('production cookies require trusted HTTPS and CSRF protects authenticated mutations', async () => {
  const production = await setup({ production: true, appOrigin: 'https://homefinder.example', trustProxy: ['loopback'] });
  try {
    const headers = { Origin: 'https://homefinder.example', 'X-Forwarded-Proto': 'https' };
    await request(production.app).post('/api/v1/auth/register').set(headers).send({ ...payload, email: 'secure@example.test' });
    const login = await request(production.app).post('/api/v1/auth/login').set(headers).send({ email: 'secure@example.test', password: testPassword });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'][0];
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    const rejected = await request(production.app).post('/api/v1/auth/logout').set('Cookie', cookie.split(';')[0]).set('Origin', 'https://evil.example').send({});
    expect(rejected.status).toBe(403);
    expect((await request(production.app).get('/api/v1/auth/me').set('Cookie', cookie.split(';')[0])).status).toBe(200);
  } finally { await production.close(); }
});
