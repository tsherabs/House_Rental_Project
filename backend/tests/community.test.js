import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { setup, account, origin } from './helpers.js';
const listing = { title: 'Peaceful Thimphu home', description: 'A peaceful two-bedroom home overlooking the valley.',
  monthlyRent: '15000.00', deposit: '15000.00', bedrooms: 2, neighbourhood: 'Motithang',
  waterAvailable: true, parkingAvailable: true, moveInDate: '2026-11-01' };
describe('favourites, moderation and freshness', () => {
  let ctx, seeker, stranger, owner, other, admin;
  const property = async () => (await owner.agent.post('/api/v1/properties').set('Origin', origin).send(listing)).body.property;
  const post = (actor, url, body = {}) => actor.agent.post(`/api/v1${url}`).set('Origin', origin).send(body);
  const patch = (actor, url, body) => actor.agent.patch(`/api/v1${url}`).set('Origin', origin).send(body);
  beforeAll(async () => {
    ctx = await setup(); seeker = await account(ctx); stranger = await account(ctx);
    owner = await account(ctx, 'landlord'); other = await account(ctx, 'landlord'); admin = await account(ctx);
    await ctx.pool.query("UPDATE users SET role='admin' WHERE id=$1", [admin.user.id]);
  });
  afterAll(async () => { if (ctx) await ctx.close(); });
  it('saves idempotently, isolates users and retains unavailable favourites without private details', async () => {
    const p = await property();
    const results = await Promise.all([post(seeker, '/favourites', { propertyId: p.id }), post(seeker, '/favourites', { propertyId: p.id })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect((await stranger.agent.get('/api/v1/favourites')).body.data).toEqual([]);
    expect((await seeker.agent.get('/api/v1/favourites?limit=1')).body.data[0]).toMatchObject({ available: true, property: { id: p.id } });
    expect((await post(owner, '/favourites', { propertyId: p.id })).status).toBe(403);
    await ctx.pool.query("UPDATE properties SET visibility_status='hidden' WHERE id=$1", [p.id]);
    expect((await seeker.agent.get('/api/v1/favourites')).body.data[0]).toMatchObject({ propertyId: p.id, available: false, property: null });
    expect((await post(seeker, '/favourites', { propertyId: p.id })).status).toBe(200);
    expect((await post(stranger, '/favourites', { propertyId: p.id })).status).toBe(404);
    for (let n = 0; n < 2; n++)
      expect((await seeker.agent.delete(`/api/v1/favourites/${p.id}`).set('Origin', origin)).status).toBe(204);
    expect((await post(seeker, '/favourites', { propertyId: randomUUID() })).status).toBe(404);
  });
  it('validates reports, prevents pending duplicates, limits review to admins and audits decisions', async () => {
    const p = await property();
    expect((await request(ctx.app).post('/api/v1/reports').set('Origin', origin).send({})).status).toBe(401);
    expect((await post(seeker, '/reports', { propertyId: p.id, reason: 'short' })).status).toBe(400);
    const report = await post(seeker, '/reports', { propertyId: p.id, reason: 'The listing information appears misleading.' });
    expect(report.status).toBe(201);
    expect((await post(seeker, '/reports', { propertyId: p.id, reason: 'Another report on this same pending issue.' })).status).toBe(409);
    expect((await seeker.agent.get('/api/v1/admin/reports')).status).toBe(403);
    const review = { reviewStatus: 'actioned', reviewReason: 'Reviewed evidence and contacted the listing owner.' };
    expect((await patch(owner, `/admin/reports/${report.body.report.id}`, review)).status).toBe(403);
    const results = await Promise.all([patch(admin, `/admin/reports/${report.body.report.id}`, review), patch(admin, `/admin/reports/${report.body.report.id}`, review)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const reviewed = results.find((r) => r.status === 200).body.report;
    expect(reviewed).toMatchObject({ reviewedBy: admin.user.id, reviewStatus: 'actioned', reviewReason: review.reviewReason });
    expect(reviewed.reviewedAt).toBeTruthy();
    expect((await admin.agent.get('/api/v1/admin/reports?reviewStatus=pending')).body.data).toEqual([]);
    expect((await admin.agent.get('/api/v1/admin/reports?reviewStatus=actioned')).body.data).toHaveLength(1);
    expect((await request(ctx.app).get(`/api/v1/properties/${p.id}`)).status).toBe(200);
    expect((await patch(admin, `/admin/reports/${randomUUID()}`, review)).status).toBe(404);
  });
  it('audits hide/unhide, enforces public visibility, preserves rental status and prevents restoring archives', async () => {
    const p = await property();
    const body = { visibilityStatus: 'hidden', reason: 'Listing information requires verification.' };
    expect((await patch(owner, `/admin/properties/${p.id}/visibility`, body)).status).toBe(403);
    expect((await patch(admin, `/admin/properties/${p.id}/visibility`, { ...body, reason: '' })).status).toBe(400);
    expect((await patch(admin, `/admin/properties/${p.id}/visibility`, body)).status).toBe(200);
    expect((await request(ctx.app).get(`/api/v1/properties/${p.id}`)).status).toBe(404);
    expect((await post(seeker, '/reports', { propertyId: p.id, reason: 'Report after listing was hidden.' })).status).toBe(404);
    await patch(owner, `/properties/${p.id}/availability`, { availabilityStatus: 'rented' });
    const response = await patch(admin, `/admin/properties/${p.id}/visibility`, { ...body, visibilityStatus: 'published' });
    expect(response.body.property.availabilityStatus).toBe('rented');
    expect((await request(ctx.app).get(`/api/v1/properties/${p.id}`)).status).toBe(404);
    const { rows } = await ctx.pool.query('SELECT * FROM property_visibility_history WHERE property_id=$1 ORDER BY changed_at', [p.id]);
    expect(rows.map((r) => r.new_status)).toEqual(['hidden', 'published']);
    expect(rows.every((r) => r.changed_by === admin.user.id && r.reason === body.reason)).toBe(true);
    await owner.agent.delete(`/api/v1/properties/${p.id}`).set('Origin', origin);
    expect((await patch(admin, `/admin/properties/${p.id}/visibility`, body)).status).toBe(409);
  });
  it('renews only owned nonarchived listings for 30 days, preserving hidden/rented states', async () => {
    const p = await property();
    expect((await post(other, `/properties/${p.id}/confirm`)).status).toBe(404);
    expect((await post(seeker, `/properties/${p.id}/confirm`)).status).toBe(403);
    expect((await post(owner, `/properties/${p.id}/confirm`, { expiresAt: '2099-01-01' })).status).toBe(400);
    expect((await owner.agent.get('/api/v1/my/properties/expiring')).body.data.some((v) => v.id === p.id)).toBe(true);
    expect((await other.agent.get('/api/v1/my/properties/expiring')).body.data).toEqual([]);
    await ctx.pool.query("UPDATE properties SET expires_at=now()-interval '1 day' WHERE id=$1", [p.id]);
    expect((await request(ctx.app).get(`/api/v1/properties/${p.id}`)).status).toBe(404);
    const renewed = await post(owner, `/properties/${p.id}/confirm`);
    expect(renewed.status).toBe(200);
    const home = renewed.body.property;
    expect(Date.parse(home.expiresAt) - Date.parse(home.confirmedAt)).toBe(30 * 86400000);
    expect((await request(ctx.app).get(`/api/v1/properties/${p.id}`)).status).toBe(200);
    expect((await owner.agent.get('/api/v1/my/properties/expiring')).body.data.some((v) => v.id === p.id)).toBe(false);
    await ctx.pool.query("UPDATE properties SET availability_status='rented',visibility_status='hidden' WHERE id=$1", [p.id]);
    expect((await post(owner, `/properties/${p.id}/confirm`)).body.property).toMatchObject({ availabilityStatus: 'rented', visibilityStatus: 'hidden' });
    await owner.agent.delete(`/api/v1/properties/${p.id}`).set('Origin', origin);
    expect((await post(owner, `/properties/${p.id}/confirm`)).status).toBe(409);
  });
  it('rejects suspended sessions and invalid pagination on community endpoints', async () => {
    expect((await seeker.agent.get('/api/v1/favourites?page=0')).status).toBe(400);
    expect((await admin.agent.get('/api/v1/admin/reports?reviewStatus=unknown')).status).toBe(400);
    await ctx.pool.query("UPDATE users SET account_status='suspended' WHERE id=$1", [admin.user.id]);
    expect((await admin.agent.get('/api/v1/admin/reports')).status).toBe(403);
  });
});
