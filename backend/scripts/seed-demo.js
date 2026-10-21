import { readFile } from 'node:fs/promises';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db/pool.js';
import { authService } from '../src/services/auth.service.js';
import { password } from '../src/routes/auth.routes.js';
import { propertiesService } from '../src/services/properties.service.js';
import { imagesService } from '../src/services/images.service.js';
import { communityService } from '../src/services/community.service.js';
import { viewingsService } from '../src/services/viewings.service.js';

const config = readConfig();
const url = new URL(config.databaseUrl);
if (config.production || process.env.DEMO_SEED !== '1' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Demo seeding requires DEMO_SEED=1 and a local nonproduction database');
const demoPassword = password.parse(process.env.DEMO_PASSWORD);
const pool = createPool(config.databaseUrl);
const auth = authService(pool, config), properties = propertiesService(pool);
const images = imagesService(pool, config, console), community = communityService(pool), viewings = viewingsService(pool);
try {
  const accounts = {};
  for (const role of ['seeker', 'landlord']) {
    const email = `${role}@homefinder.test`;
    const { rows: [existing] } = await pool.query('SELECT id,role FROM users WHERE email=$1', [email]);
    if (existing && existing.role !== role) throw new Error('Existing demo email has a different role; no account changed');
    accounts[role] = existing ?? await auth.register({ name: role === 'seeker' ? 'Pema · Demo seeker' : 'Sonam · Demo landlord', email, password: demoPassword, role });
  }
  const homes = [
    ['A sunny retreat in Motithang', 'Motithang', '22000.00', 2, 'valley-living-room'],
    ['Valley-view family apartment', 'Changzamtog', '18500.00', 3, 'thimphu-home'],
    ['A quiet corner in Changangkha', 'Changangkha', '14500.00', 1, 'valley-living-room'],
    ['Room to grow in Babesa', 'Babesa', '26000.00', 3, 'thimphu-home'],
    ['Your first home in Olakha', 'Olakha', '12000.00', 1, 'valley-living-room'],
    ['The hillside home in Taba', 'Taba', '17000.00', 2, 'thimphu-home'],
  ];
  const created = [];
  for (const [title, neighbourhood, rent, bedrooms, cover] of homes) {
    const { rows: [existing] } = await pool.query('SELECT id FROM properties WHERE owner_id=$1 AND title=$2', [accounts.landlord.id, title]);
    if (existing) continue;
    const p = await properties.create(accounts.landlord.id, {
      title, neighbourhood, monthlyRent: rent, deposit: rent, bedrooms,
      description: 'Fictional demo listing with AI-generated illustrative photos, shared across the demo homes. A bright, welcoming space with warm timber details, room to unwind and views of the Thimphu valley. Use this listing to try saving a home, arranging a viewing and managing requests. This is not a real rental advertisement.',
      landmarks: 'Demo location — no real address', waterAvailable: true, parkingAvailable: bedrooms > 1,
      moveInDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    });
    const names = [cover, cover === 'thimphu-home' ? 'valley-living-room' : 'thimphu-home'];
    const files = [];
    for (const name of names) files.push({ buffer: await readFile(new URL(`../../frontend/public/images/${name}.webp`, import.meta.url)) });
    await images.upload(p.id, accounts.landlord.id, files);
    await community.confirm(p.id, accounts.landlord.id);
    created.push(p);
  }
  if (created.length) {
    await community.save(accounts.seeker.id, created[0].id);
    await viewings.create(accounts.seeker.id, { propertyId: created[0].id, proposedAt: new Date(Date.now() + 2 * 86400000).toISOString(), message: 'Demo request: I would love to visit this home.' });
    await community.report(accounts.seeker.id, { propertyId: created[created.length - 1].id, reason: 'Demo report for testing the administrator review workflow. Please verify the listing information.' });
  }
  console.log(`Demo ready: ${created.length} new fictional listings. Existing accounts and listings were preserved.`);
  console.log('Seeker: seeker@homefinder.test; landlord: landlord@homefinder.test. Password supplied through DEMO_PASSWORD.');
} finally { await pool.end(); }
