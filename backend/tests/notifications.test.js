import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import { setup, account, origin } from './helpers.js';
let ctx, owner, seeker, stranger, admin, property;
const post = (actor, path, body) => actor.agent.post(`/api/v1${path}`).set('Origin', origin).send(body);
const patch = (actor, path, body) => actor.agent.patch(`/api/v1${path}`).set('Origin', origin).send(body);
const createViewing = () => post(seeker, '/viewings', { propertyId: property.id, proposedAt: new Date(Date.now() + 86400000).toISOString() });
beforeAll(async () => {
  ctx = await setup();
  owner = await account(ctx, 'landlord'); seeker = await account(ctx); stranger = await account(ctx); admin = await account(ctx);
  await ctx.pool.query("UPDATE users SET role='admin' WHERE id=$1", [admin.user.id]);
  property = (await post(owner, '/properties', { title: 'Home for notification tests', description: 'Sunny apartment with parking and water in Thimphu.', monthlyRent: '15000.00', deposit: '15000.00', bedrooms: 2, neighbourhood: 'Taba', waterAvailable: true, parkingAvailable: true, moveInDate: '2026-11-01' })).body.property;
});
afterAll(async () => { await ctx?.close(); });
it('sends viewing updates only to the correct recipient, paginates and marks read idempotently', async () => {
  const viewing = (await createViewing()).body.viewing;
  const inbox = (await owner.agent.get('/api/v1/notifications?limit=1&unreadOnly=true')).body;
  expect(inbox).toMatchObject({ unreadCount: 1, pagination: { total: 1, limit: 1 } });
  const notice = inbox.data[0];
  expect(notice).toMatchObject({ kind: 'viewing_requested', readAt: null, link: '/viewings' });
  expect(notice).not.toHaveProperty('userId');
  expect((await stranger.agent.get('/api/v1/notifications')).body.data).toEqual([]);
  expect((await patch(stranger, `/notifications/${notice.id}/read`, {})).status).toBe(404);
  expect((await request(ctx.app).get('/api/v1/notifications')).status).toBe(401);
  expect((await patch(owner, `/notifications/${notice.id}/read`, { userId: stranger.user.id })).status).toBe(400);
  const read = await patch(owner, `/notifications/${notice.id}/read`, {});
  expect(read.status).toBe(200);
  expect((await patch(owner, `/notifications/${notice.id}/read`, {})).body).toEqual(read.body);
  expect((await owner.agent.get('/api/v1/notifications?unreadOnly=true')).body).toMatchObject({ unreadCount: 0, data: [] });
  expect((await patch(owner, `/viewings/${viewing.id}/status`, { status: 'accepted' })).status).toBe(200);
  expect((await seeker.agent.get('/api/v1/notifications')).body.data.map((n) => n.kind)).toEqual(['viewing_accepted']);
  expect((await post(seeker, `/viewings/${viewing.id}/cancel`, {})).status).toBe(200);
  expect((await owner.agent.get('/api/v1/notifications')).body.data[0].kind).toBe('viewing_cancelled');
});
it('rolls back the viewing and history when notification insertion fails', async () => {
  const before = (await ctx.pool.query('SELECT count(*)::int AS count FROM viewing_requests')).rows[0].count;
  await ctx.pool.query(`CREATE FUNCTION fail_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test notification failure'; END $$;
    CREATE TRIGGER notice_failure BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION fail_notice()`);
  try {
    expect((await createViewing()).status).toBe(500);
    expect((await ctx.pool.query('SELECT count(*)::int AS count FROM viewing_requests')).rows[0].count).toBe(before);
  } finally { await ctx.pool.query('DROP TRIGGER notice_failure ON notifications; DROP FUNCTION fail_notice()'); }
});
it('delivers moderation outcomes without disclosing internal reasons or other users', async () => {
  const report = (await post(seeker, '/reports', { propertyId: property.id, reason: 'Listing information requires verification.' })).body.report;
  expect((await patch(admin, `/admin/reports/${report.id}`, { reviewStatus: 'actioned', reviewReason: 'Private administrator evidence notes.' })).status).toBe(200);
  expect((await patch(admin, `/admin/properties/${property.id}/visibility`, { visibilityStatus: 'hidden', reason: 'Private administrator evidence notes.' })).status).toBe(200);
  const inbox = await seeker.agent.get('/api/v1/notifications');
  expect(inbox.body.data[0].kind).toBe('report_reviewed');
  expect(JSON.stringify(inbox.body)).not.toContain('Private administrator');
  expect((await owner.agent.get('/api/v1/notifications')).body.data[0].kind).toBe('listing_moderated');
  expect((await stranger.agent.get('/api/v1/notifications')).body.unreadCount).toBe(0);
});
it('validates filters, requires CSRF and blocks suspended sessions', async () => {
  for (const query of ['page=0', 'limit=101', 'unreadOnly=yes', 'userId=other'])
    expect((await seeker.agent.get(`/api/v1/notifications?${query}`)).status).toBe(400);
  const notice = (await seeker.agent.get('/api/v1/notifications')).body.data[0];
  expect((await seeker.agent.patch(`/api/v1/notifications/${notice.id}/read`).send({})).status).toBe(403);
  await ctx.pool.query("UPDATE users SET account_status='suspended' WHERE id=$1", [seeker.user.id]);
  expect((await seeker.agent.get('/api/v1/notifications')).status).toBe(403);
});
