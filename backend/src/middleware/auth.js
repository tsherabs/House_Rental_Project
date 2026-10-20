import { ApiError, forbidden } from '../utils/errors.js';
import { userColumns, userDto } from '../services/auth.service.js';
export const sessionAction = (req, action) => new Promise((resolve, reject) => req.session[action]((error) => error ? reject(error) : resolve()));
export function cookieOptions(config) {
  return { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' };
}
export function authentication(pool, config) {
  return async (req, res, next) => {
    try {
      if (!req.session?.userId) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required');
      const { rows: [user] } = await pool.query(`SELECT ${userColumns} FROM users WHERE id=$1`, [req.session.userId]);
      if (!user || user.account_status !== 'active' || req.session.revoked) {
        await sessionAction(req, 'destroy');
        res.clearCookie(config.cookieName, cookieOptions(config));
        if (user) throw forbidden();
        throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required');
      }
      req.user = userDto(user);
      next();
    } catch (error) { next(error); }
  };
}
