import { Router } from 'express';
import { z } from 'zod';
import { validate, idParams, pageQuery } from '../middleware/validate.js';
import { roles } from '../middleware/roles.js';
import { usersService } from '../services/users.service.js';
export function usersRoutes(pool, authenticate) {
  const router = Router();
  const service = usersService(pool);
  router.use(authenticate, roles('admin'));
  router.get('/', validate(pageQuery.extend({ role: z.enum(['seeker', 'landlord', 'admin']).optional(), accountStatus: z.enum(['active', 'suspended']).optional() }), 'query'), async (req, res) => res.json(await service.list(req.validated.query)));
  router.patch('/:id/status', validate(idParams, 'params'), validate(z.object({ accountStatus: z.enum(['active', 'suspended']), reason: z.string().trim().min(10).max(1000) }).strict()), async (req, res) => res.json({ user: await service.status(req.params.id, req.user.id, req.validated.body) }));
  return router;
}
