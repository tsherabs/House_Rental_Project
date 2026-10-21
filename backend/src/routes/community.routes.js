import { Router } from 'express';
import { z } from 'zod';
import { roles } from '../middleware/roles.js';
import { validate, uuid, idParams, pageQuery } from '../middleware/validate.js';
import { communityService } from '../services/community.service.js';
const reason = z.string().trim().min(10).max(1000);
export function communityRoutes(pool, authenticate) {
  const router = Router();
  const service = communityService(pool);
  // Authenticate only matching routes, leaving M3 public routes public.
  router.get('/favourites', authenticate, roles('seeker'), validate(pageQuery, 'query'),
    async (req, res) => res.json(await service.favourites(req.user.id, req.validated.query)));
  router.post('/favourites', authenticate, roles('seeker'), validate(z.object({ propertyId: uuid }).strict()),
    async (req, res) => {
      const result = await service.save(req.user.id, req.validated.body.propertyId);
      res.status(result.created ? 201 : 200).json({ favourite: result.favourite });
    });
  router.delete('/favourites/:propertyId', authenticate, roles('seeker'), validate(z.object({ propertyId: uuid }), 'params'),
    async (req, res) => { await service.remove(req.user.id, req.validated.params.propertyId); res.sendStatus(204); });
  router.post('/reports', authenticate, validate(z.object({ propertyId: uuid, reason }).strict()),
    async (req, res) => res.status(201).json({ report: await service.report(req.user.id, req.validated.body) }));
  router.get('/admin/reports', authenticate, roles('admin'),
    validate(pageQuery.extend({ reviewStatus: z.enum(['pending', 'dismissed', 'actioned']).optional() }), 'query'),
    async (req, res) => res.json(await service.reports(req.validated.query)));
  router.patch('/admin/reports/:id', authenticate, roles('admin'), validate(idParams, 'params'),
    validate(z.object({ reviewStatus: z.enum(['dismissed', 'actioned']), reviewReason: reason }).strict()),
    async (req, res) => res.json({ report: await service.review(req.validated.params.id, req.user.id, req.validated.body) }));
  router.patch('/admin/properties/:id/visibility', authenticate, roles('admin'), validate(idParams, 'params'),
    validate(z.object({ visibilityStatus: z.enum(['hidden', 'published']), reason }).strict()),
    async (req, res) => res.json({ property: await service.visibility(req.validated.params.id, req.user.id, req.validated.body) }));
  router.post('/properties/:id/confirm', authenticate, roles('landlord'), validate(idParams, 'params'),
    validate(z.object({}).strict().optional()),
    async (req, res) => res.json({ property: await service.confirm(req.validated.params.id, req.user.id) }));
  router.get('/my/properties/expiring', authenticate, roles('landlord'), validate(pageQuery, 'query'),
    async (req, res) => res.json(await service.expiring(req.user.id, req.validated.query)));
  return router;
}
