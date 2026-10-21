import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { setup, account, origin } from './helpers.js';

export const listing = {
  title: 'Sunny Thimphu apartment', description: 'Sunny two-bedroom apartment with parking and reliable water.',
  monthlyRent: '18000.00', deposit: '18000.00', bedrooms: 2, neighbourhood: 'Changzamtog',
  landmarks: null, waterAvailable: true, parkingAvailable: true, moveInDate: '2026-11-01',
};
describe('viewing access and lifecycle', () => {
  let ctx, seeker, owner, other, stranger, property;
  const future = () => new Date(Date.now() + 86400000).toISOString();
  const create = (body = {}) => seeker.agent.post('/api/v1/viewings').set('Origin', origin)
    .send({ propertyId: property.id, proposedAt: future(), ...body });
  const change = (actor, id, status) => actor.agent.patch(`/api/v1/viewings/${id}/status`).set('Origin', origin).send({ status });
  beforeAll(async () => {
    ctx = await setup();
    seeker = await account(ctx);
    stranger = await account(ctx);
    owner = await account(ctx, 'landlord');
    other = await account(ctx, 'landlord');
    property = (await owner.agent.post('/api/v1/properties').set('Origin', origin).send(listing)).body.property;
  });
  afterAll(async () => { if (ctx) await ctx.close(); });
  it('rejects anonymous, wrong role, spoofed fields, past or invalid dates and missing properties', async () => {
    expect((await request(ctx.app).post('/api/v1/viewings').set('Origin', origin).send({})).status).toBe(401);
    expect((await owner.agent.post('/api/v1/viewings').set('Origin', origin).send({})).status).toBe(403);
    for (const body of [{ seekerId: stranger.user.id }, { status: 'accepted' }, { proposedAt: '2020-01-01T00:00:00Z' },
      { proposedAt: 'invalid' }, { message: 'x'.repeat(1001) }, { propertyId: 'oops' }])
      expect((await create(body)).status).toBe(400);
    expect((await create({ propertyId: randomUUID() })).status).toBe(404);
    expect((await seeker.agent.post('/api/v1/viewings').send({ propertyId: property.id, proposedAt: future() })).status).toBe(403);
  });
  it('creates initial history, limits private lists and detail to the two participants', async () => {
    const response = await create({ message: 'May I visit in the afternoon?' });
    expect(response.status).toBe(201);
    const v = response.body.viewing;
    expect(v).toMatchObject({ seekerId: seeker.user.id, propertyId: property.id, status: 'pending' });
    for (const actor of [seeker, owner]) {
      const detail = await actor.agent.get(`/api/v1/viewings/${v.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.history).toHaveLength(1);
      expect(detail.body.history[0]).toMatchObject({ oldStatus: null, newStatus: 'pending', changedBy: seeker.user.id });
    }
    for (const actor of [stranger, other]) expect((await actor.agent.get(`/api/v1/viewings/${v.id}`)).status).toBe(404);
    expect((await stranger.agent.get('/api/v1/viewings/mine')).body.data).toEqual([]);
    expect((await other.agent.get('/api/v1/viewings/received')).body.data).toEqual([]);
    expect((await seeker.agent.get('/api/v1/viewings/mine?limit=1')).body.pagination.total).toBeGreaterThan(0);
    expect((await owner.agent.get('/api/v1/viewings/received?limit=1')).body.data).toHaveLength(1);
    expect((await seeker.agent.get('/api/v1/viewings/received')).status).toBe(403);
    expect((await owner.agent.get('/api/v1/viewings/mine')).status).toBe(403);
  });
  it('allows only owner decisions and requester cancellation, including accepted requests', async () => {
    const v = (await create()).body.viewing;
    expect((await change(other, v.id, 'accepted')).status).toBe(404);
    expect((await change(seeker, v.id, 'accepted')).status).toBe(403);
    expect((await change(owner, v.id, 'cancelled')).status).toBe(400);
    expect((await change(owner, v.id, 'accepted')).status).toBe(200);
    expect((await change(owner, v.id, 'rejected')).status).toBe(409);
    expect((await stranger.agent.post(`/api/v1/viewings/${v.id}/cancel`).set('Origin', origin).send({})).status).toBe(404);
    expect((await seeker.agent.post(`/api/v1/viewings/${v.id}/cancel`).set('Origin', origin).send({})).status).toBe(200);
    expect((await seeker.agent.post(`/api/v1/viewings/${v.id}/cancel`).set('Origin', origin).send({})).status).toBe(409);
    const detail = await owner.agent.get(`/api/v1/viewings/${v.id}`);
    expect(detail.body.history.map((h) => h.newStatus)).toEqual(['pending', 'accepted', 'cancelled']);
  });
  it('serializes concurrent decisions and stores only the successful history entry', async () => {
    const v = (await create()).body.viewing;
    const results = await Promise.all([change(owner, v.id, 'accepted'), change(owner, v.id, 'rejected')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await seeker.agent.get(`/api/v1/viewings/${v.id}`)).body.history).toHaveLength(2);
  });
  it('rolls back the request update if its audit insert fails', async () => {
    const v = (await create()).body.viewing;
    await ctx.pool.query(`CREATE FUNCTION fail_history() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.old_status IS NOT NULL THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER history_failure BEFORE INSERT ON viewing_status_history FOR EACH ROW EXECUTE FUNCTION fail_history()`);
    try {
      expect((await change(owner, v.id, 'accepted')).status).toBe(500);
      const detail = await seeker.agent.get(`/api/v1/viewings/${v.id}`);
      expect(detail.body.viewing.status).toBe('pending');
      expect(detail.body.history).toHaveLength(1);
    } finally { await ctx.pool.query('DROP TRIGGER history_failure ON viewing_status_history; DROP FUNCTION fail_history()'); }
  });
  it('rejects unavailable properties but preserves existing viewing history', async () => {
    const v = (await create()).body.viewing;
    for (const status of ['hidden', 'draft', 'archived']) {
      await ctx.pool.query('UPDATE properties SET visibility_status=$1 WHERE id=$2', [status, property.id]);
      expect((await create()).status).toBe(404);
    }
    await ctx.pool.query("UPDATE properties SET visibility_status='published',availability_status='rented' WHERE id=$1", [property.id]);
    expect((await create()).status).toBe(404);
    expect((await seeker.agent.get(`/api/v1/viewings/${v.id}`)).status).toBe(200);
    expect((await change(owner, v.id, 'rejected')).status).toBe(200);
    expect((await seeker.agent.post(`/api/v1/viewings/${v.id}/cancel`).set('Origin', origin).send({})).status).toBe(409);
    await ctx.pool.query("UPDATE properties SET availability_status='available',expires_at=now()-interval '1 second' WHERE id=$1", [property.id]);
    expect((await create()).status).toBe(404);
    await ctx.pool.query('UPDATE properties SET expires_at=NULL WHERE id=$1', [property.id]);
    await ctx.pool.query("UPDATE users SET account_status='suspended' WHERE id=$1", [owner.user.id]);
    expect((await create()).status).toBe(404);
    await ctx.pool.query("UPDATE users SET account_status='active' WHERE id=$1", [owner.user.id]);
    await ctx.pool.query("UPDATE users SET account_status='suspended' WHERE id=$1", [seeker.user.id]);
    expect((await create()).status).toBe(403);
  });
});
