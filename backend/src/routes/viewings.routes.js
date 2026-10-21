import { Router } from 'express';
import { z } from 'zod';
import { roles } from '../middleware/roles.js';
import { validate, uuid, idParams, pageQuery } from '../middleware/validate.js';
import { viewingsService } from '../services/viewings.service.js';

export function viewingsRoutes(pool, authenticate) {
  const router = Router();
  const service = viewingsService(pool);
  router.use(authenticate);
  router.post('/', roles('seeker'), validate(z.object({
    propertyId: uuid, proposedAt: z.iso.datetime({ offset: true }).refine((v) => Date.parse(v) > Date.now(), 'Choose a future time'),
    message: z.string().trim().max(1000).optional(),
  }).strict()), async (req, res) => res.status(201).json({ viewing: await service.create(req.user.id, req.validated.body) }));
  router.get('/mine', roles('seeker'), validate(pageQuery, 'query'), async (req, res) => res.json(await service.list(req.user, req.validated.query)));
  router.get('/received', roles('landlord'), validate(pageQuery, 'query'), async (req, res) => res.json(await service.list(req.user, req.validated.query)));
  router.get('/:id', roles('seeker', 'landlord'), validate(idParams, 'params'), async (req, res) => res.json(await service.detail(req.validated.params.id, req.user)));
  router.patch('/:id/status', roles('landlord'), validate(idParams, 'params'),
    validate(z.object({ status: z.enum(['accepted', 'rejected']) }).strict()),
    async (req, res) => res.json({ viewing: await service.transition(req.validated.params.id, req.user, req.validated.body.status) }));
  router.post('/:id/cancel', roles('seeker'), validate(idParams, 'params'),
    validate(z.object({}).strict().optional()),
    async (req, res) => res.json({ viewing: await service.transition(req.validated.params.id, req.user, 'cancelled') }));
  return router;
}
