import { Router } from 'express';
import { z } from 'zod';
import { validate, idParams, pageQuery } from '../middleware/validate.js';
import { roles } from '../middleware/roles.js';
import { propertiesService } from '../services/properties.service.js';
export const money = z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/, 'Use a nonnegative decimal string with at most 10 integer and 2 fractional digits');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return s.slice(0, 4) !== '0000' && !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
}, 'Invalid calendar date');
export const propertyBody = z.object({
  title: z.string().trim().min(5).max(160), description: z.string().trim().min(20).max(5000),
  monthlyRent: money, deposit: money, bedrooms: z.number().int().min(0).max(20),
  neighbourhood: z.string().trim().min(2).max(100), landmarks: z.string().trim().max(500).nullable().optional(),
  waterAvailable: z.boolean(), parkingAvailable: z.boolean(), moveInDate: isoDate,
}).strict();
const booleanQuery = z.enum(['true', 'false']).transform((s) => s === 'true');
export const searchQuery = pageQuery.extend({ minRent: money.optional(), maxRent: money.optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(), neighbourhood: z.string().trim().min(1).max(100).optional(),
  waterAvailable: booleanQuery.optional(), parkingAvailable: booleanQuery.optional(),
  availableFrom: isoDate.optional(), sort: z.enum(['recent', 'rent_asc', 'rent_desc']).default('recent'),
}).refine((q) => q.minRent === undefined || q.maxRent === undefined || Number(q.minRent) <= Number(q.maxRent), 'minRent must not exceed maxRent');
export function propertiesRoutes(pool, authenticate) {
  const router = Router();
  const service = propertiesService(pool);
  const owner = [authenticate, roles('landlord')];
  router.get('/properties', validate(searchQuery, 'query'), async (req, res) => res.json(await service.list(req.validated.query)));
  router.get('/properties/:id', validate(idParams, 'params'), async (req, res) => res.json({ property: await service.get(req.params.id) }));
  router.get('/my/properties', ...owner, validate(pageQuery, 'query'), async (req, res) => res.json(await service.list(req.validated.query, req.user.id)));
  router.get('/my/properties/:id', ...owner, validate(idParams, 'params'), async (req, res) => res.json({ property: await service.get(req.params.id, req.user.id) }));
  router.post('/properties', ...owner, validate(propertyBody), async (req, res) => res.status(201).json({ property: await service.create(req.user.id, req.validated.body) }));
  router.patch('/properties/:id', ...owner, validate(idParams, 'params'), validate(propertyBody.partial().refine((b) => Object.keys(b).length > 0, 'Provide at least one field')), async (req, res) => res.json({ property: await service.update(req.params.id, req.user.id, req.validated.body) }));
  router.delete('/properties/:id', ...owner, validate(idParams, 'params'), async (req, res) => { await service.archive(req.params.id, req.user.id); res.sendStatus(204); });
  router.patch('/properties/:id/availability', ...owner, validate(idParams, 'params'), validate(z.object({ availabilityStatus: z.enum(['available', 'rented']) }).strict()), async (req, res) => res.json({ property: await service.availability(req.params.id, req.user.id, req.validated.body.availabilityStatus) }));
  return router;
}
