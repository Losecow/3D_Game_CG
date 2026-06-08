const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      google_id  VARCHAR(255) UNIQUE NOT NULL,
      email      VARCHAR(255) NOT NULL,
      name       VARCHAR(255),
      nickname   VARCHAR(20),
      picture    VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // 기존 DB에 nickname 컬럼 없으면 추가
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(20)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_watermelons INTEGER DEFAULT 0`;
  await sql`ALTER TABLE scores ADD COLUMN IF NOT EXISTS watermelons INTEGER DEFAULT 0`;
  await sql`
    CREATE TABLE IF NOT EXISTS shop_purchases (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      item_id    VARCHAR(50) NOT NULL,
      cost       INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
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
