import { ZodError } from 'zod';
import multer from 'multer';
import { ApiError } from '../utils/errors.js';

// Never log request bodies, SQL, session IDs or database error details here.
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request',
      details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) } });
  }
  if (error instanceof multer.MulterError) {
    const large = error.code === 'LIMIT_FILE_SIZE';
    return res.status(large ? 413 : 400).json({ error: { code: large ? 'FILE_TOO_LARGE' : 'VALIDATION_ERROR', message: large ? 'Image exceeds upload limit' : 'Invalid multipart upload' } });
  }
  if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'Request body too large' } });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } });
  if (error instanceof ApiError) return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
  req.app.get('logger')?.error({ event: 'request_failed', errorType: error.name });
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}
