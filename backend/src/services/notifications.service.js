import { transaction } from '../db/pool.js';
import { pagination } from '../middleware/validate.js';
import { notFound } from '../utils/errors.js';

// Always called on the domain transaction client: failed notifications roll back the event.
export async function notify(db, userId, kind, title, message, link) {
  await db.query(`INSERT INTO notifications(user_id,kind,title,message,link) VALUES($1,$2,$3,$4,$5)`,
    [userId, kind, title, message, link]);
}
export const notificationDto = (r) => ({ id: r.id, kind: r.kind, title: r.title, message: r.message,
  link: r.link, createdAt: r.created_at, readAt: r.read_at });
export function notificationsService(pool) {
  return {
    list(userId, { page, limit, unreadOnly }) {
      return transaction(pool, async (db) => {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const filter = `user_id=$1${unreadOnly ? ' AND read_at IS NULL' : ''}`;
        const { rows: [count] } = await db.query(`SELECT count(*)::int AS total FROM notifications WHERE ${filter}`, [userId]);
        const { rows: [unread] } = await db.query('SELECT count(*)::int AS total FROM notifications WHERE user_id=$1 AND read_at IS NULL', [userId]);
        const { rows } = await db.query(`SELECT * FROM notifications WHERE ${filter} ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, [userId, limit, (page - 1) * limit]);
        return { data: rows.map(notificationDto), pagination: pagination(page, limit, count.total), unreadCount: unread.total };
      });
    },
    async read(userId, id) {
      const { rows: [row] } = await pool.query('UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING *', [id, userId]);
      if (!row) throw notFound();
      return notificationDto(row);
    },
  };
}
