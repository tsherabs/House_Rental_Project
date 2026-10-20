import { transaction } from '../db/pool.js';
import { userColumns, userDto } from './auth.service.js';
import { pagination } from '../middleware/validate.js';
import { conflict, notFound } from '../utils/errors.js';
export function usersService(pool) {
  return {
    async list({ role, accountStatus, page, limit }) {
      const values = [], filters = [];
      if (role) { values.push(role); filters.push(`role=$${values.length}`); }
      if (accountStatus) { values.push(accountStatus); filters.push(`account_status=$${values.length}`); }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      return transaction(pool, async (db) => {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const { rows: [count] } = await db.query(`SELECT count(*)::int AS total FROM users ${where}`, values);
        const { rows } = await db.query(`SELECT ${userColumns} FROM users ${where} ORDER BY created_at DESC,id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, (page - 1) * limit]);
        return { data: rows.map(userDto), pagination: pagination(page, limit, count.total) };
      });
    },
    async status(id, actorId, { accountStatus, reason }) {
      if (id === actorId && accountStatus === 'suspended') throw conflict('Administrators cannot suspend their own account');
      return transaction(pool, async (db) => {
        const { rows: [before] } = await db.query('SELECT account_status FROM users WHERE id=$1 FOR UPDATE', [id]);
        if (!before) throw notFound();
        if (before.account_status === accountStatus) throw conflict('Account already has this status');
        const { rows: [user] } = await db.query(`UPDATE users SET account_status=$2,updated_at=now() WHERE id=$1 RETURNING ${userColumns}`, [id, accountStatus]);
        await db.query('INSERT INTO account_status_history(user_id,old_status,new_status,changed_by,reason) VALUES($1,$2,$3,$4,$5)', [id, before.account_status, accountStatus, actorId, reason]);
        if (accountStatus === 'suspended') {
          // Mark all current sessions revoked, including unused sessions that
          // would otherwise become valid again after reactivation.
          await db.query(`UPDATE session SET sess=(sess::jsonb || '{"revoked":true}'::jsonb)::json WHERE sess->>'userId'=$1`, [id]);
        }
        return userDto(user);
      });
    },
  };
}
