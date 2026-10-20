import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createPool } from './db/pool.js';
const config = readConfig();
const pool = createPool(config.databaseUrl);
await pool.query('SELECT 1 FROM schema_migrations LIMIT 1');
const app = createApp({ pool, config });
const server = app.listen(config.port, () => console.log(`API listening on port ${config.port}`));
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.close(async () => { app.locals.sessionStore.close(); await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
