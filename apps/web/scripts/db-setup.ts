/**
 * Create the PostgreSQL database named in DATABASE_URL if it doesn't exist.
 *   pnpm db:setup
 */
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.error('❌ DATABASE_URL is not set');
	process.exit(1);
}

const url = new URL(databaseUrl);
const dbName = url.pathname.slice(1);

if (!dbName) {
	console.error('❌ Could not parse a database name from DATABASE_URL');
	process.exit(1);
}

// Connect to the default 'postgres' database to create ours.
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';

const client = new Client({ connectionString: adminUrl.toString() });

try {
	await client.connect();
	const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
	if (existing.rowCount) {
		console.log(`✅ Database "${dbName}" already exists`);
	} else {
		await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
		console.log(`✅ Created database "${dbName}"`);
	}
} finally {
	await client.end();
}
