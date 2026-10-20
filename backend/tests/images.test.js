import { beforeAll, afterAll, test, expect } from 'vitest';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { setup, account, origin } from './helpers.js';
let ctx, owner, other, png, jpg, webp;
beforeAll(async () => {
  ctx = await setup(); owner = await account(ctx, 'landlord'); other = await account(ctx, 'landlord');
  const pixels = { create: { width: 4, height: 4, channels: 3, background: '#cc3300' } };
  png = await sharp(pixels).png().toBuffer(); jpg = await sharp(pixels).jpeg().toBuffer(); webp = await sharp(pixels).webp().toBuffer();
});
afterAll(async () => { await ctx?.close(); });
async function property() {
  return (await owner.agent.post('/api/v1/properties').set('Origin', origin).send({ title: 'Photo test apartment', description: 'A property for testing secure photo management.', monthlyRent: '10000', deposit: '0', bedrooms: 1, neighbourhood: 'Babesa', waterAvailable: true, parkingAvailable: false, moveInDate: '2026-11-01' })).body.property;
}
const upload = (id, buffer = png, actor = owner, name = 'image.png') => actor.agent.post(`/api/v1/properties/${id}/images`).set('Origin', origin).attach('images', buffer, name);
test('stores decoded images, serves correct bytes and privacy, orders and removes files', async () => {
  const p = await property();
  const r = await owner.agent.post(`/api/v1/properties/${p.id}/images`).set('Origin', origin).attach('images', png, '../../name.jpg').attach('images', jpg, 'a.png').attach('images', webp, 'a.webp');
  expect(r.status).toBe(201);
  expect(r.body.images).toHaveLength(3);
  expect(JSON.stringify(r.body)).not.toContain('storage_key');
  const images = r.body.images;
  const response = await request(ctx.app).get(images[0].url);
  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toContain('image/png');
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect((await sharp(response.body).metadata()).format).toBe('png');
  expect((await request(ctx.app).get(`/api/v1/properties/${p.id}`)).body.property.images).toEqual(images);
  const reordered = await owner.agent.patch(`/api/v1/properties/${p.id}/images/order`).set('Origin', origin).send({ imageIds: images.map((i) => i.id).reverse() });
  expect(reordered.status).toBe(200);
  expect(reordered.body.images.map((i) => i.displayOrder)).toEqual([0, 1, 2]);
  const invalid = await owner.agent.patch(`/api/v1/properties/${p.id}/images/order`).set('Origin', origin).send({ imageIds: [images[0].id, images[0].id, images[0].id] });
  expect(invalid.status).toBe(400);
  await ctx.pool.query("UPDATE properties SET visibility_status='hidden' WHERE id=$1", [p.id]);
  expect((await request(ctx.app).get(images[0].url)).status).toBe(404);
  expect((await other.agent.get(images[0].url)).status).toBe(404);
  expect((await owner.agent.get(images[0].url)).status).toBe(200);
  const before = await readdir(ctx.config.uploadDir);
  expect((await other.agent.delete(`/api/v1/properties/${p.id}/images/${images[0].id}`).set('Origin', origin)).status).toBe(404);
  expect((await owner.agent.delete(`/api/v1/properties/${p.id}/images/${images[0].id}`).set('Origin', origin)).status).toBe(204);
  expect((await readdir(ctx.config.uploadDir)).length).toBe(before.length - 1);
  expect((await owner.agent.get(images[0].url)).status).toBe(404);
});
test('rejects unauthenticated and foreign uploads before parsing; rejects unsupported, forged, oversized and empty uploads', async () => {
  const p = await property();
  const before = await readdir(ctx.config.uploadDir);
  expect((await request(ctx.app).post(`/api/v1/properties/${p.id}/images`).set('Origin', origin).attach('images', png, 'x.png')).status).toBe(401);
  expect((await upload(p.id, png, other)).status).toBe(404);
  for (const data of [Buffer.from('<svg></svg>'), Buffer.from([0xff, 0xd8, 0xff, 0, 0])]) expect((await upload(p.id, data)).status).toBe(415);
  expect((await upload(p.id, Buffer.alloc(5 * 1024 * 1024 + 1))).status).toBe(413);
  expect((await owner.agent.post(`/api/v1/properties/${p.id}/images`).set('Origin', origin)).status).toBe(400);
  expect(await readdir(ctx.config.uploadDir)).toEqual(before);
});
test('concurrent uploads cannot exceed eight images and failed DB writes remove created files', async () => {
  const p = await property();
  const first = owner.agent.post(`/api/v1/properties/${p.id}/images`).set('Origin', origin);
  for (let i = 0; i < 7; i++) first.attach('images', png, `${i}.png`);
  expect((await first).status).toBe(201);
  const results = await Promise.all([upload(p.id), upload(p.id)]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect((await ctx.pool.query('SELECT count(*)::int AS count FROM property_images WHERE property_id=$1', [p.id])).rows[0].count).toBe(8);
  const p2 = await property();
  const before = await readdir(ctx.config.uploadDir);
  // Real PostgreSQL failure after file write, not a mocked database.
  await ctx.pool.query("ALTER TABLE property_images ADD CONSTRAINT test_reject_insert CHECK (mime_type <> 'image/png') NOT VALID");
  try { expect((await upload(p2.id)).status).toBe(500); }
  finally { await ctx.pool.query('ALTER TABLE property_images DROP CONSTRAINT test_reject_insert'); }
  expect(await readdir(ctx.config.uploadDir)).toEqual(before);
  expect((await ctx.pool.query('SELECT count(*)::int AS count FROM property_images WHERE property_id=$1', [p2.id])).rows[0].count).toBe(0);
});
test('accepts exactly eight images in one upload and rejects nine', async () => {
  const p = await property();
  const valid = owner.agent.post(`/api/v1/properties/${p.id}/images`).set('Origin', origin);
  for (let i = 0; i < 8; i++) valid.attach('images', png, `${i}.png`);
  expect((await valid).status).toBe(201);
  const p2 = await property();
  const invalid = owner.agent.post(`/api/v1/properties/${p2.id}/images`).set('Origin', origin);
  for (let i = 0; i < 9; i++) invalid.attach('images', png, `${i}.png`);
  expect((await invalid).status).toBe(400);
});
test('missing files return safe 404 and suspended owners cannot view private media', async () => {
  const p = await property();
  const result = await upload(p.id);
  const image = result.body.images[0];
  const { rows: [row] } = await ctx.pool.query('SELECT storage_key FROM property_images WHERE id=$1', [image.id]);
  await unlink(path.join(ctx.config.uploadDir, row.storage_key));
  const missing = await request(ctx.app).get(image.url);
  expect(missing.status).toBe(404);
  expect(JSON.stringify(missing.body)).not.toContain(ctx.config.uploadDir);
  const second = (await upload(p.id)).body.images[1];
  await ctx.pool.query("UPDATE users SET account_status='suspended' WHERE id=$1", [owner.user.id]);
  expect((await owner.agent.get(second.url)).status).toBe(404);
});
