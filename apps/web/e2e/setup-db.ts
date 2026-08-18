#!/usr/bin/env tsx
/**
 * Rebuild the E2E SQLite database before Playwright starts its web server.
 * Invoked by `pnpm test:e2e`.
 */
import { E2E_DB_PATH, setupE2EDatabase, teardownE2EDatabase } from './db-setup';

console.log('🔧 Setting up E2E test database…');
console.log(`   ${E2E_DB_PATH}`);

await teardownE2EDatabase();
await setupE2EDatabase();
