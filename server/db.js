const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      google_id  VARCHAR(255) UNIQUE NOT NULL,
      email      VARCHAR(255) NOT NULL,
      name       VARCHAR(255),
      picture    VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS scores (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      score      INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

module.exports = { sql, initDB };
