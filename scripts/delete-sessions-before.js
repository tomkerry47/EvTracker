#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const cutoff = process.argv[2] || '2026-02-16';
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(cutoff);
  if (!validDate) {
    console.error('Invalid date format. Use YYYY-MM-DD, e.g. 2026-02-16');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM charging_sessions WHERE date < $1',
      [cutoff]
    );
    const toDelete = countResult.rows[0].count;

    const deleteResult = await pool.query(
      'DELETE FROM charging_sessions WHERE date < $1',
      [cutoff]
    );

    console.log(`Deleted ${deleteResult.rowCount} session(s) with date before ${cutoff} (found ${toDelete}).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Delete failed:', error.message);
  process.exit(1);
});
