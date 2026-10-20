import { transaction } from '../db/pool.js';
import { PUBLIC_PROPERTY, propertySelect, propertyFields } from '../db/queries.js';
import { notFound, conflict } from '../utils/errors.js';
import { pagination } from '../middleware/validate.js';
export function propertyDto(p, images = []) {
  return { id: p.id, ownerId: p.owner_id, title: p.title, description: p.description,
    monthlyRent: p.monthly_rent, deposit: p.deposit, bedrooms: p.bedrooms,
    neighbourhood: p.neighbourhood, landmarks: p.landmarks, waterAvailable: p.water_available,
    parkingAvailable: p.parking_available, moveInDate: p.move_in_date,
    availabilityStatus: p.availability_status, visibilityStatus: p.visibility_status,
    confirmedAt: p.confirmed_at, expiresAt: p.expires_at, images,
    createdAt: p.created_at, updatedAt: p.updated_at };
}
// One batched image query per page, not one query per property.
async function withImages(db, rows) {
  if (!rows.length) return [];
  const { rows: images } = await db.query('SELECT id, property_id, display_order FROM property_images WHERE property_id=ANY($1::uuid[]) ORDER BY display_order,id', [rows.map((p) => p.id)]);
  const grouped = new Map();
  for (const i of images) {
    if (!grouped.has(i.property_id)) grouped.set(i.property_id, []);
    grouped.get(i.property_id).push({ id: i.id, url: `/api/v1/property-images/${i.id}`, displayOrder: i.display_order });
  }
  return rows.map((p) => propertyDto(p, grouped.get(p.id) ?? []));
}
export async function lockOwnedProperty(db, id, ownerId, { allowArchived = false } = {}) {
  const { rows: [property] } = await db.query('SELECT * FROM properties WHERE id=$1 AND owner_id=$2 FOR UPDATE', [id, ownerId]);
  if (!property) throw notFound();
  if (!allowArchived && property.visibility_status === 'archived') throw conflict('Archived listings cannot be changed');
  return property;
}
export function propertiesService(pool) {
  const get = async (id, ownerId, db = pool) => {
    const values = [id];
    const where = ownerId ? 'p.owner_id=$2' : PUBLIC_PROPERTY;
    if (ownerId) values.push(ownerId);
    const { rows } = await db.query(`${propertySelect} WHERE p.id=$1 AND ${where}`, values);
    if (!rows.length) throw notFound();
    return (await withImages(db, rows))[0];
  };
  const edit = (id, ownerId, work) => transaction(pool, async (db) => {
    await lockOwnedProperty(db, id, ownerId);
    await work(db);
    return get(id, ownerId, db);
  });
  return {
    get,
    async list(query, ownerId) {
      const { page, limit, sort = 'recent' } = query;
      const values = [];
      const clauses = [];
      const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
      if (ownerId) add('p.owner_id=?', ownerId); else clauses.push(PUBLIC_PROPERTY);
      if (query.minRent !== undefined) add('p.monthly_rent>=?', query.minRent);
      if (query.maxRent !== undefined) add('p.monthly_rent<=?', query.maxRent);
      if (query.bedrooms !== undefined) add('p.bedrooms=?', query.bedrooms);
      if (query.neighbourhood !== undefined) add("p.neighbourhood ILIKE ? ESCAPE '\\'", `%${query.neighbourhood.replace(/[\\%_]/g, '\\$&')}%`);
      if (query.waterAvailable !== undefined) add('p.water_available=?', query.waterAvailable);
      if (query.parkingAvailable !== undefined) add('p.parking_available=?', query.parkingAvailable);
      if (query.availableFrom !== undefined) add('p.move_in_date<=?', query.availableFrom);
      const order = { recent: 'p.created_at DESC,p.id DESC', rent_asc: 'p.monthly_rent ASC,p.id ASC', rent_desc: 'p.monthly_rent DESC,p.id DESC' }[sort];
      return transaction(pool, async (db) => {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const filter = `FROM properties p JOIN users u ON u.id=p.owner_id WHERE ${clauses.join(' AND ')}`;
        const { rows: [count] } = await db.query(`SELECT count(*)::int AS total ${filter}`, values);
        const { rows } = await db.query(`SELECT p.* ${filter} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, (page - 1) * limit]);
        return { data: await withImages(db, rows), pagination: pagination(page, limit, count.total) };
      });
    },
    async create(ownerId, body) {
      return transaction(pool, async (db) => {
        const entries = Object.entries(propertyFields).filter(([key]) => body[key] !== undefined);
        const columns = entries.map(([, column]) => column);
        const values = entries.map(([key]) => body[key]);
        const placeholders = values.map((_, index) => `$${index + 2}`);
        const { rows: [row] } = await db.query(`INSERT INTO properties(owner_id,${columns.join(',')}) VALUES($1,${placeholders.join(',')}) RETURNING id`, [ownerId, ...values]);
        return get(row.id, ownerId, db);
      });
    },
    update(id, ownerId, body) {
      return edit(id, ownerId, (db) => {
        const entries = Object.entries(propertyFields).filter(([key]) => body[key] !== undefined);
        const assignments = entries.map(([, column], index) => `${column}=$${index + 2}`);
        return db.query(`UPDATE properties SET ${assignments.join(',')},updated_at=now() WHERE id=$1`, [id, ...entries.map(([key]) => body[key])]);
      });
    },
    availability(id, ownerId, status) {
      return edit(id, ownerId, (db) => db.query('UPDATE properties SET availability_status=$2,updated_at=now() WHERE id=$1', [id, status]));
    },
    archive(id, ownerId) {
      return transaction(pool, async (db) => {
        await lockOwnedProperty(db, id, ownerId, { allowArchived: true });
        await db.query("UPDATE properties SET visibility_status='archived',updated_at=now() WHERE id=$1", [id]);
      });
    },
  };
}
