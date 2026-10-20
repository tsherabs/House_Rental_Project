import { forbidden } from '../utils/errors.js';
export const roles = (...allowed) => (req, _res, next) => allowed.includes(req.user?.role) ? next() : next(forbidden());
