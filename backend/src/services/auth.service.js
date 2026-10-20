import bcrypt from 'bcrypt';
import { ApiError, conflict, forbidden } from '../utils/errors.js';
export const userColumns = 'id, name, email, role, account_status, created_at';
export const userDto = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, accountStatus: u.account_status, createdAt: u.created_at });
export function authService(pool, config) {
  const dummyHash = bcrypt.hash('dummy-password-never-used', config.bcryptCost);
  return {
    async register({ name, email, password, role }) {
      const hash = await bcrypt.hash(password, config.bcryptCost);
      try {
        const { rows } = await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING ${userColumns}`, [name, email, hash, role]);
        return userDto(rows[0]);
      } catch (error) {
        if (error.code === '23505') throw conflict('An account with this email already exists');
        throw error;
      }
    },
    async login({ email, password }) {
      const { rows: [user] } = await pool.query('SELECT * FROM users WHERE lower(email)=$1', [email]);
      const valid = await bcrypt.compare(password, user?.password_hash ?? await dummyHash);
      if (!user || !valid) throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid email or password');
      if (user.account_status !== 'active') throw forbidden();
      return userDto(user);
    },
  };
}
