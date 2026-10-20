import { Router } from 'express';
import { z } from 'zod';
import { validate, idParams, uuid } from '../middleware/validate.js';
import { roles } from '../middleware/roles.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { imagesService } from '../services/images.service.js';
import { notFound } from '../utils/errors.js';
export function imagesRoutes(pool, config, authenticate, logger) {
  const router = Router();
  const service = imagesService(pool, config, logger);
  const owner = [authenticate, roles('landlord'), validate(idParams, 'params')];
  router.post('/properties/:id/images', ...owner, ...uploadMiddleware(pool, config), async (req, res) => res.status(201).json({ images: await service.upload(req.params.id, req.user.id, req.files) }));
  router.delete('/properties/:id/images/:imageId', ...owner, validate(z.object({ id: uuid, imageId: uuid }), 'params'), async (req, res) => { await service.remove(req.params.id, req.params.imageId, req.user.id); res.sendStatus(204); });
  router.patch('/properties/:id/images/order', ...owner, validate(z.object({ imageIds: z.array(uuid).max(config.maxPropertyImages) }).strict()), async (req, res) => res.json({ images: await service.order(req.params.id, req.user.id, req.validated.body.imageIds) }));
  router.get('/property-images/:imageId', validate(z.object({ imageId: uuid }), 'params'), async (req, res, next) => {
    const image = await service.read(req.params.imageId, req.session?.revoked ? undefined : req.session?.userId);
    res.set({ 'Content-Type': image.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' });
    res.sendFile(image.path, { cacheControl: false, lastModified: false, acceptRanges: false }, (error) => {
      if (error) next(error.code === 'ENOENT' || error.status === 404 ? notFound() : error);
    });
  });
  return router;
}
