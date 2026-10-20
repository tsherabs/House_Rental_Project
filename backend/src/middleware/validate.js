import { z } from 'zod';
export const uuid = z.string().uuid();
export const idParams = z.object({ id: uuid });
export function validate(schema, target = 'body') {
  return (req, _res, next) => {
    try {
      req.validated ??= {};
      req.validated[target] = schema.parse(req[target]);
      next();
    } catch (error) { next(error); }
  };
}
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
}).strict();
export const pagination = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
