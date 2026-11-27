require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

// A pool keeps a few database connections open and reuses them,
// which is faster than opening a new connection for every request.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Without this, a dropped idle connection (for example when PostgreSQL
// restarts) would crash the whole server
pool.on('error', (error) => {
  console.error('Database connection error:', error.message);
});

module.exports = pool;
