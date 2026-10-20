import { forbidden } from '../utils/errors.js';
export function csrf(appOrigin) {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    let origin = req.get('Origin');
    if (!origin) {
      try { origin = new URL(req.get('Referer')).origin; } catch { /* reject below */ }
    }
    if (origin !== appOrigin) return next(forbidden());
    next();
  };
}
