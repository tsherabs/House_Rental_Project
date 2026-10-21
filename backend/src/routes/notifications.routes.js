import { Router } from 'express';
import { z } from 'zod';
import { validate, idParams, pageQuery } from '../middleware/validate.js';
import { notificationsService } from '../services/notifications.service.js';
export function notificationsRoutes(pool, authenticate) {
  const router = Router(), service = notificationsService(pool);
  router.use(authenticate);
  router.get('/', validate(pageQuery.extend({ unreadOnly: z.enum(['true','false']).optional().transform(v => v === 'true') }), 'query'),
    async (req, res) => res.json(await service.list(req.user.id, req.validated.query)));
  router.patch('/:id/read', validate(idParams, 'params'), validate(z.object({}).strict()),
    async (req, res) => res.json({ notification: await service.read(req.user.id, req.validated.params.id) }));
  return router;
}
