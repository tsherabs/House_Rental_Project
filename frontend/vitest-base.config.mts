import { defineConfig } from 'vitest/config';

// Keep test workers bounded on development laptops running PostgreSQL and Docker.
export default defineConfig({ test: { maxWorkers: 2 } });
