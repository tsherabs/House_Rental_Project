import { Router } from 'express';
import { z } from 'zod';
import { requestLimit } from '../middleware/request-limit.js';
import { validate } from '../middleware/validate.js';
import { authService } from '../services/auth.service.js';
import { authController } from '../controllers/auth.controller.js';
const email = z.string().trim().toLowerCase().max(254).email();
export const password = z.string().min(12).refine((s) => Buffer.byteLength(s, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');
export const registration = z.object({ name: z.string().trim().min(1).max(120), email, password, role: z.enum(['seeker', 'landlord']) }).strict();
export function authRoutes(pool, config, authenticate) {
  const router = Router();
  const controller = authController(authService(pool, config), config);
  const limiter = requestLimit(pool, { scope: 'auth', limit: config.authRateLimit, seconds: 900, secret: config.sessionSecret });
  router.post('/register', limiter, validate(registration), controller.register);
  router.post('/login', limiter, validate(z.object({ email, password: z.string().min(1).refine((s) => Buffer.byteLength(s) <= 72) }).strict()), controller.login);
  router.post('/logout', authenticate, validate(z.object({}).strict().optional()), controller.logout);
  router.get('/me', authenticate, controller.me);
  return router;
}
