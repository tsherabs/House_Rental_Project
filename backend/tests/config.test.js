import { test, expect } from 'vitest';
import { readConfig } from '../src/config.js';
const env = { DATABASE_URL: 'postgresql://local@localhost/homefinder', SESSION_SECRET: 'a'.repeat(48), APP_ORIGIN: 'http://localhost:4200' };
test('runtime config requires secrets and preserves approved secure defaults', () => {
  expect(readConfig(env)).toMatchObject({ bcryptCost: 12, cookieName: 'homefinder.sid', sessionTtlMs: 86400000, trustProxy: false, maxUploadBytes: 5242880, maxPropertyImages: 8 });
  for (const invalid of [{ SESSION_SECRET: '' }, { SESSION_SECRET: 'replace_with_long_random_secret_example' }, { DATABASE_URL: '' }, { BCRYPT_COST: '4' }, { MAX_UPLOAD_MB: '500' }]) expect(() => readConfig({ ...env, ...invalid })).toThrow();
});
test('production config requires HTTPS and a valid origin without credentials or path', () => {
  expect(() => readConfig({ ...env, NODE_ENV: 'production' })).toThrow('HTTPS');
  for (const APP_ORIGIN of ['https://example.test/path', 'https://user:secret@example.test', 'ftp://example.test']) expect(() => readConfig({ ...env, APP_ORIGIN })).toThrow();
  expect(readConfig({ ...env, NODE_ENV: 'production', APP_ORIGIN: 'https://example.test', TRUST_PROXY: 'loopback,10.0.0.0/8' }).trustProxy).toEqual(['loopback', '10.0.0.0/8']);
});
