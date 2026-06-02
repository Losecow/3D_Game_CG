const express = require('express');
const { sql } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/leaderboard', async (req, res) => {
  try {
    const rows = await sql`
      SELECT u.name, u.picture, MAX(s.score) AS score
      FROM scores s
      JOIN users u ON s.user_id = u.id
      GROUP BY u.id, u.name, u.picture
      ORDER BY score DESC
      LIMIT 10
    `;
    res.json(rows);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/scores', authMiddleware, async (req, res) => {
  try {
    const { score } = req.body;
    if (!Number.isInteger(score) || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }
    await sql`INSERT INTO scores (user_id, score) VALUES (${req.userId}, ${score})`;
    res.json({ ok: true });
  } catch (err) {
    console.error('Score submit error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
