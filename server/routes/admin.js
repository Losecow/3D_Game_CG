const express = require('express');
const { sql } = require('../db');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*)              FROM users)  AS total_users,
        (SELECT COUNT(*)              FROM scores) AS total_games,
        (SELECT ROUND(AVG(score))     FROM scores) AS avg_score,
        (SELECT MAX(score)            FROM scores) AS max_score,
        (SELECT COALESCE(SUM(watermelons), 0) FROM scores) AS total_watermelons
    `;
    res.json(stats);
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users', adminAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT
        u.id,
        COALESCE(u.nickname, u.name) AS name,
        u.email,
        u.picture,
        u.total_watermelons,
        u.created_at,
        MAX(s.score)  AS best_score,
        COUNT(s.id)   AS game_count
      FROM users u
      LEFT JOIN scores s ON s.user_id = u.id
      GROUP BY u.id
      ORDER BY best_score DESC NULLS LAST
    `;
    res.json(rows);
  } catch (err) {
    console.error('Admin users error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/scores', adminAuth, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0,  0);
    const rows = await sql`
      SELECT
        s.id,
        COALESCE(u.nickname, u.name) AS name,
        u.picture,
        s.score,
        s.watermelons,
        s.created_at
      FROM scores s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    res.json(rows);
  } catch (err) {
    console.error('Admin scores error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/feedback', adminAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT
        f.id,
        COALESCE(u.nickname, u.name) AS name,
        u.picture,
        f.content,
        f.created_at
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
    `;
    res.json(rows);
  } catch (err) {
    console.error('Admin feedback error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// 어드민 계정 is_admin 세팅 + 수박 충전
router.post('/setup-admin', adminAuth, async (req, res) => {
  try {
    const amount = parseInt(req.query.amount) || 9999;
    const [user] = await sql`
      UPDATE users
      SET is_admin = TRUE, total_watermelons = ${amount}
      WHERE id = ${req.userId}
      RETURNING total_watermelons
    `;
    res.json({ ok: true, total_watermelons: user.total_watermelons });
  } catch (err) {
    console.error('Admin setup error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
