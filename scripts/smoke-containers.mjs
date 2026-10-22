// Isolated local preview only. Creates synthetic accounts/listing; never run against production.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const origin = 'http://127.0.0.1:8080';
const statePath = new URL('../.local/container-smoke.json', import.meta.url);
// A started proxy can need a moment before accepting its first connection.
let ready = false;
for (let attempt = 0; attempt < 20; attempt++) {
  try { ready = (await fetch(`${origin}/api/v1/ready`, { signal: AbortSignal.timeout(2000) })).ok; } catch { /* Retry startup only. */ }
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert.ok(ready, 'Local container preview did not become ready');
async function call(path, { method = 'GET', body, cookie, expected = 200, form, foreign = false } = {}) {
  const response = await fetch(`${origin}/api/v1${path}`, { method, headers: {
    ...(method !== 'GET' ? { Origin: foreign ? 'https://foreign.invalid' : origin } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}),
  }, body: form ?? (body ? JSON.stringify(body) : undefined), signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}`);
  return response;
}
if (process.argv.includes('--verify-persistence')) {
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal((await (await call('/auth/me', { cookie: state.ownerCookie })).json()).user.role, 'landlord');
  assert.equal((await (await call(`/properties/${state.propertyId}`)).json()).property.images.length, 1);
  const image = await call(state.imageUrl.replace('/api/v1', ''));
  assert.ok((await image.arrayBuffer()).byteLength > 1000);
  const inbox = await (await call('/notifications', { cookie: state.seekerCookie })).json();
  assert.equal(inbox.data[0].kind, 'viewing_accepted');
  console.log('Persistence verified after restart: database, session cookies, inbox and uploaded image.');
} else {
  const suffix = randomUUID().slice(0, 8), password = randomBytes(20).toString('hex');
  async function user(role) {
    const email = `${role}-${suffix}@container.test`;
    await call('/auth/register', { method: 'POST', body: { name: `Container ${role}`, email, password, role }, expected: 201 });
    const response = await call('/auth/login', { method: 'POST', body: { email, password } });
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    return response.headers.get('set-cookie').split(';')[0];
  }
  await call('/ready');
  const ownerCookie = await user('landlord'), seekerCookie = await user('seeker');
  const property = (await (await call('/properties', { method: 'POST', cookie: ownerCookie, expected: 201, body: {
    title: 'Container verification home', description: 'Fictional home for local deployment verification. Illustrative photo.',
    monthlyRent: '18000.00', deposit: '18000.00', bedrooms: 2, neighbourhood: 'Taba', waterAvailable: true, parkingAvailable: true, moveInDate: '2026-11-01',
  } })).json()).property;
  const form = new FormData();
  form.append('images', new Blob([await readFile(new URL('../frontend/public/images/thimphu-home.webp', import.meta.url))], { type: 'image/webp' }), 'illustration.webp');
  const uploaded = await (await call(`/properties/${property.id}/images`, { method: 'POST', cookie: ownerCookie, form, expected: 201 })).json();
  assert.equal(uploaded.images.length, 1);
  const viewing = (await (await call('/viewings', { method: 'POST', cookie: seekerCookie, expected: 201, body: { propertyId: property.id, proposedAt: new Date(Date.now() + 86400000).toISOString() } })).json()).viewing;
  const ownerInbox = await (await call('/notifications', { cookie: ownerCookie })).json();
  assert.equal(ownerInbox.data[0].kind, 'viewing_requested');
  await call(`/notifications/${ownerInbox.data[0].id}/read`, { method: 'PATCH', cookie: seekerCookie, body: {}, expected: 404 });
  await call(`/viewings/${viewing.id}/status`, { method: 'PATCH', cookie: ownerCookie, body: { status: 'accepted' } });
  await call('/favourites', { method: 'POST', cookie: seekerCookie, body: { propertyId: property.id }, expected: 201 });
  await call('/auth/logout', { method: 'POST', cookie: seekerCookie, body: {}, foreign: true, expected: 403 });
  const html = await fetch(`${origin}/compare`);
  assert.equal(html.status, 200); assert.match(await html.text(), /<app-root>/);
  assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await writeFile(statePath, JSON.stringify({ ownerCookie, seekerCookie, propertyId: property.id, imageUrl: uploaded.images[0].url }));
  console.log('Container smoke passed: registration, login, listing, image, viewing, inbox ownership, decision, favourite, CSRF and SPA fallback.');
}
