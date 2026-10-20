import { beforeAll, afterAll, test, expect } from 'vitest';
import request from 'supertest';
import { setup, account, origin } from './helpers.js';
let ctx, a, b, seeker;
beforeAll(async () => { ctx = await setup(); a = await account(ctx, 'landlord'); b = await account(ctx, 'landlord'); seeker = await account(ctx); });
afterAll(async () => { await ctx?.close(); });
export const listing = { title: 'Sunny Thimphu apartment', description: 'Sunny two-bedroom apartment with parking and reliable water.', monthlyRent: '18000.00', deposit: '18000.00', bedrooms: 2, neighbourhood: 'Changzamtog', landmarks: null, waterAvailable: true, parkingAvailable: true, moveInDate: '2026-11-01' };
const create = (body = listing, actor = a) => actor.agent.post('/api/v1/properties').set('Origin', origin).send(body);
test('property mutations require active landlord identity and ownership', async () => {
  expect((await request(ctx.app).post('/api/v1/properties').set('Origin', origin).send(listing)).status).toBe(401);
  expect((await create(listing, seeker)).status).toBe(403);
  const response = await create();
  expect(response.status).toBe(201);
  const p = response.body.property;
  expect(p).toMatchObject({ ownerId: a.user.id, monthlyRent: '18000.00', moveInDate: '2026-11-01', images: [], availabilityStatus: 'available', visibilityStatus: 'published' });
  const url = `/api/v1/properties/${p.id}`;
  expect((await b.agent.patch(url).set('Origin', origin).send({ title: 'Stolen property' })).status).toBe(404);
  expect((await b.agent.delete(url).set('Origin', origin)).status).toBe(404);
  expect((await b.agent.get(`/api/v1/my/properties/${p.id}`)).status).toBe(404);
  expect((await a.agent.patch(url).set('Origin', origin).send({ title: 'Updated listing', moveInDate: '2020-01-01' })).status).toBe(200);
  expect((await request(ctx.app).get(url)).body.property.title).toBe('Updated listing');
  expect((await a.agent.patch(`${url}/availability`).set('Origin', origin).send({ availabilityStatus: 'rented' })).status).toBe(200);
  expect((await request(ctx.app).get(url)).status).toBe(404);
  expect((await a.agent.get(`/api/v1/my/properties/${p.id}`)).body.property.availabilityStatus).toBe('rented');
  expect((await a.agent.delete(url).set('Origin', origin)).status).toBe(204);
  expect((await a.agent.patch(`${url}/availability`).set('Origin', origin).send({ availabilityStatus: 'available' })).status).toBe(409);
  expect((await ctx.pool.query('SELECT visibility_status FROM properties WHERE id=$1', [p.id])).rows[0].visibility_status).toBe('archived');
});
test.each([{ ownerId: 'forged' }, { visibilityStatus: 'published' }, { expiresAt: '2030-01-01' }, { monthlyRent: 18000 }, { monthlyRent: '-1' }, { monthlyRent: '10000000000.00' }, { bedrooms: 1.5 }, { waterAvailable: 'true' }, { moveInDate: '2026-02-30' }])('rejects mass assignment and invalid property data %j', async (body) => {
  expect((await create({ ...listing, ...body })).status).toBe(400);
});
test('search combines filters, paginates totals, orders stably and treats SQL/wildcards as data', async () => {
  for (const rent of ['10000.00', '12000.00', '16000.00']) await create({ ...listing, neighbourhood: 'Search Test', monthlyRent: rent });
  await create({ ...listing, neighbourhood: 'Search Test', monthlyRent: '11000.00', waterAvailable: false });
  const q = { neighbourhood: 'search', minRent: '10000', maxRent: '15000', bedrooms: '2', waterAvailable: 'true', parkingAvailable: 'true', availableFrom: '2026-11-01', sort: 'rent_asc', limit: '1', page: '2' };
  const response = await request(ctx.app).get('/api/v1/properties').query(q);
  expect(response.status).toBe(200);
  expect(response.body.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
  expect(response.body.data[0].monthlyRent).toBe('12000.00');
  expect((await request(ctx.app).get('/api/v1/properties').query({ ...q, page: 999 })).body.data).toEqual([]);
  for (const neighbourhood of ["' OR 1=1 --", '%', '_']) expect((await request(ctx.app).get('/api/v1/properties').query({ neighbourhood })).body.data).toEqual([]);
  for (const query of [{ sort: 'rent;DROP TABLE users' }, { minRent: '20', maxRent: '10' }, { limit: 51 }, { page: 0 }, { waterAvailable: 'yes' }, { availableFrom: '2026-02-30' }, { ownerId: a.user.id }]) expect((await request(ctx.app).get('/api/v1/properties').query(query)).status).toBe(400);
  expect((await request(ctx.app).get('/api/v1/properties/not-a-uuid')).status).toBe(400);
});
test('public queries exclude hidden, draft, archived, expired, rented and suspended-owner properties', async () => {
  const ids = [];
  for (const state of ['hidden', 'draft', 'archived', 'expired', 'rented']) {
    const p = (await create({ ...listing, neighbourhood: 'Privacy Test' })).body.property;
    ids.push(p.id);
    if (state === 'expired') await ctx.pool.query("UPDATE properties SET expires_at=now()-interval '1 minute' WHERE id=$1", [p.id]);
    else if (state === 'rented') await ctx.pool.query("UPDATE properties SET availability_status='rented' WHERE id=$1", [p.id]);
    else await ctx.pool.query('UPDATE properties SET visibility_status=$2 WHERE id=$1', [p.id, state]);
  }
  const p = (await create({ ...listing, neighbourhood: 'Privacy Test' }, b)).body.property;
  ids.push(p.id);
  await ctx.pool.query("UPDATE users SET account_status='suspended' WHERE id=$1", [b.user.id]);
  for (const id of ids) expect((await request(ctx.app).get(`/api/v1/properties/${id}`)).status).toBe(404);
  expect((await request(ctx.app).get('/api/v1/properties').query({ neighbourhood: 'Privacy Test' })).body.pagination.total).toBe(0);
  expect((await a.agent.get('/api/v1/my/properties')).body.data.length).toBeGreaterThan(0);
  expect((await create(listing, b)).status).toBe(403);
});
