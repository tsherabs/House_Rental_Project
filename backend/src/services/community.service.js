import { transaction } from '../db/pool.js';
import { PUBLIC_PROPERTY } from '../db/queries.js';
import { pagination } from '../middleware/validate.js';
import { propertiesService, lockOwnedProperty } from './properties.service.js';
import { notFound, conflict } from '../utils/errors.js';
import { notify } from './notifications.service.js';

const favouriteDto = (f) => ({ propertyId: f.property_id, createdAt: f.created_at });
const reportDto = (r) => ({
  id: r.id, propertyId: r.property_id, reporterId: r.reporter_id, reason: r.reason,
  reviewStatus: r.review_status, reviewedBy: r.reviewed_by, reviewReason: r.review_reason,
  reviewedAt: r.reviewed_at, createdAt: r.created_at,
});
async function mapSequential(rows, map) {
  const result = [];
  for (const row of rows) result.push(await map(row));
  return result;
}
// Every count + page uses a consistent snapshot. SQL fragments are internal constants.
async function pageRows(pool, query, from, values, select, order, map) {
  return transaction(pool, async (db) => {
    await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: [count] } = await db.query(`SELECT count(*)::int AS total ${from}`, values);
    const { rows } = await db.query(`SELECT ${select} ${from} ORDER BY ${order}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, query.limit, (query.page - 1) * query.limit]);
    return { data: await map(rows, db), pagination: pagination(query.page, query.limit, count.total) };
  });
}
async function lockPublic(db, id) {
  const { rows: [property] } = await db.query(`SELECT p.id FROM properties p JOIN users u ON u.id=p.owner_id
    WHERE p.id=$1 AND ${PUBLIC_PROPERTY} FOR UPDATE OF p FOR SHARE OF u`, [id]);
  if (!property) throw notFound();
}
export function communityService(pool) {
  const properties = propertiesService(pool);
  return {
    favourites(userId, query) {
      return pageRows(pool, query, `FROM favourites f JOIN properties p ON p.id=f.property_id
        JOIN users u ON u.id=p.owner_id WHERE f.user_id=$1`, [userId],
      `f.*, (${PUBLIC_PROPERTY}) AS available`, 'f.created_at DESC,f.property_id DESC',
      async (rows, db) => mapSequential(rows, async (f) => ({
        ...favouriteDto(f), available: f.available,
        property: f.available ? await properties.get(f.property_id, undefined, db) : null,
      })));
    },
    save(userId, propertyId) {
      return transaction(pool, async (db) => {
        // A previously saved unavailable listing still yields its idempotent result.
        const { rows: [existing] } = await db.query('SELECT * FROM favourites WHERE user_id=$1 AND property_id=$2', [userId, propertyId]);
        if (existing) return { created: false, favourite: favouriteDto(existing) };
        await lockPublic(db, propertyId);
        const { rows: [row] } = await db.query(`INSERT INTO favourites(user_id,property_id) VALUES($1,$2)
          ON CONFLICT DO NOTHING RETURNING *`, [userId, propertyId]);
        const saved = row ?? (await db.query('SELECT * FROM favourites WHERE user_id=$1 AND property_id=$2', [userId, propertyId])).rows[0];
        return { created: Boolean(row), favourite: favouriteDto(saved) };
      });
    },
    async remove(userId, propertyId) {
      await pool.query('DELETE FROM favourites WHERE user_id=$1 AND property_id=$2', [userId, propertyId]);
    },
    report(userId, { propertyId, reason }) {
      return transaction(pool, async (db) => {
        await lockPublic(db, propertyId);
        const { rows: [row] } = await db.query(`INSERT INTO listing_reports(property_id,reporter_id,reason)
          VALUES($1,$2,$3) ON CONFLICT (reporter_id,property_id) WHERE review_status='pending' DO NOTHING RETURNING *`,
        [propertyId, userId, reason]);
        if (!row) throw conflict('You already have a pending report for this listing');
        return reportDto(row);
      });
    },
    reports(query) {
      return pageRows(pool, query, `FROM listing_reports r JOIN properties p ON p.id=r.property_id${query.reviewStatus ? ' WHERE r.review_status=$1' : ''}`,
        query.reviewStatus ? [query.reviewStatus] : [], 'r.*,p.title AS property_title,p.visibility_status', 'r.created_at DESC,r.id DESC',
        async (rows) => rows.map((r) => ({ ...reportDto(r), propertyTitle: r.property_title, visibilityStatus: r.visibility_status })));
    },
    review(id, userId, { reviewStatus, reviewReason }) {
      return transaction(pool, async (db) => {
        const { rows: [row] } = await db.query('SELECT * FROM listing_reports WHERE id=$1 FOR UPDATE', [id]);
        if (!row) throw notFound();
        if (row.review_status !== 'pending') throw conflict('This report has already been reviewed');
        const { rows: [updated] } = await db.query(`UPDATE listing_reports SET review_status=$2,review_reason=$3,
          reviewed_by=$4,reviewed_at=now() WHERE id=$1 RETURNING *`, [id, reviewStatus, reviewReason, userId]);
        await notify(db, row.reporter_id, 'report_reviewed', 'Your listing report was reviewed', `An administrator marked your report ${reviewStatus}. Thank you for helping keep listings accurate.`, '/properties');
        return reportDto(updated);
      });
    },
    visibility(id, userId, { visibilityStatus, reason }) {
      return transaction(pool, async (db) => {
        const { rows: [row] } = await db.query('SELECT * FROM properties WHERE id=$1 FOR UPDATE', [id]);
        if (!row) throw notFound();
        if (row.visibility_status === 'archived') throw conflict('Archived listings cannot be moderated');
        if (row.visibility_status === visibilityStatus) throw conflict('This listing already has that visibility');
        await db.query('UPDATE properties SET visibility_status=$2,updated_at=now() WHERE id=$1', [id, visibilityStatus]);
        await db.query(`INSERT INTO property_visibility_history(property_id,old_status,new_status,changed_by,reason)
          VALUES($1,$2,$3,$4,$5)`, [id, row.visibility_status, visibilityStatus, userId, reason]);
        await notify(db, row.owner_id, 'listing_moderated', 'Listing visibility updated', `An administrator changed a listing to ${visibilityStatus}. Review your properties for its current status.`, '/my-properties');
        return properties.get(id, row.owner_id, db);
      });
    },
    confirm(id, ownerId) {
      return transaction(pool, async (db) => {
        await lockOwnedProperty(db, id, ownerId);
        await db.query("UPDATE properties SET confirmed_at=now(),expires_at=now()+interval '30 days',updated_at=now() WHERE id=$1", [id]);
        return properties.get(id, ownerId, db);
      });
    },
    expiring(ownerId, query) {
      return pageRows(pool, query, `FROM properties p WHERE p.owner_id=$1 AND p.visibility_status<>'archived'
        AND (p.expires_at IS NULL OR p.expires_at<=now()+interval '7 days')`, [ownerId], 'p.id',
      'p.expires_at ASC NULLS FIRST,p.id', async (rows, db) => mapSequential(rows, (r) => properties.get(r.id, ownerId, db)));
    },
  };
}
