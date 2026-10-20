import multer from 'multer';
import { notFound, conflict } from '../utils/errors.js';
export function uploadMiddleware(pool, config) {
  // Busboy emits partsLimit on reaching the boundary, not after exceeding it.
  const receive = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: config.maxPropertyImages, fields: 0, parts: config.maxPropertyImages + 1, fieldNameSize: 50 } }).array('images', config.maxPropertyImages);
  return [async (req, _res, next) => {
    // Avoid buffering files from anyone who cannot modify this listing.
    const { rows: [property] } = await pool.query('SELECT visibility_status FROM properties WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
    if (!property) throw notFound();
    if (property.visibility_status === 'archived') throw conflict('Archived listings cannot be changed');
    next();
  }, receive];
}
