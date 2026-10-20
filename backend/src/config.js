import path from 'node:path';
import { z } from 'zod';
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().refine((s) => /^postgres(ql)?:/.test(s)),
  SESSION_SECRET: z.string().min(32).refine((s) => !/replace|change_me/i.test(s), 'Use a generated secret'),
  SESSION_COOKIE_NAME: z.string().regex(/^[\w.-]+$/).default('homefinder.sid'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),
  APP_ORIGIN: z.string().url(),
  TRUST_PROXY: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(5).default(5),
  MAX_PROPERTY_IMAGES: z.coerce.number().int().min(1).max(8).default(8),
});
export function readConfig(env = process.env) {
  const e = envSchema.parse(env);
  const origin = new URL(e.APP_ORIGIN);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('APP_ORIGIN must be an HTTP(S) origin without a path');
  if (e.NODE_ENV === 'production' && origin.protocol !== 'https:') throw new Error('Production APP_ORIGIN must use HTTPS');
  return {
    production: e.NODE_ENV === 'production', port: e.PORT, databaseUrl: e.DATABASE_URL,
    sessionSecret: e.SESSION_SECRET, cookieName: e.SESSION_COOKIE_NAME,
    sessionTtlMs: e.SESSION_TTL_HOURS * 3600000, bcryptCost: e.BCRYPT_COST,
    appOrigin: origin.origin, trustProxy: e.TRUST_PROXY ? e.TRUST_PROXY.split(',').map((s) => s.trim()) : false,
    uploadDir: path.resolve(e.UPLOAD_DIR), maxUploadBytes: e.MAX_UPLOAD_MB * 1024 * 1024,
    maxPropertyImages: e.MAX_PROPERTY_IMAGES, authRateLimit: 30,
  };
}
