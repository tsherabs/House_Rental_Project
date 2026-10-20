import { sessionAction, cookieOptions } from '../middleware/auth.js';
export function authController(service, config) {
  return {
    register: async (req, res) => res.status(201).json({ user: await service.register(req.validated.body) }),
    login: async (req, res) => {
      const user = await service.login(req.validated.body);
      await sessionAction(req, 'regenerate');
      req.session.userId = user.id;
      await sessionAction(req, 'save');
      res.json({ user });
    },
    logout: async (req, res) => {
      await sessionAction(req, 'destroy');
      res.clearCookie(config.cookieName, cookieOptions(config));
      res.sendStatus(204);
    },
    me: (req, res) => res.json({ user: req.user }),
  };
}
