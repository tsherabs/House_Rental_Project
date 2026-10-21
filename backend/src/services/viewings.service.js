import { transaction } from '../db/pool.js';
import { PUBLIC_PROPERTY } from '../db/queries.js';
import { pagination } from '../middleware/validate.js';
import { ApiError, notFound, conflict } from '../utils/errors.js';

const select = `SELECT v.*, p.title AS property_title, p.owner_id
  FROM viewing_requests v JOIN properties p ON p.id=v.property_id`;
export const viewingDto = (v) => ({
  id: v.id, propertyId: v.property_id, propertyTitle: v.property_title,
  seekerId: v.seeker_id, proposedAt: v.proposed_at, message: v.message,
  status: v.status, createdAt: v.created_at, updatedAt: v.updated_at,
});
const historyDto = (h) => ({
  id: h.id, viewingId: h.viewing_id, oldStatus: h.old_status, newStatus: h.new_status,
  changedBy: h.changed_by, changedAt: h.changed_at,
});
const history = (db, id, oldStatus, newStatus, actor) =>
  db.query(`INSERT INTO viewing_status_history(viewing_id,old_status,new_status,changed_by)
    VALUES($1,$2,$3,$4)`, [id, oldStatus, newStatus, actor]);

export function viewingsService(pool) {
  return {
    create(seekerId, body) {
      return transaction(pool, async (db) => {
        // Serialize with M3's availability/archive mutations, then recheck public eligibility.
        const { rows: [property] } = await db.query(`SELECT p.id,p.title,p.owner_id
          FROM properties p JOIN users u ON u.id=p.owner_id
          WHERE p.id=$1 AND ${PUBLIC_PROPERTY} FOR UPDATE OF p FOR SHARE OF u`, [body.propertyId]);
        if (!property || property.owner_id === seekerId) throw notFound();
        if (Date.parse(body.proposedAt) <= Date.now())
          throw new ApiError(400, 'VALIDATION_ERROR', 'The viewing time must be in the future');
        const { rows: [row] } = await db.query(`INSERT INTO viewing_requests(property_id,seeker_id,proposed_at,message)
          VALUES($1,$2,$3,$4) RETURNING *`, [body.propertyId, seekerId, body.proposedAt, body.message ?? null]);
        await history(db, row.id, null, 'pending', seekerId);
        return viewingDto({ ...row, property_title: property.title });
      });
    },
    list(user, { page, limit }) {
      return transaction(pool, async (db) => {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const where = user.role === 'landlord' ? 'p.owner_id=$1' : 'v.seeker_id=$1';
        const from = `FROM viewing_requests v JOIN properties p ON p.id=v.property_id WHERE ${where}`;
        const { rows: [count] } = await db.query(`SELECT count(*)::int AS total ${from}`, [user.id]);
        const { rows } = await db.query(`${select} WHERE ${where} ORDER BY v.created_at DESC,v.id DESC LIMIT $2 OFFSET $3`,
          [user.id, limit, (page - 1) * limit]);
        return { data: rows.map(viewingDto), pagination: pagination(page, limit, count.total) };
      });
    },
    detail(id, user) {
      return transaction(pool, async (db) => {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const where = user.role === 'landlord' ? 'p.owner_id=$2' : 'v.seeker_id=$2';
        const { rows: [row] } = await db.query(`${select} WHERE v.id=$1 AND ${where}`, [id, user.id]);
        if (!row) throw notFound();
        const { rows } = await db.query('SELECT * FROM viewing_status_history WHERE viewing_id=$1 ORDER BY changed_at,id', [id]);
        return { viewing: viewingDto(row), history: rows.map(historyDto) };
      });
    },
    transition(id, user, status) {
      return transaction(pool, async (db) => {
        const where = user.role === 'landlord' ? 'p.owner_id=$2' : 'v.seeker_id=$2';
        const { rows: [row] } = await db.query(`${select} WHERE v.id=$1 AND ${where} FOR UPDATE OF v`, [id, user.id]);
        if (!row) throw notFound();
        const allowed = status === 'cancelled' ? ['pending', 'accepted'] : ['pending'];
        if (!allowed.includes(row.status)) throw conflict('This viewing can no longer make that status transition');
        const { rows: [updated] } = await db.query('UPDATE viewing_requests SET status=$2,updated_at=now() WHERE id=$1 RETURNING *', [id, status]);
        await history(db, id, row.status, status, user.id);
        return viewingDto({ ...updated, property_title: row.property_title });
      });
    },
  };
}
