import pg from 'pg';

// DATE stays a date-only string, independent of host timezone. NUMERIC stays text.
pg.types.setTypeParser(1082, (value) => value);
export function createPool(connectionString, options = {}) {
  return new pg.Pool({ connectionString, max: 10, ...options });
}

export async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
